// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SubwayVault} from "./SubwayVault.sol";
import {RangePolicy} from "./policy/RangePolicy.sol";

/// @title VaultFactory
/// @notice Pair registry and deployer. One vault per pair.
///
/// The owner can add pairs, rotate keepers and pause new deposits. It
/// deliberately CANNOT move funds out of any vault it deployed: a factory that
/// could would make every vault's safety argument depend on the factory's
/// multisig rather than on the vault's own code, which is the opposite of the
/// point.
contract VaultFactory {
    address public owner;
    address public immutable usdg;
    address public immutable lighter;

    /// @notice stock token => vault. One per pair, so a second registration is
    /// a mistake rather than a second opinion.
    mapping(address => address) public vaultFor;
    address[] public vaults;

    event PairAdded(address indexed stock, address indexed vault, uint256 lighterMarketId);
    event OwnerChanged(address indexed from, address indexed to);

    error NotOwner();
    error PairExists(address stock, address vault);
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address owner_, address usdg_, address lighter_) {
        if (owner_ == address(0) || usdg_ == address(0) || lighter_ == address(0)) revert ZeroAddress();
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
        address guardian;
        uint256 haircut;
        uint256 maxMargin;
        /// @notice Recorded for operators and indexers; the chain cannot read
        /// rollup state, so nothing on-chain can verify it.
        uint256 lighterMarketId;
        RangePolicy.Bounds bounds;
    }

    function addPair(PairParams calldata p) external onlyOwner returns (address vault) {
        address existing = vaultFor[p.stock];
        if (existing != address(0)) revert PairExists(p.stock, existing);
        if (p.stock == address(0) || p.feed == address(0) || p.pool == address(0)) revert ZeroAddress();

        vault = address(
            new SubwayVault(
                SubwayVault.Config({
                    name: p.name,
                    symbol: p.symbol,
                    stock: p.stock,
                    usdg: usdg,
                    feed: p.feed,
                    lighter: lighter,
                    pool: p.pool,
                    keeper: p.keeper,
                    guardian: p.guardian,
                    // The factory OWNER administers the vault, not the factory
                    // itself: an admin that is a contract with no admin
                    // function is an admin nobody can use.
                    admin: owner,
                    haircut: p.haircut,
                    maxMargin: p.maxMargin,
                    bounds: p.bounds
                })
            )
        );

        vaultFor[p.stock] = vault;
        vaults.push(vault);
        emit PairAdded(p.stock, vault, p.lighterMarketId);
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
