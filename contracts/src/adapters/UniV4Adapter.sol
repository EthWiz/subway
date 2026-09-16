// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId} from "v4-core/src/types/PoolId.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {ModifyLiquidityParams} from "v4-core/src/types/PoolOperation.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";
import {FullMath} from "v4-core/src/libraries/FullMath.sol";
import {FixedPoint128} from "v4-core/src/libraries/FixedPoint128.sol";
import {SqrtPriceMath} from "v4-core/src/libraries/SqrtPriceMath.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";

import {IPoolAdapter} from "../interfaces/IPoolAdapter.sol";
import {LiquidityAmounts} from "../libraries/LiquidityAmounts.sol";
import {PriceTick} from "../libraries/PriceTick.sol";

/// @title UniV4Adapter
/// @notice The Uniswap v4 leg, behind `IPoolAdapter`.
///
/// ## Why this holds liquidity directly instead of through PositionManager
///
/// v4's PositionManager wraps a range in an ERC-721 and reaches approvals
/// through Permit2. The vault owns exactly one range and never transfers it, so
/// the NFT buys nothing and costs two more contracts in the trust path. This
/// adapter is its own position owner inside the PoolManager: one `unlock`, one
/// `modifyLiquidity`, done.
///
/// ## The property that matters
///
/// **This contract never holds either token between calls.** Amounts owed to
/// the pool are pulled straight from the vault to the PoolManager during
/// settlement, and amounts owed by the pool are `take`n straight to the vault.
/// There is no recipient parameter anywhere and no balance to sweep, so the
/// vault's money-movement invariant survives the AMM leg intact — a keeper who
/// controls which range is opened still cannot make funds land anywhere else.
///
/// That is also why the adapter holds the vault's allowance rather than its
/// tokens: the vault grants exactly what a call may consume and revokes it
/// immediately afterwards.
contract UniV4Adapter is IPoolAdapter, IUnlockCallback {
    using SafeERC20 for IERC20;
    using StateLibrary for IPoolManager;

    /// @dev Distinguishes the three shapes of `modifyLiquidity` this adapter
    /// performs, all of which go through the same unlock.
    enum Action {
        Add,
        Remove,
        Collect
    }

    struct CallbackData {
        Action action;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
    }

    IPoolManager public immutable poolManager;
    address public immutable vault;
    IERC20 public immutable stock;
    IERC20 public immutable usdg;

    /// @notice True when the stock token sorts below USDG and is therefore
    /// currency0. Fixed at construction because the pool key is.
    bool public immutable stockIsCurrency0;
    uint8 private immutable stockDecimals;
    uint8 private immutable usdgDecimals;

    uint24 public immutable fee;
    int24 public immutable tickSpacing;

    /// @notice Ticks of the live position. Meaningless while `liquidity == 0`.
    int24 public tickLower;
    int24 public tickUpper;
    uint128 public positionLiquidity;

    event RangeOpened(
        int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 stockUsed, uint256 usdgUsed
    );
    event LiquidityDecreased(uint128 liquidity, uint256 stockOut, uint256 usdgOut);
    event FeesCollected(uint256 stockFees, uint256 usdgFees);

    error NotVault(address caller);
    error NotPoolManager(address caller);
    error PositionAlreadyOpen();
    error NoPosition();
    error RangeEmpty(int24 tickLower, int24 tickUpper);
    error ZeroLiquidity();
    error InsufficientLiquidity(uint128 requested, uint128 available);
    error TokensNotDistinct();

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault(msg.sender);
        _;
    }

    constructor(
        IPoolManager poolManager_,
        address vault_,
        IERC20 stock_,
        IERC20 usdg_,
        uint24 fee_,
        int24 tickSpacing_
    ) {
        if (address(stock_) == address(usdg_)) revert TokensNotDistinct();

        poolManager = poolManager_;
        vault = vault_;
        stock = stock_;
        usdg = usdg_;
        fee = fee_;
        tickSpacing = tickSpacing_;

        stockIsCurrency0 = address(stock_) < address(usdg_);
        stockDecimals = IERC20Metadata(address(stock_)).decimals();
        usdgDecimals = IERC20Metadata(address(usdg_)).decimals();
    }

    // ------------------------------------------------------------- pool key

    function poolKey() public view returns (PoolKey memory) {
        (Currency c0, Currency c1) = stockIsCurrency0
            ? (Currency.wrap(address(stock)), Currency.wrap(address(usdg)))
            : (Currency.wrap(address(usdg)), Currency.wrap(address(stock)));
        // No hooks: a hook is code that runs inside the vault's own liquidity
        // operations, and nothing in this design needs one. The plan's
        // oracle-anchored hook pool would be a DIFFERENT adapter, not a flag
        // here.
        return PoolKey({
            currency0: c0,
            currency1: c1,
            fee: fee,
            tickSpacing: tickSpacing,
            hooks: IHooks(address(0))
        });
    }

    function poolId() public view returns (PoolId) {
        return poolKey().toId();
    }

    // ---------------------------------------------------------------- views

    function hasPosition() public view returns (bool) {
        return positionLiquidity > 0;
    }

    /// @notice Token amounts the position would return if closed right now,
    /// valued at the pool's CURRENT price.
    /// @dev Principal only — uncollected fees are excluded. The hedged vault
    /// adds this into its NAV floor, and a floor is allowed to be too low but
    /// never too high; fees not yet swept are exactly the kind of value that is
    /// safe to ignore and unsafe to assume.
    function positionAmounts() external view returns (uint256 stockAmount, uint256 usdgAmount) {
        uint128 liq = positionLiquidity;
        if (liq == 0) return (0, 0);

        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolId());
        uint160 sqrtLower = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(tickUpper);

        uint256 amount0;
        uint256 amount1;
        if (sqrtPriceX96 <= sqrtLower) {
            amount0 = SqrtPriceMath.getAmount0Delta(sqrtLower, sqrtUpper, liq, false);
        } else if (sqrtPriceX96 < sqrtUpper) {
            amount0 = SqrtPriceMath.getAmount0Delta(sqrtPriceX96, sqrtUpper, liq, false);
            amount1 = SqrtPriceMath.getAmount1Delta(sqrtLower, sqrtPriceX96, liq, false);
        } else {
            amount1 = SqrtPriceMath.getAmount1Delta(sqrtLower, sqrtUpper, liq, false);
        }

        return stockIsCurrency0 ? (amount0, amount1) : (amount1, amount0);
    }

    function inRange() external view returns (bool) {
        if (positionLiquidity == 0) return false;
        (, int24 tick,,) = poolManager.getSlot0(poolId());
        // Upper is exclusive, matching Uniswap: at exactly `tickUpper` the
        // position is entirely one-sided and earning nothing.
        return tick >= tickLower && tick < tickUpper;
    }

    /// @notice Fees the range has earned and not yet been paid, in vault
    /// units (stock, USDG).
    ///
    /// @dev This exists because of a v4 rule that is easy to miss and
    /// expensive to miss: `modifyLiquidity` credits a position's ENTIRE
    /// accrued fee balance to the caller on ANY liquidity change, however
    /// small — `feesOwed` is computed against the position's whole
    /// pre-change liquidity (`Position.update`), and `PoolManager` then
    /// returns `principalDelta + feesAccrued` as one number. So fees are not
    /// something a vault can leave in the range and account for later: they
    /// are paid to whoever touches the position next, and a vault that splits
    /// only the principal pro-rata hands the first redeemer everyone's fees.
    ///
    /// Exposing them as a separate, readable quantity is what lets the vault
    /// count them in NAV and realise them before it splits anything.
    ///
    /// Mirrors `Position.update`'s arithmetic exactly, including the wrapping
    /// subtraction: v4 lets fee growth overflow deliberately, and only the
    /// difference is meaningful.
    function pendingFees() external view returns (uint256 stockFees, uint256 usdgFees) {
        uint128 liq = positionLiquidity;
        if (liq == 0) return (0, 0);

        PoolId id = poolId();
        (uint256 growth0, uint256 growth1) =
            poolManager.getFeeGrowthInside(id, tickLower, tickUpper);
        (, uint256 last0, uint256 last1) =
            poolManager.getPositionInfo(id, address(this), tickLower, tickUpper, bytes32(0));

        uint256 amount0;
        uint256 amount1;
        unchecked {
            amount0 = FullMath.mulDiv(growth0 - last0, liq, FixedPoint128.Q128);
            amount1 = FullMath.mulDiv(growth1 - last1, liq, FixedPoint128.Q128);
        }
        return stockIsCurrency0 ? (amount0, amount1) : (amount1, amount0);
    }

    /// @notice The pool's own price, in the vault's units (USDG per whole
    /// stock token, 1e18).
    /// @dev For keepers and dashboards ONLY. Nothing that decides a share price
    /// may read this: a pool tick is something an attacker can move with
    /// capital, and `SubwayVault.navFloor` deliberately reads the Chainlink
    /// feed instead.
    function poolLiquidity() external view returns (uint128) {
        return poolManager.getLiquidity(poolId());
    }

    /// @dev v4 fees are in hundredths of a bip, so 3000 is 0.30% and the
    /// scaling to WAD is 1e18/1e6.
    function swapFeeWad() external view returns (uint256) {
        return uint256(fee) * 1e12;
    }

    function poolPriceWad() public view returns (uint256) {
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolId());
        return PriceTick.toWadPrice(sqrtPriceX96, stockIsCurrency0, stockDecimals, usdgDecimals);
    }

    // --------------------------------------------------------- vault surface

    function openRange(
        uint256 lowerPrice,
        uint256 upperPrice,
        uint256 stockAmount,
        uint256 usdgAmount
    )
        external
        onlyVault
        returns (uint256 stockUsed, uint256 usdgUsed, uint256 realisedLower, uint256 realisedUpper)
    {
        if (positionLiquidity != 0) revert PositionAlreadyOpen();

        (int24 lower, int24 upper) = _ticksFor(lowerPrice, upperPrice);
        (uint256 amount0, uint256 amount1) =
            stockIsCurrency0 ? (stockAmount, usdgAmount) : (usdgAmount, stockAmount);

        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolId());
        uint128 liq = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPriceX96,
            TickMath.getSqrtPriceAtTick(lower),
            TickMath.getSqrtPriceAtTick(upper),
            amount0,
            amount1
        );
        if (liq == 0) revert ZeroLiquidity();

        tickLower = lower;
        tickUpper = upper;
        positionLiquidity = liq;

        (uint256 stockDelta, uint256 usdgDelta) = _unlock(
            CallbackData({action: Action.Add, tickLower: lower, tickUpper: upper, liquidity: liq})
        );

        // `LiquidityAmounts` rounds down precisely so this holds; asserting it
        // anyway means a future change to that library cannot quietly spend
        // more of the vault's balance than the keeper authorised.
        assert(stockDelta <= stockAmount && usdgDelta <= usdgAmount);

        (realisedLower, realisedUpper) = _realisedBounds(lower, upper);

        emit RangeOpened(lower, upper, liq, stockDelta, usdgDelta);
        return (stockDelta, usdgDelta, realisedLower, realisedUpper);
    }

    /// @dev The grid-aligned ticks converted back into the vault's units.
    ///
    /// The `min`/`max` is not defensive tidying: when USDG sorts as currency0
    /// the price axis is inverted, so `tickLower` is the HIGHER stock price.
    /// Returning the pair in tick order would hand the vault a range whose
    /// bounds are the wrong way round on exactly the pool ordering the vault
    /// tests least, and `RangePolicy` would then reject every valid range on
    /// that side — or, worse, accept an invalid one.
    function _realisedBounds(int24 lower, int24 upper)
        private
        view
        returns (uint256 lo, uint256 hi)
    {
        uint256 a = PriceTick.toWadPrice(
            TickMath.getSqrtPriceAtTick(lower), stockIsCurrency0, stockDecimals, usdgDecimals
        );
        uint256 b = PriceTick.toWadPrice(
            TickMath.getSqrtPriceAtTick(upper), stockIsCurrency0, stockDecimals, usdgDecimals
        );
        return a < b ? (a, b) : (b, a);
    }

    function decreaseLiquidity(uint128 liquidity)
        public
        onlyVault
        returns (uint256 stockOut, uint256 usdgOut)
    {
        uint128 live = positionLiquidity;
        if (live == 0) revert NoPosition();
        if (liquidity == 0 || liquidity > live) revert InsufficientLiquidity(liquidity, live);

        // Written before the callback: the pool pays into the vault during it,
        // and a stale figure here would misprice the remaining position.
        positionLiquidity = live - liquidity;

        (stockOut, usdgOut) = _unlock(
            CallbackData({
                action: Action.Remove,
                tickLower: tickLower,
                tickUpper: tickUpper,
                liquidity: liquidity
            })
        );
        emit LiquidityDecreased(liquidity, stockOut, usdgOut);
    }

    function closeRange() external onlyVault returns (uint256 stockOut, uint256 usdgOut) {
        return decreaseLiquidity(positionLiquidity);
    }

    function collectFees() external onlyVault returns (uint256 stockFees, uint256 usdgFees) {
        if (positionLiquidity == 0) revert NoPosition();
        (stockFees, usdgFees) = _unlock(
            CallbackData({
                action: Action.Collect, tickLower: tickLower, tickUpper: tickUpper, liquidity: 0
            })
        );
        emit FeesCollected(stockFees, usdgFees);
    }

    // ------------------------------------------------------------- internals

    /// @dev Converts the vault's two prices into an aligned, non-empty tick
    /// range. The two prices are sorted AFTER conversion, not before: when USDG
    /// is currency0 a higher stock price is a lower pool price, so which input
    /// becomes the lower tick depends on the pool's ordering.
    function _ticksFor(uint256 lowerPrice, uint256 upperPrice)
        private
        view
        returns (int24 lower, int24 upper)
    {
        uint160 sqrtA =
            PriceTick.toSqrtPriceX96(lowerPrice, stockIsCurrency0, stockDecimals, usdgDecimals);
        uint160 sqrtB =
            PriceTick.toSqrtPriceX96(upperPrice, stockIsCurrency0, stockDecimals, usdgDecimals);
        (uint160 sqrtLo, uint160 sqrtHi) = sqrtA < sqrtB ? (sqrtA, sqrtB) : (sqrtB, sqrtA);

        lower = PriceTick.toAlignedTick(sqrtLo, tickSpacing, true);
        upper = PriceTick.toAlignedTick(sqrtHi, tickSpacing, false);

        int24 minTick = TickMath.minUsableTick(tickSpacing);
        int24 maxTick = TickMath.maxUsableTick(tickSpacing);
        if (lower < minTick) lower = minTick;
        if (upper > maxTick) upper = maxTick;
        if (lower >= upper) revert RangeEmpty(lower, upper);
    }

    function _unlock(CallbackData memory data)
        private
        returns (uint256 stockMoved, uint256 usdgMoved)
    {
        bytes memory result = poolManager.unlock(abi.encode(data));
        (uint256 amount0, uint256 amount1) = abi.decode(result, (uint256, uint256));
        return stockIsCurrency0 ? (amount0, amount1) : (amount1, amount0);
    }

    /// @inheritdoc IUnlockCallback
    function unlockCallback(bytes calldata raw) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager(msg.sender);
        CallbackData memory data = abi.decode(raw, (CallbackData));

        int256 liquidityDelta;
        if (data.action == Action.Add) {
            liquidityDelta = int256(uint256(data.liquidity));
        } else if (data.action == Action.Remove) {
            liquidityDelta = -int256(uint256(data.liquidity));
        }

        PoolKey memory key = poolKey();
        (BalanceDelta callerDelta,) = poolManager.modifyLiquidity(
            key,
            ModifyLiquidityParams({
                tickLower: data.tickLower,
                tickUpper: data.tickUpper,
                liquidityDelta: liquidityDelta,
                salt: bytes32(0)
            }),
            ""
        );

        // A removal or a poke returns principal AND any fees the range earned,
        // so both legs can be positive here even when the caller asked to add.
        uint256 amount0 = _resolve(key.currency0, callerDelta.amount0());
        uint256 amount1 = _resolve(key.currency1, callerDelta.amount1());
        return abi.encode(amount0, amount1);
    }

    /// @dev Settles one currency's delta and returns the magnitude moved.
    /// Negative means the vault owes the pool, and the tokens are pulled from
    /// the vault straight to the PoolManager. Positive means the pool owes the
    /// vault, and they are taken straight to it. Either way this contract is
    /// never the destination.
    function _resolve(Currency currency, int128 delta) private returns (uint256 amount) {
        if (delta < 0) {
            amount = uint256(uint128(-delta));
            poolManager.sync(currency);
            IERC20(Currency.unwrap(currency)).safeTransferFrom(vault, address(poolManager), amount);
            poolManager.settle();
        } else if (delta > 0) {
            amount = uint256(uint128(delta));
            poolManager.take(currency, vault, amount);
        }
    }
}
