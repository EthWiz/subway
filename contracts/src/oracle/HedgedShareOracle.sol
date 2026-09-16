// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SubwayVault} from "../SubwayVault.sol";
import {IPriceFeed} from "../interfaces/IPriceFeed.sol";

/// @title HedgedShareOracle
/// @notice Price of one vault share in USDG, for a lending market.
///
/// This returns the vault's FLOOR, which is the entire reason a share is
/// lendable against at all. The floor treats unsettled hedge PnL as zero and
/// haircuts posted margin, so the only way it can overstate the share is if
/// the underlying Chainlink feed is wrong — which is a risk the lender already
/// carries on every other position in the same market.
///
/// It is intentionally thin. An oracle with logic is an oracle with bugs, and
/// this one's whole job is to refuse to answer when it should not.
contract HedgedShareOracle {
    SubwayVault public immutable vault;
    IPriceFeed public immutable feed;
    /// @notice Oldest feed update this oracle will price against, seconds.
    uint256 public immutable maxFeedAge;

    error FeedStale(uint256 updatedAt, uint256 maxAge);
    error FeedPaused();
    error FeedInvalid(int256 answer);

    constructor(address vault_, uint256 maxFeedAge_) {
        vault = SubwayVault(vault_);
        feed = IPriceFeed(address(SubwayVault(vault_).feed()));
        maxFeedAge = maxFeedAge_;
    }

    /// @notice USDG per 1e18 shares, or revert.
    ///
    /// Reverting is correct here and a zero would not be: a lender that reads
    /// zero liquidates every position in the market at once, whereas a revert
    /// pauses it. Staleness is checked HERE as well as inside the vault
    /// because `navFloor` degrades gracefully for its own callers — it drops
    /// the stock leg rather than reverting — and a degraded floor is a fine
    /// answer for a depositor and a dangerous one for a liquidator.
    function price() external view returns (uint256) {
        if (feed.oraclePaused()) revert FeedPaused();
        (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();
        if (answer <= 0) revert FeedInvalid(answer);
        if (block.timestamp > updatedAt + maxFeedAge) revert FeedStale(updatedAt, maxFeedAge);
        return vault.convertToAssets(1e18);
    }
}
