// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";

import {BaseVault} from "../src/BaseVault.sol";
import {Router} from "../src/Router.sol";
import {VaultFactory} from "../src/VaultFactory.sol";
import {UniV4Adapter} from "../src/adapters/UniV4Adapter.sol";
import {RangePolicy} from "../src/policy/RangePolicy.sol";
import {PriceTick} from "../src/libraries/PriceTick.sol";
import {MockERC20, MockFeed} from "./Mocks.sol";
import {Swapper} from "./v4/Swapper.sol";

/// @notice The unhedged base vault, end to end against a real Uniswap v4 pool.
///
/// The four claims under test are the ones the design rests on:
///
///   1. A redeemer is paid their pro-rata slice and nobody else's claim moves.
///   2. Redemption never reads a price, so a dead feed cannot trap a holder.
///   3. The share price never reads the pool tick.
///   4. The keeper can change the range's shape and nothing else.
contract BaseVaultTest is Test {
    IPoolManager internal poolManager;
    MockERC20 internal stock;
    MockERC20 internal usdg;
    MockFeed internal feed;
    UniV4Adapter internal adapter;
    BaseVault internal vault;
    VaultFactory internal factory;
    Router internal router;
    Swapper internal swapper;

    address internal keeper = makeAddr("keeper");
    address internal admin = makeAddr("admin");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint24 internal constant FEE = 3000;
    int24 internal constant TICK_SPACING = 60;
    uint256 internal constant PRICE = 200e18;

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
                bounds: RangePolicy.Bounds({
                    maxFeedAge: 2 hours, minHalfWidth: 0.01e18, maxHalfWidth: 0.25e18
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
        _fund(alice);
        _fund(bob);
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
        _deposit(alice, 100e18, 20_000e6);
        _deposit(bob, 100e18, 20_000e6);
        _openRange();

        // Real fees, from real round trips through the range.
        PoolKey memory key = adapter.poolKey();
        swapper.swap(key, true, -20e18);
        swapper.swap(key, false, -4_000e6);

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
        swapper.swap(adapter.poolKey(), true, -300e18);
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
                bounds: RangePolicy.Bounds({
                    maxFeedAge: 2 hours, minHalfWidth: 0.01e18, maxHalfWidth: 0.25e18
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
                bounds: RangePolicy.Bounds({
                    maxFeedAge: 2 hours, minHalfWidth: 0.01e18, maxHalfWidth: 0.25e18
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
            bounds: RangePolicy.Bounds({
                maxFeedAge: 2 hours, minHalfWidth: 0.01e18, maxHalfWidth: 0.25e18
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

    /// @dev A1 face (4): a depositor can now put a floor under their own trade.
    ///
    /// Not a unit test of a comparison — the point is the sequence it defends.
    /// The victim quotes `previewDeposit`, an attacker moves the pool inside
    /// the range before the transaction lands, the quote goes stale, and the
    /// deposit reverts instead of silently minting fewer shares.
    function test_minSharesRejectsADepositRepricedByThePool() public {
        _deposit(alice, 100e18, 20_000e6);
        _openRange();

        // Bob quotes $2,000 of USDG and asks for no worse than 0.5% slippage.
        uint256 quoted = vault.previewDeposit(2_000e6);
        uint256 floor = quoted * 995 / 1000;

        // The pool moves; the feed does not. `totalAssets` marks both legs at
        // the feed, but the MIX it marks comes from the pool, so the mint
        // denominator moves anyway. That is A1 face (2), still open.
        swapper.swap(adapter.poolKey(), true, -300e18);
        assertLt(vault.previewDeposit(2_000e6), floor, "pool move did not reprice the mint");

        vm.prank(bob);
        vm.expectPartialRevert(BaseVault.MinSharesNotMet.selector);
        vault.deposit(0, 2_000e6, floor, bob);

        // And the floor is not a blanket veto: at the quote the deposit lands.
        uint256 shares = _deposit(bob, 0, 2_000e6, vault.previewDeposit(2_000e6));
        assertGt(shares, 0, "an honest deposit at its own quote was rejected");
    }

    /// @dev A1 face (2), measured rather than asserted away.
    ///
    /// Moving the pool inside the range and back changes `totalAssets` even
    /// with the feed still, because `positionAmounts` reports the mix the
    /// POOL's price implies. The full sequence — attacker shoves the pool, a
    /// victim deposits against the moved NAV, attacker shoves it back and
    /// exits — is the one that turns that into money, and this test exists to
    /// produce the number rather than to claim it is zero.
    ///
    /// Marking a range at a static feed while the pool walks away OVERSTATES
    /// it (the position's realised trades all happened at prices better than
    /// the mark), so the victim's deposit is divided by an inflated
    /// denominator and mints too few shares. The shortfall stays with the
    /// existing holders, which is what the attacker is.
    ///
    /// What the attacker pays for it, here, is the round trip's swap fees —
    /// and in this test the vault is the pool's only liquidity, so most of
    /// that comes straight back to them as a holder. A real pool with other
    /// LPs leaks more. That is precisely why this is a characterisation test
    /// with a loose bound and a log line, not a pass/fail on profitability:
    /// the bound documents today's exposure, and the A1 decision (divergence
    /// gate, or minting from quantities) is what should drive it to zero. When
    /// that lands, this test becomes an `expectRevert`.
    /// @dev A1 face (2), measured end to end rather than asserted away.
    ///
    /// Moving the pool inside the range and back changes `totalAssets` with
    /// the feed still, because `positionAmounts` reports the mix the POOL's
    /// price implies. The sequence that turns that into money is: shove the
    /// pool, let a victim deposit against the moved NAV, shove it back, exit.
    /// This test runs it and reports the number, because A1 is a decision that
    /// wants an amount rather than an adjective.
    ///
    /// Two things come out of it, and they point opposite ways.
    ///
    /// **The mispricing is real and material.** Marking a range at a static
    /// feed while the pool walks away OVERSTATES it — the position's realised
    /// trades all happened at prices better than the mark — so the victim
    /// divides by an inflated denominator and mints too few shares. Measured
    /// here at about 1.75% of the deposit, from a shove of roughly a quarter
    /// of the range. That is the defect, and nothing in this change fixes it.
    ///
    /// **On this pool shape the attack still loses money.** The attacker has
    /// to push the price through the vault's own liquidity, and pays ~0.3%
    /// each way on the size it takes to move it. The NAV distortion is second
    /// order in the price move; the fee is first order. So the victim's share
    /// of the round trip's fees more than covers what the mispricing took off
    /// them, and the attacker ends up paying the victim a few dollars.
    ///
    /// **That second fact does not generalise, and is the reason A1 still
    /// blocks.** It holds only because the vault is the pool's ONLY liquidity
    /// here, so every fee the attacker pays comes back to the vault. A vault
    /// that is a minority of the pool pays most of those fees to other LPs
    /// while eating the whole distortion — and A6's vault-≤-15%-of-pool-TVL
    /// cap guarantees the vault is exactly that. An attacker who can move the
    /// price on a cheaper venue and let arbitrage carry it here pays nothing
    /// at all. So this test pins today's exposure; it does not close it.
    ///
    /// When A1's decision lands — a divergence gate, or minting from
    /// quantities — the deposit in step 2 should revert or reprice, and this
    /// test becomes an `expectRevert` rather than a measurement.
    function test_A1_poolManipulationAroundAVictimDeposit_isMeasured() public {
        // The attacker is a large incumbent holder; that is the position the
        // victim's shortfall accrues to.
        uint256 attackerShares = _deposit(alice, 100e18, 20_000e6);
        _openRange();

        uint256 attackerBefore = _wealth(address(swapper)) + vault.convertToAssets(attackerShares);
        uint256 victimIn = 2_000e6;
        uint256 quoteAtRest = vault.previewDeposit(victimIn);
        uint256 navAtRest = vault.totalAssets();

        // 1. Shove the pool inside the range. The feed does not move.
        swapper.swap(adapter.poolKey(), true, -300e18);

        uint256 navShoved = vault.totalAssets();
        uint256 quoteShoved = vault.previewDeposit(victimIn);
        emit log_named_decimal_uint("NAV at rest (USDG)", navAtRest, 6);
        emit log_named_decimal_uint("NAV shoved (USDG)", navShoved, 6);

        // The denominator moved, and by enough to matter: this is the defect.
        assertGt(navShoved, navAtRest * 101 / 100, "NAV distortion below the recorded floor");
        assertLt(navShoved, navAtRest * 110 / 100, "NAV distortion above its recorded bound");
        assertLt(quoteShoved, quoteAtRest * 99 / 100, "quote did not move with the denominator");

        // 2. The victim deposits against the inflated denominator.
        uint256 victimShares = _deposit(bob, 0, victimIn);

        // 3. Shove it back, and both sides leave.
        swapper.swap(adapter.poolKey(), false, -290e18);

        vm.prank(alice);
        (uint256 aStock, uint256 aUsdg) = vault.redeem(attackerShares, alice);
        uint256 attackerAfter = _wealth(address(swapper)) + _value(aStock, aUsdg);

        vm.prank(bob);
        (uint256 vStock, uint256 vUsdg) = vault.redeem(victimShares, bob);
        uint256 victimOut = _value(vStock, vUsdg);

        emit log_named_decimal_uint("victim deposited (USDG)", victimIn, 6);
        emit log_named_decimal_uint("victim recovered (USDG)", victimOut, 6);
        emit log_named_int("attacker P&L (USDG)", int256(attackerAfter) - int256(attackerBefore));

        // On this shape the round trip is a transfer FROM the attacker TO the
        // victim, via the fees the shoves paid into the vault's own range.
        assertLt(attackerAfter, attackerBefore, "manipulation turned a profit; A1 is now urgent");
        assertGt(victimOut, victimIn, "victim was not made whole by the fee round trip");
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
                bounds: RangePolicy.Bounds({
                    maxFeedAge: 2 hours, minHalfWidth: 0.01e18, maxHalfWidth: 0.25e18
                })
            })
        );
        assertEq(address(altVault), predicted, "alt vault address prediction failed");

        poolManager.initialize(altAdapter.poolKey(), PriceTick.toSqrtPriceX96(PRICE, false, 18, 6));
        altStock.mint(alice, 10_000e18);
        altStock.mint(address(swapper), 10_000e18);
    }
}
