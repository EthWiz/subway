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
import {RangePolicy} from "./policy/RangePolicy.sol";

/// @title BaseVault — `xAMC`
/// @notice The unhedged base vault: one per pair, and the ONLY contract in
/// this system that touches Uniswap.
///
/// Holding `xAMC` is equity beta plus fees minus arbitrage loss. It is not
/// dollar-stable and does not pretend to be — the hedged wrapper (`hAMC`) is a
/// separate token that holds this one. Two tokens rather than a per-holder
/// hedge flag, because a flag inside one vault makes its shares
/// non-interchangeable, and fungibility is the entire reason to pool.
///
/// ## Why this one ships first
///
/// It has no keeper trading risk, no rollup dependency, no epoch clock and no
/// redemption queue, and it measures the only number both modes depend on:
/// whether fees on these pools beat what arbitrage takes out. Building the
/// hedge first would have carried all of that through the period in which the
/// strategy was still unproven.
///
/// ## Two properties worth stating plainly
///
/// **1. Redemption needs no oracle.** A redeemer is paid their pro-rata slice
/// of what the vault physically holds: a share of idle balances plus a share
/// of the Uniswap position, taken out as liquidity. Quantities, not prices. So
/// a dead, stale or paused Chainlink feed stops deposits and stops the keeper
/// from moving the range, and does NOT stop anyone leaving. There is no panic
/// path here because there is no state a holder can be trapped in.
///
/// **2. Exits are dual-asset, so this is not a compliant ERC-4626.** A slice
/// of a Uniswap range is stock AND USDG; paying out in one of them would mean
/// swapping, which needs a route, a price and a counterparty at exactly the
/// moment a redeemer should not have to depend on any of them. So `redeem`
/// here returns two amounts, and the ERC-4626 `withdraw`/`redeem` entry points
/// revert pointing at it.
///
/// The ERC-4626 *accounting* view (`asset`, `totalAssets`, `convertTo*`) is
/// implemented and exact, because that is what an oracle or a lending market
/// needs. Implementing the 4626 exit signature and quietly paying two tokens
/// would corrupt every integrator that trusted the return value; reverting at
/// integration time is the honest failure.
contract BaseVault is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using RangePolicy for IPriceFeed;

    uint256 internal constant WAD = 1e18;

    // ---------------------------------------------------------------- config

    IERC20 public immutable stock;
    IERC20 public immutable usdg;
    IPriceFeed public immutable feed;
    IPoolAdapter public immutable pool;

    /// @notice Bounded operator. Changes the SHAPE of the position, never its
    /// destination, and cannot stop anyone withdrawing.
    address public keeper;
    /// @notice Sets the keeper and the policy bounds. Cannot move funds.
    ///
    /// Mutable, and only by itself. An immutable admin cannot be reassigned by
    /// an attacker — but it also cannot be reassigned after one, and rotating
    /// the factory's owner used to leave `setKeeper` and `setBounds` on every
    /// live vault with the compromised key. Rotation is the more useful
    /// property: an admin that cannot move funds is worth less to an attacker
    /// than a stuck admin is worth to a defender.
    address public admin;

    RangePolicy.Bounds public bounds;

    /// @notice How long a policy change waits between proposal and effect.
    /// @dev Immutable on purpose. A timelock the admin can shorten is a
    /// timelock the admin can shorten to zero in the same transaction as the
    /// change it was meant to delay.
    uint256 public immutable boundsDelay;

    /// @notice The pending policy change, if any, and when it may be applied.
    RangePolicy.Bounds public pendingBounds;
    uint256 public pendingBoundsAt;

    /// @notice A brake on new money that depends on no keeper and stops no
    /// exit. `redeem` does not read it, and no admin path can be made to.
    bool public depositsPaused;

    /// @notice Ceiling on the vault's NAV, in raw USDG. `type(uint256).max`
    /// for none; zero is refused, because a vault whose cap means "unlimited"
    /// on some deployments and "closed" on others is a cap nobody can read.
    uint256 public maxTotalAssets;

    /// @notice The largest share of the pool's ACTIVE liquidity the vault's
    /// position may be, 1e18 = 100%. Checked when a range is opened.
    uint256 public maxPoolShare;

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

    /// @dev Virtual shares that exist in the mint arithmetic and in the
    /// ERC-4626 views, and that nobody holds: `10 ** (decimals() -
    /// usdgDecimals)`, so 1e12 against 6-decimal USDG. Paired with one virtual
    /// USDG unit in the denominator, this is OpenZeppelin's ERC-4626 offset,
    /// and it is here for two reasons.
    ///
    /// **It closes first-deposit inflation.** Without it the opening deposit
    /// mints `shares = value` against an empty vault, so one raw unit buys one
    /// share, a donation of 59,999,999 units then makes that share worth $60,
    /// and the next depositor's $100 rounds down to a single share they can
    /// only redeem $80 of. With the offset the attacker's opening unit buys
    /// 1e12 shares, the victim's $100 buys ~3.3e12 more, and the attacker ends
    /// up eating their own donation instead of the victim's money. The theft
    /// is bounded by roughly `1 / virtualShares` of the victim's deposit.
    ///
    /// **It makes `decimals()` honest.** Shares are an 18-decimal ERC-20 while
    /// the accounting asset has 6, so minting `shares = value` priced one
    /// whole share at a million dollars and `convertToAssets(1e18)` — the
    /// number a lending market reads as "price per share" — at $1e12. With the
    /// offset a whole share opens at $1.
    ///
    /// The virtual terms appear ONLY in value-space: the mint, and the
    /// `convertTo*` views built on it. They are deliberately absent from
    /// `redeem` and `previewRedeemAmounts`, which divide the vault's physical
    /// contents by the REAL supply — crediting phantom shares with a slice of
    /// real tokens would leave the last holder unable to empty the vault.
    uint256 private immutable virtualShares;

    /// @notice Raw USDG value of a raw stock amount at a WAD price.
    function _stockValue(uint256 stockAmount, uint256 price) internal view returns (uint256) {
        return Math.mulDiv(stockAmount, price, stockValueDivisor);
    }

    // ---------------------------------------------------------------- events

    event Deposit(
        address indexed caller,
        address indexed receiver,
        uint256 stockIn,
        uint256 usdgIn,
        uint256 shares
    );
    event Redeem(
        address indexed caller,
        address indexed receiver,
        uint256 shares,
        uint256 stockOut,
        uint256 usdgOut
    );
    event RangeOpened(
        uint256 lower,
        uint256 upper,
        uint256 realisedLower,
        uint256 realisedUpper,
        uint256 stockUsed,
        uint256 usdgUsed
    );
    event RangeClosed(uint256 stockOut, uint256 usdgOut);
    event FeesCollected(uint256 stockFees, uint256 usdgFees);
    event KeeperChanged(address indexed from, address indexed to);
    event AdminChanged(address indexed from, address indexed to);
    event BoundsProposed(RangePolicy.Bounds bounds, uint256 effectiveAt);
    event BoundsChanged(RangePolicy.Bounds bounds);
    event BoundsProposalCancelled();
    event DepositsPausedSet(bool paused);
    event CapsChanged(uint256 maxTotalAssets, uint256 maxPoolShare);

    // ---------------------------------------------------------------- errors

    error NotKeeper();
    error NotAdmin();
    error ZeroDeposit();
    error NothingToMint();
    error NothingToRedeem();
    error InsufficientShares(uint256 requested, uint256 held);
    error UseDualAssetRedeem();
    error ZeroAddress();
    error MinSharesNotMet(uint256 shares, uint256 minShares);
    error UnsupportedDecimals(uint8 usdgDecimals);
    error NoPendingBounds();
    error TimelockNotElapsed(uint256 effectiveAt);
    error DepositsArePaused();
    error CapExceeded(uint256 wouldBe, uint256 cap);
    error PoolShareExceeded(uint128 positionLiquidity, uint128 poolLiquidity, uint256 cap);
    error CapsInvalid();

    modifier onlyKeeper() {
        if (msg.sender != keeper) revert NotKeeper();
        _;
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    struct Config {
        string name;
        string symbol;
        address stock;
        address usdg;
        address feed;
        address pool;
        address keeper;
        address admin;
        uint256 boundsDelay;
        uint256 maxTotalAssets;
        uint256 maxPoolShare;
        RangePolicy.Bounds bounds;
    }

    constructor(Config memory c) ERC20(c.name, c.symbol) {
        if (
            c.stock == address(0) || c.usdg == address(0) || c.feed == address(0)
                || c.pool == address(0)
        ) {
            revert ZeroAddress();
        }
        stock = IERC20(c.stock);
        usdg = IERC20(c.usdg);
        feed = IPriceFeed(c.feed);
        pool = IPoolAdapter(c.pool);
        keeper = c.keeper;
        admin = c.admin;
        boundsDelay = c.boundsDelay;

        _setCaps(c.maxTotalAssets, c.maxPoolShare);

        RangePolicy.requireValidBounds(c.bounds, IPoolAdapter(c.pool).swapFeeWad());
        bounds = c.bounds;

        uint8 usdgDecimals = IERC20Metadata(c.usdg).decimals();
        // The share token is 18-decimal; an accounting asset wider than that
        // would make the offset below a negative power of ten.
        if (usdgDecimals > decimals()) revert UnsupportedDecimals(usdgDecimals);

        stockValueDivisor = WAD * (10 ** IERC20Metadata(c.stock).decimals()) / (10 ** usdgDecimals);
        virtualShares = 10 ** (decimals() - usdgDecimals);
    }

    // ------------------------------------------------------------ accounting

    /// @notice ERC-4626 accounting asset. Shares are denominated in USDG.
    function asset() external view returns (address) {
        return address(usdg);
    }

    /// @notice Everything the vault owns, valued in USDG at the FEED price.
    ///
    /// Every term is on this chain and priceable, so unlike the hedged
    /// wrapper's `navFloor` this is not a deliberate undervaluation.
    ///
    /// **It is not, however, independent of the pool.** The stock and USDG
    /// legs are priced at the Chainlink feed, but the QUANTITIES come from
    /// `positionAmounts`, and what mix a range is holding is decided by the
    /// pool's current price. Moving the pool inside the range therefore moves
    /// this number even with the feed still. The feed bounds how badly — the
    /// value of the inventory is marked honestly rather than at a tick an
    /// attacker chose — but "the share price cannot read the tick" is a
    /// stronger claim than this function supports, and it is not made here.
    /// The manipulation that remains is a mint-pricing question; see the open
    /// item in `docs/decisions.md`.
    function totalAssets() public view returns (uint256) {
        uint256 price = _feedPriceOrZero();
        uint256 total = usdg.balanceOf(address(this));

        if (price == 0) {
            // No usable price means no defensible valuation of the stock legs.
            // Report only what needs no price at all rather than guess. Note
            // this does NOT impair redemption, which is pro-rata on
            // quantities and never reads this function.
            return total;
        }

        total += _stockValue(stock.balanceOf(address(this)), price);

        if (pool.hasPosition()) {
            (uint256 poolStock, uint256 poolUsdg) = pool.positionAmounts();
            // Fees the range has earned are assets of this vault whether or
            // not they have been swept yet. Leaving them out understates NAV,
            // and an understated NAV is not conservative on the MINT side: it
            // is the denominator new shares are priced against, so it hands
            // the next depositor a slice of yield the existing holders earned.
            (uint256 feeStock, uint256 feeUsdg) = pool.pendingFees();
            total += poolUsdg + feeUsdg;
            total += _stockValue(poolStock + feeStock, price);
        }
        return total;
    }

    /// @dev The virtual share and the virtual USDG unit remove the empty-vault
    /// special cases that used to sit here: at zero supply this is
    /// `assets * virtualShares`, which is the same ratio every later depositor
    /// gets, rather than a separate rule that only the first depositor meets.
    /// Rounding is down, against the depositor and towards the vault.
    function convertToShares(uint256 assets) public view returns (uint256) {
        return Math.mulDiv(assets, totalSupply() + virtualShares, totalAssets() + 1);
    }

    /// @notice USDG per share. This is what an oracle or a lending market
    /// reads, and what the hedged wrapper values its holding at.
    function convertToAssets(uint256 shares) public view returns (uint256) {
        return Math.mulDiv(shares, totalAssets() + 1, totalSupply() + virtualShares);
    }

    function previewDeposit(uint256 assets) external view returns (uint256) {
        return convertToShares(assets);
    }

    function previewRedeem(uint256 shares) external view returns (uint256) {
        return convertToAssets(shares);
    }

    /// @notice What `redeem` would actually pay: quantities of both tokens.
    /// @dev The honest companion to `previewRedeem`, which can only express
    /// the USDG-equivalent of a dual-asset payout.
    ///
    /// Divides by the REAL supply, with no virtual share anywhere: this is
    /// quantity-space, and the vault's physical contents belong entirely to
    /// the people holding real shares. So this is very slightly MORE generous
    /// than `previewRedeem` — by the `virtualShares / (supply +
    /// virtualShares)` sliver the value-space views hold back, about 2.5e-10
    /// of a vault with $4,000 in it. That sliver is the anti-inflation buffer,
    /// and it is only a meaningful fraction of the vault in exactly the state
    /// the buffer exists to punish: a near-empty supply against donated
    /// assets.
    function previewRedeemAmounts(uint256 shares)
        external
        view
        returns (uint256 stockOut, uint256 usdgOut)
    {
        uint256 supply = totalSupply();
        if (supply == 0 || shares == 0) return (0, 0);

        // Mirrors `redeem`, which sweeps the range's fees into the vault before
        // dividing: they are idle balance by the time anyone's slice is taken.
        (uint256 feeStock, uint256 feeUsdg) = pool.pendingFees();
        stockOut = (stock.balanceOf(address(this)) + feeStock) * shares / supply;
        usdgOut = (usdg.balanceOf(address(this)) + feeUsdg) * shares / supply;

        uint128 liq = pool.positionLiquidity();
        if (liq > 0) {
            uint128 slice = uint128(uint256(liq) * shares / supply);
            if (slice > 0) {
                (uint256 poolStock, uint256 poolUsdg) = pool.positionAmounts();
                stockOut += poolStock * slice / liq;
                usdgOut += poolUsdg * slice / liq;
            }
        }
    }

    /// @dev ERC-4626's single-asset exits, which this vault cannot honestly
    /// provide. See the contract header.
    function withdraw(uint256, address, address) external pure returns (uint256) {
        revert UseDualAssetRedeem();
    }

    function redeem(uint256, address, address) external pure returns (uint256) {
        revert UseDualAssetRedeem();
    }

    function maxWithdraw(address) external pure returns (uint256) {
        return 0;
    }

    function maxRedeem(address) external pure returns (uint256) {
        return 0;
    }

    // --------------------------------------------------------------- holders

    /// @notice Deposit stock, USDG, or both.
    ///
    /// The incoming value is priced at the feed and minted against the vault's
    /// NAV read BEFORE the transfers land, so a deposit is never in its own
    /// denominator.
    ///
    /// @param minShares The fewest shares the caller will accept. This is not
    /// decoration. The mint denominator is `totalAssets()`, whose stock and
    /// USDG QUANTITIES come from `positionAmounts()` and therefore move with
    /// the pool's price inside the range even while the feed is still — so the
    /// share count a depositor is quoted is not the share count they are
    /// guaranteed, and someone who moves the pool between the quote and the
    /// transaction changes it. Closing that gap at the protocol level is the
    /// open half of A1; `minShares` is the part that does not need the answer,
    /// because it lets a depositor put a floor under their own trade whichever
    /// way that decision goes. Pass 0 only if you genuinely do not care.
    function deposit(uint256 stockAmount, uint256 usdgAmount, uint256 minShares, address receiver)
        external
        nonReentrant
        returns (uint256 shares)
    {
        if (stockAmount == 0 && usdgAmount == 0) revert ZeroDeposit();
        if (depositsPaused) revert DepositsArePaused();

        // A deposit needs a price and therefore a live feed; a redemption does
        // not. That asymmetry is deliberate — it is always safe to refuse new
        // money and never safe to trap existing money.
        uint256 price = feed.requireFreshPrice(bounds);

        // ...and, for the same reason, a deposit needs the pool to be somewhere
        // near that price. `totalAssets()` marks both legs at the feed, but the
        // QUANTITIES it marks are whatever mix the pool's current price implies
        // the range is holding, so a pool far from the feed means a mint
        // denominator that is wrong by an amount an attacker chose. See
        // `RangePolicy.requireConverged`.
        //
        // Skipped when there is no position, and that is not a loophole: with
        // nothing in the pool, NAV is idle balances priced at the feed and has
        // no pool dependence at all, so there is nothing for the gate to
        // protect. Gating anyway would block every deposit before the first
        // range opens, which is every deposit the vault starts life with.
        if (pool.hasPosition()) {
            RangePolicy.requireConverged(pool.poolPriceWad(), price, bounds);
        }

        uint256 navBefore = totalAssets();
        uint256 supply = totalSupply();

        uint256 value = usdgAmount + _stockValue(stockAmount, price);

        // The cap is on NAV, not on cumulative deposits: money that has left
        // makes room for money arriving, which is what a size limit on the
        // strategy means. Checked against the value being added rather than by
        // re-reading `totalAssets()` afterwards, so the two numbers the mint
        // and the cap use are the same number.
        uint256 navAfter = navBefore + value;
        if (navAfter > maxTotalAssets) revert CapExceeded(navAfter, maxTotalAssets);

        // Same expression as `convertToShares`, against the pre-transfer NAV.
        shares = Math.mulDiv(value, supply + virtualShares, navBefore + 1);
        if (shares == 0) revert NothingToMint();
        if (shares < minShares) revert MinSharesNotMet(shares, minShares);

        if (stockAmount > 0) stock.safeTransferFrom(msg.sender, address(this), stockAmount);
        if (usdgAmount > 0) usdg.safeTransferFrom(msg.sender, address(this), usdgAmount);

        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, stockAmount, usdgAmount, shares);
    }

    /// @notice Burn shares and take the corresponding slice of the vault out,
    /// immediately, in both tokens.
    ///
    /// The redeemer's share of the Uniswap position comes out as liquidity.
    /// Fees are NOT taken out with it — v4 would pay all of them to whoever
    /// removed liquidity first — so they are swept into the vault before
    /// anything is divided and then split like any other idle balance. That
    /// is what leaves every remaining holder's claim exactly where it was:
    /// nobody subsidises an exit, and no cash buffer is held against one.
    ///
    /// No price is read anywhere in this function.
    function redeem(uint256 shares, address receiver)
        external
        nonReentrant
        returns (uint256 stockOut, uint256 usdgOut)
    {
        if (shares == 0) revert NothingToRedeem();
        uint256 held = balanceOf(msg.sender);
        if (shares > held) revert InsufficientShares(shares, held);

        uint256 supply = totalSupply();

        // Sweep the range's fees into the vault FIRST, so the pro-rata lines
        // below split them like any other idle balance.
        //
        // This is not an optimisation. Uniswap v4 pays a position's ENTIRE
        // accrued fee balance to whoever changes its liquidity, regardless of
        // how small the change is — `callerDelta = principalDelta +
        // feesAccrued`, with `feesAccrued` computed against the position's
        // whole pre-change liquidity. So without this line the first redeemer
        // after a fee-earning period leaves with every other holder's fees,
        // and one share is enough to do it.
        if (pool.hasPosition()) pool.collectFees();

        // Idle slices are computed BEFORE the pool pays in, so a redeemer gets
        // a share of what the vault held, not a share of their own withdrawal.
        stockOut = stock.balanceOf(address(this)) * shares / supply;
        usdgOut = usdg.balanceOf(address(this)) * shares / supply;

        uint128 liq = pool.positionLiquidity();
        uint128 slice = liq == 0 ? 0 : uint128(uint256(liq) * shares / supply);

        _burn(msg.sender, shares);

        if (slice > 0) {
            (uint256 poolStock, uint256 poolUsdg) = pool.decreaseLiquidity(slice);
            stockOut += poolStock;
            usdgOut += poolUsdg;
        }

        if (stockOut == 0 && usdgOut == 0) revert NothingToRedeem();
        if (stockOut > 0) stock.safeTransfer(receiver, stockOut);
        if (usdgOut > 0) usdg.safeTransfer(receiver, usdgOut);

        emit Redeem(msg.sender, receiver, shares, stockOut, usdgOut);
    }

    // ---------------------------------------------------------------- keeper

    /// @notice Place the vault's inventory in a range.
    ///
    /// The policy is checked TWICE, against two different things, and the
    /// second check is the one that matters.
    ///
    /// The first is on the keeper's request, before any money moves: it is
    /// cheap, and it makes a bad request fail with an error naming what the
    /// keeper asked for. The second is on the range the adapter actually
    /// opened. An AMM with a tick grid cannot place an arbitrary price, and
    /// the adapter rounds OUTWARD so the position contains the request — so
    /// the realised range can be up to one tick spacing wider on each side
    /// than the one that passed the first check. With a $200 feed, a requested
    /// $150–$250 at `maxHalfWidth` 25% and spacing 60, the realised range is
    /// about $149.33–$250.17, and its narrow side already exceeds the bound
    /// that approved it.
    ///
    /// A bound the position does not have to satisfy is not a bound, so the
    /// realised range is re-validated and the transaction reverts if the grid
    /// pushed it out. The rounding only ever widens, so this can only fail as
    /// `RangeTooWide` — straddling and `minHalfWidth` survive widening by
    /// construction. **The keeper therefore needs headroom**: a request at
    /// exactly `maxHalfWidth` will now always revert, and one within a tick
    /// spacing of it usually will. That is the keeper's problem to solve by
    /// asking for less, which is the correct place for it.
    function openRange(uint256 lower, uint256 upper, uint256 stockAmount, uint256 usdgAmount)
        external
        onlyKeeper
    {
        uint256 price = feed.requireFreshPrice(bounds);
        RangePolicy.requireValidRange(lower, upper, price, bounds);

        if (stockAmount > 0) stock.forceApprove(address(pool), stockAmount);
        if (usdgAmount > 0) usdg.forceApprove(address(pool), usdgAmount);
        (uint256 stockUsed, uint256 usdgUsed, uint256 realisedLower, uint256 realisedUpper) =
            pool.openRange(lower, upper, stockAmount, usdgAmount);

        // Against the SAME price the request was judged on, so the two checks
        // cannot disagree about where the market is.
        RangePolicy.requireValidRange(realisedLower, realisedUpper, price, bounds);
        _requirePoolShareWithinCap();

        // Leaving an allowance alive is a standing claim on vault funds.
        stock.forceApprove(address(pool), 0);
        usdg.forceApprove(address(pool), 0);
        emit RangeOpened(lower, upper, realisedLower, realisedUpper, stockUsed, usdgUsed);
    }

    function closeRange() external onlyKeeper returns (uint256 stockOut, uint256 usdgOut) {
        (stockOut, usdgOut) = pool.closeRange();
        emit RangeClosed(stockOut, usdgOut);
    }

    function collectFees() external onlyKeeper returns (uint256 stockFees, uint256 usdgFees) {
        (stockFees, usdgFees) = pool.collectFees();
        emit FeesCollected(stockFees, usdgFees);
    }

    // ----------------------------------------------------------------- admin

    function setKeeper(address next) external onlyAdmin {
        emit KeeperChanged(keeper, next);
        keeper = next;
    }

    /// @notice Hand the admin role to another address.
    /// @dev Only the current admin, and no two-step handshake: the role cannot
    /// move funds, so the cost of handing it to a typo is a vault whose keeper
    /// and policy are frozen at their current values — recoverable by
    /// redeploying, and never a loss of anyone's money.
    function setAdmin(address next) external onlyAdmin {
        if (next == address(0)) revert ZeroAddress();
        emit AdminChanged(admin, next);
        admin = next;
    }

    /// @notice Stop or restart new deposits.
    ///
    /// @dev Immediate, and deliberately not behind the policy timelock. The
    /// bounds timelock exists because widening a keeper bound on demand makes
    /// it not a bound; pausing has no such shape. It only ever REFUSES new
    /// money, so making it wait would delay the brake and not the risk, and
    /// unpausing only restores the ordinary state.
    ///
    /// It is also the one admin power that must be provably harmless, so:
    /// `redeem` does not read this flag, `previewRedeemAmounts` does not read
    /// it, and no path that pays a holder can be made to. A pause is a brake
    /// on the way in and nothing else.
    function setDepositsPaused(bool paused) external onlyAdmin {
        depositsPaused = paused;
        emit DepositsPausedSet(paused);
    }

    /// @notice Set the NAV ceiling and the share-of-pool ceiling.
    ///
    /// @dev Immediate, like the pause and for the same reason. Lowering a cap
    /// is a brake and should not have to wait; raising one lets in money that
    /// dilutes nobody, since new shares are priced at NAV. Neither direction
    /// is the thing the bounds timelock guards against.
    function setCaps(uint256 maxTotalAssets_, uint256 maxPoolShare_) external onlyAdmin {
        _setCaps(maxTotalAssets_, maxPoolShare_);
    }

    /// @notice Propose new policy bounds. They take effect after `boundsDelay`.
    ///
    /// This document has always said policy changes are timelocked, and for a
    /// long time `setBounds` changed them in the same block. That is not a
    /// bound: a keeper limit that can be widened in the block it is exceeded
    /// constrains nothing, and the whole argument for letting a keeper touch
    /// the position is that `RangePolicy` fences it in.
    ///
    /// The delay buys holders the one thing they actually need, which is time
    /// to leave — and leaving works without the admin, without the keeper and
    /// without the feed, so a proposal a holder dislikes is an exit they can
    /// always take.
    ///
    /// Validated at proposal time AND at application time. The pool's fee
    /// tier cannot change under a v4 pool key, so the second check is about
    /// the proposal itself rather than about drift, but re-checking costs
    /// nothing and means no path writes an unvalidated bound.
    function proposeBounds(RangePolicy.Bounds calldata bounds_) external onlyAdmin {
        RangePolicy.requireValidBounds(bounds_, pool.swapFeeWad());
        pendingBounds = bounds_;
        pendingBoundsAt = block.timestamp + boundsDelay;
        emit BoundsProposed(bounds_, pendingBoundsAt);
    }

    /// @notice Apply a proposal whose delay has elapsed.
    /// @dev Deliberately callable by anyone. The admin already decided; making
    /// them show up again to finish is a liveness dependency for no gain, and
    /// there is nothing here a stranger can choose.
    function applyBounds() external {
        uint256 at = pendingBoundsAt;
        if (at == 0) revert NoPendingBounds();
        if (block.timestamp < at) revert TimelockNotElapsed(at);

        RangePolicy.Bounds memory next = pendingBounds;
        RangePolicy.requireValidBounds(next, pool.swapFeeWad());
        bounds = next;

        delete pendingBounds;
        delete pendingBoundsAt;
        emit BoundsChanged(next);
    }

    /// @notice Withdraw a pending proposal.
    /// @dev The admin's escape hatch from their own mistake, and it needs no
    /// delay: cancelling can only ever leave the bounds where they already are.
    function cancelBounds() external onlyAdmin {
        if (pendingBoundsAt == 0) revert NoPendingBounds();
        delete pendingBounds;
        delete pendingBoundsAt;
        emit BoundsProposalCancelled();
    }

    // -------------------------------------------------------------- internal

    function _setCaps(uint256 maxTotalAssets_, uint256 maxPoolShare_) internal {
        // Zero is refused on both. A zero NAV ceiling reads as either
        // "unlimited" or "closed" depending on who is guessing, and a zero
        // pool share would make every range the keeper opens revert.
        if (maxTotalAssets_ == 0 || maxPoolShare_ == 0 || maxPoolShare_ > WAD) {
            revert CapsInvalid();
        }
        maxTotalAssets = maxTotalAssets_;
        maxPoolShare = maxPoolShare_;
        emit CapsChanged(maxTotalAssets_, maxPoolShare_);
    }

    /// @dev The vault's position as a fraction of the liquidity actually being
    /// traded against.
    ///
    /// Active liquidity rather than total value locked, because fees are split
    /// among the liquidity in range: it is the share of THAT which decides
    /// whether the vault is diluting its own fee take, and whether the depth
    /// it would unwind into is really there.
    ///
    /// Read AFTER the position is placed, so the denominator includes it and
    /// the ratio is the vault's true share. Written as a multiplication so a
    /// pool with no active liquidity reverts rather than dividing by zero —
    /// which is the right answer anyway: nothing is at most 15% of nothing.
    ///
    /// One honest caveat. If the position is opened OUT of range — legal,
    /// since `RangePolicy` straddles the FEED and the pool can sit elsewhere —
    /// the pool's active liquidity excludes it and the check is stricter than
    /// the true share. Conservative in the safe direction, and a keeper
    /// opening out-of-range ranges has a problem this is not the place to fix.
    function _requirePoolShareWithinCap() internal view {
        uint128 positionLiq = pool.positionLiquidity();
        if (positionLiq == 0) return;

        uint128 poolLiq = pool.poolLiquidity();
        if (uint256(positionLiq) * WAD > uint256(poolLiq) * maxPoolShare) {
            revert PoolShareExceeded(positionLiq, poolLiq, maxPoolShare);
        }
    }

    /// @dev The feed read that must not revert: `totalAssets` is a view other
    /// protocols call, and a stale feed should degrade it rather than brick
    /// every reader.
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
