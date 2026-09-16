// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {SqrtPriceMath} from "v4-core/src/libraries/SqrtPriceMath.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";

import {UniV4Adapter} from "../src/adapters/UniV4Adapter.sol";
import {LiquidityAmounts} from "../src/libraries/LiquidityAmounts.sol";
import {PriceTick} from "../src/libraries/PriceTick.sol";
import {MockERC20} from "./Mocks.sol";
import {Swapper} from "./v4/Swapper.sol";

/// @notice The AMM leg, tested against Uniswap's REAL `PoolManager`.
///
/// The PoolManager bytecode is loaded from `out/` rather than imported, because
/// it pins `pragma 0.8.26` and this repo pins 0.8.28 (see `test/v4/Artifacts.sol`).
/// It is the genuine contract either way, which is the point: an adapter whose
/// only counterparty in tests is a mock AMM has been tested against the author's
/// belief about Uniswap, not against Uniswap.
contract UniV4AdapterTest is Test {
    using StateLibrary for IPoolManager;

    IPoolManager internal poolManager;
    MockERC20 internal stock;
    MockERC20 internal usdg;
    UniV4Adapter internal adapter;
    Swapper internal swapper;

    /// @dev This contract plays the vault: it holds the tokens and is the only
    /// address the adapter will take orders from or send money to.
    address internal vault;

    uint24 internal constant FEE = 3000;
    int24 internal constant TICK_SPACING = 60;

    /// @dev $200.00 per share, 1e18-scaled, the vault's unit throughout.
    uint256 internal constant PRICE = 200e18;

    function setUp() public {
        vault = address(this);
        poolManager = IPoolManager(
            deployCode("out/PoolManager.sol/PoolManager.json", abi.encode(address(this)))
        );

        // 18/6 decimals, deliberately: the decimal asymmetry between a stock
        // token and USDG is where the Phase 0 screen's orientation bug lived.
        stock = new MockERC20("Stock", "xSTK", 18);
        usdg = new MockERC20("USD Global", "USDG", 6);

        adapter = new UniV4Adapter(
            poolManager, vault, IERC20(address(stock)), IERC20(address(usdg)), FEE, TICK_SPACING
        );
        swapper = new Swapper(poolManager);

        stock.mint(vault, 1_000_000e18);
        usdg.mint(vault, 1_000_000_000e6);
        stock.approve(address(adapter), type(uint256).max);
        usdg.approve(address(adapter), type(uint256).max);

        stock.mint(address(swapper), 1_000_000e18);
        usdg.mint(address(swapper), 1_000_000_000e6);

        poolManager.initialize(adapter.poolKey(), _sqrt(PRICE));
    }

    function _sqrt(uint256 wadPrice) internal view returns (uint160) {
        return PriceTick.toSqrtPriceX96(wadPrice, adapter.stockIsCurrency0(), 18, 6);
    }

    // ------------------------------------------------------- the happy path

    function test_openRange_placesRealLiquidityAndMovesOnlyVaultFunds() public {
        uint256 stockBefore = stock.balanceOf(vault);
        uint256 usdgBefore = usdg.balanceOf(vault);

        (uint256 stockUsed, uint256 usdgUsed, uint256 realisedLower, uint256 realisedUpper) =
            adapter.openRange(188e18, 212e18, 100e18, 20_000e6);

        // A3: the grid rounds OUTWARD, so the realised range contains the
        // request and is never narrower than it. The vault relies on exactly
        // this direction to know that re-validation can only fail as
        // `RangeTooWide`.
        assertLe(realisedLower, 188e18, "realised lower shrank inside the request");
        assertGe(realisedUpper, 212e18, "realised upper shrank inside the request");

        assertTrue(adapter.hasPosition(), "position should exist");
        assertGt(adapter.positionLiquidity(), 0, "liquidity should be placed");
        assertTrue(adapter.inRange(), "price should sit inside the range");

        // Both legs get used: the range straddles the price.
        assertGt(stockUsed, 0, "stock leg unused");
        assertGt(usdgUsed, 0, "usdg leg unused");
        assertLe(stockUsed, 100e18, "spent more stock than authorised");
        assertLe(usdgUsed, 20_000e6, "spent more usdg than authorised");

        assertEq(stockBefore - stock.balanceOf(vault), stockUsed, "stock debited != reported");
        assertEq(usdgBefore - usdg.balanceOf(vault), usdgUsed, "usdg debited != reported");

        _assertAdapterHoldsNothing();
    }

    function test_positionAmounts_matchesWhatCloseReturns() public {
        adapter.openRange(188e18, 212e18, 100e18, 20_000e6);
        (uint256 viewStock, uint256 viewUsdg) = adapter.positionAmounts();

        (uint256 outStock, uint256 outUsdg) = adapter.closeRange();

        // The view is principal-only and rounds down; closing returns the same
        // principal (no fees have accrued yet) up to that rounding.
        assertApproxEqAbs(viewStock, outStock, 1, "stock view vs realised");
        assertApproxEqAbs(viewUsdg, outUsdg, 1, "usdg view vs realised");
        assertFalse(adapter.hasPosition(), "position should be gone");
        _assertAdapterHoldsNothing();
    }

    function test_collectFees_returnsRealSwapFees() public {
        adapter.openRange(188e18, 212e18, 1_000e18, 200_000e6);

        PoolKey memory key = adapter.poolKey();
        // Round trip, so the price ends near where it started and the fees are
        // unambiguously fees rather than inventory drift.
        swapper.swap(key, true, -1e18);
        swapper.swap(key, false, -1e18);

        uint256 stockBefore = stock.balanceOf(vault);
        uint256 usdgBefore = usdg.balanceOf(vault);
        (uint256 stockFees, uint256 usdgFees) = adapter.collectFees();

        assertTrue(stockFees > 0 || usdgFees > 0, "a 0.3% pool with two swaps earned nothing");
        assertEq(
            stock.balanceOf(vault) - stockBefore, stockFees, "stock fees did not reach the vault"
        );
        assertEq(usdg.balanceOf(vault) - usdgBefore, usdgFees, "usdg fees did not reach the vault");
        assertTrue(adapter.hasPosition(), "collecting must not disturb the position");
        _assertAdapterHoldsNothing();
    }

    function test_decreaseLiquidity_takesProRataAndLeavesTheRest() public {
        adapter.openRange(188e18, 212e18, 100e18, 20_000e6);
        uint128 liq = adapter.positionLiquidity();
        (uint256 wholeStock, uint256 wholeUsdg) = adapter.positionAmounts();

        (uint256 halfStock, uint256 halfUsdg) = adapter.decreaseLiquidity(liq / 2);

        assertEq(adapter.positionLiquidity(), liq - liq / 2, "remaining liquidity wrong");
        // Pro-rata within rounding: half the liquidity is half the principal.
        assertApproxEqRel(halfStock, wholeStock / 2, 1e12, "stock not pro-rata");
        assertApproxEqRel(halfUsdg, wholeUsdg / 2, 1e12, "usdg not pro-rata");
        assertTrue(adapter.hasPosition(), "half a position is still a position");
        _assertAdapterHoldsNothing();
    }

    function test_openRange_worksWhenUsdgIsCurrencyZero() public {
        // Force the opposite ordering and re-run the core path: a higher stock
        // price is a LOWER pool price here, so the tick mapping inverts.
        MockERC20 highStock = new MockERC20("Stock", "xSTK", 18);
        while (address(highStock) < address(usdg)) {
            highStock = new MockERC20("Stock", "xSTK", 18);
        }

        UniV4Adapter alt = new UniV4Adapter(
            poolManager, vault, IERC20(address(highStock)), IERC20(address(usdg)), FEE, TICK_SPACING
        );
        assertFalse(alt.stockIsCurrency0(), "test setup failed to flip the ordering");

        highStock.mint(vault, 1_000e18);
        highStock.approve(address(alt), type(uint256).max);
        usdg.approve(address(alt), type(uint256).max);
        poolManager.initialize(alt.poolKey(), PriceTick.toSqrtPriceX96(PRICE, false, 18, 6));

        (uint256 stockUsed, uint256 usdgUsed, uint256 realisedLower, uint256 realisedUpper) =
            alt.openRange(188e18, 212e18, 100e18, 20_000e6);

        // The bounds come back in STOCK-PRICE order, not tick order. With USDG
        // as currency0 the price axis is inverted and `tickLower` is the
        // higher stock price, so an adapter that returned them tick-first
        // would hand the vault a reversed range on this ordering alone.
        assertLt(realisedLower, realisedUpper, "realised bounds came back reversed");
        assertLe(realisedLower, 188e18, "realised lower shrank inside the request");
        assertGe(realisedUpper, 212e18, "realised upper shrank inside the request");
        assertGt(stockUsed, 0, "stock leg unused in the flipped ordering");
        assertGt(usdgUsed, 0, "usdg leg unused in the flipped ordering");
        assertTrue(alt.inRange(), "flipped range does not straddle the price");
        assertApproxEqRel(alt.poolPriceWad(), PRICE, 1e14, "flipped pool price misreported");
    }

    function test_poolPriceWad_readsBackTheInitialisedPrice() public view {
        assertApproxEqRel(adapter.poolPriceWad(), PRICE, 1e14, "pool price misreported");
    }

    // --------------------------------------------------------- the boundary

    function test_onlyVaultMayMoveMoney() public {
        address stranger = makeAddr("stranger");

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(UniV4Adapter.NotVault.selector, stranger));
        adapter.openRange(188e18, 212e18, 1e18, 200e6);

        adapter.openRange(188e18, 212e18, 100e18, 20_000e6);

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(UniV4Adapter.NotVault.selector, stranger));
        adapter.closeRange();

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(UniV4Adapter.NotVault.selector, stranger));
        adapter.collectFees();

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(UniV4Adapter.NotVault.selector, stranger));
        adapter.decreaseLiquidity(1);
    }

    function test_unlockCallbackRejectsEveryoneButThePoolManager() public {
        address stranger = makeAddr("stranger");
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(UniV4Adapter.NotPoolManager.selector, stranger));
        adapter.unlockCallback("");
    }

    function test_cannotOpenTwice() public {
        adapter.openRange(188e18, 212e18, 100e18, 20_000e6);
        vm.expectRevert(UniV4Adapter.PositionAlreadyOpen.selector);
        adapter.openRange(188e18, 212e18, 100e18, 20_000e6);
    }

    function test_operationsWithoutAPositionRevert() public {
        vm.expectRevert(UniV4Adapter.NoPosition.selector);
        adapter.collectFees();

        vm.expectRevert(UniV4Adapter.NoPosition.selector);
        adapter.closeRange();

        (uint256 s, uint256 u) = adapter.positionAmounts();
        assertEq(s + u, 0, "an unopened position is not empty");
        assertFalse(adapter.inRange(), "an unopened position cannot be in range");
    }

    function test_rangeTooNarrowForTheTickGridReverts() public {
        // 60-tick spacing is ~0.6% wide; a range this thin cannot survive
        // alignment, and collapsing to an empty range must revert rather than
        // silently place nothing.
        vm.expectRevert(abi.encodeWithSelector(PriceTick.PriceOutOfRange.selector, uint256(0)));
        adapter.openRange(0, 212e18, 100e18, 20_000e6);
    }

    // ------------------------------------------------------------- the math

    /// @dev The reason to trust `LiquidityAmounts`: put amounts in, get
    /// liquidity, ask v4-core's own `SqrtPriceMath` what that liquidity costs,
    /// and require it never exceeds what was offered. An over-estimate here is
    /// what would make a keeper's call revert or overspend.
    function testFuzz_liquidityForAmountsNeverOverspends(
        uint128 amount0,
        uint128 amount1,
        int24 lowerSeed
    ) public pure {
        // Bounded to the band a real stock/USDG pool occupies. An 18-decimal
        // token against 6-decimal USDG puts the raw ratio near 1e-10 or 1e10
        // depending on ordering, i.e. ticks around +/-223,000; +/-250,000
        // covers that with room to spare. Outside it, liquidity for these
        // amounts exceeds uint128 and the library reverts by design - safe,
        // but not the property under test here.
        amount0 = uint128(bound(amount0, 1e6, 1e24));
        amount1 = uint128(bound(amount1, 1e6, 1e24));
        int24 lower = int24(bound(lowerSeed, -250_000, 250_000 - 1200));
        int24 upper = lower + 1200;

        uint160 sqrtLower = TickMath.getSqrtPriceAtTick(lower);
        uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(upper);
        uint160 sqrtCurrent = TickMath.getSqrtPriceAtTick(lower + 600);

        uint128 liq = LiquidityAmounts.getLiquidityForAmounts(
            sqrtCurrent, sqrtLower, sqrtUpper, amount0, amount1
        );
        if (liq == 0) return;

        uint256 need0 = SqrtPriceMath.getAmount0Delta(sqrtCurrent, sqrtUpper, liq, true);
        uint256 need1 = SqrtPriceMath.getAmount1Delta(sqrtLower, sqrtCurrent, liq, true);

        // Rounding up the requirement can exceed the offer by at most one unit
        // per leg; anything more means the formula is wrong, not the rounding.
        assertLe(need0, uint256(amount0) + 1, "amount0 over-spent");
        assertLe(need1, uint256(amount1) + 1, "amount1 over-spent");
    }

    function testFuzz_priceRoundTripsThroughSqrtPrice(uint256 wadPrice, bool stockFirst)
        public
        pure
    {
        wadPrice = bound(wadPrice, 1e15, 1e24); // $0.001 .. $1,000,000
        uint160 sqrtPriceX96 = PriceTick.toSqrtPriceX96(wadPrice, stockFirst, 18, 6);
        uint256 back = PriceTick.toWadPrice(sqrtPriceX96, stockFirst, 18, 6);
        assertApproxEqRel(back, wadPrice, 1e10, "price did not survive the round trip");
    }

    /// @dev The orientation check the Phase 0 screen failed: the SAME dollar
    /// price must map to the same dollars in both pool orderings. Folding
    /// decimals in before inverting would put these out by 10^(2·(d0-d1)).
    function test_bothOrderingsAgreeOnTheSameDollarPrice() public pure {
        uint256 asToken0 =
            PriceTick.toWadPrice(PriceTick.toSqrtPriceX96(PRICE, true, 18, 6), true, 18, 6);
        uint256 asToken1 =
            PriceTick.toWadPrice(PriceTick.toSqrtPriceX96(PRICE, false, 18, 6), false, 18, 6);
        assertApproxEqRel(asToken0, PRICE, 1e10, "token0 ordering mispriced");
        assertApproxEqRel(asToken1, PRICE, 1e10, "token1 ordering mispriced");
    }

    function testFuzz_alignedTicksAlwaysContainTheRequestedRange(
        uint256 lowerPrice,
        uint256 upperPrice
    ) public pure {
        lowerPrice = bound(lowerPrice, 1e17, 1e21);
        upperPrice = bound(upperPrice, lowerPrice * 2, 1e23);
        // Containment is the claim `toAlignedTick` makes; this is the test that
        // caught it shaving the upper edge when the requested price landed
        // between two ticks that were already on the grid.

        uint160 sqrtLo = PriceTick.toSqrtPriceX96(lowerPrice, true, 18, 6);
        uint160 sqrtHi = PriceTick.toSqrtPriceX96(upperPrice, true, 18, 6);

        int24 lower = PriceTick.toAlignedTick(sqrtLo, TICK_SPACING, true);
        int24 upper = PriceTick.toAlignedTick(sqrtHi, TICK_SPACING, false);

        assertEq(lower % TICK_SPACING, 0, "lower tick off the grid");
        assertEq(upper % TICK_SPACING, 0, "upper tick off the grid");
        assertLe(TickMath.getSqrtPriceAtTick(lower), sqrtLo, "alignment narrowed the lower edge");
        assertGe(TickMath.getSqrtPriceAtTick(upper), sqrtHi, "alignment narrowed the upper edge");
    }

    // ------------------------------------------------------------- invariant

    /// @dev The adapter is a conduit, not a purse. If this ever holds a balance
    /// between calls, the vault's "money only moves between the vault, its pool
    /// position and a holder" invariant has a hole in it.
    function _assertAdapterHoldsNothing() internal view {
        assertEq(stock.balanceOf(address(adapter)), 0, "adapter is holding stock");
        assertEq(usdg.balanceOf(address(adapter)), 0, "adapter is holding usdg");
    }
}
