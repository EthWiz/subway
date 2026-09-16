import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  screenHedgeability,
  hedgeableNames,
  classifyPoolToken,
  USDG_ADDRESS,
  MIN_VIABLE_VAULT_TVL_USD,
  type StockTokenAsset,
  type LighterOrderBook,
  type LighterBookStats,
} from "../research/lib/hedgeability.ts";
import {
  markoutSwap,
  gradeHorizon,
  gradeGate,
  midLookupFromTape,
  hedgeCarryApr,
  type Swap,
} from "../research/lib/markout.ts";
import {
  fetchLogs,
  decodeV3Swap,
  toGraderSwap,
  activeLiquidityQuoteValue,
  concentratedLiquidityMultiplier,
  decodeSlot0SqrtPrice,
  decodeV4Swap,
  decodeV4Initialize,
  sessionBucket,
  UNIV4_DYNAMIC_FEE_FLAG,
  RpcError,
  isLimitExceeded,
  isRateLimited,
  type RpcLog,
} from "../research/lib/poolscan.ts";
import {
  rankCandidates,
  poolEconomics,
  HEDGE_CARRY_APR,
  HEDGE_CARRY_APR_AT_CAP,
  DEFAULT_RANGE_HALF_WIDTH,
  DEFAULT_VAULT_TVL_USD,
} from "../research/lib/rank.ts";

// The Phase 0 evidence gate for docs/hedged-stock-lp-app-plan.md.
//
// These tests pin the three things the gate's verdict rests on: that a name
// with no hedge book is not quietly graded as hedgeable, that the markout
// sign convention puts adverse selection on the LP, and that the log scanner
// narrows rather than gives up when the endpoint refuses a range. All three
// run on fixtures — no venue or RPC access (tests/support/no-network.mjs).

