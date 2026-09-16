// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {FullMath} from "v4-core/src/libraries/FullMath.sol";
import {FixedPoint128} from "v4-core/src/libraries/FixedPoint128.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";

/// @title PriceTick
/// @notice Translates between the price the vault speaks and the price the AMM
/// speaks.
///
/// The vault, the Chainlink feed and `RangePolicy` all work in **USDG per whole
/// stock token, scaled by 1e18**. Uniswap works in **√(raw token1 / raw token0)
/// × 2^96**. Three things differ, and getting any one of them wrong is a silent
/// mispricing rather than a revert:
///
///  1. Direction — whether the stock token sorts as currency0 or currency1.
///  2. Decimals — a ratio of RAW units, so the two tokens' decimals do not
///     cancel. This is the same orientation bug that halved 53 of 90 pools in
///     the Phase 0 screen; it is fixed here by never folding decimals into a
///     price before inverting, only after.
///  3. The square root and the Q96 scaling.
library PriceTick {
    error PriceOutOfRange(uint256 wadPrice);
    error TickSpacingInvalid(int24 tickSpacing);

    uint256 private constant WAD = 1e18;

    /// @notice Convert a vault-side price to a pool sqrt price.
    /// @param wadPrice USDG per whole stock token, 1e18-scaled.
    /// @param stockIsCurrency0 True when the stock token sorts below USDG.
    /// @param stockDecimals Decimals of the stock token.
    /// @param usdgDecimals Decimals of USDG (6 on Robinhood Chain).
    function toSqrtPriceX96(
        uint256 wadPrice,
        bool stockIsCurrency0,
        uint8 stockDecimals,
        uint8 usdgDecimals
    ) internal pure returns (uint160 sqrtPriceX96) {
        if (wadPrice == 0) revert PriceOutOfRange(wadPrice);

        // One whole stock = 10^stockDecimals raw units and is worth
        // wadPrice/1e18 · 10^usdgDecimals raw USDG units, so as a raw ratio:
        //     token1/token0 = (wadPrice · 10^usdgDecimals) / (1e18 · 10^stockDecimals)
        // inverted when USDG is the lower-sorting currency.
        uint256 stockSide = WAD * (10 ** stockDecimals);
        uint256 usdgSide = wadPrice * (10 ** usdgDecimals);
        (uint256 num, uint256 den) =
            stockIsCurrency0 ? (usdgSide, stockSide) : (stockSide, usdgSide);

        // √(num/den) · 2^96 computed as √(num/den · 2^128) · 2^32. Splitting the
        // scaling this way keeps ~14 significant digits even for the ~1e-10
        // ratios an 18-decimal stock against 6-decimal USDG produces, where
        // taking the root at Q96 would leave only ~9. Tick resolution is 1e-4,
        // so either would round to the same tick in normal ranges; the margin
        // is there for the tails, not the middle.
        uint256 ratioX128 = FullMath.mulDiv(num, FixedPoint128.Q128, den);
        uint256 sqrtPrice = Math.sqrt(ratioX128) << 32;

        if (sqrtPrice < TickMath.MIN_SQRT_PRICE || sqrtPrice >= TickMath.MAX_SQRT_PRICE) {
            revert PriceOutOfRange(wadPrice);
        }
        sqrtPriceX96 = uint160(sqrtPrice);
    }

    /// @notice The inverse of `toSqrtPriceX96`, for events, views and tests.
    function toWadPrice(
        uint160 sqrtPriceX96,
        bool stockIsCurrency0,
        uint8 stockDecimals,
        uint8 usdgDecimals
    ) internal pure returns (uint256 wadPrice) {
        // ratio(token1/token0) at Q128, then undo the decimal scaling in the
        // direction the pool is actually ordered.
        // ratio · 2^128 = sqrtPriceX96^2 / 2^64, via mulDiv so the square is
        // carried at 512 bits rather than overflowing at ratio > 2^64.
        uint256 ratioX128 = FullMath.mulDiv(sqrtPriceX96, sqrtPriceX96, 1 << 64);

        if (stockIsCurrency0) {
            // wadPrice = ratio · 1e18 · 10^stockDecimals / 10^usdgDecimals
            wadPrice = FullMath.mulDiv(ratioX128, WAD * (10 ** stockDecimals), FixedPoint128.Q128);
            wadPrice = wadPrice / (10 ** usdgDecimals);
        } else {
            // wadPrice = 1e18 · 10^stockDecimals / (ratio · 10^usdgDecimals)
            uint256 denom = FullMath.mulDiv(ratioX128, 10 ** usdgDecimals, FixedPoint128.Q128);
            if (denom == 0) revert PriceOutOfRange(0);
            wadPrice = (WAD * (10 ** stockDecimals)) / denom;
        }
    }

    /// @notice Snap a price to the tick grid so that the realised range
    /// CONTAINS the requested one.
    /// @dev `roundDown` is true for the lower edge and false for the upper. The
    /// alternative — shrinking to fit — can collapse a range to nothing when
    /// tick spacing is coarse relative to the width, which is a worse failure
    /// than a range up to one tick spacing wider than asked for on each side.
    /// The vault checks the REQUESTED prices against `RangePolicy`; the
    /// realised ticks are emitted so the widening is visible rather than
    /// assumed.
    ///
    /// Containment needs two steps, not one. `getTickAtSqrtPrice` floors, so
    /// the returned tick's own price can sit strictly below the request even
    /// when that tick is already on the grid; rounding only to the grid would
    /// then shave the upper edge inside the requested range.
    function toAlignedTick(uint160 sqrtPriceX96, int24 tickSpacing, bool roundDown)
        internal
        pure
        returns (int24)
    {
        if (tickSpacing <= 0) revert TickSpacingInvalid(tickSpacing);
        int24 tick = TickMath.getTickAtSqrtPrice(sqrtPriceX96);

        if (roundDown) return _floorToSpacing(tick, tickSpacing);

        if (TickMath.getSqrtPriceAtTick(tick) < sqrtPriceX96) tick++;
        return _ceilToSpacing(tick, tickSpacing);
    }

    /// @dev Solidity truncates toward zero, so a negative non-multiple has
    /// already rounded up and has to be stepped back down.
    function _floorToSpacing(int24 tick, int24 tickSpacing) private pure returns (int24) {
        int24 compressed = tick / tickSpacing;
        if (tick < 0 && tick % tickSpacing != 0) compressed--;
        return compressed * tickSpacing;
    }

    function _ceilToSpacing(int24 tick, int24 tickSpacing) private pure returns (int24) {
        int24 compressed = tick / tickSpacing;
        if (tick > 0 && tick % tickSpacing != 0) compressed++;
        return compressed * tickSpacing;
    }
}
