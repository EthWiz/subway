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
library RangePolicy {
    struct Bounds {
        /// @notice Oldest feed update the policy will act on, seconds.
        uint256 maxFeedAge;
        /// @notice Tightest allowed half-width, 1e18 = 100%.
        uint256 minHalfWidth;
        /// @notice Widest allowed half-width, 1e18 = 100%.
        uint256 maxHalfWidth;
    }

    uint256 internal constant WAD = 1e18;

    error FeedStale(uint256 updatedAt, uint256 maxAge);
    error FeedPaused();
    error FeedInvalid(int256 answer);
    error RangeNotStraddling(uint256 lower, uint256 price, uint256 upper);
    error RangeTooNarrow(uint256 halfWidth, uint256 min);
    error RangeTooWide(uint256 halfWidth, uint256 max);
    error BoundsInvalid();

    /// @notice Read the feed and return a usable price, or revert saying why
    /// it is not usable.
    /// @return price USDG per whole stock token, scaled to 1e18.
    function requireFreshPrice(IPriceFeed feed, Bounds memory bounds) internal view returns (uint256 price) {
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

    /// @notice Revert unless [lower, upper] is a range this vault may hold.
    function requireValidRange(uint256 lower, uint256 upper, uint256 price, Bounds memory bounds) internal pure {
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
