// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice The four ZkLighter escrow calls the vault needs, as deployed on
/// Robinhood Chain at 0x94bAB9693Ba2f6358507eFfcbd372b0660AFfF9d.
///
/// Why this is the whole custody story: Lighter's L1 owner is the account's
/// root of trust. Secure withdrawals land only at the L1 owner, L2 transfers
/// and fast withdrawals need the L1 owner's signature, and API keys carry no
/// withdrawal scope at all. Making the VAULT the L1 owner therefore makes the
/// keeper's key trade-only by construction rather than by policy.
///
/// Selectors probed on chain 4663 (2026-09-16), recorded so a mismatch at
/// integration time is caught as a wrong ABI rather than a silent revert:
///   deposit         0x8a857083
///   withdraw        0xd20191bd   (secure and forced share this entry point)
///   changePubKey    0x17010c68
///   cancelAllOrders 0xa4b6f756
interface IZkLighter {
    /// @notice Credit `amount` of collateral to `to`'s Lighter account.
    function deposit(address to, uint256 amount) external;

    /// @notice Secure withdrawal. Funds land at the account's L1 OWNER, which
    /// is why the vault must own the account rather than the keeper.
    function withdraw(uint256 amount) external;

    /// @notice Register the trade-only API key. The escrow checks that
    /// `msg.sender` is the account's L1 address, so a contract can call it
    /// directly with no EIP-1271 path.
    function changePubKey(bytes calldata pubKey) external;

    /// @notice Force-cancel every resting order via the L1 priority queue.
    /// The escape hatch that makes `panic()` independent of the keeper.
    function cancelAllOrders() external;
}
