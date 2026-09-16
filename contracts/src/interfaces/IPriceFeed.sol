// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Chainlink `AggregatorV3Interface`, plus the two Robinhood-specific
/// calls that make an equity feed different from a crypto one.
interface IPriceFeed {
    function decimals() external view returns (uint8);

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);

    /// @notice Corporate-action pause. A split or a dividend moves the token's
    /// unit value without moving the equity's price, and the feed stops rather
    /// than publishing a number that means something different than it did
    /// yesterday. Any read during a pause is unusable.
    function oraclePaused() external view returns (bool);

    /// @notice Share-count multiplier (ERC-8056). The token's value is the
    /// equity price times this, so ignoring it silently misprices every
    /// position the moment an issuer splits.
    function uiMultiplier() external view returns (uint256);
}
