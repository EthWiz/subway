// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {FullMath} from "v4-core/src/libraries/FullMath.sol";
import {FixedPoint96} from "v4-core/src/libraries/FixedPoint96.sol";

/// @title LiquidityAmounts
/// @notice The inverse of `SqrtPriceMath.getAmountNDelta`: how much liquidity a
/// given pair of token amounts buys over a tick range.
///
/// v4-core ships the forward direction (liquidity -> amounts) and not this one,
/// which lives in v4-periphery. Rather than take that whole dependency for two
/// formulas, they are derived here from the same identities v4-core uses:
///
///     amount0 = L · (√b − √a) / (√a · √b)      =>  L = amount0 · √a·√b / (√b − √a)
///     amount1 = L · (√b − √a)                  =>  L = amount1 / (√b − √a)
///
/// with the Q96 scaling carried through. `test/UniV4Adapter.t.sol` fuzzes both
/// against `SqrtPriceMath`, which is the actual check that this is right — the
/// algebra above is only the reason to believe it before running the test.
///
/// Rounding is deliberately DOWN throughout. A too-small liquidity figure
/// leaves a little of the vault's inventory unused; a too-large one would make
/// the pool ask for more than was approved and revert the keeper's call.
library LiquidityAmounts {
    /// @notice Liquidity affordable with `amount0` alone across [√a, √b].
    function getLiquidityForAmount0(uint160 sqrtPriceAX96, uint160 sqrtPriceBX96, uint256 amount0)
        internal
        pure
        returns (uint128 liquidity)
    {
        if (sqrtPriceAX96 > sqrtPriceBX96) (sqrtPriceAX96, sqrtPriceBX96) = (sqrtPriceBX96, sqrtPriceAX96);
        // √a·√b is up to 320 bits, so it is descaled by Q96 before the divide.
        uint256 intermediate = FullMath.mulDiv(sqrtPriceAX96, sqrtPriceBX96, FixedPoint96.Q96);
        liquidity = _toUint128(FullMath.mulDiv(amount0, intermediate, sqrtPriceBX96 - sqrtPriceAX96));
    }

    /// @notice Liquidity affordable with `amount1` alone across [√a, √b].
    function getLiquidityForAmount1(uint160 sqrtPriceAX96, uint160 sqrtPriceBX96, uint256 amount1)
        internal
        pure
        returns (uint128 liquidity)
    {
        if (sqrtPriceAX96 > sqrtPriceBX96) (sqrtPriceAX96, sqrtPriceBX96) = (sqrtPriceBX96, sqrtPriceAX96);
        liquidity = _toUint128(FullMath.mulDiv(amount1, FixedPoint96.Q96, sqrtPriceBX96 - sqrtPriceAX96));
    }

    /// @notice Liquidity both amounts can support at once — the binding side.
    /// @dev Below the range the position is all token0, above it all token1;
    /// inside, the smaller of the two sides is what can actually be placed, and
    /// the remainder of the other token stays with the caller.
    function getLiquidityForAmounts(
        uint160 sqrtPriceX96,
        uint160 sqrtPriceAX96,
        uint160 sqrtPriceBX96,
        uint256 amount0,
        uint256 amount1
    ) internal pure returns (uint128 liquidity) {
        if (sqrtPriceAX96 > sqrtPriceBX96) (sqrtPriceAX96, sqrtPriceBX96) = (sqrtPriceBX96, sqrtPriceAX96);

        if (sqrtPriceX96 <= sqrtPriceAX96) {
            liquidity = getLiquidityForAmount0(sqrtPriceAX96, sqrtPriceBX96, amount0);
        } else if (sqrtPriceX96 < sqrtPriceBX96) {
            uint128 liquidity0 = getLiquidityForAmount0(sqrtPriceX96, sqrtPriceBX96, amount0);
            uint128 liquidity1 = getLiquidityForAmount1(sqrtPriceAX96, sqrtPriceX96, amount1);
            liquidity = liquidity0 < liquidity1 ? liquidity0 : liquidity1;
        } else {
            liquidity = getLiquidityForAmount1(sqrtPriceAX96, sqrtPriceBX96, amount1);
        }
    }

    function _toUint128(uint256 x) private pure returns (uint128 y) {
        require((y = uint128(x)) == x, "LiquidityAmounts: overflow");
    }
}