const ASSETS: StockTokenAsset[] = [
  {
    tokenSymbol: "AMC",
    status: "ASSET_STATUS_ACTIVE",
    deployments: [{ contractAddress: "0x05a3d1Cd21d0C88145E82600E62e7E496e0F222B", chainId: 4663 }],
  },
  {
    tokenSymbol: "MSTR",
    status: "ASSET_STATUS_ACTIVE",
    deployments: [{ contractAddress: "0xec262a75e413fAfD0dF80480274532C79D42da09", chainId: 4663 }],
  },
  {
    tokenSymbol: "NVDA",
    status: "ASSET_STATUS_ACTIVE",
    deployments: [{ contractAddress: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC", chainId: 4663 }],
  },
];

const BOOKS: LighterOrderBook[] = [
  { symbol: "AMC", market_id: 56, market_type: "perp", status: "active" },
  { symbol: "NVDA", market_id: 15, market_type: "perp", status: "active" },
  { symbol: "NVDA/USDG", market_id: 2054, market_type: "spot", status: "active" },
];

// Live values probed 2026-09-16; they are the numbers the report quotes.
const STATS: LighterBookStats[] = [
  { symbol: "AMC", daily_quote_token_volume: 47_005.645866, daily_trades_count: 115 },
  { symbol: "NVDA", daily_quote_token_volume: 5_232_641.289118, daily_trades_count: 9_940 },
];

test("hedgeability screen separates a missing LP leg from a missing hedge leg", () => {
  const rows = screenHedgeability({ assets: ASSETS, orderBooks: BOOKS, stats: STATS });
  const by = new Map(rows.map((r) => [r.name, r]));

  // MSTR has a stock token but Lighter RH lists no MSTR perp.
  assert.equal(by.get("MSTR")?.verdict, "NO_PERP_MARKET");
  assert.equal(by.get("MSTR")?.perpMarketId, null);

  // HOOD appears in neither source, so it must not appear as a row at all
  // rather than defaulting into a passing verdict.
  assert.equal(by.has("HOOD"), false);

  assert.equal(by.get("NVDA")?.verdict, "HEDGEABLE");
  assert.equal(by.get("NVDA")?.perpMarketId, 15);
});

test("a listed perp is not a hedgeable one: AMC's book is too thin for a viable vault", () => {
  const rows = screenHedgeability({ assets: ASSETS, orderBooks: BOOKS, stats: STATS });
  const amc = rows.find((r) => r.name === "AMC");
  assert.ok(amc);

  // Both legs exist, so a naive listed/not-listed screen would pass AMC.
  assert.equal(amc.perpMarketId, 56);
  assert.notEqual(amc.tokenAddress, null);

  // At the default 2% participation the book supports a ~$1.9K vault.
  assert.equal(amc.verdict, "PERP_TOO_THIN");
  assert.ok(amc.maxVaultTvlUsd < MIN_VIABLE_VAULT_TVL_USD);
  assert.ok(amc.maxVaultTvlUsd > 1_500 && amc.maxVaultTvlUsd < 2_500, `got ${amc.maxVaultTvlUsd}`);

  assert.deepEqual(
    hedgeableNames(rows).map((r) => r.name),
    ["NVDA"],
  );
});

test("the screen ranks by hedge depth so Phase 1 gets an ordered candidate list", () => {
  const rows = screenHedgeability({ assets: ASSETS, orderBooks: BOOKS, stats: STATS });
  const depths = rows.map((r) => r.maxVaultTvlUsd);
  assert.deepEqual(
    depths,
    [...depths].sort((a, b) => b - a),
  );
});

test("participation share moves the viability bar rather than being baked in", () => {
  const generous = screenHedgeability({
    assets: ASSETS,
    orderBooks: BOOKS,
    stats: STATS,
    maxDailyFlowShare: 0.5,
  });
  // Even at an absurd 50% of daily flow AMC only reaches ~$47K, so the
  // verdict is not an artefact of a conservative default.
  assert.equal(generous.find((r) => r.name === "AMC")?.verdict, "HEDGEABLE");
  assert.ok((generous.find((r) => r.name === "AMC")?.maxVaultTvlUsd ?? 0) < 50_000);

  assert.throws(
    () =>
      screenHedgeability({ assets: ASSETS, orderBooks: BOOKS, stats: STATS, maxDailyFlowShare: 0 }),
    /maxDailyFlowShare/,
  );
});

test("pool tokens are classified by address, catching a same-ticker synthetic", () => {
  // The HOOD/USDG pools on Robinhood Chain trade this address, which is not
  // in the registry: an anonymous synthetic tracker, not Robinhood's token.
  const fake = classifyPoolToken("0x32ac8c1d7672667d5ebdea22935f7b06fc8d496f", ASSETS);
  assert.equal(fake.class, "UNREGISTERED");
  assert.equal(fake.tokenSymbol, null);

  const real = classifyPoolToken("0x05a3d1cd21d0c88145e82600e62e7e496e0f222b", ASSETS);
  assert.equal(real.class, "REGISTERED_STOCK_TOKEN");
  assert.equal(real.tokenSymbol, "AMC");

  assert.equal(classifyPoolToken(USDG_ADDRESS, ASSETS).class, "USDG");

  // A token deployed on another chain is not an LP leg on 4663.
  const elsewhere = classifyPoolToken("0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC", ASSETS, 1);
  assert.equal(elsewhere.class, "UNREGISTERED");
});

const flatMid = (price: number) => () => price;

// A reference tape that moves from `from` to `to` between the fill and the
// horizon. `flatMid` is deliberately NOT used for toxicity tests: under the
// corrected definition a flat reference means the flow carried no
// information, so everything on it is benign by construction.
const movingMid = (from: number, to: number, horizonMs: number) =>
  midLookupFromTape(
    [
      { tsMs: 0, mid: from },
      { tsMs: horizonMs, mid: to },
    ],
    horizonMs + 1_000,
  );

test("markout puts the adverse-selection loss on the LP, both directions", () => {
  const buy: Swap = {
    tsMs: 0,
    takerBuysBase: true,
    baseAmount: 10,
    execPrice: 100,
    feeTier: 0.003,
  };

  // Taker bought at 100; the reference was 100 at the fill and 101 at the
  // horizon. The taker made $10 and the LP lost exactly that. The LP does
  // NOT also pocket the fee — the price the taker paid already includes it.
  const up = markoutSwap(buy, 10_000, movingMid(100, 101, 10_000));
  assert.ok(up);
  assert.equal(up.takerMarkoutUsd, 10);
  assert.equal(up.refMoveUsd, 10);
  assert.equal(up.feeUsd, 3);
  assert.equal(up.lpPnlUsd, -10);
  assert.equal(up.toxic, true);

  // Same fill, reference falls to 99: the taker was wrong and the LP gains.
  const down = markoutSwap(buy, 10_000, movingMid(100, 99, 10_000));
  assert.ok(down);
  assert.equal(down.takerMarkoutUsd, -10);
  assert.equal(down.refMoveUsd, -10);
  assert.equal(down.lpPnlUsd, 10);
  assert.equal(down.toxic, false);

  // A seller is toxic on the mirrored move.
  const sell: Swap = { ...buy, takerBuysBase: false };
  const sold = markoutSwap(sell, 10_000, movingMid(100, 99, 10_000));
  assert.ok(sold);
  assert.equal(sold.takerMarkoutUsd, 10);
  assert.equal(sold.refMoveUsd, 10);
  assert.equal(sold.toxic, true);
});

test("the fee is not counted twice: an unmoved reference pays the LP the fee once", () => {
  // A v3 Swap event's amounts are fee-inclusive, so execPrice already carries
  // the fee. With the reference flat at 100, a taker buying at 100.3 is out
  // the fee and the LP is up the same $3 -- ONCE. The old model scored +$6.
  const fee = 0.003;
  const s: Swap = { tsMs: 0, takerBuysBase: true, baseAmount: 10, execPrice: 100.3, feeTier: fee };
  const m = markoutSwap(s, 60_000, flatMid(100));
  assert.ok(m);
  assert.ok(Math.abs(m.takerMarkoutUsd + 3) < 1e-9, `taker: ${m.takerMarkoutUsd}`);
  assert.ok(Math.abs(m.lpPnlUsd - 3) < 1e-9, `lp: ${m.lpPnlUsd}`);
  // The reference never moved, so nothing was adversely selected.
  assert.equal(m.refMoveUsd, 0);
  assert.equal(m.toxic, false);
});

test("toxicity is measured on the reference move, not on who paid the fee", () => {
  // Reference moves 100 -> 100.5 after the fill: informed flow, toxic, even
  // though a 1% fee more than covered it.
  const fat: Swap = { tsMs: 0, takerBuysBase: true, baseAmount: 10, execPrice: 100, feeTier: 0.01 };
  const m = markoutSwap(fat, 60_000, movingMid(100, 100.5, 60_000));
  assert.ok(m);
  assert.equal(m.refMoveUsd, 5);
  assert.equal(m.toxic, true);
  // Fee income ($10) exceeds the $5 move, so the LP is up on this swap while
  // the flow is still toxic -- which is what the fee-decay stress discounts.
  assert.equal(m.feeUsd, 10);
});

test("an uncovered reference tape is dropped, never treated as a zero markout", () => {
  const tape = [
    { tsMs: 0, mid: 100 },
    { tsMs: 1_000, mid: 100 },
  ];
  const mid = midLookupFromTape(tape, 5_000);

  // Before the tape starts there is no reference at all.
  assert.equal(mid(-10_000), null);
  // A gap longer than maxAge must not carry the last quote forward.
  assert.equal(mid(30_000), null);
  assert.equal(mid(900), 100);

  const swaps: Swap[] = [
    { tsMs: 500, takerBuysBase: true, baseAmount: 1, execPrice: 100, feeTier: 0.003 },
    { tsMs: 500_000, takerBuysBase: true, baseAmount: 1, execPrice: 100, feeTier: 0.003 },
  ];
  const g = gradeHorizon(swaps, 1_000, mid);
  assert.equal(g.swaps, 1);
  assert.equal(g.uncovered, 1);
});

test("gradeHorizon keeps toxic and benign dollars apart", () => {
  // One informed buyer and one wrong seller, same size, same fill price.
  // The reference moves 100 -> 101 after both.
  const mid = movingMid(100, 101, 1_000);
  const swaps: Swap[] = [
    { tsMs: 0, takerBuysBase: true, baseAmount: 10, execPrice: 100, feeTier: 0.003 },
    { tsMs: 0, takerBuysBase: false, baseAmount: 10, execPrice: 100, feeTier: 0.003 },
  ];
  const g = gradeHorizon(swaps, 1_000, mid);
  assert.equal(g.swaps, 2);
  assert.equal(g.notionalUsd, 2_000);
  assert.equal(g.feeUsd, 6);
  assert.equal(g.toxicSwaps, 1);
  assert.equal(g.toxicNotionalUsd, 1_000);

  // The NETTED markout is zero -- exactly the number that used to hide the
  // adverse selection. The toxic bucket still reports the real $10.
  assert.equal(g.takerMarkoutUsd, 0);
  assert.equal(g.toxicRefMoveUsd, 10);
  assert.equal(g.benignRefMoveUsd, -10);
  assert.ok(Math.abs(g.feeCoverageRatio - 0.6) < 1e-9);
});

test("the gate grades at the longest horizon and survives a fee cut only on real edge", () => {
  const grades = [
    // A short horizon flatters the LP; the gate must not read this one.
    {
      horizonMs: 1_000,
      swaps: 1,
      uncovered: 0,
      notionalUsd: 0,
      feeUsd: 1_000,
      takerMarkoutUsd: 10,
      lpPnlUsd: -10,
      toxicSwaps: 0,
      toxicNotionalUsd: 0,
      toxicRefMoveUsd: 10,
      benignRefMoveUsd: 0,
      feeCoverageRatio: 100,
    },
    {
      horizonMs: 60_000,
      swaps: 1,
      uncovered: 0,
      notionalUsd: 0,
      feeUsd: 1_000,
      takerMarkoutUsd: 900,
      lpPnlUsd: -900,
      toxicSwaps: 1,
      toxicNotionalUsd: 0,
      toxicRefMoveUsd: 900,
      benignRefMoveUsd: 0,
      feeCoverageRatio: 1.1,
    },
  ];
  const v = gradeGate({
    grades,
    windowDays: 7,
    liquidityUsd: 25_000,
    fundingRate8h: 0.0001,
    gasUsd: 20,
  });

  assert.equal(v.horizonMs, 60_000);
  assert.equal(v.adverseSelectionUsd, 900);
  // Gross fees clear adverse selection, but half of them do not.
  assert.equal(v.decayedFeeUsd, 500);
  assert.equal(v.pass, false);
  assert.match(v.why, /do not cover adverse selection/);

  // Quadruple the fee and the same tape passes.
  const rich = gradeGate({
    grades: grades.map((g) => ({ ...g, feeUsd: g.feeUsd * 4 })),
    windowDays: 7,
    liquidityUsd: 25_000,
    fundingRate8h: 0.0001,
    gasUsd: 20,
  });
  assert.equal(rich.pass, true);
  assert.ok(rich.netApr > 0);
});

test("gradeGate rejects inputs that would silently produce a meaningless APR", () => {
  const g = [
    {
      horizonMs: 60_000,
      swaps: 1,
      uncovered: 0,
      notionalUsd: 0,
      feeUsd: 1,
      takerMarkoutUsd: 0,
      lpPnlUsd: 0,
      toxicSwaps: 0,
      toxicNotionalUsd: 0,
      toxicRefMoveUsd: 0,
      benignRefMoveUsd: 0,
      feeCoverageRatio: 1,
    },
  ];
  assert.throws(
    () => gradeGate({ grades: [], windowDays: 1, liquidityUsd: 1, fundingRate8h: 0, gasUsd: 0 }),
    /at least one/,
  );
  assert.throws(
    () => gradeGate({ grades: g, windowDays: 0, liquidityUsd: 1, fundingRate8h: 0, gasUsd: 0 }),
    /windowDays/,
  );
  assert.throws(
    () => gradeGate({ grades: g, windowDays: 1, liquidityUsd: 0, fundingRate8h: 0, gasUsd: 0 }),
    /liquidityUsd/,
  );
});

test("fetchLogs narrows the range when the endpoint refuses it as too large", async () => {
  const seen: [number, number][] = [];
  const transport = async (_m: string, params: unknown[]) => {
    const p = (params as [{ fromBlock: string; toBlock: string }])[0];
    const from = Number(BigInt(p.fromBlock));
    const to = Number(BigInt(p.toBlock));
    seen.push([from, to]);
    if (to - from + 1 > 100) {
      throw new RpcError(-32000, "logs matched by query exceeds limit of 10000");
    }
    return [
      {
        address: "0xpool",
        topics: [],
        data: "0x",
        blockNumber: p.fromBlock,
        transactionHash: "0xtx",
        logIndex: "0x0",
      },
    ] satisfies RpcLog[];
  };

  const logs = await fetchLogs(
    transport,
    { fromBlock: 0, toBlock: 999 },
    { initialChunk: 1_000, throttleMs: 0, sleep: async () => {} },
  );

  // It must have split rather than thrown, and covered the range exactly once.
  assert.ok(
    seen.some(([f, t]) => t - f + 1 > 100),
    "expected an over-large first attempt",
  );
  const accepted = seen.filter(([f, t]) => t - f + 1 <= 100);
  assert.equal(accepted[0]![0], 0);
  assert.equal(accepted.at(-1)![1], 999);
  for (let i = 1; i < accepted.length; i += 1) {
    assert.equal(accepted[i]![0], accepted[i - 1]![1] + 1, "gap or overlap in coverage");
  }
  assert.equal(logs.length, accepted.length);
});

test("fetchLogs backs off on 429 instead of narrowing, then gives up cleanly", async () => {
  let calls = 0;
  const waits: number[] = [];
  const transport = async () => {
    calls += 1;
    if (calls <= 3) throw new RpcError(429, "Too Many Requests");
    return [] satisfies RpcLog[];
  };
  await fetchLogs(
    transport,
    { fromBlock: 0, toBlock: 10 },
    { throttleMs: 10, sleep: async (ms) => void waits.push(ms) },
  );
  assert.equal(calls, 4);
  assert.deepEqual(waits, [10, 20, 40]); // exponential, not a fixed retry

  const always = async () => {
    throw new RpcError(429, "Too Many Requests");
  };
  await assert.rejects(
    fetchLogs(always, { fromBlock: 0, toBlock: 1 }, { maxRetries: 2, sleep: async () => {} }),
    /Too Many Requests/,
  );
});

test("fetchLogs refuses to loop forever on a range it cannot narrow", async () => {
  const always = async () => {
    throw new RpcError(-32000, "logs matched by query exceeds limit of 10000");
  };
  await assert.rejects(
    fetchLogs(always, { fromBlock: 0, toBlock: 50 }, { minChunk: 8, sleep: async () => {} }),
    /still exceeds the log limit/,
  );
});

test("error classification does not confuse a size cap with throttling", () => {
  assert.equal(
    isLimitExceeded(new RpcError(-32000, "logs matched by query exceeds limit of 10000")),
    true,
  );
  assert.equal(
    isRateLimited(new RpcError(-32000, "logs matched by query exceeds limit of 10000")),
    false,
  );
  assert.equal(isRateLimited(new RpcError(429, "Too Many Requests")), true);
  assert.equal(isLimitExceeded(new RpcError(429, "Too Many Requests")), false);
  assert.equal(isLimitExceeded(new Error("boom")), false);
});

test("v3 swap decoding preserves sign and yields the taker's side", () => {
  // Pool receives 1000 USDG (token1, +) and pays out 10 stock (token0, −):
  // the taker BOUGHT the stock at 100.
  const word = (v: bigint) => (v < 0n ? (1n << 256n) + v : v).toString(16).padStart(64, "0");
  const log: RpcLog = {
    address: "0xPOOL",
    topics: [],
    data:
      "0x" +
      word(-10n * 10n ** 18n) +
      word(1000n * 10n ** 6n) +
      word(0n) +
      word(12345n) +
      word(-3n),
    blockNumber: "0x10",
    transactionHash: "0xtx",
    logIndex: "0x2",
  };

  const d = decodeV3Swap(log);
  assert.equal(d.amount0, -10n * 10n ** 18n);
  assert.equal(d.amount1, 1000n * 10n ** 6n);
  assert.equal(d.tick, -3, "negative ticks must sign-extend from int24");
  assert.equal(d.liquidity, 12345n);
  assert.equal(d.pool, "0xpool");

  const s = toGraderSwap(d, {
    baseIsToken0: true,
    baseDecimals: 18,
    quoteDecimals: 6,
    feeTier: 0.003,
    tsMs: 1_700_000_000_000,
  });
  assert.equal(s.takerBuysBase, true);
  assert.equal(s.baseAmount, 10);
  assert.equal(s.execPrice, 100);

  // Same log read with the stock on token1 is the opposite trade — the
  // caller must resolve sort order from the pool, not the pair name.
  const flipped = toGraderSwap(d, {
    baseIsToken0: false,
    baseDecimals: 6,
    quoteDecimals: 18,
    feeTier: 0.003,
    tsMs: 0,
  });
  assert.equal(flipped.takerBuysBase, false);

  assert.throws(() => decodeV3Swap({ ...log, data: "0x00" }), /too short/);
});

test("active-liquidity value is the fee-yield denominator, in quote units", () => {
  // A balanced pool at price 100 with L chosen so the virtual reserves are
  // 10 base and 1000 quote: sqrtP (raw, 18/6 decimals) and L are derived so
  // the position is worth 2000 quote.
  const baseDecimals = 18;
  const quoteDecimals = 6;
  const price = 100; // quote per base
  // p01 = price * 10^(quoteDecimals - baseDecimals) for base=token0.
  const p01 = price * 10 ** (quoteDecimals - baseDecimals);
  const sqrtPriceX96 = BigInt(Math.floor(Math.sqrt(p01) * 2 ** 96));
  // L = sqrt(x_raw * y_raw) with x_raw = 10e18, y_raw = 1000e6.
  const liquidity = BigInt(Math.floor(Math.sqrt(10e18 * 1000e6)));

  const v = activeLiquidityQuoteValue({
    liquidity,
    sqrtPriceX96,
    baseDecimals,
    quoteDecimals,
    baseIsToken0: true,
  });
  // 1000 quote + 10 base * 100 = 2000, within float tolerance.
  assert.ok(Math.abs(v - 2_000) / 2_000 < 0.01, `expected ~2000, got ${v}`);

  // Doubling L doubles the value: the measure is linear in liquidity, which
  // is what makes share = size/(active + size) the right dilution model.
  const doubled = activeLiquidityQuoteValue({
    liquidity: liquidity * 2n,
    sqrtPriceX96,
    baseDecimals,
    quoteDecimals,
    baseIsToken0: true,
  });
  assert.ok(Math.abs(doubled - 2 * v) / v < 0.01);
});

test("active-liquidity value is token-order invariant with mismatched decimals", () => {
  // The case the first version got wrong. A stock token (18 dp) against USDG
  // (6 dp) sorts onto EITHER side by address, and 53 of the 90 registered
  // stock/USDG pools in the 2026-09-16 scan put the stock on token1.
  //
  // sqrtPriceX96 encodes the RAW token1/token0 ratio, so the price inverts
  // with token order but the decimal correction does not. Folding decimals
  // into a token1-per-token0 price and inverting the whole thing is wrong by
  // 10^(2*(d0-d1)) = 10^24 here, which zeroes the base half and returns
  // exactly half the pool's value.
  //
  // Pool: 1,000 stock at 100 USDG + 100,000 USDG = 200,000 USDG.
  const liquidity = 10n ** 16n; // sqrt(1e21 * 1e11)
  const truth = 200_000;

  // token0 = USDG(6), token1 = STOCK(18): raw1/raw0 = 1e10, sqrtP = 1e5.
  const stockIsToken1 = activeLiquidityQuoteValue({
    liquidity,
    sqrtPriceX96: 100_000n * 2n ** 96n,
    baseDecimals: 18,
    quoteDecimals: 6,
    baseIsToken0: false,
  });
  assert.ok(
    Math.abs(stockIsToken1 - truth) / truth < 1e-6,
    `stock as token1: expected ~${truth}, got ${stockIsToken1}`,
  );

  // The mirrored pool must value identically.
  const stockIsToken0 = activeLiquidityQuoteValue({
    liquidity,
    sqrtPriceX96: 2n ** 96n / 100_000n,
    baseDecimals: 18,
    quoteDecimals: 6,
    baseIsToken0: true,
  });
  assert.ok(
    Math.abs(stockIsToken0 - truth) / truth < 1e-6,
    `stock as token0: expected ~${truth}, got ${stockIsToken0}`,
  );
});

test("active-liquidity value refuses to invent a denominator", () => {
  const args = { sqrtPriceX96: 2n ** 96n, baseDecimals: 18, quoteDecimals: 6, baseIsToken0: true };
  // An empty or uninitialised pool must read as zero, not as a tiny
  // denominator that would print an astronomical APR.
  assert.equal(activeLiquidityQuoteValue({ ...args, liquidity: 0n }), 0);
  assert.equal(activeLiquidityQuoteValue({ ...args, liquidity: -1n }), 0);
  assert.equal(activeLiquidityQuoteValue({ ...args, sqrtPriceX96: 0n, liquidity: 10n ** 18n }), 0);
});

test("slot0 decoding takes the first word and rejects a short return", () => {
  const sqrt = 79228162514264337593543950336n; // 2^96, price 1
  const raw = `0x${sqrt.toString(16).padStart(64, "0")}${"11".repeat(32)}`;
  assert.equal(decodeSlot0SqrtPrice(raw), sqrt);
  assert.throws(() => decodeSlot0SqrtPrice("0xdead"), /short slot0/);
});

const HEDGE_ROWS = [
  {
    name: "SNDK",
    verdict: "HEDGEABLE",
    perpMarketId: 32,
    perpDailyQuoteVolumeUsd: 6_258_623,
    maxVaultTvlUsd: 250_345,
  },
  {
    name: "MSTR",
    verdict: "NO_PERP_MARKET",
    perpMarketId: null,
    perpDailyQuoteVolumeUsd: 0,
    maxVaultTvlUsd: 0,
  },
  {
    name: "AMC",
    verdict: "PERP_TOO_THIN",
    perpMarketId: 56,
    perpDailyQuoteVolumeUsd: 47_006,
    maxVaultTvlUsd: 1_880,
  },
  {
    name: "NVDA",
    verdict: "HEDGEABLE",
    perpMarketId: 15,
    perpDailyQuoteVolumeUsd: 5_284_818,
    maxVaultTvlUsd: 211_393,
  },
];

/** A pool whose vault APR works out near `targetApr` at the default size. */
function poolFor(baseSymbol: string, targetApr: number, swaps: number, pool = "0xpool") {
  const activeLiquidityUsd = 10_000_000;
  const k = concentratedLiquidityMultiplier(DEFAULT_RANGE_HALF_WIDTH);
  const eff = DEFAULT_VAULT_TVL_USD * k;
  const share = eff / (activeLiquidityUsd + eff);
  // vaultFeeApr = feeUsdPerDay * share * 365 / vaultTvl  =>  solve feeUsdPerDay.
  const feeUsdPerDay = (targetApr * DEFAULT_VAULT_TVL_USD) / (365 * share);
  return { baseSymbol, admissible: true, pool, swaps, activeLiquidityUsd, feeUsdPerDay };
}

test("a concentrated vault's share is range-aware, not full-range dollars", () => {
  // The bug this pins: comparing the vault's DOLLARS against the pool's
  // full-range-equivalent active liquidity understates its fee share by the
  // capital-efficiency factor of its range (~33.8x at the plan's +/-6%).
  const k = concentratedLiquidityMultiplier(0.06);
  assert.ok(Math.abs(k - 33.8) < 0.1, `expected ~33.8x at +/-6%, got ${k}`);
  // Tighter ranges are more efficient; wider ones less.
  assert.ok(concentratedLiquidityMultiplier(0.03) > k);
  assert.ok(concentratedLiquidityMultiplier(0.2) < k);
  assert.throws(() => concentratedLiquidityMultiplier(0), /halfWidth/);
  assert.throws(() => concentratedLiquidityMultiplier(1), /halfWidth/);

  const p = {
    baseSymbol: "SNDK",
    admissible: true,
    swaps: 500,
    activeLiquidityUsd: 10_000_000,
    feeUsdPerDay: 1_000,
  };
  const opts = { vaultTvlUsd: 25_000, minVaultFeeApr: 0.11, minPoolSwaps: 30 };
  const wide = poolEconomics(p, { ...opts, rangeHalfWidth: 0.2 });
  const tight = poolEconomics(p, { ...opts, rangeHalfWidth: 0.03 });
  // Same pool, same deposit: the tighter range earns strictly more.
  assert.ok(tight.vaultShare > wide.vaultShare);
  assert.ok(tight.vaultFeeApr > wide.vaultFeeApr);
  // And both are far above the naive full-range share.
  assert.ok(wide.vaultShare > 25_000 / (10_000_000 + 25_000));
});

test("the join refuses a name whose APR rests on a handful of swaps", () => {
  // SNDK's headline came from 12 swaps in a 15-minute window.
  const thin = rankCandidates({ hedge: HEDGE_ROWS, pools: [poolFor("SNDK", 0.75, 12)] });
  const sndk = thin.find((r) => r.name === "SNDK");
  assert.equal(sndk?.candidate, false);
  assert.equal(sndk?.bestQualifyingPool, null);
  assert.match(sndk?.why ?? "", /extrapolation, not a measurement/);
  // The noisy pool is still reported, so the number does not vanish.
  assert.ok((sndk?.bestAprPool?.vaultFeeApr ?? 0) > 0.7);

  // The same APR on real flow becomes a candidate -- and is still described
  // as needing a multi-day window rather than as a verdict.
  const thick = rankCandidates({ hedge: HEDGE_ROWS, pools: [poolFor("SNDK", 0.75, 400)] });
  const ok = thick.find((r) => r.name === "SNDK");
  assert.equal(ok?.candidate, true);
  assert.match(ok?.why ?? "", /not yet a verdict/);
});

test("a paying pool cannot rescue a failed hedge leg, and vice versa", () => {
  const ranked = rankCandidates({
    hedge: HEDGE_ROWS,
    pools: [
      // MSTR's pool pays, but MSTR has no perp.
      poolFor("MSTR", 0.4, 500),
      // NVDA hedges deeply, but its pool pays nothing.
      poolFor("NVDA", 0.01, 500),
    ],
  });
  const mstr = ranked.find((r) => r.name === "MSTR");
  assert.equal(mstr?.candidate, false);
  assert.match(mstr?.why ?? "", /hedge leg fails \(NO_PERP_MARKET\)/);

  const nvda = ranked.find((r) => r.name === "NVDA");
  assert.equal(nvda?.candidate, false);
  assert.match(nvda?.why ?? "", /under the/);

  assert.equal(ranked.filter((r) => r.candidate).length, 0);
});

test("the yield bar is anchored to assumed carry, and the plan's cap is 10x it", () => {
  // 0.01%/8h funding on half the vault = 5.475% APR.
  assert.ok(Math.abs(HEDGE_CARRY_APR - 0.05475) < 1e-9);
  // The plan's 0.1%/8h is an EMERGENCY cap, not the expected rate. Conflating
  // them would price a permanent crisis into every screen.
  assert.ok(Math.abs(HEDGE_CARRY_APR_AT_CAP - 0.5475) < 1e-9);
  assert.ok(Math.abs(HEDGE_CARRY_APR_AT_CAP / HEDGE_CARRY_APR - 10) < 1e-9);

  // A pool paying just over assumed carry is still rejected: carry is the
  // floor before adverse selection and gas, not the bar.
  const ranked = rankCandidates({
    hedge: HEDGE_ROWS,
    pools: [poolFor("SNDK", HEDGE_CARRY_APR * 1.5, 500)],
  });
  assert.equal(ranked.find((r) => r.name === "SNDK")?.candidate, false);
});

test("the join picks the best QUALIFYING pool, not the best-printing one", () => {
  const ranked = rankCandidates({
    hedge: HEDGE_ROWS,
    pools: [
      // A two-swap outlier printing a huge APR.
      poolFor("SNDK", 5.0, 2, "0xnoisy"),
      // A lower-APR pool that actually clears both bars.
      poolFor("SNDK", 0.4, 500, "0xreal"),
      // Inadmissible rows must never be selected.
      {
        baseSymbol: "SNDK",
        admissible: false,
        pool: "0xfake",
        activeLiquidityUsd: 1,
        feeUsdPerDay: 1e9,
        swaps: 9_999,
      },
    ],
  });
  const sndk = ranked.find((r) => r.name === "SNDK");
  // Selecting on APR first would have picked the noisy pool and then failed
  // the whole name on its swap count.
  assert.equal(sndk?.bestQualifyingPool?.pool, "0xreal");
  assert.equal(sndk?.candidate, true);
  // The outlier is preserved separately so the noise stays visible.
  assert.equal(sndk?.bestAprPool?.pool, "0xnoisy");
});

test("a hedgeable name with no pool flow is reported, not dropped", () => {
  const ranked = rankCandidates({ hedge: HEDGE_ROWS, pools: [] });
  assert.equal(ranked.length, HEDGE_ROWS.length);
  assert.match(
    ranked.find((r) => r.name === "NVDA")?.why ?? "",
    /no registered stock\/USDG pool showed flow/,
  );
  assert.match(ranked.find((r) => r.name === "AMC")?.why ?? "", /neither leg/);
});

test("the committed Phase 0 ranking was produced by the CURRENT model", () => {
  // The regression that made this test necessary: the report and index were
  // written from a full-range dilution model while the code of record had
  // moved to a range-aware one. The unit tests pinned the new model and the
  // artefacts kept the old numbers, so nothing went red and the published
  // verdict was wrong by ~34x.
  //
  // Re-deriving the ranking from the committed inputs closes that gap: change
  // the model without regenerating `generated/`, and this fails.
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "research", "generated");
  const hedgeDoc = JSON.parse(readFileSync(join(dir, "2026-09-16-hedgeability.json"), "utf8"));
  const poolDoc = JSON.parse(readFileSync(join(dir, "2026-09-16-pool-scan.json"), "utf8"));
  const rankDoc = JSON.parse(readFileSync(join(dir, "2026-09-16-phase0-ranking.json"), "utf8"));

  const recomputed = rankCandidates({ hedge: hedgeDoc.rows, pools: poolDoc.pools });

  assert.equal(recomputed.length, rankDoc.rows.length);
  for (let i = 0; i < recomputed.length; i += 1) {
    const got = recomputed[i]!;
    const want = rankDoc.rows[i]!;
    assert.equal(got.name, want.name, `row ${i} name`);
    assert.equal(got.candidate, want.candidate, `${got.name} candidate`);
    const gotApr = got.bestQualifyingPool?.vaultFeeApr ?? null;
    const wantApr = want.bestQualifyingPool?.vaultFeeApr ?? null;
    if (gotApr === null || wantApr === null) {
      assert.equal(gotApr, wantApr, `${got.name} qualifying pool presence`);
    } else {
      assert.ok(Math.abs(gotApr - wantApr) < 1e-9, `${got.name} APR drifted`);
    }
  }

  // The model the artefact was built with must also be recorded in it, so a
  // reader can see the assumptions without re-running anything.
  assert.equal(rankDoc.model.rangeHalfWidth, DEFAULT_RANGE_HALF_WIDTH);
  assert.equal(rankDoc.model.vaultTvlUsd, DEFAULT_VAULT_TVL_USD);
  assert.ok(Math.abs(rankDoc.model.hedgeCarryApr - HEDGE_CARRY_APR) < 1e-12);
});

test("the screen's carry bar and the gate's funding come from one model", () => {
  // These used to be two copies of the same arithmetic. If they drift, a name
  // can clear the screen's yield bar and then fail the gate's funding for no
  // reason but a mismatched constant.
  const rate = 0.00037;
  const liquidityUsd = 25_000;
  const windowDays = 7;

  const gateFunding = gradeGate({
    grades: [
      {
        horizonMs: 60_000,
        swaps: 1,
        uncovered: 0,
        notionalUsd: 0,
        feeUsd: 0,
        takerMarkoutUsd: 0,
        lpPnlUsd: 0,
        toxicSwaps: 0,
        toxicNotionalUsd: 0,
        toxicRefMoveUsd: 0,
        benignRefMoveUsd: 0,
        feeCoverageRatio: 1,
      },
    ],
    windowDays,
    liquidityUsd,
    fundingRate8h: rate,
    gasUsd: 0,
  }).fundingCostUsd;

  const fromCarry = liquidityUsd * hedgeCarryApr(rate) * (windowDays / 365);
  assert.ok(Math.abs(gateFunding - fromCarry) < 1e-9, `${gateFunding} vs ${fromCarry}`);

  // And the screen's published constants are that same function.
  assert.equal(HEDGE_CARRY_APR, hedgeCarryApr(0.0001));
  assert.equal(HEDGE_CARRY_APR_AT_CAP, hedgeCarryApr(0.001));
});

// ---------------------------------------------------------------- Uniswap v4

const w = (v: bigint) => (v & ((1n << 256n) - 1n)).toString(16).padStart(64, "0");
const ID = `0x${"ab".repeat(32)}`;

test("decodeV4Swap: swapper-perspective int128 amounts, id from topic, fee from data", () => {
  const log: RpcLog = {
    address: "0x8366a39cc670b4001a1121b8f6a443a643e40951",
    topics: [
      "0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f",
      ID,
      `0x${"00".repeat(12)}${"cd".repeat(20)}`,
    ],
    data: `0x${w(-5_000_000n)}${w(25n * 10n ** 18n)}${w(79228162514264337593543950336n)}${w(7n)}${w(-60n)}${w(3000n)}`,
    blockNumber: "0x10",
    transactionHash: "0x01",
    logIndex: "0x2",
  };
  const d = decodeV4Swap(log);
  assert.equal(d.id, ID);
  assert.equal(d.sender, `0x${"cd".repeat(20)}`);
  assert.equal(d.amount0, -5_000_000n); // swapper PAID 5 USDG
  assert.equal(d.amount1, 25n * 10n ** 18n); // and received stock
  assert.equal(d.tick, -60);
  assert.equal(d.fee, 3000);
  assert.equal(d.blockNumber, 16);
});

test("decodeV4Initialize: currencies from topics, key fields from data, dynamic-fee flag", () => {
  const log: RpcLog = {
    address: "0x8366a39cc670b4001a1121b8f6a443a643e40951",
    topics: [
      "0xdd466e674ea557f56295e2d0218a125ea4b4f0f6f3307b95f85e6110838d6438",
      ID,
      `0x${"00".repeat(12)}${"11".repeat(20)}`,
      `0x${"00".repeat(12)}${"22".repeat(20)}`,
    ],
    data: `0x${w(BigInt(UNIV4_DYNAMIC_FEE_FLAG))}${w(60n)}${w(0x33n)}${w(1n << 96n)}${w(0n)}`,
    blockNumber: "0x2372",
    transactionHash: "0x02",
    logIndex: "0x0",
  };
  const d = decodeV4Initialize(log);
  assert.equal(d.currency0, `0x${"11".repeat(20)}`);
  assert.equal(d.currency1, `0x${"22".repeat(20)}`);
  assert.equal(d.tickSpacing, 60);
  assert.equal(d.hooks, `0x${"00".repeat(19)}33`);
  assert.equal(d.sqrtPriceX96, 1n << 96n);
  assert.ok(d.fee & UNIV4_DYNAMIC_FEE_FLAG);
});

test("isLimitExceeded: a server-side log query timeout is a split signal, not a retry", () => {
  assert.equal(isLimitExceeded(new RpcError(-32000, "log query timed out")), true);
  assert.equal(
    isLimitExceeded(new RpcError(-32000, "logs matched by query exceeds limit of 10000")),
    true,
  );
  assert.equal(isLimitExceeded(new RpcError(429, "Too Many Requests")), false);
  assert.equal(isRateLimited(new RpcError(-32000, "log query timed out")), false);
});

test("sessionBucket: RTH, weekday overnight, and the Friday-close-to-Monday-open weekend", () => {
  // September 2026, EDT (UTC-4).
  assert.equal(sessionBucket(Date.parse("2026-09-11T19:30:00Z")), "rth"); // Fri 15:30 ET
  assert.equal(sessionBucket(Date.parse("2026-09-11T20:00:00Z")), "weekend"); // Fri 16:00 ET: close
  assert.equal(sessionBucket(Date.parse("2026-09-13T12:00:00Z")), "weekend"); // Sun
  assert.equal(sessionBucket(Date.parse("2026-09-14T13:00:00Z")), "weekend"); // Mon 09:00 ET
  assert.equal(sessionBucket(Date.parse("2026-09-14T13:30:00Z")), "rth"); // Mon 09:30 ET
  assert.equal(sessionBucket(Date.parse("2026-09-15T03:00:00Z")), "weekday_offhours"); // Mon 23:00 ET
  assert.equal(sessionBucket(Date.parse("2026-09-15T12:00:00Z")), "weekday_offhours"); // Tue 08:00 ET
});
