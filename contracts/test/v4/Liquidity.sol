// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {ModifyLiquidityParams} from "v4-core/src/types/PoolOperation.sol";

/// @dev Test-only background liquidity provider: somebody else in the pool.
///
/// Without one, the vault under test is the pool's ONLY liquidity, and that
/// fixture quietly flatters it. Every fee an attacker pays to move the price
/// comes straight back to the vault, so manipulation looks self-defeating when
/// in production it is not; and the vault's share of the pool is 100%, which
/// is the one thing A6's cap exists to forbid. A real pool has other LPs, so
/// the tests have one.
contract LiquidityProvider is IUnlockCallback {
    IPoolManager public immutable poolManager;

    constructor(IPoolManager poolManager_) {
        poolManager = poolManager_;
    }

    function provide(PoolKey memory key, int24 tickLower, int24 tickUpper, int256 liquidityDelta)
        external
    {
        poolManager.unlock(abi.encode(key, tickLower, tickUpper, liquidityDelta));
    }

    function unlockCallback(bytes calldata raw) external returns (bytes memory) {
        require(msg.sender == address(poolManager), "LP: not manager");
        (PoolKey memory key, int24 tickLower, int24 tickUpper, int256 liquidityDelta) =
            abi.decode(raw, (PoolKey, int24, int24, int256));

        (BalanceDelta delta, BalanceDelta fees) = poolManager.modifyLiquidity(
            key,
            ModifyLiquidityParams({
                tickLower: tickLower,
                tickUpper: tickUpper,
                liquidityDelta: liquidityDelta,
                salt: bytes32(0)
            }),
            ""
        );

        BalanceDelta total = delta + fees;
        _resolve(key.currency0, total.amount0());
        _resolve(key.currency1, total.amount1());
        return "";
    }

    function _resolve(Currency currency, int128 delta) private {
        if (delta < 0) {
            poolManager.sync(currency);
            IERC20(Currency.unwrap(currency))
                .transfer(address(poolManager), uint256(uint128(-delta)));
            poolManager.settle();
        } else if (delta > 0) {
            poolManager.take(currency, address(this), uint256(uint128(delta)));
        }
    }
}
