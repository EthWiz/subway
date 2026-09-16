// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";

import {BaseVault} from "../src/BaseVault.sol";
import {Router} from "../src/Router.sol";
import {VaultFactory} from "../src/VaultFactory.sol";
import {UniV4Adapter} from "../src/adapters/UniV4Adapter.sol";
import {RangePolicy} from "../src/policy/RangePolicy.sol";
import {PriceTick} from "../src/libraries/PriceTick.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {MockERC20, MockFeed} from "./Mocks.sol";
import {Swapper} from "./v4/Swapper.sol";
import {LiquidityProvider} from "./v4/Liquidity.sol";

/// @notice The unhedged base vault, end to end against a real Uniswap v4 pool.
///
/// The four claims under test are the ones the design rests on:
///
///   1. A redeemer is paid their pro-rata slice and nobody else's claim moves.
///   2. Redemption never reads a price, so a dead feed cannot trap a holder.
///   3. The share price never reads the pool tick.
///   4. The keeper can change the range's shape and nothing else.
contract BaseVaultTest is Test {
    using StateLibrary for IPoolManager;

    IPoolManager internal poolManager;
    MockERC20 internal stock;
    MockERC20 internal usdg;
    MockFeed internal feed;
    UniV4Adapter internal adapter;
    BaseVault internal vault;
    VaultFactory internal factory;
    Router internal router;
    Swapper internal swapper;
    LiquidityProvider internal backgroundLp;

    address internal keeper = makeAddr("keeper");
    address internal admin = makeAddr("admin");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint24 internal constant FEE = 3000;
    int24 internal constant TICK_SPACING = 60;
    uint256 internal constant PRICE = 200e18;

    /// @dev Sized so the vault's own range is a realistic minority of the
    /// pool — comfortably under A6's 15% cap at the deposit sizes used here.
    int256 internal constant BACKGROUND_LIQUIDITY = 4e17;

    function setUp() public {
        poolManager = IPoolManager(
            deployCode("out/PoolManager.sol/PoolManager.json", abi.encode(address(this)))
        );

        // Ordering fixed so the pool key is deterministic across runs.
        stock = new MockERC20("Stock", "xSTK", 18);
        usdg = new MockERC20("USD Global", "USDG", 6);
        feed = new MockFeed(int256(200e8)); // 8-decimal Chainlink answer

        // The vault address is needed by the adapter and vice versa, so the
        // adapter is deployed against a predicted vault address.
        address predictedVault =
            vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        adapter = new UniV4Adapter(
            poolManager,
            predictedVault,
            IERC20(address(stock)),
            IERC20(address(usdg)),
            FEE,
            TICK_SPACING
        );
        vault = new BaseVault(
            BaseVault.Config({
                name: "Subway Stock",
                symbol: "xSTK",
                stock: address(stock),
                usdg: address(usdg),
                feed: address(feed),
                pool: address(adapter),
                keeper: keeper,
                admin: admin,
                boundsDelay: 2 days,
                maxTotalAssets: type(uint256).max,
                maxPoolShare: 0.15e18,
                bounds: RangePolicy.Bounds({
                    maxFeedAge: 2 hours,
                    minHalfWidth: 0.01e18,
                    maxHalfWidth: 0.25e18,
                    maxDivergence: 0.005e18
                })
            })
        );
        assertEq(address(vault), predictedVault, "vault address prediction failed");

        factory = new VaultFactory(admin, address(usdg), makeAddr("lighter"));
        router = new Router(factory);
        swapper = new Swapper(poolManager);

        poolManager.initialize(
            adapter.poolKey(), PriceTick.toSqrtPriceX96(PRICE, adapter.stockIsCurrency0(), 18, 6)
        );

        stock.mint(address(swapper), 100_000e18);
        usdg.mint(address(swapper), 100_000_000e6);

        // Somebody else in the pool. The vault must be a minority LP for A6's
        // share cap to admit it at all, and a sole-LP fixture also hands every
        // manipulation fee straight back to the vault under test.
        backgroundLp = new LiquidityProvider(poolManager);
        stock.mint(address(backgroundLp), 1e12 * 1e18);
        usdg.mint(address(backgroundLp), 1e12 * 1e6);
        _provideBackground(adapter, BACKGROUND_LIQUIDITY);

        _fund(alice);
        _fund(bob);
    }

    /// @dev A band of third-party liquidity straddling the pool's current
    /// price, placed relative to the live tick so it does not depend on which
    /// token sorts first.
    function _provideBackground(UniV4Adapter target, int256 liquidity) internal {
        (, int24 tick,,) = poolManager.getSlot0(target.poolKey().toId());
        int24 lo = ((tick - 6_000) / TICK_SPACING) * TICK_SPACING;
        int24 hi = ((tick + 6_000) / TICK_SPACING) * TICK_SPACING;
        backgroundLp.provide(target.poolKey(), lo, hi, liquidity);
    }

    function _fund(address who) internal {
        stock.mint(who, 10_000e18);
        usdg.mint(who, 10_000_000e6);
        vm.startPrank(who);
        stock.approve(address(vault), type(uint256).max);
        usdg.approve(address(vault), type(uint256).max);
        stock.approve(address(router), type(uint256).max);
        usdg.approve(address(router), type(uint256).max);
        vm.stopPrank();
    }

    function _deposit(address who, uint256 stockAmt, uint256 usdgAmt) internal returns (uint256) {
        return _deposit(who, stockAmt, usdgAmt, 0);
    }

    function _deposit(address who, uint256 stockAmt, uint256 usdgAmt, uint256 minShares)
        internal
        returns (uint256)
    {
        vm.prank(who);
        return vault.deposit(stockAmt, usdgAmt, minShares, who);
    }

    function _openRange() internal {
        // Balances are read BEFORE the prank: `vm.prank` applies to the next
        // call, and a `balanceOf` in the argument list would consume it.
        uint256 stockAmt = stock.balanceOf(address(vault));
        uint256 usdgAmt = usdg.balanceOf(address(vault));
        vm.prank(keeper);
        vault.openRange(188e18, 212e18, stockAmt, usdgAmt);
    }

    // ------------------------------------------------------------- the claims

    function test_depositMintsAgainstNavAndSecondDepositorIsNotDiluted() public {
        uint256 aliceShares = _deposit(alice, 10e18, 2_000e6);
        assertGt(aliceShares, 0, "no shares minted");

        // $2,000 of stock + $2,000 USDG = $4,000.
        assertApproxEqRel(
            vault.convertToAssets(aliceShares), 4_000e6, 1e12, "alice's claim mispriced"
        );

        uint256 bobShares = _deposit(bob, 10e18, 2_000e6);
        assertApproxEqRel(
            bobShares, aliceShares, 1e12, "identical deposits minted different shares"
        );
        assertApproxEqRel(vault.convertToAssets(aliceShares), 4_000e6, 1e12, "alice diluted by bob");
    }

    function test_redeemPaysProRataAndLeavesOthersWhole() public {
        _deposit(alice, 10e18, 2_000e6);
        _deposit(bob, 10e18, 2_000e6);
        _openRange();

        uint256 bobClaimBefore = vault.convertToAssets(vault.balanceOf(bob));
        uint256 aliceShares = vault.balanceOf(alice);
        (uint256 predStock, uint256 predUsdg) = vault.previewRedeemAmounts(aliceShares);

        vm.prank(alice);
        (uint256 stockOut, uint256 usdgOut) = vault.redeem(aliceShares, alice);

        assertApproxEqRel(stockOut, predStock, 1e12, "stock payout missed its preview");
        assertApproxEqRel(usdgOut, predUsdg, 1e12, "usdg payout missed its preview");
        assertEq(vault.balanceOf(alice), 0, "shares not burned");

        // The whole point: Bob's claim is unchanged by Alice leaving.
        assertApproxEqRel(
            vault.convertToAssets(vault.balanceOf(bob)), bobClaimBefore, 1e12, "bob's claim moved"
        );
        assertTrue(adapter.hasPosition(), "one exit should not close the range");
    }

    function test_redeemerTakesTheirShareOfFeesWithThem() public {
        _deposit(alice, 100e18, 20_000e6);
        _openRange();

        PoolKey memory key = adapter.poolKey();
        swapper.swap(key, true, -5e18);
        swapper.swap(key, false, -5e18);

        // Fees are inside the position, not yet collected. A pro-rata
        // liquidity withdrawal must bring them out in the same proportion.
        uint256 half = vault.balanceOf(alice) / 2;
        (uint256 s1, uint256 u1) = vault.previewRedeemAmounts(half);

        vm.prank(alice);
        (uint256 stockOut, uint256 usdgOut) = vault.redeem(half, alice);

        // The preview reads principal only, so the realised payout must be at
        // least the preview: the difference is the fee slice.
        assertGe(stockOut + usdgOut * 1e12, s1 + u1 * 1e12, "redeemer left fees behind");
    }

    /// @dev Claim 1, the version that can actually fail.
    ///
    /// The test above has ONE holder, so "the redeemer took their fees" and
    /// "the redeemer took EVERYONE's fees" look identical. This is the
    /// two-holder form, and it catches the v4 rule the first version of this
    /// vault got wrong: `modifyLiquidity` pays a position's WHOLE accrued fee
    /// balance to whoever changes its liquidity, however little they remove.
    ///
    /// The sharp assertion is preview-vs-actual rather than a size bound. A
    /// redeemer who is paid their own fee slice matches the preview exactly; a
    /// redeemer who sweeps the pot exceeds it by everyone else's fees, and
    /// that gap does not shrink with the size of the redemption — which is
    /// precisely what makes the bug worth one share to exploit.
    function test_aTinyRedeemerCannotTakeEveryonesFees() public {
        // Two holders, and between them a vault that stays inside A6's
        // share-of-pool cap.
        _deposit(alice, 50e18, 10_000e6);
        _deposit(bob, 50e18, 10_000e6);
        _openRange();

        // Real fees, from real round trips through the range. Larger than the
        // vault, because the vault now earns only its slice of them.
        PoolKey memory key = adapter.poolKey();
        swapper.swap(key, true, -100e18);
        swapper.swap(key, false, -20_000e6);

        (uint256 feeStock, uint256 feeUsdg) = adapter.pendingFees();
        uint256 feeValue = feeUsdg + feeStock * 200 / 1e12;
        assertGt(feeValue, 1e6, "test earned no fees worth measuring");

        // Alice leaves with 1% of her holding — about 0.5% of the supply.
        uint256 tiny = vault.balanceOf(alice) / 100;
        (uint256 pStock, uint256 pUsdg) = vault.previewRedeemAmounts(tiny);

        vm.prank(alice);
        (uint256 stockOut, uint256 usdgOut) = vault.redeem(tiny, alice);

        // She is paid what she was quoted. Under the bug she is paid that plus
        // the other ~99.5% of the fee pot.
        uint256 quoted = pUsdg + pStock * 200 / 1e12;
        uint256 paid = usdgOut + stockOut * 200 / 1e12;
        assertApproxEqAbs(paid, quoted, feeValue / 10, "redeemer paid more than their quote");

        // And the fees are still in the vault for the holder who earned them:
        // Bob holds ~99.5% of what is left, so his claim must still carry
        // essentially the whole fee pot.
        uint256 remaining = vault.totalAssets();
        (uint256 bStock, uint256 bUsdg) = vault.previewRedeemAmounts(vault.balanceOf(bob));
        uint256 bobClaim = bUsdg + bStock * 200 / 1e12;
        uint256 bobFraction = vault.balanceOf(bob) * 1e18 / vault.totalSupply();
        assertApproxEqRel(
            bobClaim, remaining * bobFraction / 1e18, 0.01e18, "the remaining holder was left short"
        );
    }

    /// @dev Claim 2. A redeemer must not need the oracle, because needing it
    /// would mean an outage traps every holder.
    function test_redeemWorksWithADeadFeed() public {
        _deposit(alice, 10e18, 2_000e6);
        _openRange();

        feed.setPaused(true);
        vm.warp(block.timestamp + 30 days); // also stale

        // Deposits stop...
        vm.prank(bob);
        vm.expectRevert(RangePolicy.FeedPaused.selector);
        vault.deposit(1e18, 200e6, 0, bob);

        // ...and the keeper cannot move the range...
        vm.prank(keeper);
        vm.expectRevert(RangePolicy.FeedPaused.selector);
        vault.openRange(188e18, 212e18, 0, 0);

        // ...but leaving still works, and pays real money.
        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        (uint256 stockOut, uint256 usdgOut) = vault.redeem(shares, alice);
        assertTrue(stockOut > 0 || usdgOut > 0, "a dead feed trapped a holder");
    }

    /// @dev Claim 3. The share price must not be a thing an attacker can move
    /// with capital.
    function test_sharePriceIgnoresThePoolTick() public {
        _deposit(alice, 100e18, 20_000e6);
        _openRange();

        uint256 before = vault.convertToAssets(1e18);
        uint256 poolPriceBefore = adapter.poolPriceWad();

        // Shove the pool hard in one direction. The feed does not move.
        swapper.swap(adapter.poolKey(), true, -500e18);
        assertLt(adapter.poolPriceWad(), poolPriceBefore * 99 / 100, "test failed to move the pool");

        // The share price may drift a little because the position's token MIX
        // changed, but it is valued at the feed throughout, so the change is
        // nothing like the pool's.
        uint256 afterPrice = vault.convertToAssets(1e18);
        assertApproxEqRel(afterPrice, before, 0.02e18, "share price tracked the pool tick");
    }

    /// @dev Claim 4. The keeper's whole power is the shape of one range.
    function test_keeperBoundsAndPowers() public {
        _deposit(alice, 100e18, 20_000e6);

        // Not the keeper.
        vm.prank(alice);
        vm.expectRevert(BaseVault.NotKeeper.selector);
        vault.openRange(188e18, 212e18, 1e18, 200e6);

        // Range must straddle the feed price.
        vm.prank(keeper);
        vm.expectRevert(
            abi.encodeWithSelector(
                RangePolicy.RangeNotStraddling.selector, uint256(210e18), PRICE, uint256(220e18)
            )
        );
        vault.openRange(210e18, 220e18, 1e18, 200e6);

        // And respect the width bounds.
        vm.prank(keeper);
        vm.expectRevert(
            abi.encodeWithSelector(
                RangePolicy.RangeTooWide.selector, uint256(0.5e18), uint256(0.25e18)
            )
        );
        vault.openRange(100e18, 300e18, 1e18, 200e6);

        // What it CAN do, and the limit of it: shape only. There is no keeper
        // entry point that names a recipient.
        _openRange();
        assertTrue(adapter.hasPosition(), "keeper could not open a valid range");
        assertEq(stock.balanceOf(keeper), 0, "keeper received stock");
        assertEq(usdg.balanceOf(keeper), 0, "keeper received usdg");
    }

    function test_erc4626ExitsRevertRatherThanLieAboutOneAsset() public {
        _deposit(alice, 10e18, 2_000e6);
        vm.prank(alice);
        vm.expectRevert(BaseVault.UseDualAssetRedeem.selector);
        vault.withdraw(1, alice, alice);

        vm.prank(alice);
        vm.expectRevert(BaseVault.UseDualAssetRedeem.selector);
        vault.redeem(1, alice, alice);

        assertEq(vault.maxWithdraw(alice), 0, "maxWithdraw should advertise zero");
        assertEq(vault.maxRedeem(alice), 0, "maxRedeem should advertise zero");
    }

    function test_cannotRedeemMoreThanHeld() public {
        _deposit(alice, 10e18, 2_000e6);
        uint256 held = vault.balanceOf(alice);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(BaseVault.InsufficientShares.selector, held + 1, held)
        );
        vault.redeem(held + 1, alice);
    }

    function test_lastRedeemerEmptiesTheVault() public {
        _deposit(alice, 10e18, 2_000e6);
        _openRange();

        uint256 all = vault.balanceOf(alice);
        vm.prank(alice);
        vault.redeem(all, alice);

        assertEq(vault.totalSupply(), 0, "shares outstanding after the last exit");
        assertEq(adapter.positionLiquidity(), 0, "liquidity stranded after the last exit");
        assertLt(stock.balanceOf(address(vault)), 1e6, "stock dust beyond rounding");
        assertLt(usdg.balanceOf(address(vault)), 10, "usdg dust beyond rounding");
    }

    // ---------------------------------------------------------------- router

    function test_routerDepositAndRedeemMatchTheDirectPath() public {
        address stockToken = address(stock);

        // The adapter is immutably bound to ONE vault, so a factory-created
        // vault needs its own adapter bound to the address the factory is
        // about to deploy at. Handing it the adapter that belongs to the
        // directly-deployed vault compiles and even passes an idle-balance
        // test, then reverts `NotVault` the first time a keeper touches the
        // range — which is the wiring this test exists to prove.
        address predicted = vm.computeCreateAddress(address(factory), vm.getNonce(address(factory)));
        UniV4Adapter routerAdapter = new UniV4Adapter(
            poolManager, predicted, IERC20(stockToken), IERC20(address(usdg)), FEE, TICK_SPACING
        );

        vm.prank(admin);
        factory.addPair(
            VaultFactory.PairParams({
                name: "Subway Stock",
                symbol: "xSTK",
                stock: stockToken,
                feed: address(feed),
                pool: address(routerAdapter),
                keeper: keeper,
                lighterMarketId: 7,
                boundsDelay: 2 days,
                maxTotalAssets: type(uint256).max,
                maxPoolShare: 0.15e18,
                bounds: RangePolicy.Bounds({
                    maxFeedAge: 2 hours,
                    minHalfWidth: 0.01e18,
                    maxHalfWidth: 0.25e18,
                    maxDivergence: 0.005e18
                })
            })
        );
        address base = factory.baseVaultFor(stockToken);
        assertEq(base, predicted, "factory vault address prediction failed");
        assertEq(routerAdapter.vault(), base, "adapter is not bound to the factory's vault");

        vm.prank(alice);
        uint256 shares = router.deposit(stockToken, 10e18, 2_000e6, 0, false, alice);
        assertGt(shares, 0, "router minted nothing");
        assertEq(BaseVault(base).balanceOf(alice), shares, "shares did not reach the depositor");
        assertEq(stock.balanceOf(address(router)), 0, "router kept stock");
        assertEq(usdg.balanceOf(address(router)), 0, "router kept usdg");

        // The part the old version of this test never reached: real liquidity
        // through the factory's own wiring, and fees earned on it.
        uint256 vaultStock = stock.balanceOf(base);
        uint256 vaultUsdg = usdg.balanceOf(base);
        vm.prank(keeper);
        BaseVault(base).openRange(188e18, 212e18, vaultStock, vaultUsdg);
        assertTrue(routerAdapter.hasPosition(), "factory vault could not open a range");

        PoolKey memory key = routerAdapter.poolKey();
        swapper.swap(key, true, -20e18);
        swapper.swap(key, false, -4_000e6);

        vm.startPrank(alice);
        BaseVault(base).approve(address(router), shares);
        (uint256 stockOut, uint256 usdgOut) = router.redeem(stockToken, shares, false, alice);
        vm.stopPrank();

        assertTrue(stockOut > 0 || usdgOut > 0, "router redeem paid nothing");
        assertEq(BaseVault(base).balanceOf(address(router)), 0, "router kept shares");
        assertEq(BaseVault(base).totalSupply(), 0, "sole holder left shares behind");
    }

    function test_hedgedPathsAreHonestlyUnavailable() public {
        vm.prank(admin);
        factory.addPair(
            VaultFactory.PairParams({
                name: "Subway Stock",
                symbol: "xSTK",
                stock: address(stock),
                feed: address(feed),
                pool: address(adapter),
                keeper: keeper,
                lighterMarketId: 7,
                boundsDelay: 2 days,
                maxTotalAssets: type(uint256).max,
                maxPoolShare: 0.15e18,
                bounds: RangePolicy.Bounds({
                    maxFeedAge: 2 hours,
                    minHalfWidth: 0.01e18,
                    maxHalfWidth: 0.25e18,
                    maxDivergence: 0.005e18
                })
            })
        );

        assertFalse(router.hedgeAvailable(address(stock)), "hedge advertised before it exists");

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Router.HedgedVaultNotDeployed.selector, address(stock))
        );
        router.deposit(address(stock), 10e18, 2_000e6, 0, true, alice);
    }

    function test_factoryRegistersOneBaseVaultAndOneHedgedVaultPerPair() public {
        VaultFactory.PairParams memory p = VaultFactory.PairParams({
            name: "Subway Stock",
            symbol: "xSTK",
            stock: address(stock),
            feed: address(feed),
            pool: address(adapter),
            keeper: keeper,
            lighterMarketId: 7,
            boundsDelay: 2 days,
            maxTotalAssets: type(uint256).max,
            maxPoolShare: 0.15e18,
            bounds: RangePolicy.Bounds({
                maxFeedAge: 2 hours,
                minHalfWidth: 0.01e18,
                maxHalfWidth: 0.25e18,
                maxDivergence: 0.005e18
            })
        });

        vm.prank(admin);
        address base = factory.addPair(p);

        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(VaultFactory.PairExists.selector, address(stock), base)
        );
        factory.addPair(p);

        address fakeHedged = makeAddr("hAMC");
        vm.prank(admin);
        factory.registerHedgedVault(address(stock), fakeHedged);
        assertEq(factory.hedgedVaultFor(address(stock)), fakeHedged, "registration did not stick");

        // Registering a wrapper does NOT advertise the hedged mode: the Router
        // still cannot route to it in Track A, and a toggle that lights up on
        // a path that always reverts is worse than no toggle.
        assertFalse(
            router.hedgeAvailable(address(stock)), "hedge advertised while routing still reverts"
        );
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Router.HedgedVaultNotDeployed.selector, address(stock))
        );
        router.deposit(address(stock), 10e18, 2_000e6, 0, true, alice);

        // Write-once: re-pointing a live wrapper would strand its holders.
        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(
                VaultFactory.HedgedVaultExists.selector, address(stock), fakeHedged
            )
        );
        factory.registerHedgedVault(address(stock), makeAddr("other"));
    }

    // ------------------------------------------------- A1: how a deposit prices
    //
    // The four tests `docs/plan.md` A1 asks for either way the open half of
    // that item is decided. Two of them prove the rails added with this
    // change; two measure the exposure the decision still has to close.

    /// @dev A1 face (3): first-deposit inflation, in the form that actually
    /// steals money rather than the form `NothingToMint` already blocked.
    ///
    /// The classic sequence is: open the vault with one raw unit, donate
    /// enough to make that unit worth $60, and let a $100 depositor round down
    /// to a single share worth $80. `NothingToMint` never saw it, because the
    /// victim does mint a nonzero share — it is just far too few.
    ///
    /// With the virtual offset the arithmetic inverts, and it inverts for a
    /// reason worth stating: the attacker's opening unit buys 1e12 shares
    /// rather than 1, so after the donation they own a small MINORITY of a
    /// vault they funded, and the donation lands mostly in the victim's
    /// pocket. Donating to a vault you do not control is simply a gift.
    function test_donationCannotInflateTheOpeningShare() public {
        address mallory = makeAddr("mallory");
        usdg.mint(mallory, 100e6);
        vm.prank(mallory);
        usdg.approve(address(vault), type(uint256).max);

        // 1. Open the vault with the smallest possible deposit.
        vm.prank(mallory);
        uint256 malloryShares = vault.deposit(0, 1, 0, mallory);
        assertEq(malloryShares, 1e12, "opening unit did not buy a whole share's worth");

        // 2. Donate, so one raw unit of deposit now looks like $60 of vault.
        vm.prank(mallory);
        usdg.transfer(address(vault), 59_999_999);
        assertEq(vault.totalAssets(), 60e6, "donation did not land");

        // 3. The victim deposits $100 and must not round down to dust.
        uint256 victimShares = _deposit(alice, 0, 100e6);
        assertGt(victimShares, malloryShares, "victim minted less than the opening unit");

        // 4. Both leave. The victim must come out whole; the attacker must eat
        //    the donation rather than the victim.
        vm.prank(alice);
        (, uint256 victimOut) = vault.redeem(victimShares, alice);
        assertGe(victimOut, 100e6, "victim lost money to the donation");

        vm.prank(mallory);
        (, uint256 malloryOut) = vault.redeem(malloryShares, mallory);
        assertLt(malloryOut, 60e6, "attacker got their donation back");
    }

    /// @dev A1 face (4): a depositor can put a floor under their own trade.
    ///
    /// The divergence gate bounds how far the mint can be repriced; it does
    /// not pin it. Inside the gate the pool still moves, the quote a depositor
    /// read still goes stale between quote and execution, and `minShares` is
    /// what lets them say how much of that they will wear. A depositor who
    /// demands exactly their quote gets exactly their quote or nothing.
    ///
    /// Note the move here is a legal one — 0.44%, inside ε. The version of
    /// this test that shoved the pool a quarter of the range no longer reaches
    /// `minShares` at all, because the gate refuses the deposit first.
    function test_minSharesRejectsADepositRepricedInsideTheGate() public {
        _deposit(alice, 100e18, 20_000e6);
        _openRange();

        uint256 quoted = vault.previewDeposit(2_000e6);

        swapper.swap(adapter.poolKey(), true, -70e18);
        assertLt(
            (PRICE - adapter.poolPriceWad()) * 1e18 / PRICE,
            0.005e18,
            "the move under test was not inside the gate"
        );
        assertLt(vault.previewDeposit(2_000e6), quoted, "pool move did not reprice the mint");

        vm.prank(bob);
        vm.expectPartialRevert(BaseVault.MinSharesNotMet.selector);
        vault.deposit(0, 2_000e6, quoted, bob);

        // And the floor is not a blanket veto: at the current quote it lands.
        assertGt(
            _deposit(bob, 0, 2_000e6, vault.previewDeposit(2_000e6)),
            0,
            "an honest deposit at its own quote was rejected"
        );
    }

    /// @dev A1 face (2), now gated — and the gate's residual, measured.
    ///
    /// The sequence this replaces used to run to completion: shove the pool,
    /// let a victim deposit against the moved NAV, shove it back, exit. It was
    /// kept as a characterisation test because the exposure needed a number
    /// before the fix could be chosen. The number said the distortion is
    /// quadratic in the divergence and capped by the range width, which is
    /// what made a divergence gate the answer rather than a redesign of the
    /// mint. `docs/a1-deposit-pricing.md` has the table.
    ///
    /// Both halves of the bargain are asserted here.
    ///
    /// **Outside the gate the deposit does not happen.** The distortion is
    /// still measured first, because the gate does not make it go away — it
    /// makes it unreachable from `deposit`, which is the only place it could
    /// cost anybody anything.
    ///
    /// **Inside the gate the residual is tiny.** A pool 0.44% from the feed —
    /// legal, ε is 0.5% — costs a $2,000 depositor about 1.8 bps. That is the
    /// number the gate was chosen on, and it is worth comparing against the
    /// alternative a depositor faces rather than against zero: the 30–100 bps
    /// of pool fee they would pay to go acquire the other leg themselves.
    function test_A1_gateBlocksTheManipulationAndCapsTheResidual() public {
        _deposit(alice, 100e18, 20_000e6);
        _openRange();

        uint256 navAtRest = vault.totalAssets();
        uint256 quoteAtRest = vault.previewDeposit(2_000e6);

        // --- inside the gate: allowed, and cheap ---
        uint256 snap = vm.snapshotState();
        swapper.swap(adapter.poolKey(), true, -70e18);

        uint256 divergence = (PRICE - adapter.poolPriceWad()) * 1e18 / PRICE;
        assertLt(divergence, 0.005e18, "test's small shove was not inside the gate");

        uint256 quoteMoved = vault.previewDeposit(2_000e6);
        uint256 shortfall = (quoteAtRest - quoteMoved) * 1e18 / quoteAtRest;
        emit log_named_decimal_uint("divergence allowed", divergence, 18);
        emit log_named_decimal_uint("residual shortfall", shortfall, 18);
        assertLt(shortfall, 0.0005e18, "residual inside the gate exceeded 5 bps");

        // And it is a real deposit, not a blocked one.
        assertGt(_deposit(bob, 0, 2_000e6), 0, "the gate blocked an honest deposit");
        vm.revertToState(snap);

        // --- outside the gate: refused ---
        swapper.swap(adapter.poolKey(), true, -1_000e18);
        assertGt(vault.totalAssets(), navAtRest * 101 / 100, "shove did not distort NAV");

        vm.prank(bob);
        vm.expectPartialRevert(RangePolicy.FeedPoolDiverged.selector);
        vault.deposit(0, 2_000e6, 0, bob);

        // Leaving is untouched. The gate refuses new money and never traps
        // existing money — the same asymmetry as the feed check.
        uint256 aliceShares = vault.balanceOf(alice);
        vm.prank(alice);
        (uint256 stockOut, uint256 usdgOut) = vault.redeem(aliceShares, alice);
        assertTrue(stockOut > 0 || usdgOut > 0, "the gate trapped a holder");
    }

    /// @dev Fees a range has earned but not been paid are assets of the
    /// holders who earned them. `totalAssets` counts them, so a depositor
    /// arriving mid-period is priced against a NAV that already includes them
    /// and cannot buy into yield they were not there for.
    ///
    /// The failure this catches is the quiet one: drop `pendingFees` from
    /// `totalAssets` and every test above still passes, because the mint
    /// denominator is only visibly wrong when somebody mints against it.
    function test_depositWhileFeesArePendingDoesNotBuyIntoThem() public {
        uint256 aliceShares = _deposit(alice, 100e18, 20_000e6);
        _openRange();

        swapper.swap(adapter.poolKey(), true, -20e18);
        swapper.swap(adapter.poolKey(), false, -4_000e6);

        (uint256 feeStock, uint256 feeUsdg) = adapter.pendingFees();
        uint256 feeValue = _value(feeStock, feeUsdg);
        assertGt(feeValue, 1e6, "test earned no fees worth measuring");

        uint256 aliceClaimBefore = vault.convertToAssets(aliceShares);
        uint256 bobShares = _deposit(bob, 0, 2_000e6);

        // Alice keeps every cent of what her liquidity earned...
        assertApproxEqRel(
            vault.convertToAssets(aliceShares),
            aliceClaimBefore,
            1e14,
            "the new depositor took a slice of pending fees"
        );
        // ...and Bob's claim is worth what he paid, not a cent more.
        assertLe(vault.convertToAssets(bobShares), 2_000e6, "new depositor bought into yield");
    }

    /// @dev Every test above runs with the stock token as `currency0`, which
    /// is one of the two pool shapes. `UniV4Adapter.t.sol` covers the flipped
    /// ordering at the adapter, but the vault's own arithmetic — the value
    /// divisor, the mint, the pro-rata exit — has never been run against it,
    /// and a sign error in the tick mapping surfaces as a mispriced share
    /// rather than a failed swap.
    function test_theWholeVaultWorksWhenUsdgIsCurrencyZero() public {
        (BaseVault altVault, UniV4Adapter altAdapter, MockERC20 altStock) = _altOrderingStack();
        assertFalse(altAdapter.stockIsCurrency0(), "test setup failed to flip the ordering");

        vm.startPrank(alice);
        altStock.approve(address(altVault), type(uint256).max);
        usdg.approve(address(altVault), type(uint256).max);
        uint256 shares = altVault.deposit(10e18, 2_000e6, 0, alice);
        vm.stopPrank();

        // $2,000 of stock plus $2,000 of USDG, priced through the same
        // divisor as the other ordering.
        assertApproxEqRel(
            altVault.convertToAssets(shares), 4_000e6, 1e12, "flipped ordering mispriced the mint"
        );

        vm.prank(keeper);
        altVault.openRange(188e18, 212e18, 10e18, 2_000e6);
        assertTrue(altAdapter.hasPosition(), "flipped ordering could not open a range");

        swapper.swap(altAdapter.poolKey(), true, -2e18);
        swapper.swap(altAdapter.poolKey(), false, -2e18);

        vm.prank(alice);
        (uint256 stockOut, uint256 usdgOut) = altVault.redeem(shares, alice);
        assertGt(stockOut, 0, "flipped ordering paid no stock");
        assertGt(usdgOut, 0, "flipped ordering paid no usdg");
        assertEq(altVault.totalSupply(), 0, "sole holder left shares behind");
    }

    // --------------------------------------------------------------- helpers

    /// @dev Both tokens of an address, valued in USDG at the feed price.
    function _wealth(address who) internal view returns (uint256) {
        return _value(stock.balanceOf(who), usdg.balanceOf(who));
    }

    function _value(uint256 stockAmt, uint256 usdgAmt) internal pure returns (uint256) {
        // PRICE is 200e18 and the divisor is 1e18 * 1e18 / 1e6 = 1e30.
        return usdgAmt + stockAmt * PRICE / 1e30;
    }

    /// @dev A second, independent vault whose stock token sorts ABOVE USDG,
    /// so the pool's `currency0` is USDG and every tick mapping inverts.
    function _altOrderingStack()
        internal
        returns (BaseVault altVault, UniV4Adapter altAdapter, MockERC20 altStock)
    {
        altStock = new MockERC20("High Stock", "xHI", 18);
        while (address(altStock) < address(usdg)) {
            altStock = new MockERC20("High Stock", "xHI", 18);
        }

        address predicted = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        altAdapter = new UniV4Adapter(
            poolManager,
            predicted,
            IERC20(address(altStock)),
            IERC20(address(usdg)),
            FEE,
            TICK_SPACING
        );
        altVault = new BaseVault(
            BaseVault.Config({
                name: "Subway High",
                symbol: "xHI",
                stock: address(altStock),
                usdg: address(usdg),
                feed: address(feed),
                pool: address(altAdapter),
                keeper: keeper,
                admin: admin,
                boundsDelay: 2 days,
                maxTotalAssets: type(uint256).max,
                maxPoolShare: 0.15e18,
                bounds: RangePolicy.Bounds({
                    maxFeedAge: 2 hours,
                    minHalfWidth: 0.01e18,
                    maxHalfWidth: 0.25e18,
                    maxDivergence: 0.005e18
                })
            })
        );
        assertEq(address(altVault), predicted, "alt vault address prediction failed");

        poolManager.initialize(altAdapter.poolKey(), PriceTick.toSqrtPriceX96(PRICE, false, 18, 6));
        altStock.mint(alice, 10_000e18);
        altStock.mint(address(swapper), 10_000e18);
        altStock.mint(address(backgroundLp), 1e12 * 1e18);
        _provideBackground(altAdapter, BACKGROUND_LIQUIDITY);
    }

    // ------------------------------------------- A3: the policy binds the POSITION

    /// @dev The case written up in `docs/decisions.md`, now a revert.
    ///
    /// A $200 feed, `maxHalfWidth` 25%, and a request for exactly $150–$250.
    /// The request is legal — its half-width is exactly the bound, and the
    /// check rejects only what exceeds it. The tick grid then rounds both
    /// edges outward onto spacing 60, and the realised range is about
    /// $149.33–$250.17, whose NARROW side is already past 25%.
    ///
    /// Before A3 this opened. `RangePolicy` was checked against the keeper's
    /// request, and the position the vault actually held was nobody's
    /// business. A safety bound the position does not have to satisfy is not
    /// a safety bound, so now the second check catches it and the whole
    /// transaction reverts.
    function test_gridWideningPastTheBoundIsRejected() public {
        _deposit(alice, 100e18, 20_000e6);
        uint256 sBal = stock.balanceOf(address(vault));
        uint256 uBal = usdg.balanceOf(address(vault));

        // The request itself is within the policy: exactly at the bound.
        assertEq((PRICE - 150e18) * 1e18 / PRICE, 0.25e18, "test lost its worked case");

        vm.prank(keeper);
        vm.expectPartialRevert(RangePolicy.RangeTooWide.selector);
        vault.openRange(150e18, 250e18, sBal, uBal);

        assertFalse(adapter.hasPosition(), "a rejected range still opened a position");
        assertEq(stock.allowance(address(vault), address(adapter)), 0, "allowance survived");
        assertEq(usdg.allowance(address(vault), address(adapter)), 0, "allowance survived");
    }

    /// @dev And the headroom rule that follows from it: back the request off
    /// by more than one tick spacing and the same range opens fine. The
    /// keeper's job is to ask for less than the bound, which is the right
    /// place for the problem — the contract's job is to make sure it did.
    function test_aRequestWithHeadroomStillOpens() public {
        _deposit(alice, 100e18, 20_000e6);
        uint256 sBal = stock.balanceOf(address(vault));
        uint256 uBal = usdg.balanceOf(address(vault));

        vm.prank(keeper);
        vault.openRange(155e18, 245e18, sBal, uBal);
        assertTrue(adapter.hasPosition(), "a range with headroom was rejected");

        (uint256 rLo, uint256 rHi) = _realisedBounds();
        assertLe(_halfWidth(rLo, rHi), 0.25e18, "opened range exceeds the bound");
    }

    /// @dev A3 asks for this fuzzed against the real `PoolManager`, because
    /// the widening is a property of the tick grid and a mock has no grid.
    ///
    /// The invariant is the whole point of the item: whatever the keeper asks
    /// for, either the call reverts or the range the vault is now holding
    /// satisfies `RangePolicy`. The half-width is recomputed here from the
    /// adapter's own ticks rather than from what `openRange` returned, so the
    /// test would still catch an adapter that reported bounds it had not
    /// opened.
    function testFuzz_realisedRangeAlwaysSatisfiesThePolicy(uint256 lowerRaw, uint256 upperRaw)
        public
    {
        _deposit(alice, 100e18, 20_000e6);
        uint256 lower = bound(lowerRaw, PRICE * 60 / 100, PRICE * 99 / 100);
        uint256 upper = bound(upperRaw, PRICE * 101 / 100, PRICE * 140 / 100);

        uint256 sBal = stock.balanceOf(address(vault));
        uint256 uBal = usdg.balanceOf(address(vault));

        vm.prank(keeper);
        try vault.openRange(lower, upper, sBal, uBal) {
            (uint256 rLo, uint256 rHi) = _realisedBounds();
            assertLt(rLo, PRICE, "opened a range that does not straddle the feed");
            assertGt(rHi, PRICE, "opened a range that does not straddle the feed");

            uint256 half = _halfWidth(rLo, rHi);
            assertLe(half, 0.25e18, "opened a range wider than maxHalfWidth");
            assertGe(half, 0.01e18, "opened a range narrower than minHalfWidth");
        } catch {
            assertFalse(adapter.hasPosition(), "a reverted open left a position behind");
        }
    }

    /// @dev The adapter's live ticks, read back as vault-unit prices.
    function _realisedBounds() internal view returns (uint256 lo, uint256 hi) {
        uint256 a = PriceTick.toWadPrice(
            TickMath.getSqrtPriceAtTick(adapter.tickLower()), adapter.stockIsCurrency0(), 18, 6
        );
        uint256 b = PriceTick.toWadPrice(
            TickMath.getSqrtPriceAtTick(adapter.tickUpper()), adapter.stockIsCurrency0(), 18, 6
        );
        return a < b ? (a, b) : (b, a);
    }

    /// @dev `RangePolicy`'s rule, re-derived rather than imported: a range is
    /// judged on its NARROWER side.
    function _halfWidth(uint256 lo, uint256 hi) internal pure returns (uint256) {
        uint256 down = (PRICE - lo) * 1e18 / PRICE;
        uint256 up = (hi - PRICE) * 1e18 / PRICE;
        return down < up ? down : up;
    }

    /// @dev The gate has nothing to protect when the vault holds no position:
    /// NAV is then idle balances priced at the feed, with no pool term in it
    /// at all. Gating anyway would block every deposit a vault takes before
    /// its first range opens, which is all of the ones it starts life with.
    function test_theGateIsSkippedWhenThereIsNoPosition() public {
        _deposit(alice, 100e18, 20_000e6);
        _openRange();

        // Push the pool far outside the gate, then take the vault out of it.
        swapper.swap(adapter.poolKey(), true, -1_000e18);
        vm.prank(keeper);
        vault.closeRange();
        assertFalse(adapter.hasPosition(), "range did not close");

        // The pool is still miles from the feed, and it no longer matters.
        assertGt(_deposit(bob, 0, 2_000e6), 0, "the gate blocked a pool-independent deposit");
    }

    /// @dev ε is floored at the pool's swap fee, because the fee is the width
    /// of the no-arbitrage band: a 0.3% pool sits anywhere within ±0.3% of
    /// fair with nobody manipulating anything. A gate tighter than that does
    /// not catch attackers, it blocks depositors. And it is capped at the
    /// range half-width, because the distortion it exists to bound is itself
    /// capped there — a gate wider than the range never binds first.
    function test_divergenceBoundsMustBeLiveable() public {
        RangePolicy.Bounds memory tooTight = RangePolicy.Bounds({
            maxFeedAge: 2 hours,
            minHalfWidth: 0.01e18,
            maxHalfWidth: 0.25e18,
            maxDivergence: 0.001e18 // below the pool's 0.3% fee
        });
        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(
                RangePolicy.DivergenceTighterThanTheFee.selector,
                uint256(0.001e18),
                uint256(0.003e18)
            )
        );
        vault.proposeBounds(tooTight);

        RangePolicy.Bounds memory tooWide = RangePolicy.Bounds({
            maxFeedAge: 2 hours,
            minHalfWidth: 0.01e18,
            maxHalfWidth: 0.25e18,
            maxDivergence: 0.3e18 // wider than the range it guards
        });
        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(
                RangePolicy.DivergenceWiderThanTheRange.selector, uint256(0.3e18), uint256(0.25e18)
            )
        );
        vault.proposeBounds(tooWide);
    }

    // ---------------------------------------------- A4: keys and the timelock

    /// @dev The point of the timelock, stated as the thing it prevents.
    ///
    /// A keeper bound that can be widened in the same block it is exceeded is
    /// not a bound — the admin and the keeper together could open any range at
    /// all and the policy would never have said no. So the widening has to
    /// wait, and while it waits the old bound still binds.
    function test_aBoundCannotBeWidenedInTheBlockItIsExceeded() public {
        _deposit(alice, 100e18, 20_000e6);
        uint256 sBal = stock.balanceOf(address(vault));
        uint256 uBal = usdg.balanceOf(address(vault));

        // A range the current policy refuses.
        vm.prank(keeper);
        vm.expectPartialRevert(RangePolicy.RangeTooWide.selector);
        vault.openRange(140e18, 260e18, sBal, uBal);

        // The admin asks for a wider bound. Asking changes nothing today.
        RangePolicy.Bounds memory wider = RangePolicy.Bounds({
            maxFeedAge: 2 hours,
            minHalfWidth: 0.01e18,
            maxHalfWidth: 0.4e18,
            maxDivergence: 0.005e18
        });
        vm.prank(admin);
        vault.proposeBounds(wider);

        vm.prank(keeper);
        vm.expectPartialRevert(RangePolicy.RangeTooWide.selector);
        vault.openRange(140e18, 260e18, sBal, uBal);

        // Nor one second early.
        vm.warp(block.timestamp + 2 days - 1);
        vm.expectPartialRevert(BaseVault.TimelockNotElapsed.selector);
        vault.applyBounds();

        // After the delay it applies — and anyone may finish it, since the
        // admin already decided and there is nothing here to choose.
        vm.warp(block.timestamp + 1);
        vm.prank(alice);
        vault.applyBounds();

        // The feed went stale while we waited; the keeper needs a live one.
        feed.set(int256(200e8), block.timestamp);

        (,, uint256 maxHalfWidth,) = vault.bounds();
        assertEq(maxHalfWidth, 0.4e18, "bounds did not take effect");

        vm.prank(keeper);
        vault.openRange(140e18, 260e18, sBal, uBal);
        assertTrue(adapter.hasPosition(), "the widened bound did not take effect");

        // The proposal is consumed, not reusable.
        vm.expectRevert(BaseVault.NoPendingBounds.selector);
        vault.applyBounds();
    }

    /// @dev A4: the admin can be rotated. It used to be immutable and set to
    /// whoever owned the factory at `addPair`, so rotating a compromised
    /// factory key left `setKeeper` and `setBounds` on every live vault with
    /// the old one.
    function test_adminRotatesAndTheOldKeyGoesDead() public {
        address newAdmin = makeAddr("newAdmin");

        vm.prank(alice);
        vm.expectRevert(BaseVault.NotAdmin.selector);
        vault.setAdmin(newAdmin);

        vm.prank(admin);
        vault.setAdmin(newAdmin);
        assertEq(vault.admin(), newAdmin, "admin did not rotate");

        // The old key is done: it cannot rotate back, set the keeper, or move
        // the policy.
        vm.prank(admin);
        vm.expectRevert(BaseVault.NotAdmin.selector);
        vault.setAdmin(admin);

        vm.prank(admin);
        vm.expectRevert(BaseVault.NotAdmin.selector);
        vault.setKeeper(alice);

        // And the new one works.
        vm.prank(newAdmin);
        vault.setKeeper(alice);
        assertEq(vault.keeper(), alice, "new admin could not set the keeper");

        // Rotating to nowhere is refused: it would freeze the keeper and the
        // policy at whatever they happen to be.
        vm.prank(newAdmin);
        vm.expectRevert(BaseVault.ZeroAddress.selector);
        vault.setAdmin(address(0));
    }

    /// @dev A proposal the admin thinks better of costs nothing to withdraw,
    /// and needs no delay to do it: cancelling can only leave the bounds where
    /// they already are.
    function test_aProposalCanBeCancelled() public {
        RangePolicy.Bounds memory wider = RangePolicy.Bounds({
            maxFeedAge: 2 hours,
            minHalfWidth: 0.01e18,
            maxHalfWidth: 0.4e18,
            maxDivergence: 0.005e18
        });
        vm.prank(admin);
        vault.proposeBounds(wider);

        vm.prank(alice);
        vm.expectRevert(BaseVault.NotAdmin.selector);
        vault.cancelBounds();

        vm.prank(admin);
        vault.cancelBounds();

        vm.warp(block.timestamp + 30 days);
        vm.expectRevert(BaseVault.NoPendingBounds.selector);
        vault.applyBounds();

        (,, uint256 maxHalfWidth,) = vault.bounds();
        assertEq(maxHalfWidth, 0.25e18, "cancelled proposal changed the bounds");
    }

    // ------------------------------------------------- A6: pause and the caps

    /// @dev A pause is a brake on the way IN. The property worth testing is
    /// not that it stops deposits — it is that it stops nothing else.
    function test_pauseStopsDepositsAndNothingElse() public {
        _deposit(alice, 100e18, 20_000e6);
        _openRange();

        vm.prank(alice);
        vm.expectRevert(BaseVault.NotAdmin.selector);
        vault.setDepositsPaused(true);

        vm.prank(admin);
        vault.setDepositsPaused(true);

        vm.prank(bob);
        vm.expectRevert(BaseVault.DepositsArePaused.selector);
        vault.deposit(0, 2_000e6, 0, bob);

        // Leaving works, and pays the same as it would have unpaused.
        uint256 half = vault.balanceOf(alice) / 2;
        (uint256 predStock, uint256 predUsdg) = vault.previewRedeemAmounts(half);
        vm.prank(alice);
        (uint256 stockOut, uint256 usdgOut) = vault.redeem(half, alice);
        assertApproxEqRel(stockOut, predStock, 1e12, "pause changed what a redeemer is paid");
        assertApproxEqRel(usdgOut, predUsdg, 1e12, "pause changed what a redeemer is paid");

        // And the keeper can still manage the position it is holding — a
        // pause on new money is not a freeze on the vault.
        vm.prank(keeper);
        vault.collectFees();

        vm.prank(admin);
        vault.setDepositsPaused(false);
        assertGt(_deposit(bob, 0, 2_000e6), 0, "unpause did not restore deposits");
    }

    /// @dev The NAV cap is a ceiling on how big the strategy gets, not on how
    /// much has ever been deposited — so money leaving makes room for money
    /// arriving. Anything else would ratchet a vault shut.
    function test_theNavCapBindsAndMoneyLeavingReopensIt() public {
        vm.prank(admin);
        vault.setCaps(50_000e6, 0.15e18);

        _deposit(alice, 100e18, 20_000e6); // $40k, fits

        // $20k more would be $60k against a $50k cap.
        vm.prank(bob);
        vm.expectPartialRevert(BaseVault.CapExceeded.selector);
        vault.deposit(0, 20_000e6, 0, bob);

        // What fits, fits.
        assertGt(_deposit(bob, 0, 5_000e6), 0, "a deposit inside the cap was refused");

        // Alice leaves; the room is Bob's to take.
        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        vault.redeem(shares, alice);
        assertGt(_deposit(bob, 0, 20_000e6), 0, "an exit did not make room under the cap");
    }

    /// @dev The share-of-pool cap, against a pool that has other liquidity in
    /// it — which is the only situation where the cap means anything, and the
    /// reason this suite provides background liquidity at all.
    function test_theVaultCannotTakeMoreThanItsShareOfThePool() public {
        _deposit(alice, 100e18, 20_000e6);
        _deposit(bob, 100e18, 20_000e6);

        uint256 sBal = stock.balanceOf(address(vault));
        uint256 uBal = usdg.balanceOf(address(vault));

        // Everything at once would be ~18% of the pool's active liquidity.
        vm.prank(keeper);
        vm.expectPartialRevert(BaseVault.PoolShareExceeded.selector);
        vault.openRange(188e18, 212e18, sBal, uBal);
        assertFalse(adapter.hasPosition(), "a rejected range still opened a position");

        // Half of it is not. The cap bounds the POSITION, so a vault over the
        // line keeps working — it just cannot put all of itself in the pool.
        vm.prank(keeper);
        vault.openRange(188e18, 212e18, sBal / 2, uBal / 2);
        assertTrue(adapter.hasPosition(), "a range inside the cap was refused");

        uint256 share = uint256(adapter.positionLiquidity()) * 1e18 / adapter.poolLiquidity();
        assertLt(share, 0.15e18, "opened a position over the cap");

        // Nobody is trapped by it either: exits do not read the cap.
        uint256 aliceShares = vault.balanceOf(alice);
        vm.prank(alice);
        (uint256 stockOut, uint256 usdgOut) = vault.redeem(aliceShares, alice);
        assertTrue(stockOut > 0 || usdgOut > 0, "the cap trapped a holder");
    }

    /// @dev Zero is refused on both caps. A zero NAV ceiling reads as
    /// "unlimited" or "closed" depending on who is guessing, and a zero pool
    /// share makes every range the keeper opens revert.
    function test_capsCannotBeSetToSomethingUnreadable() public {
        vm.prank(admin);
        vm.expectRevert(BaseVault.CapsInvalid.selector);
        vault.setCaps(0, 0.15e18);

        vm.prank(admin);
        vm.expectRevert(BaseVault.CapsInvalid.selector);
        vault.setCaps(type(uint256).max, 0);

        vm.prank(admin);
        vm.expectRevert(BaseVault.CapsInvalid.selector);
        vault.setCaps(type(uint256).max, 1e18 + 1);

        vm.prank(alice);
        vm.expectRevert(BaseVault.NotAdmin.selector);
        vault.setCaps(1_000e6, 0.15e18);
    }
}
