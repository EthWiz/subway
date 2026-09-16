// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IPriceFeed} from "../interfaces/IPriceFeed.sol";

/// @title RangePolicy
/// @notice The on-chain bounds every keeper range change is checked against.
///
/// The keeper is a bounded operator: it may change the SHAPE of the position
/// but never its destination. This library is the shape half of that promise.
/// It exists as a separate, pure-ish unit because every rule here is a rule a
/// reviewer should be able to read without also reading the vault.
///
/// The rules are not arbitrary. Each one closes a way a range can lose money
/// that has nothing to do with being wrong about the price:
///
///   - A stale feed means the vault cannot know where the price is. Opening a
///     range around a two-hour-old equity print is opening it around a number,
///     not a price.
///   - A paused feed means a corporate action is in flight and the token's
///     unit value is about to change.
///   - A range that does not straddle the feed price is a directional bet
///     dressed as liquidity provision, and the hedge is sized for the former.
///   - A range narrower than the bound churns: it earns more per dollar and
///     spends the difference on gas and adverse selection as the price walks
///     out of it. Wider than the bound and the vault is a worse market maker
///     than simply holding.
///   - A pool far from the feed means the vault's own inventory mix is far
///     from the one the feed implies, and a deposit priced at the feed
///     against that inventory is mispriced. That is `maxDivergence`, and it
///     is the only rule here that guards a HOLDER rather than the position.
library RangePolicy {
    struct Bounds {
        /// @notice Oldest feed update the policy will act on, seconds.
        uint256 maxFeedAge;
        /// @notice Tightest allowed half-width, 1e18 = 100%.
        uint256 minHalfWidth;
        /// @notice Widest allowed half-width, 1e18 = 100%.
        uint256 maxHalfWidth;
        /// @notice How far the pool may sit from the feed before deposits
        /// stop, 1e18 = 100%. See `requireConverged`.
        uint256 maxDivergence;
    }

    uint256 internal constant WAD = 1e18;

    error FeedStale(uint256 updatedAt, uint256 maxAge);
    error FeedPaused();
    error FeedInvalid(int256 answer);
    error RangeNotStraddling(uint256 lower, uint256 price, uint256 upper);
    error RangeTooNarrow(uint256 halfWidth, uint256 min);
    error RangeTooWide(uint256 halfWidth, uint256 max);
    error BoundsInvalid();
    error FeedPoolDiverged(uint256 poolPrice, uint256 feedPrice, uint256 divergence, uint256 max);
    error DivergenceTighterThanTheFee(uint256 maxDivergence, uint256 swapFee);
    error DivergenceWiderThanTheRange(uint256 maxDivergence, uint256 maxHalfWidth);

    /// @notice Read the feed and return a usable price, or revert saying why
    /// it is not usable.
    /// @return price USDG per whole stock token, scaled to 1e18.
    function requireFreshPrice(IPriceFeed feed, Bounds memory bounds)
        internal
        view
        returns (uint256 price)
    {
        // Checked before the price is read at all: during a corporate action
        // the last answer is not merely old, it refers to a different thing.
        if (feed.oraclePaused()) revert FeedPaused();

        (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();
        if (answer <= 0) revert FeedInvalid(answer);
        if (block.timestamp > updatedAt + bounds.maxFeedAge) {
            revert FeedStale(updatedAt, bounds.maxFeedAge);
        }

        // Equity price scaled to WAD, then the share-count multiplier. A token
        // that has split is worth a fraction of the equity it names, and the
        // multiplier is the only thing that says so.
        // Safe: `answer <= 0` reverted above, so the value is strictly positive.
        // forge-lint: disable-next-line(unsafe-typecast)
        uint256 scaled = uint256(answer) * WAD / (10 ** feed.decimals());
        price = scaled * feed.uiMultiplier() / WAD;
        if (price == 0) revert FeedInvalid(answer);
    }

    /// @notice Revert unless the pool is close enough to the feed to price a
    /// deposit against.
    ///
    /// A deposit is valued at the feed and divided by the vault's NAV, whose
    /// stock and USDG QUANTITIES are whatever mix the pool's current price
    /// implies the range is holding. Marking a range at a static feed while
    /// the pool walks away from it OVERSTATES the range — every trade the
    /// position actually made happened at a price better than the mark — so
    /// the depositor divides by an inflated denominator and mints too few
    /// shares. The shortfall stays with the incumbent holders.
    ///
    /// Measured against the real `PoolManager`, that distortion is QUADRATIC
    /// in the divergence and capped by the range width: 1.79% for a ±6% range,
    /// 8.04% for a ±25% one. Quadratic is what makes a gate worth having —
    /// halving the bound quarters the residual. At 0.5% divergence the
    /// residual mispricing is about 2 bps. `docs/a1-deposit-pricing.md` has
    /// the table.
    ///
    /// This bounds the error; it does not remove it. Minting from quantities
    /// would remove it, and was rejected because it costs single-asset
    /// deposits. `minShares` remains the depositor's own backstop.
    function requireConverged(uint256 poolPrice, uint256 feedPrice, Bounds memory bounds)
        internal
        pure
    {
        uint256 diff = poolPrice > feedPrice ? poolPrice - feedPrice : feedPrice - poolPrice;
        uint256 divergence = diff * WAD / feedPrice;
        if (divergence > bounds.maxDivergence) {
            revert FeedPoolDiverged(poolPrice, feedPrice, divergence, bounds.maxDivergence);
        }
    }

    /// @notice Revert unless these bounds are ones a vault can actually run on.
    ///
    /// The two divergence rules are the interesting ones, and they fail in
    /// opposite directions.
    ///
    /// **Not tighter than the swap fee.** The fee is the width of the pool's
    /// no-arbitrage band: nobody closes a gap smaller than the fee they would
    /// pay to close it, so a 0.3% pool sits anywhere within ±0.3% of fair with
    /// nobody manipulating anything, and a 1% pool within ±1%. A gate tighter
    /// than that does not catch attackers, it blocks honest depositors
    /// whenever the pool is doing what pools normally do.
    ///
    /// **Not wider than the range.** The mispricing this gate exists to bound
    /// is itself capped by the range half-width, so a gate wider than the
    /// range never binds before the cap does and is not a gate at all.
    function requireValidBounds(Bounds memory bounds, uint256 swapFeeWad) internal pure {
        if (bounds.minHalfWidth == 0 || bounds.minHalfWidth > bounds.maxHalfWidth) {
            revert BoundsInvalid();
        }
        if (bounds.maxDivergence < swapFeeWad) {
            revert DivergenceTighterThanTheFee(bounds.maxDivergence, swapFeeWad);
        }
        if (bounds.maxDivergence > bounds.maxHalfWidth) {
            revert DivergenceWiderThanTheRange(bounds.maxDivergence, bounds.maxHalfWidth);
        }
    }

    /// @notice Revert unless [lower, upper] is a range this vault may hold.
    function requireValidRange(uint256 lower, uint256 upper, uint256 price, Bounds memory bounds)
        internal
        pure
    {
        if (bounds.minHalfWidth == 0 || bounds.minHalfWidth > bounds.maxHalfWidth) {
            revert BoundsInvalid();
        }
        // Strict: a range with the price exactly on an edge is already
        // one-sided and starts by selling the whole inventory.
        if (lower >= price || upper <= price) {
            revert RangeNotStraddling(lower, price, upper);
        }

        // Half-width is measured on the NARROWER side. A range that is 1%
        // below and 40% above straddles the price but behaves like the 1%
        // side, and it is the near edge that decides how soon the vault is
        // fully converted into one token.
        uint256 downWidth = (price - lower) * WAD / price;
        uint256 upWidth = (upper - price) * WAD / price;
        uint256 halfWidth = downWidth < upWidth ? downWidth : upWidth;

        if (halfWidth < bounds.minHalfWidth) revert RangeTooNarrow(halfWidth, bounds.minHalfWidth);
        if (halfWidth > bounds.maxHalfWidth) revert RangeTooWide(halfWidth, bounds.maxHalfWidth);
    }
}
