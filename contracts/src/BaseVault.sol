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
    address public immutable admin;

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
    event RangeOpened(uint256 lower, uint256 upper, uint256 stockUsed, uint256 usdgUsed);
    event RangeClosed(uint256 stockOut, uint256 usdgOut);
    event FeesCollected(uint256 stockFees, uint256 usdgFees);
    event KeeperChanged(address indexed from, address indexed to);
    event BoundsChanged(uint256 maxFeedAge, uint256 minHalfWidth, uint256 maxHalfWidth);

    // ---------------------------------------------------------------- errors

    error NotKeeper();
    error NotAdmin();
    error ZeroDeposit();
    error NothingToMint();
    error NothingToRedeem();
    error InsufficientShares(uint256 requested, uint256 held);
    error UseDualAssetRedeem();
    error ZeroAddress();

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
        bounds = c.bounds;

        stockValueDivisor = WAD * (10 ** IERC20Metadata(c.stock).decimals())
            / (10 ** IERC20Metadata(c.usdg).decimals());
    }

    // ------------------------------------------------------------ accounting

    /// @notice ERC-4626 accounting asset. Shares are denominated in USDG.
    function asset() external view returns (address) {
        return address(usdg);
    }

    /// @notice Everything the vault owns, valued in USDG at the FEED price.
    ///
    /// Unlike the hedged wrapper's `navFloor`, this is not a deliberate
    /// undervaluation — every term is on this chain and exactly priceable.
    /// What it shares with the floor is where the price comes from: the
    /// CHAINLINK FEED, never the pool tick. A pool tick is something an
    /// attacker can move with capital, and a share price built on one is a
    /// share price they can print.
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
            total += poolUsdg;
            total += _stockValue(poolStock, price);
        }
        return total;
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply();
        uint256 nav = totalAssets();
        if (supply == 0 || nav == 0) return assets;
        return assets * supply / nav;
    }

    /// @notice USDG per share. This is what an oracle or a lending market
    /// reads, and what the hedged wrapper values its holding at.
    function convertToAssets(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return shares;
        return shares * totalAssets() / supply;
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
    function previewRedeemAmounts(uint256 shares)
        external
        view
        returns (uint256 stockOut, uint256 usdgOut)
    {
        uint256 supply = totalSupply();
        if (supply == 0 || shares == 0) return (0, 0);

        stockOut = stock.balanceOf(address(this)) * shares / supply;
        usdgOut = usdg.balanceOf(address(this)) * shares / supply;

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
    function deposit(uint256 stockAmount, uint256 usdgAmount, address receiver)
        external
        nonReentrant
        returns (uint256 shares)
    {
        if (stockAmount == 0 && usdgAmount == 0) revert ZeroDeposit();

        // A deposit needs a price and therefore a live feed; a redemption does
        // not. That asymmetry is deliberate — it is always safe to refuse new
        // money and never safe to trap existing money.
        uint256 price = feed.requireFreshPrice(bounds);
        uint256 navBefore = totalAssets();
        uint256 supply = totalSupply();

        uint256 value = usdgAmount + _stockValue(stockAmount, price);
        shares = (supply == 0 || navBefore == 0) ? value : value * supply / navBefore;
        if (shares == 0) revert NothingToMint();

        if (stockAmount > 0) stock.safeTransferFrom(msg.sender, address(this), stockAmount);
        if (usdgAmount > 0) usdg.safeTransferFrom(msg.sender, address(this), usdgAmount);

        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, stockAmount, usdgAmount, shares);
    }

    /// @notice Burn shares and take the corresponding slice of the vault out,
    /// immediately, in both tokens.
    ///
    /// The redeemer's share of the Uniswap position comes out as liquidity,
    /// which brings their share of accrued fees with it in the same
    /// proportion. That is what leaves every remaining holder's claim exactly
    /// where it was: nobody subsidises an exit, and no cash buffer is held
    /// against one.
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
        (stockFees, usdgFees) = pool.collectFees();
        emit FeesCollected(stockFees, usdgFees);
    }

    // ----------------------------------------------------------------- admin

    function setKeeper(address next) external onlyAdmin {
        emit KeeperChanged(keeper, next);
        keeper = next;
    }

    function setBounds(RangePolicy.Bounds calldata bounds_) external onlyAdmin {
        bounds = bounds_;
        emit BoundsChanged(bounds_.maxFeedAge, bounds_.minHalfWidth, bounds_.maxHalfWidth);
    }

    // -------------------------------------------------------------- internal

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
