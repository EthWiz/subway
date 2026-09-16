// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {SwapParams} from "v4-core/src/types/PoolOperation.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";

/// @dev Test-only taker. The adapter tests need real swaps so that real fees
/// accrue to the range; a mocked "accrue()" would prove nothing about whether
/// `collectFees` reaches Uniswap's accounting correctly.
contract Swapper is IUnlockCallback {
    IPoolManager public immutable poolManager;

    constructor(IPoolManager poolManager_) {
        poolManager = poolManager_;
    }

    function swap(PoolKey memory key, bool zeroForOne, int256 amountSpecified) external {
        poolManager.unlock(abi.encode(key, zeroForOne, amountSpecified));
    }

    function unlockCallback(bytes calldata raw) external returns (bytes memory) {
        require(msg.sender == address(poolManager), "Swapper: not manager");
        (PoolKey memory key, bool zeroForOne, int256 amountSpecified) =
            abi.decode(raw, (PoolKey, bool, int256));

        BalanceDelta delta = poolManager.swap(
            key,
            SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: amountSpecified,
                sqrtPriceLimitX96: zeroForOne
                    ? TickMath.MIN_SQRT_PRICE + 1
                    : TickMath.MAX_SQRT_PRICE - 1
            }),
            ""
        );

        _resolve(key.currency0, delta.amount0());
        _resolve(key.currency1, delta.amount1());
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
