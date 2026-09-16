// SPDX-License-Identifier: MIT
// Compiles Uniswap's real PoolManager into `out/` so tests can deploy it with
// `vm.deployCode`. It is imported by nothing: PoolManager pins `pragma 0.8.26`
// and our sources pin 0.8.28, and solc cannot put two exact pragmas in one
// compilation unit. Loading it as an artifact keeps our pragma exact while the
// tests still run against the genuine AMM rather than a mock of it.
pragma solidity ^0.8.26;

import {PoolManager} from "v4-core/src/PoolManager.sol";
