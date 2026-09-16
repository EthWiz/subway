// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {SubwayVault} from "../src/SubwayVault.sol";
import {RangePolicy} from "../src/policy/RangePolicy.sol";
import {MockERC20, MockFeed, MockLighter, MockPool} from "./Mocks.sol";

/// @notice The four invariants the vault's design rests on, plus the keeper
/// bounds that make them true. If one of these ever fails, the product is not
/// shippable — they are not regression tests for past bugs, they are the
/// safety argument itself.
///
///   1. Money only ever moves between the vault, its pool position, its own
///      Lighter account, and a share holder.
///   2. `convertToAssets` never reads the pool tick or a keeper-supplied value.
///   3. The keeper cannot exceed `maxMargin`, open a range that violates
///      `RangePolicy`, or settle an epoch the queue cannot be paid from.
///   4. `panic()` leaves every holder able to exit without the keeper.
contract SubwayVaultTest is Test {
    MockERC20 stock;
    MockERC20 usdg;
    MockFeed feed;
    MockLighter lighter;
    MockPool pool;
    SubwayVault vault;

    address keeper = makeAddr("keeper");
    address guardian = makeAddr("guardian");
    address admin = makeAddr("admin");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant WAD = 1e18;
    /// @dev $100.00 at 8 decimals, the Chainlink convention.
    int256 constant PRICE_8DP = 100e8;
    uint256 constant PRICE = 100e18;

    function setUp() public {
        stock = new MockERC20("Stock", "STK", 18);
        usdg = new MockERC20("USDG", "USDG", 18);
        feed = new MockFeed(PRICE_8DP);
        lighter = new MockLighter(address(usdg));

        // The pool needs the vault's address and the vault needs the pool's,
        // so compute the vault address first.
        address vaultAddr = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        pool = new MockPool(address(stock), address(usdg), vaultAddr);

        vault = new SubwayVault(
            SubwayVault.Config({
                name: "Subway STK",
                symbol: "subSTK",
                stock: address(stock),
                usdg: address(usdg),
                feed: address(feed),
                lighter: address(lighter),
                pool: address(pool),
                keeper: keeper,
                guardian: guardian,
                admin: admin,
                haircut: 0.35e18,
                maxMargin: 100_000e18,
                bounds: RangePolicy.Bounds({maxFeedAge: 2 hours, minHalfWidth: 0.01e18, maxHalfWidth: 0.25e18})
            })
        );
        assertEq(address(vault), vaultAddr, "vault address prediction");

        vm.warp(1_000_000);
        feed.set(PRICE_8DP, block.timestamp);

        for (uint256 i = 0; i < 2; ++i) {
            address who = i == 0 ? alice : bob;
            stock.mint(who, 1_000e18);
            usdg.mint(who, 1_000_000e18);
            vm.startPrank(who);
            stock.approve(address(vault), type(uint256).max);
            usdg.approve(address(vault), type(uint256).max);
            vm.stopPrank();
        }
    }

    function _deposit(address who, uint256 stockAmt, uint256 usdgAmt) internal returns (uint256) {
        vm.prank(who);
        return vault.deposit(stockAmt, usdgAmt, who);
    }

    // ------------------------------------------------- floor NAV and shares

    function test_firstDepositMintsValueAtFeedPrice() public {
        // 10 stock at 100 + 1,000 USDG = 2,000 of value.
        uint256 shares = _deposit(alice, 10e18, 1_000e18);
        assertEq(shares, 2_000e18, "shares == value on an empty vault");
        assertEq(vault.navFloor(), 2_000e18, "floor == deposited value");
        assertEq(vault.convertToAssets(shares), 2_000e18, "round trip");
    }

    function test_navFloorIgnoresUnsettledHedgePnlAndHaircutsMargin() public {
        _deposit(alice, 0, 10_000e18);
        assertEq(vault.navFloor(), 10_000e18);

        vm.prank(keeper);
        vault.fundHedge(4_000e18);

        // 6,000 idle + 4,000 x (1 - 0.35) = 8,600. The vault is not poorer; the
        // floor simply refuses to count margin it cannot verify is recoverable.
        assertEq(vault.navFloor(), 8_600e18, "margin enters the floor haircut");
        assertEq(vault.marginLedger(), 4_000e18);

        // Hedge profit arriving in the rollup is invisible until it is
        // withdrawn — that is the whole point of the floor.
        usdg.mint(address(lighter), 5_000e18);
        assertEq(vault.navFloor(), 8_600e18, "unsettled hedge PnL counts as zero");
    }

    function test_navFloorUsesTheFeedNotThePoolTick() public {
        _deposit(alice, 10e18, 1_000e18);
        vm.prank(keeper);
        vault.openRange(90e18, 110e18, 10e18, 1_000e18);

        uint256 before = vault.navFloor();

        // A pool that reports wildly more stock does not move the share price
        // by itself — the stock is still priced at the feed. This is the
        // manipulation the floor is built to ignore.
        pool.accrue(1e18, 0);
        assertEq(vault.navFloor(), before + 100e18, "extra stock valued AT THE FEED");

        // And moving the feed is what moves the floor.
        feed.set(200e8, block.timestamp);
        assertGt(vault.navFloor(), before + 100e18, "feed drives the price");
    }

    function test_navFloorDegradesRatherThanRevertingOnAStaleFeed() public {
        _deposit(alice, 10e18, 1_000e18);
        skip(3 hours); // beyond maxFeedAge

        // A lender calling this view must not be bricked by a stale feed, but
        // it also must not be told the stock is worth its last known price.
        assertEq(vault.navFloor(), 1_000e18, "only the USDG leg survives a stale feed");

        // Acting on it, however, is refused outright.
        vm.prank(keeper);
        vm.expectRevert();
        vault.openRange(90e18, 110e18, 1e18, 100e18);
    }

    function test_depositCannotDiluteExistingHolders() public {
        uint256 aliceShares = _deposit(alice, 0, 1_000e18);
        uint256 aliceValueBefore = vault.convertToAssets(aliceShares);

        // A large second deposit at the same price must leave Alice's claim
        // intact. Minting at the floor is what guarantees this.
        _deposit(bob, 0, 500_000e18);
        assertApproxEqAbs(vault.convertToAssets(aliceShares), aliceValueBefore, 1, "no dilution");
    }

    // -------------------------------------------------------- keeper bounds

    function test_keeperCannotExceedMarginCap() public {
        _deposit(alice, 0, 200_000e18);
        vm.prank(keeper);
        vault.fundHedge(100_000e18);

        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(SubwayVault.MarginCapExceeded.selector, 100_001e18, 100_000e18));
        vault.fundHedge(1e18);
    }

    function test_keeperCannotWithdrawMoreMarginThanItPosted() public {
        _deposit(alice, 0, 10_000e18);
        vm.prank(keeper);
        vault.fundHedge(1_000e18);

        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(SubwayVault.InsufficientMargin.selector, 2_000e18, 1_000e18));
        vault.withdrawHedge(2_000e18);
    }

    function test_rangePolicyRejectsBadRanges() public {
        _deposit(alice, 10e18, 10_000e18);

        // Does not straddle the feed price.
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(RangePolicy.RangeNotStraddling.selector, 101e18, PRICE, 120e18));
        vault.openRange(101e18, 120e18, 1e18, 100e18);

        // Too narrow: 0.5% against a 1% floor.
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(RangePolicy.RangeTooNarrow.selector, 0.005e18, 0.01e18));
        vault.openRange(99.5e18, 100.5e18, 1e18, 100e18);

        // Too wide: 50% against a 25% cap.
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(RangePolicy.RangeTooWide.selector, 0.5e18, 0.25e18));
        vault.openRange(50e18, 150e18, 1e18, 100e18);

        // A paused feed blocks the action entirely.
        feed.setPaused(true);
        vm.prank(keeper);
        vm.expectRevert(RangePolicy.FeedPaused.selector);
        vault.openRange(94e18, 106e18, 1e18, 100e18);
    }

    function test_lopsidedRangeIsJudgedOnItsNarrowSide() public {
        _deposit(alice, 10e18, 10_000e18);
        // 0.5% below, 40% above: straddles, but converts to one token almost
        // immediately on a small move down.
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(RangePolicy.RangeTooNarrow.selector, 0.005e18, 0.01e18));
        vault.openRange(99.5e18, 140e18, 1e18, 100e18);
    }

    function test_onlyKeeperMayActAndOnlyAdminMayRotate() public {
        _deposit(alice, 0, 10_000e18);

        vm.prank(alice);
        vm.expectRevert(SubwayVault.NotKeeper.selector);
        vault.fundHedge(1e18);

        vm.prank(keeper);
        vm.expectRevert(SubwayVault.NotAdmin.selector);
        vault.setKeeper(alice);

        vm.prank(admin);
        vault.setKeeper(bob);
        assertEq(vault.keeper(), bob);
    }

    function test_openRangeLeavesNoStandingAllowance() public {
        _deposit(alice, 10e18, 1_000e18);
        vm.prank(keeper);
        vault.openRange(94e18, 106e18, 10e18, 1_000e18);

        // A live allowance is a standing claim on vault funds by the adapter.
        assertEq(stock.allowance(address(vault), address(pool)), 0);
        assertEq(usdg.allowance(address(vault), address(pool)), 0);
    }

    // ------------------------------------------------------ redemption queue

    function test_queueSettlesAtTheNextEpochFloorAndPaysExactly() public {
        uint256 aliceShares = _deposit(alice, 0, 10_000e18);
        _deposit(bob, 0, 10_000e18);

        vm.prank(alice);
        uint256 id = vault.requestRedeem(aliceShares);

        // Shares burn on request: a queued holder stops taking the risk.
        assertEq(vault.balanceOf(alice), 0);
        assertEq(vault.totalSupply(), 10_000e18);
        assertEq(vault.pendingShares(), aliceShares);

        vm.prank(keeper);
        vault.settleEpoch();

        vm.prank(alice);
        uint256 got = vault.claim(id);
        assertEq(got, 10_000e18, "half the 20,000 floor");
        assertEq(usdg.balanceOf(alice), 1_000_000e18, "whole position returned");
        assertEq(vault.reservedAssets(), 0);
    }

    function test_settleEpochRevertsWhenTheQueueIsNotCovered() public {
        uint256 shares = _deposit(alice, 0, 10_000e18);
        // Keeper posts most of the vault as margin, so idle USDG cannot pay.
        vm.prank(keeper);
        vault.fundHedge(9_000e18);

        vm.prank(alice);
        vault.requestRedeem(shares);

        // The epoch may not advance into a promise the vault cannot keep.
        vm.prank(keeper);
        vm.expectRevert();
        vault.settleEpoch();

        // Once the keeper has pulled margin back, it settles.
        vm.prank(keeper);
        vault.withdrawHedge(9_000e18);
        vm.prank(keeper);
        vault.settleEpoch();
        assertEq(vault.epoch(), 1);
    }

    function test_reservedAssetsAreNotCountedForRemainingHolders() public {
        uint256 aliceShares = _deposit(alice, 0, 10_000e18);
        uint256 bobShares = _deposit(bob, 0, 10_000e18);

        vm.prank(alice);
        vault.requestRedeem(aliceShares);
        vm.prank(keeper);
        vault.settleEpoch();

        // Alice's 10,000 is settled but unclaimed and sits in the vault. It
        // must not inflate Bob's share price.
        assertEq(vault.reservedAssets(), 10_000e18);
        assertEq(vault.convertToAssets(bobShares), 10_000e18, "Bob still owns exactly his half");
    }

    function test_claimIsOwnerOnlyAndOnce() public {
        uint256 shares = _deposit(alice, 0, 10_000e18);
        vm.prank(alice);
        uint256 id = vault.requestRedeem(shares);

        // Not settled yet.
        vm.prank(alice);
        vm.expectRevert(SubwayVault.NotSettled.selector);
        vault.claim(id);

        vm.prank(keeper);
        vault.settleEpoch();

        vm.prank(bob);
        vm.expectRevert(SubwayVault.NotOwner.selector);
        vault.claim(id);

        vm.prank(alice);
        vault.claim(id);
        vm.prank(alice);
        vm.expectRevert(SubwayVault.AlreadyClaimed.selector);
        vault.claim(id);
    }

    function test_queuedPayoutsSumExactlyToTheAmountReserved() public {
        // Three odd-sized requests in one epoch: the dust must not strand.
        uint256 a = _deposit(alice, 0, 3_333e18);
        uint256 b = _deposit(bob, 0, 6_667e18);

        vm.prank(alice);
        uint256 idA = vault.requestRedeem(a);
        vm.prank(bob);
        uint256 idB = vault.requestRedeem(b);

        vm.prank(keeper);
        vault.settleEpoch();

        uint256 reserved = vault.reservedAssets();
        vm.prank(alice);
        uint256 gotA = vault.claim(idA);
        vm.prank(bob);
        uint256 gotB = vault.claim(idB);

        assertEq(gotA + gotB, reserved, "payouts sum to the reservation");
        assertEq(vault.reservedAssets(), 0, "nothing stranded");
    }

    function test_synchronousExitsRevertPointingAtTheQueue() public {
        _deposit(alice, 0, 1_000e18);
        vm.expectRevert(SubwayVault.UseRedemptionQueue.selector);
        vault.redeem(1, alice, alice);
        vm.expectRevert(SubwayVault.UseRedemptionQueue.selector);
        vault.withdraw(1, alice, alice);
        assertEq(vault.maxRedeem(alice), 0, "advertises zero rather than lying");
    }

    // ------------------------------------------------------------- the panic

    function test_panicFreezesTheKeeperAndLetsEveryHolderLeave() public {
        _deposit(alice, 10e18, 5_000e18);
        _deposit(bob, 10e18, 5_000e18);

        vm.prank(keeper);
        vault.openRange(94e18, 106e18, 20e18, 8_000e18);
        vm.prank(keeper);
        vault.fundHedge(2_000e18);

        vm.prank(guardian);
        vault.panic();

        assertTrue(vault.frozen());
        assertTrue(lighter.cancelled(), "orders force-cancelled via L1");
        assertEq(vault.marginLedger(), 0, "margin pulled home");
        assertEq(pool.hasPosition(), false, "liquidity pulled");

        // The keeper is now inert.
        vm.prank(keeper);
        vm.expectRevert(SubwayVault.Frozen.selector);
        vault.fundHedge(1e18);

        // And both holders exit pro-rata without anyone's help.
        uint256 aliceShares = vault.balanceOf(alice);
        vm.prank(alice);
        (uint256 s1, uint256 u1) = vault.emergencyRedeem(aliceShares);
        assertGt(s1, 0);
        assertGt(u1, 0);

        uint256 bobShares = vault.balanceOf(bob);
        vm.prank(bob);
        (uint256 s2, uint256 u2) = vault.emergencyRedeem(bobShares);

        assertEq(vault.totalSupply(), 0, "everyone out");
        assertApproxEqAbs(s1, s2, 1, "pro rata");
        assertApproxEqAbs(u1, u2, 1, "pro rata");
        assertApproxEqAbs(stock.balanceOf(address(vault)), 0, 2, "vault drained of stock");
    }

    function test_panicIsCallableByTheKeeperItselfAndIsNotBlockedByFreeze() public {
        _deposit(alice, 0, 1_000e18);
        vm.prank(keeper);
        vault.panic();
        assertTrue(vault.frozen());

        // Idempotent: a second panic must not revert, or a guardian racing a
        // keeper could be locked out of the only safety control.
        vm.prank(guardian);
        vault.panic();
    }

    function test_emergencyRedeemRequiresAPanic() public {
        uint256 shares = _deposit(alice, 0, 1_000e18);
        vm.prank(alice);
        vm.expectRevert(SubwayVault.NotFrozen.selector);
        vault.emergencyRedeem(shares);
    }

    function test_emergencyRedeemCannotTakeAnotherHoldersSettledClaim() public {
        uint256 aliceShares = _deposit(alice, 0, 10_000e18);
        uint256 bobShares = _deposit(bob, 0, 10_000e18);

        vm.prank(alice);
        uint256 id = vault.requestRedeem(aliceShares);
        vm.prank(keeper);
        vault.settleEpoch();

        vm.prank(guardian);
        vault.panic();

        // Bob is now the only share holder, but Alice's settled 10,000 is
        // reserved and must not be drained by his exit.
        vm.prank(bob);
        (, uint256 u) = vault.emergencyRedeem(bobShares);
        assertEq(u, 10_000e18, "Bob gets his half, not the whole balance");

        vm.prank(alice);
        assertEq(vault.claim(id), 10_000e18, "Alice's claim survives the panic");
    }

    // --------------------------------------------------- money-movement rule

    function test_vaultNeverSendsFundsToAnAddressTheKeeperChooses() public {
        // The strongest statement the interfaces allow: no vault entry point
        // takes a recipient. Every payout target is derived — the caller for a
        // claim, the L1 owner for a Lighter withdrawal, the adapter for a
        // range. A keeper with a compromised key can lose money by trading
        // badly; it has no call that names a destination.
        _deposit(alice, 10e18, 1_000e18);

        uint256 vaultStock = stock.balanceOf(address(vault));
        uint256 vaultUsdg = usdg.balanceOf(address(vault));

        vm.startPrank(keeper);
        vault.openRange(94e18, 106e18, 5e18, 500e18);
        vault.fundHedge(200e18);
        vault.registerHedgeKey(hex"dead");
        vault.withdrawHedge(200e18);
        vault.closeRange();
        vm.stopPrank();

        // After a full keeper cycle every token is back in the vault.
        assertEq(stock.balanceOf(address(vault)), vaultStock);
        assertEq(usdg.balanceOf(address(vault)), vaultUsdg);
        assertEq(stock.balanceOf(keeper), 0);
        assertEq(usdg.balanceOf(keeper), 0);
    }

    function testFuzz_floorNeverExceedsWhatTheVaultCanVerify(uint96 usdgIn, uint96 margin) public {
        uint256 u = uint256(usdgIn);
        vm.assume(u > 1e18 && u < 500_000e18);
        // The keeper can never post more than the cap, so neither may the
        // fuzzer — exceeding it reverts by design and is covered elsewhere.
        uint256 cap = u < vault.maxMargin() ? u : vault.maxMargin();
        uint256 m = bound(uint256(margin), 0, cap);

        _deposit(alice, 0, u);
        if (m > 0) {
            vm.prank(keeper);
            vault.fundHedge(m);
        }

        // The floor is idle + haircut margin, and can never exceed the total
        // the vault actually put somewhere.
        uint256 floor = vault.navFloor();
        assertLe(floor, u, "floor never exceeds deposits when nothing has been earned");
    }
}
