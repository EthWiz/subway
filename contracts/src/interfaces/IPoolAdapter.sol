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
    /// @notice Stock units and USDG of PRINCIPAL currently held by the
    /// position, valued at the pool's own state. Excludes fees the position
    /// has earned but not been paid — see `pendingFees`.
    /// @dev Both legs depend on the pool's current price, because that is what
    /// decides the mix a range is holding. A vault that marks this at a feed
    /// price is therefore still reading pool state indirectly; it is a
    /// quantity report, not a manipulation-resistant valuation.
    function positionAmounts() external view returns (uint256 stockAmount, uint256 usdgAmount);

    /// @notice Fees the position has earned and not yet been paid.
    /// @dev Must be counted by any vault that prices shares off this position:
    /// they are real assets of the position that `positionAmounts` omits.
    function pendingFees() external view returns (uint256 stockFees, uint256 usdgFees);

    /// @notice True while the pool price sits inside the position's range.
    /// A position out of range earns no fees and is entirely one-sided.
    function inRange() external view returns (bool);

    /// @notice Open a position over [lowerPrice, upperPrice], both expressed as
    /// USDG per whole stock token scaled by 1e18.
    ///
    /// @return stockUsed Raw stock actually consumed.
    /// @return usdgUsed Raw USDG actually consumed.
    /// @return realisedLower The position's ACTUAL lower bound, in the same
    /// vault units as `lowerPrice`.
    /// @return realisedUpper The position's ACTUAL upper bound, likewise.
    ///
    /// @dev The realised bounds are returned because they are not the
    /// requested ones. An AMM with a tick grid cannot place an arbitrary
    /// price, and this adapter rounds OUTWARD so the position contains what
    /// was asked for — which means the range it opens can be up to one tick
    /// spacing wider on each side. A vault whose `RangePolicy` is a safety
    /// bound rather than a suggestion has to check the position it got, not
    /// the position it asked for, and it can only do that if the adapter says
    /// what it got. Returned from the call rather than exposed as a view so
    /// the vault validates the range this call opened and not whatever is
    /// open by the time it looks.
    function openRange(
        uint256 lowerPrice,
        uint256 upperPrice,
        uint256 stockAmount,
        uint256 usdgAmount
    )
        external
        returns (uint256 stockUsed, uint256 usdgUsed, uint256 realisedLower, uint256 realisedUpper);

    /// @notice Withdraw the whole position back to the vault, fees included.
    function closeRange() external returns (uint256 stockOut, uint256 usdgOut);

    /// @notice Liquidity currently placed, in the AMM's own units.
    /// @dev Exposed so a vault can take a PRO-RATA slice of the position
    /// without knowing how the AMM measures it.
    function positionLiquidity() external view returns (uint128);

    /// @notice Withdraw part of the position back to the vault.
    /// @dev The unhedged base vault settles withdrawals directly out of the
    /// range rather than from a cash buffer, so it needs to take a redeemer's
    /// share of the liquidity without disturbing the rest of it.
    ///
    /// **Fees do NOT come out in proportion.** On Uniswap v4 a liquidity
    /// change pays the position's whole accrued fee balance to the caller
    /// whatever fraction it removes, so the amounts returned here can include
    /// fees earned on liquidity that is staying. A vault must therefore
    /// realise fees with `collectFees` BEFORE it computes anybody's share,
    /// rather than assume this call splits them.
    function decreaseLiquidity(uint128 liquidity)
        external
        returns (uint256 stockOut, uint256 usdgOut);

    /// @notice Sweep accrued fees to the vault without touching the position.
    function collectFees() external returns (uint256 stockFees, uint256 usdgFees);

    /// @notice True once a position exists and has not been closed.
    function hasPosition() external view returns (bool);
}
