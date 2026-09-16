// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {BaseVault} from "./BaseVault.sol";
import {VaultFactory} from "./VaultFactory.sol";

/// @title Router
/// @notice One entry point, so a two-token design is not two-step UX.
///
/// `hedged` is a parameter, not a property of a position. Unhedged deposits
/// mint `xAMC`; hedged deposits route stock/USDG -> `xAMC` -> `hAMC` in one
/// transaction. "Toggle hedge" is `wrap`/`unwrap`, which moves `xAMC` into or
/// out of `hAMC` **without closing or reopening any LP position** — the whole
/// reason the hedge is a second vault rather than a flag inside the first.
///
/// ## The Router is a convenience, not a custodian
///
/// It holds no balances between transactions, has no privileged role on either
/// vault, and every path through it is reachable by calling the vaults
/// directly. If this contract were destroyed tomorrow, nobody's funds would be
/// harder to reach — which is the property that makes it safe to put in front
/// of everything.
///
/// ## Phase 1 status
///
/// `HedgedVault` does not exist yet. `deposit` and `redeem` carry the `hedged`
/// flag from the start — the signature is what the web app's toggle calls, and
/// a flag that will mean something later is better than a signature change
/// later — and revert `HedgedVaultNotDeployed` when it is set.
///
/// `wrap`/`unwrap` are deliberately NOT here yet. A reverting stub whose state
/// mutability has to change when it is implemented is worse than an absent
/// function: it puts a lie in the ABI. `hedgeAvailable()` is what the web app
/// reads to decide whether to show the toggle at all.
contract Router {
    using SafeERC20 for IERC20;

    VaultFactory public immutable factory;

    error UnknownPair(address stock);
    error HedgedVaultNotDeployed(address stock);
    error NothingToDeposit();

    constructor(VaultFactory factory_) {
        factory = factory_;
    }

    // ----------------------------------------------------------------- views

    function vaultsFor(address stock) public view returns (address base, address hedged) {
        base = factory.baseVaultFor(stock);
        if (base == address(0)) revert UnknownPair(stock);
        hedged = factory.hedgedVaultFor(stock);
    }

    /// @notice Whether the hedged mode can be selected for this pair yet.
    /// @dev The web app reads this to decide whether the toggle is live,
    /// rather than discovering it from a reverted transaction.
    function hedgeAvailable(address stock) external view returns (bool) {
        return factory.hedgedVaultFor(stock) != address(0);
    }

    // -------------------------------------------------------------- deposits

    /// @notice Deposit into a pair, hedged or not.
    /// @param stock The pair's stock token, which is the pair's identity.
    /// @param hedged False mints `xAMC` to `receiver`; true wraps it into
    /// `hAMC` in the same transaction.
    function deposit(
        address stock,
        uint256 stockAmount,
        uint256 usdgAmount,
        bool hedged,
        address receiver
    ) external returns (uint256 shares) {
        if (stockAmount == 0 && usdgAmount == 0) revert NothingToDeposit();
        // Phase 3 replaces this with: deposit to the Router, then wrap into
        // the hedged vault and mint to `receiver`, all in this transaction.
        if (hedged) revert HedgedVaultNotDeployed(stock);
        (address base,) = vaultsFor(stock);

        IERC20 stockToken = IERC20(stock);
        IERC20 usdgToken = IERC20(BaseVault(base).asset());

        // Pulled to the Router and forwarded in the same call. Nothing is left
        // here to sweep, so the approvals below are consumed within the
        // transaction that grants them.
        if (stockAmount > 0) {
            stockToken.safeTransferFrom(msg.sender, address(this), stockAmount);
            stockToken.forceApprove(base, stockAmount);
        }
        if (usdgAmount > 0) {
            usdgToken.safeTransferFrom(msg.sender, address(this), usdgAmount);
            usdgToken.forceApprove(base, usdgAmount);
        }

        shares = BaseVault(base).deposit(stockAmount, usdgAmount, receiver);

        if (stockAmount > 0) stockToken.forceApprove(base, 0);
        if (usdgAmount > 0) usdgToken.forceApprove(base, 0);
    }

    // ------------------------------------------------------------ withdrawal

    /// @notice Redeem `xAMC` back to both tokens.
    /// @dev The Router cannot redeem on a holder's behalf without taking
    /// custody of their shares first, so it does exactly that and nothing
    /// more: pull, redeem to the receiver, done. A holder who would rather not
    /// route through it can call `BaseVault.redeem` directly for the identical
    /// result.
    function redeem(address stock, uint256 shares, bool hedged, address receiver)
        external
        returns (uint256 stockOut, uint256 usdgOut)
    {
        if (hedged) revert HedgedVaultNotDeployed(stock); // Phase 3.
        (address base,) = vaultsFor(stock);

        IERC20(base).safeTransferFrom(msg.sender, address(this), shares);
        return BaseVault(base).redeem(shares, receiver);
    }
}
