// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice The AMM leg, behind one interface so the vault does not know which
/// Uniswap version it is on.
///
/// Deliberately version-agnostic: Uniswap v3 and v4 are both live on Robinhood
/// Chain, the v3 periphery addresses were never pinned during research, and
/// v4 keeps its positions inside a singleton PoolManager rather than in a
/// per-pool contract. Committing the vault to either shape would have to be
/// undone later.
interface IPoolAdapter {
    /// @notice Stock units and USDG currently held by the position, valued at
    /// the pool's own state. Used for delta, NOT for share price — see
    /// `SubwayVault.navFloor`.
    function positionAmounts() external view returns (uint256 stockAmount, uint256 usdgAmount);

    /// @notice True while the pool price sits inside the position's range.
    /// A position out of range earns no fees and is entirely one-sided.
    function inRange() external view returns (bool);

    /// @notice Open a position over [lowerPrice, upperPrice], both expressed as
    /// USDG per whole stock token scaled by 1e18.
    function openRange(
        uint256 lowerPrice,
        uint256 upperPrice,
        uint256 stockAmount,
        uint256 usdgAmount
    ) external returns (uint256 stockUsed, uint256 usdgUsed);

    /// @notice Withdraw the whole position back to the vault, fees included.
    function closeRange() external returns (uint256 stockOut, uint256 usdgOut);

    /// @notice Liquidity currently placed, in the AMM's own units.
    /// @dev Exposed so a vault can take a PRO-RATA slice of the position
    /// without knowing how the AMM measures it.
    function positionLiquidity() external view returns (uint128);

    /// @notice Withdraw part of the position back to the vault.
    /// @dev The unhedged base vault settles withdrawals directly out of the
    /// range rather than from a cash buffer, so it needs to take a redeemer's
    /// share of the liquidity without disturbing the rest of it. Accrued fees
    /// come out in the same proportion, which is what makes the remaining
    /// holders' claim unchanged by someone else leaving.
    function decreaseLiquidity(uint128 liquidity)
        external
        returns (uint256 stockOut, uint256 usdgOut);

    /// @notice Sweep accrued fees to the vault without touching the position.
    function collectFees() external returns (uint256 stockFees, uint256 usdgFees);

    /// @notice True once a position exists and has not been closed.
    function hasPosition() external view returns (bool);
}
