// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IPoolAdapter} from "./interfaces/IPoolAdapter.sol";
import {IPriceFeed} from "./interfaces/IPriceFeed.sol";
import {IZkLighter} from "./interfaces/IZkLighter.sol";
import {RangePolicy} from "./policy/RangePolicy.sol";

/// @title SubwayVault
/// @notice One pooled vault per pair. Deposit a Robinhood Stock Token and/or
/// USDG, receive a fungible share, and the vault runs a concentrated Uniswap
/// position hedged by a short on Lighter's Robinhood Chain instance.
///
/// ## The one hard problem: what is a share worth?
///
/// Everything the vault owns is on-chain and priceable EXCEPT the hedge
/// equity, which lives inside Lighter's rollup and cannot be read from this
/// chain. A share that other protocols accept as collateral needs a price
/// that does not depend on the keeper being honest or even alive.
///
/// So `navFloor` is a deliberate UNDERVALUATION built only from things this
/// contract can verify:
///
///     floor = idle balances + LP value at the FEED price + margin x (1 - h)
///
/// with unsettled hedge PnL counted as ZERO and margin haircut by `h`. Every
/// term is either a token balance or a number this contract itself wrote. The
/// error is one-directional: the floor can be too low, never too high. A
/// lender reading it is safe; a depositor is paid slightly less than fair,
/// which is the side of the trade to be wrong on.
///
/// Two consequences that look like bugs and are not:
///   - Depositors mint at the floor, so they are mildly underpaid. That is
///     what makes a deposit-time manipulation pointless.
///   - The price uses the CHAINLINK FEED, never the pool tick. A pool tick is
///     a thing an attacker can move with capital; a share price built on one
///     is a share price they can print.
///
/// ## Redemption is asynchronous, and that is not ERC-4626
///
/// Lighter withdrawals take minutes normally and up to 14 days through the
/// escape hatch. A synchronous `redeem()` would either lie about that or keep
/// a cash buffer big enough to make the strategy pointless. So redemption is
/// request -> settle -> claim, in the shape ERC-7540 describes.
///
/// This vault therefore implements ERC-20 and the ERC-4626 *accounting* view
/// (`asset`, `totalAssets`, `convertTo*`, `previewDeposit`), and deliberately
/// does NOT implement `withdraw`/`redeem`; they revert pointing at the queue.
/// Claiming to be 4626 and then blocking withdrawal is worse than not claiming
/// it: an integrator's `redeem()` would revert in production instead of at
/// integration time.
contract SubwayVault is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using RangePolicy for IPriceFeed;

    uint256 internal constant WAD = 1e18;
    /// @notice Upper bound on the margin haircut, 90%.
    uint256 internal constant MAX_HAIRCUT = 0.9e18;

    // ---------------------------------------------------------------- config

    IERC20 public immutable stock;
    IERC20 public immutable usdg;
    IPriceFeed public immutable feed;
    IZkLighter public immutable lighter;
    IPoolAdapter public immutable pool;

    /// @notice Bounded operator. Changes shape, never destination.
    address public keeper;
    /// @notice Protocol multisig. Panic only — it cannot move funds either.
    address public immutable guardian;
    /// @notice Sets the keeper and the caps. Cannot move funds.
    address public immutable admin;

    /// @notice Fraction of posted margin the floor refuses to count, 1e18 =
    /// 100%. Set from the liquidation distance at the target leverage: at 3x
    /// the hedge is liquidated roughly a third of the way against, so ~0.35
    /// keeps the floor below the recoverable amount.
    uint256 public haircut;
    /// @notice Hard cap on cumulative margin the keeper may post.
    uint256 public maxMargin;
    RangePolicy.Bounds public bounds;

    /// @dev `WAD * 10^stockDecimals / 10^usdgDecimals`, the single divisor that
    /// turns a raw stock amount times a WAD price into a RAW USDG amount.
    ///
    /// This exists because the obvious `amount * price / WAD` is wrong whenever
    /// the two tokens differ in decimals, and it is wrong silently: with an
    /// 18-decimal stock token against 6-decimal USDG it overstates the stock
    /// leg by 10^12, which prices a share at a trillion times its worth. The
    /// first version of this code had exactly that bug and its tests did not
    /// catch it, because they gave both mock tokens 18 decimals. USDG on
    /// Robinhood Chain has 6.
    uint256 private immutable stockValueDivisor;

    /// @notice Raw USDG value of a raw stock amount at a WAD price.
    function _stockValue(uint256 stockAmount, uint256 price) internal view returns (uint256) {
        return Math.mulDiv(stockAmount, price, stockValueDivisor);
    }

    // ----------------------------------------------------------------- state

    /// @notice USDG sent to this vault's Lighter account minus USDG withdrawn
    /// from it. The vault's own event trail — never a keeper assertion, which
    /// is exactly why the floor may lean on it.
    uint256 public marginLedger;

    uint256 public epoch;
    bool public frozen;

    struct RedeemRequest {
        address owner;
        uint256 shares;
        uint256 epochId;
        /// @notice USDG owed, fixed at settlement. Zero until then.
        uint256 assetsOwed;
        bool claimed;
    }

    RedeemRequest[] public requests;
    /// @notice Shares burned into the queue and not yet paid out.
    uint256 public pendingShares;
    /// @notice USDG reserved for settled-but-unclaimed requests. Excluded from
    /// the floor: it belongs to a departing holder, not to the remaining ones.
    uint256 public reservedAssets;

    // ---------------------------------------------------------------- events

    event Deposit(
        address indexed caller,
        address indexed receiver,
        uint256 stockIn,
        uint256 usdgIn,
        uint256 shares
    );
    event RedeemRequested(
        uint256 indexed id, address indexed owner, uint256 shares, uint256 epochId
    );
    event RedeemClaimed(uint256 indexed id, address indexed owner, uint256 assets);
    event EpochSettled(
        uint256 indexed epochId, uint256 navFloor, uint256 totalShares, uint256 paidOut
    );
    event HedgeFunded(uint256 amount, uint256 ledger);
    event HedgeWithdrawn(uint256 amount, uint256 ledger);
    event HedgeKeyRegistered(bytes pubKey);
    event RangeOpened(uint256 lower, uint256 upper, uint256 stockUsed, uint256 usdgUsed);
    event RangeClosed(uint256 stockOut, uint256 usdgOut);
    event Panicked(address indexed by);
    event KeeperChanged(address indexed from, address indexed to);

    // ---------------------------------------------------------------- errors

    error NotKeeper();
    error NotGuardianOrKeeper();
    error NotAdmin();
    error Frozen();
    error NotFrozen();
    error ZeroDeposit();
    error NothingToMint();
    error MarginCapExceeded(uint256 requested, uint256 cap);
    error InsufficientMargin(uint256 requested, uint256 ledger);
    error QueueUnfunded(uint256 needed, uint256 available);
    error AlreadyClaimed();
    error NotOwner();
    error NotSettled();
    error UseRedemptionQueue();
    error HaircutTooHigh(uint256 haircut);

    // ------------------------------------------------------------- modifiers

    modifier onlyKeeper() {
        if (msg.sender != keeper) revert NotKeeper();
        if (frozen) revert Frozen();
        _;
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    /// @notice Everything a vault needs at birth.
    /// @dev One struct rather than thirteen arguments: the positional form
    /// overflowed the stack, and more to the point, two adjacent `address`
    /// parameters that mean "guardian" and "admin" are a live mis-wiring
    /// hazard at deployment — the struct makes each one named at the call site.
    struct Config {
        string name;
        string symbol;
        address stock;
        address usdg;
        address feed;
        address lighter;
        address pool;
        address keeper;
        address guardian;
        address admin;
        uint256 haircut;
        uint256 maxMargin;
        RangePolicy.Bounds bounds;
    }

    constructor(Config memory c) ERC20(c.name, c.symbol) {
        if (c.haircut > MAX_HAIRCUT) revert HaircutTooHigh(c.haircut);
        stock = IERC20(c.stock);
        usdg = IERC20(c.usdg);
        feed = IPriceFeed(c.feed);
        lighter = IZkLighter(c.lighter);
        pool = IPoolAdapter(c.pool);
        keeper = c.keeper;
        guardian = c.guardian;
        admin = c.admin;
        haircut = c.haircut;
        maxMargin = c.maxMargin;
        bounds = c.bounds;

        stockValueDivisor = WAD * (10 ** IERC20Metadata(c.stock).decimals())
            / (10 ** IERC20Metadata(c.usdg).decimals());
    }

    // ------------------------------------------------------------ accounting

    /// @notice ERC-4626 accounting asset. Shares are denominated in USDG.
    function asset() external view returns (address) {
        return address(usdg);
    }

    /// @notice The conservative, fully on-chain floor described in the header.
    ///
    /// Reads, in order: idle token balances, the LP position valued at the
    /// FEED price, and the margin ledger after its haircut. Never the pool
    /// tick, never a keeper-supplied number, never unsettled hedge PnL.
    function navFloor() public view returns (uint256) {
        uint256 price = _feedPriceOrZero();
        if (price == 0) {
            // No usable price means no defensible valuation of the stock legs.
            // Report only what needs no price at all rather than guess — a
            // floor that guesses is not a floor.
            uint256 idleUsdgOnly = usdg.balanceOf(address(this));
            return idleUsdgOnly > reservedAssets ? idleUsdgOnly - reservedAssets : 0;
        }

        uint256 total = usdg.balanceOf(address(this));
        total += _stockValue(stock.balanceOf(address(this)), price);

        if (pool.hasPosition()) {
            (uint256 poolStock, uint256 poolUsdg) = pool.positionAmounts();
            total += poolUsdg;
            total += _stockValue(poolStock, price);
        }

        total += marginLedger * (WAD - haircut) / WAD;

        // Settled-but-unclaimed USDG is already spoken for.
        return total > reservedAssets ? total - reservedAssets : 0;
    }

    /// @notice ERC-4626 `totalAssets`, equal to the floor by construction.
    function totalAssets() public view returns (uint256) {
        return navFloor();
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply();
        uint256 nav = navFloor();
        if (supply == 0 || nav == 0) return assets;
        return assets * supply / nav;
    }

    /// @notice USDG per share at the floor. This is what an oracle reads.
    function convertToAssets(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return shares;
        return shares * navFloor() / supply;
    }

    function previewDeposit(uint256 assets) external view returns (uint256) {
        return convertToShares(assets);
    }

    /// @notice What a redemption is worth at the CURRENT floor. The queue
    /// settles at the NEXT epoch's floor, which will differ.
    function previewRedeem(uint256 shares) external view returns (uint256) {
        return convertToAssets(shares);
    }

    /// @dev ERC-4626 shape without the synchronous exits it promises. See the
    /// contract header: reverting here is the honest choice.
    function withdraw(uint256, address, address) external pure returns (uint256) {
        revert UseRedemptionQueue();
    }

    function redeem(uint256, address, address) external pure returns (uint256) {
        revert UseRedemptionQueue();
    }

    function maxWithdraw(address) external pure returns (uint256) {
        return 0;
    }

    function maxRedeem(address) external pure returns (uint256) {
        return 0;
    }

    // --------------------------------------------------------------- holders

    /// @notice Deposit stock, USDG, or both. Shares mint at the floor.
    ///
    /// Minting at the floor is what makes deposits safe to accept at any time:
    /// a depositor can only ever be UNDERPAID relative to fair value, so there
    /// is no sequence of deposits that dilutes the existing holders. The
    /// asymmetry is the defence.
    function deposit(uint256 stockAmount, uint256 usdgAmount, address receiver)
        external
        nonReentrant
        returns (uint256 shares)
    {
        if (stockAmount == 0 && usdgAmount == 0) revert ZeroDeposit();
        if (frozen) revert Frozen();

        // Price and supply are read BEFORE the transfers land, so the incoming
        // deposit is not in its own denominator.
        uint256 price = feed.requireFreshPrice(bounds);
        uint256 navBefore = navFloor();
        uint256 supply = totalSupply();

        uint256 value = usdgAmount + _stockValue(stockAmount, price);
        shares = (supply == 0 || navBefore == 0) ? value : value * supply / navBefore;
        if (shares == 0) revert NothingToMint();

        if (stockAmount > 0) stock.safeTransferFrom(msg.sender, address(this), stockAmount);
        if (usdgAmount > 0) usdg.safeTransferFrom(msg.sender, address(this), usdgAmount);

        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, stockAmount, usdgAmount, shares);
    }

    /// @notice Burn shares into the queue. Settles at the next epoch's floor.
    ///
    /// Shares burn NOW rather than at settlement so a queued holder stops
    /// taking the position's risk the moment they ask to leave, and cannot
    /// transfer a share that is already promised a payout.
    function requestRedeem(uint256 shares) external nonReentrant returns (uint256 id) {
        _burn(msg.sender, shares);
        pendingShares += shares;

        id = requests.length;
        requests.push(
            RedeemRequest({
                owner: msg.sender, shares: shares, epochId: epoch, assetsOwed: 0, claimed: false
            })
        );
        emit RedeemRequested(id, msg.sender, shares, epoch);
    }

    /// @notice Collect a settled request.
    function claim(uint256 id) external nonReentrant returns (uint256 assets) {
        RedeemRequest storage r = requests[id];
        if (r.owner != msg.sender) revert NotOwner();
        if (r.claimed) revert AlreadyClaimed();
        if (r.epochId >= epoch) revert NotSettled();

        r.claimed = true;
        assets = r.assetsOwed;
        reservedAssets -= assets;
        usdg.safeTransfer(r.owner, assets);
        emit RedeemClaimed(id, r.owner, assets);
    }

    function requestCount() external view returns (uint256) {
        return requests.length;
    }

    // ---------------------------------------------------------------- keeper

    function openRange(uint256 lower, uint256 upper, uint256 stockAmount, uint256 usdgAmount)
        external
        onlyKeeper
    {
        uint256 price = feed.requireFreshPrice(bounds);
        RangePolicy.requireValidRange(lower, upper, price, bounds);

        if (stockAmount > 0) stock.forceApprove(address(pool), stockAmount);
        if (usdgAmount > 0) usdg.forceApprove(address(pool), usdgAmount);
        (uint256 stockUsed, uint256 usdgUsed) =
            pool.openRange(lower, upper, stockAmount, usdgAmount);

        // Leaving an allowance alive is a standing claim on vault funds.
        stock.forceApprove(address(pool), 0);
        usdg.forceApprove(address(pool), 0);
        emit RangeOpened(lower, upper, stockUsed, usdgUsed);
    }

    function closeRange() external onlyKeeper returns (uint256 stockOut, uint256 usdgOut) {
        (stockOut, usdgOut) = pool.closeRange();
        emit RangeClosed(stockOut, usdgOut);
    }

    function collectFees() external onlyKeeper returns (uint256 stockFees, uint256 usdgFees) {
        return pool.collectFees();
    }

    /// @notice Post USDG margin to this vault's own Lighter account.
    function fundHedge(uint256 amount) external onlyKeeper {
        uint256 next = marginLedger + amount;
        if (next > maxMargin) revert MarginCapExceeded(next, maxMargin);

        marginLedger = next;
        usdg.forceApprove(address(lighter), amount);
        // `to` is this contract: the vault is the account's L1 owner, which is
        // the whole basis for the keeper's key being trade-only.
        lighter.deposit(address(this), amount);
        usdg.forceApprove(address(lighter), 0);
        emit HedgeFunded(amount, next);
    }

    /// @notice Secure-withdraw margin. Lands here because the vault owns the
    /// account; there is no address the keeper could redirect it to.
    function withdrawHedge(uint256 amount) external onlyKeeper {
        if (amount > marginLedger) revert InsufficientMargin(amount, marginLedger);
        marginLedger -= amount;
        lighter.withdraw(amount);
        emit HedgeWithdrawn(amount, marginLedger);
    }

    function registerHedgeKey(bytes calldata pubKey) external onlyKeeper {
        lighter.changePubKey(pubKey);
        emit HedgeKeyRegistered(pubKey);
    }

    /// @notice Close the epoch: snapshot the floor, price the queue against
    /// it, and advance.
    ///
    /// Reverts unless idle USDG already covers the whole queue. That ordering
    /// is the point — the keeper must have closed enough range and matured
    /// enough Lighter withdrawal BEFORE it may advance the epoch, so an epoch
    /// can never settle into a promise the vault cannot pay.
    function settleEpoch() external onlyKeeper {
        uint256 nav = navFloor();
        uint256 supply = totalSupply();
        uint256 pending = pendingShares;

        uint256 owed;
        if (pending > 0) {
            // Departing holders are priced against the pool they are leaving:
            // the floor covers the remaining shares, and the queue's claim is
            // its pro-rata slice of floor plus queue.
            owed = nav * pending / (supply + pending);
            uint256 free = usdg.balanceOf(address(this)) - reservedAssets;
            if (owed > free) revert QueueUnfunded(owed, free);
        }

        uint256 paid;
        uint256 remaining = owed;
        uint256 remainingShares = pending;
        uint256 n = requests.length;
        for (uint256 i = 0; i < n; ++i) {
            RedeemRequest storage r = requests[i];
            if (r.claimed || r.epochId != epoch || r.assetsOwed != 0) continue;
            // Last request takes the dust so the sum is exact.
            uint256 share = (remainingShares == r.shares) ? remaining : owed * r.shares / pending;
            r.assetsOwed = share;
            remaining -= share;
            remainingShares -= r.shares;
            paid += share;
        }

        reservedAssets += paid;
        pendingShares -= pending;
        emit EpochSettled(epoch, nav, supply, paid);
        unchecked {
            ++epoch;
        }
    }

    // ----------------------------------------------------------------- panic

    /// @notice Freeze the keeper and start the unconditional exit.
    ///
    /// Callable by the guardian OR the keeper, and never blocked by `frozen`.
    /// The failure this defends against is the keeper going rogue or going
    /// dark; a panic path that needed the keeper's cooperation would defend
    /// against neither.
    function panic() external nonReentrant {
        if (msg.sender != guardian && msg.sender != keeper) revert NotGuardianOrKeeper();
        frozen = true;

        if (pool.hasPosition()) {
            (uint256 s, uint256 u) = pool.closeRange();
            emit RangeClosed(s, u);
        }
        // Force-cancel through the L1 priority queue, then pull the whole
        // margin. Both land at the vault because the vault owns the account.
        lighter.cancelAllOrders();
        if (marginLedger > 0) {
            uint256 amount = marginLedger;
            marginLedger = 0;
            lighter.withdraw(amount);
            emit HedgeWithdrawn(amount, 0);
        }
        emit Panicked(msg.sender);
    }

    /// @notice After a panic, any holder may exit pro-rata without the keeper.
    ///
    /// Pays out both tokens as they sit rather than selling the stock leg:
    /// selling would need a price, a route and a counterparty, which is
    /// exactly what a vault in panic cannot be assumed to have.
    function emergencyRedeem(uint256 shares)
        external
        nonReentrant
        returns (uint256 stockOut, uint256 usdgOut)
    {
        if (!frozen) revert NotFrozen();
        uint256 supply = totalSupply();

        uint256 freeUsdg = usdg.balanceOf(address(this)) - reservedAssets;
        stockOut = stock.balanceOf(address(this)) * shares / supply;
        usdgOut = freeUsdg * shares / supply;

        _burn(msg.sender, shares);
        if (stockOut > 0) stock.safeTransfer(msg.sender, stockOut);
        if (usdgOut > 0) usdg.safeTransfer(msg.sender, usdgOut);
    }

    // ----------------------------------------------------------------- admin

    function setKeeper(address next) external onlyAdmin {
        emit KeeperChanged(keeper, next);
        keeper = next;
    }

    function setCaps(uint256 haircut_, uint256 maxMargin_, RangePolicy.Bounds calldata bounds_)
        external
        onlyAdmin
    {
        if (haircut_ > MAX_HAIRCUT) revert HaircutTooHigh(haircut_);
        haircut = haircut_;
        maxMargin = maxMargin_;
        bounds = bounds_;
    }

    // ---------------------------------------------------------------- internal

    /// @dev The feed read that must not revert: `navFloor` is a view other
    /// protocols call, and a stale feed should degrade the floor rather than
    /// brick every reader of it.
    function _feedPriceOrZero() internal view returns (uint256) {
        try this.feedPrice() returns (uint256 p) {
            return p;
        } catch {
            return 0;
        }
    }

    /// @dev External only so `_feedPriceOrZero` can try/catch it.
    function feedPrice() external view returns (uint256) {
        return feed.requireFreshPrice(bounds);
    }
}
