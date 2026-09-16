// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BaseVault} from "./BaseVault.sol";
import {RangePolicy} from "./policy/RangePolicy.sol";

/// @title VaultFactory
/// @notice Pair registry and deployer.
///
/// A pair has one `BaseVault` (`xAMC`) and, from Track B, one `HedgedVault`
/// (`hAMC`) that holds it. A pair with only a base vault is the normal Track A
/// state, not an incomplete one.
///
/// The owner can add pairs, rotate keepers and register the hedged vault. It
/// deliberately CANNOT move funds out of any vault it deployed: a factory that
/// could would make every vault's safety argument depend on the factory's
/// multisig rather than on the vault's own code, which is the opposite of the
/// point.
contract VaultFactory {
    address public owner;
    address public immutable usdg;
    address public immutable lighter;

    /// @notice stock token => unhedged base vault. One per pair, so a second
    /// registration is a mistake rather than a second opinion.
    mapping(address => address) public baseVaultFor;

    /// @notice stock token => hedged wrapper vault, zero until Track B.
    ///
    /// Set rather than deployed here: `HedgedVault` owns a Lighter account and
    /// its wiring (market id, asset index, margin caps, guardian) is decided
    /// per pair at the time it is stood up. The Router reads this pointer, so
    /// the owner can misdirect hedged deposits by setting it wrongly — the
    /// same trust the owner already has by choosing keepers. It cannot reach
    /// funds in a vault that is already deployed.
    mapping(address => address) public hedgedVaultFor;

    address[] public vaults;

    event PairAdded(address indexed stock, address indexed baseVault, uint256 lighterMarketId);
    event HedgedVaultRegistered(address indexed stock, address indexed hedgedVault);
    event OwnerChanged(address indexed from, address indexed to);

    error NotOwner();
    error PairExists(address stock, address vault);
    error UnknownPair(address stock);
    error HedgedVaultExists(address stock, address vault);
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address owner_, address usdg_, address lighter_) {
        if (owner_ == address(0) || usdg_ == address(0) || lighter_ == address(0)) {
            revert ZeroAddress();
        }
        owner = owner_;
        usdg = usdg_;
        lighter = lighter_;
    }

    struct PairParams {
        string name;
        string symbol;
        address stock;
        address feed;
        address pool;
        address keeper;
        /// @notice Recorded for operators and indexers; the chain cannot read
        /// rollup state, so nothing on-chain can verify it. Carried here from
        /// Track A so the pair's hedge market is decided with the pair.
        uint256 lighterMarketId;
        RangePolicy.Bounds bounds;
    }

    function addPair(PairParams calldata p) external onlyOwner returns (address vault) {
        address existing = baseVaultFor[p.stock];
        if (existing != address(0)) revert PairExists(p.stock, existing);
        if (p.stock == address(0) || p.feed == address(0) || p.pool == address(0)) {
            revert ZeroAddress();
        }

        vault = address(
            new BaseVault(
                BaseVault.Config({
                    name: p.name,
                    symbol: p.symbol,
                    stock: p.stock,
                    usdg: usdg,
                    feed: p.feed,
                    pool: p.pool,
                    keeper: p.keeper,
                    // The factory OWNER administers the vault, not the factory
                    // itself: an admin that is a contract with no admin
                    // function is an admin nobody can use.
                    admin: owner,
                    bounds: p.bounds
                })
            )
        );

        baseVaultFor[p.stock] = vault;
        vaults.push(vault);
        emit PairAdded(p.stock, vault, p.lighterMarketId);
    }

    /// @notice Point a pair at its hedged wrapper. Track B.
    /// @dev Write-once per pair: re-pointing a live `hAMC` would strand every
    /// holder of the old one behind a Router that no longer knows about it.
    function registerHedgedVault(address stock, address hedgedVault) external onlyOwner {
        if (baseVaultFor[stock] == address(0)) revert UnknownPair(stock);
        if (hedgedVault == address(0)) revert ZeroAddress();
        address existing = hedgedVaultFor[stock];
        if (existing != address(0)) revert HedgedVaultExists(stock, existing);

        hedgedVaultFor[stock] = hedgedVault;
        emit HedgedVaultRegistered(stock, hedgedVault);
    }

    function vaultCount() external view returns (uint256) {
        return vaults.length;
    }

    function setOwner(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        emit OwnerChanged(owner, next);
        owner = next;
    }
}
