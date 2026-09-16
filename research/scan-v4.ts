/**
 * A5: where the stock-token volume actually is on Uniswap v4 (`docs/plan.md`).
 *
 * The Phase 0 scan was v3-only while the vault's only adapter is v4, so the
 * question "which pair" was being asked of the wrong venue. This scans v4
 * `Swap` events off the PoolManager singleton over a window long enough to
 * contain two US opens and a weekend, resolves each pool id to its currencies
 * through the pool's `Initialize` event (the only place v4 records it),
 * classifies tokens BY ADDRESS against the Robinhood stock-token registry, and
 * ranks the stock/USDG pools by fee income — split by trading session, and
 * annotated with whether a Chainlink feed exists for the name, because a pool
 * without a feed cannot be a Track A pair whatever its volume.
 *
 * Two RPCs, deliberately. The public endpoint serves `eth_getLogs` but
 * throttles hard; the Dwellir archive node serves unlimited `eth_call` but no
 * logs at all on its plan. Logs go to one, state reads to the other.
 *
 * Two passes, because the chain does ~50 v4 swaps a second and five days of
 * them is ~25M logs — more than a throttled endpoint or memory will carry.
 * Pass one DISCOVERS candidate pools from a handful of sampled windows spread
 * across the range (`--samples`, `--sample-minutes`): every pool with flow in
 * a sample is resolved and classified, and only the registered stock/USDG
 * ones survive. Pass two scans the WHOLE range filtered to those ids — `id`
 * is an indexed topic, so the 10k cap almost never bites and the chunks are
 * enormous. A stock pool that traded in the window but in none of the samples
 * is missed; with eight 45-minute samples across five days that is a pool too
 * quiet to rank anyway.
 *
 *   DWELLER_RPC_URL=... npx tsx research/scan-v4.ts --from 2026-09-10T12:00Z --to 2026-09-15T12:00Z
 *   npx tsx research/scan-v4.ts --minutes 30            # quick look: one window, one pass
 *
 * Research tooling: run by hand, never imported by a runtime app.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { classifyPoolToken, type StockTokenAsset } from "./lib/hedgeability.ts";
import {
  fetchLogs,
  decodeV4Swap,
  decodeV4Initialize,
  activeLiquidityQuoteValue,
  sessionBucket,
  UNIV4_SWAP_TOPIC,
  UNIV4_INITIALIZE_TOPIC,
  UNIV4_DYNAMIC_FEE_FLAG,
  type RpcTransport,
  type RpcLog,
  type DecodedV4Initialize,
  type SessionBucket,
} from "./lib/poolscan.ts";
import {
  makeHttpTransport,
  blockNumber,
  callUint,
  SELECTORS,
  RH_PUBLIC_RPC,
} from "./lib/rpcClient.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const RH_ASSETS_URL = "https://api.robinhood.com/rhj/assets";

// Fixed facts, `docs/plan.md`.
const POOL_MANAGER = "0x8366a39cc670b4001a1121b8f6a443a643e40951";
const STATE_VIEW = "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b";
/** First block at which PoolManager has code (binary-searched 2026-09-16). */
const POOL_MANAGER_DEPLOY_BLOCK = 9_070;
const STATE_VIEW_SEL = { getSlot0: "0xc815641c", getLiquidity: "0xfa6793d5" } as const;

const BLOCKS_PER_MINUTE = 600;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function blockTimestamp(t: RpcTransport, block: number): Promise<number> {
  const b = (await t("eth_getBlockByNumber", [`0x${block.toString(16)}`, false])) as {
    timestamp: string;
  } | null;
  if (!b) throw new Error(`no block ${block}`);
  return Number(BigInt(b.timestamp)) * 1_000;
}

/** Highest block at or before `tsMs`, by binary search on the state node. */
async function blockAt(t: RpcTransport, tip: number, tsMs: number): Promise<number> {
  let lo = 0;
  let hi = tip;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((await blockTimestamp(t, mid)) <= tsMs) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * Wall clock for every block in the window from a handful of anchors,
 * piecewise-linearly. Reading one timestamp per swap would be hundreds of
 * thousands of calls; block time drifts by under 1% so anchors every 100k
 * blocks put any swap within a minute or two of its true time, which is
 * plenty for session bucketing.
 */
async function makeClock(
  t: RpcTransport,
  fromBlock: number,
  toBlock: number,
): Promise<(block: number) => number> {
  const anchors: [number, number][] = [];
  const step = 100_000;
  for (let b = fromBlock; b < toBlock; b += step) anchors.push([b, await blockTimestamp(t, b)]);
  anchors.push([toBlock, await blockTimestamp(t, toBlock)]);
  return (block: number) => {
    let i = 0;
    while (i + 2 < anchors.length && anchors[i + 1]![0] <= block) i += 1;
    const [b0, t0] = anchors[i]!;
    const [b1, t1] = anchors[i + 1]!;
    return t0 + ((block - b0) * (t1 - t0)) / (b1 - b0);
  };
}

/**
 * Resolve pool ids to their `Initialize` records — the only place v4 says
 * what an id refers to — for exactly the pools that had flow.
 *
 * Not a chain-wide crawl. There are over half a million v4 pools on this
 * chain by 2026-09-16, almost all junk, and walking every `Initialize` log
 * through the public endpoint's 10k-match cap tripped its 429→403 escalation
 * a quarter of the way in. `id` is an indexed topic, so the lookup can be
 * filtered to a list of ids instead: a few hundred pools with flow resolve in
 * a handful of requests. Results are cached on disk by id, since an
 * `Initialize` record never changes.
 */
async function resolvePools(
  logsT: RpcTransport,
  ids: string[],
  tip: number,
  gapMs: number,
): Promise<Map<string, DecodedV4Initialize>> {
  const cachePath = resolve(HERE, "generated", "v4-pools.json");
  const pools = new Map<string, DecodedV4Initialize>();
  if (existsSync(cachePath)) {
    const c = JSON.parse(readFileSync(cachePath, "utf8")) as {
      pools: (Omit<DecodedV4Initialize, "sqrtPriceX96"> & { sqrtPriceX96: string })[];
    };
    for (const p of c.pools) pools.set(p.id, { ...p, sqrtPriceX96: BigInt(p.sqrtPriceX96) });
  }
  const missing = ids.filter((id) => !pools.has(id));
  console.log(`pool cache: ${pools.size} known; ${missing.length} of ${ids.length} to resolve`);

  const IDS_PER_QUERY = 200;
  for (let i = 0; i < missing.length; i += IDS_PER_QUERY) {
    const batch = missing.slice(i, i + IDS_PER_QUERY);
    const logs = await fetchLogs(
      logsT,
      {
        fromBlock: POOL_MANAGER_DEPLOY_BLOCK,
        toBlock: tip,
        address: POOL_MANAGER,
        topics: [UNIV4_INITIALIZE_TOPIC, batch],
      },
      { initialChunk: tip - POOL_MANAGER_DEPLOY_BLOCK + 1, minChunk: 100_000, throttleMs: gapMs },
    );
    for (const l of logs) {
      const d = decodeV4Initialize(l);
      pools.set(d.id, d);
    }
    process.stdout.write(
      `\r  Initialize ${Math.min(i + IDS_PER_QUERY, missing.length)}/${missing.length} resolved   `,
    );
  }
  if (missing.length > 0) process.stdout.write("\n");

  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(
    cachePath,
    `${JSON.stringify(
      {
        pools: [...pools.values()].map((p) => ({ ...p, sqrtPriceX96: p.sqrtPriceX96.toString() })),
      },
      null,
      0,
    )}\n`,
  );
  return pools;
}

async function main(): Promise<void> {
  const capturedAt = new Date().toISOString();
  const logsUrl = arg("rpc") ?? RH_PUBLIC_RPC;
  const stateUrl = process.env.DWELLER_RPC_URL ?? logsUrl;
  const gapMs = Number(arg("gap-ms") ?? 150);
  const logsT = makeHttpTransport({ url: logsUrl, minGapMs: gapMs, maxRetries: 10 });
  const stateT =
    stateUrl === logsUrl
      ? logsT
      : makeHttpTransport({ url: stateUrl, minGapMs: 0, timeoutMs: 90_000 });

  const assetsRes = await fetch(RH_ASSETS_URL, { signal: AbortSignal.timeout(30_000) });
  const assets = ((await assetsRes.json()) as { assets?: StockTokenAsset[] }).assets ?? [];
  if (assets.length === 0)
    throw new Error("empty stock-token registry; refusing to classify pools");

  const feedDir = JSON.parse(
    readFileSync(resolve(HERE, "generated", "2026-09-16-chainlink-feeds.json"), "utf8"),
  ) as { feeds: { name: string; marketHours: string | null }[] };
  const feedNames = new Set(
    feedDir.feeds
      .filter((f) => f.marketHours === "us_equities_24/5")
      .map((f) => f.name.replace("Robinhood ", "").replace(" / USD", "").replace("-USD", "")),
  );

  const tip = await blockNumber(stateT);
  let fromBlock: number;
  let toBlock: number;
  if (arg("from")) {
    fromBlock = await blockAt(stateT, tip, Date.parse(arg("from")!));
    toBlock = arg("to") ? await blockAt(stateT, tip, Date.parse(arg("to")!)) : tip;
  } else {
    toBlock = tip;
    fromBlock = tip - Math.round(Number(arg("minutes") ?? 60) * BLOCKS_PER_MINUTE);
  }
  const [fromTsMs, toTsMs] = [
    await blockTimestamp(stateT, fromBlock),
    await blockTimestamp(stateT, toBlock),
  ];
  const windowMinutes = (toTsMs - fromTsMs) / 60_000;
  console.log(
    `window ${fromBlock}..${toBlock} = ${new Date(fromTsMs).toISOString()} → ${new Date(toTsMs).toISOString()}` +
      ` (${(windowMinutes / 60).toFixed(1)} h); logs via ${logsUrl}, state via ${stateUrl === logsUrl ? "same" : "archive node"}`,
  );
  const clock = await makeClock(stateT, fromBlock, toBlock);

  // ---- pass one: discover candidate pools from sampled windows ----
  const sampleCount = arg("from") ? Number(arg("samples") ?? 8) : 1;
  const sampleBlocks = arg("from")
    ? Math.round(Number(arg("sample-minutes") ?? 45) * BLOCKS_PER_MINUTE)
    : toBlock - fromBlock + 1;
  const samples: { fromBlock: number; toBlock: number }[] = [];
  for (let i = 0; i < sampleCount; i += 1) {
    const start =
      sampleCount === 1
        ? fromBlock
        : Math.round(fromBlock + ((toBlock - fromBlock - sampleBlocks) * i) / (sampleCount - 1));
    samples.push({ fromBlock: start, toBlock: Math.min(start + sampleBlocks - 1, toBlock) });
  }

  const seenIds = new Set<string>();
  let sampledSwaps = 0;
  for (const [i, w] of samples.entries()) {
    const logs = await fetchLogs(
      logsT,
      { ...w, address: POOL_MANAGER, topics: [UNIV4_SWAP_TOPIC] },
      {
        initialChunk: 2_000,
        throttleMs: gapMs,
        onProgress: (done, total, n) =>
          process.stdout.write(
            `\r  discover ${i + 1}/${samples.length} ${((done / total) * 100).toFixed(0)}%  ${n} swaps   `,
          ),
      },
    );
    sampledSwaps += logs.length;
    for (const l of logs) seenIds.add(decodeV4Swap(l).id);
  }
  process.stdout.write("\n");
  console.log(
    `discovery: ${sampledSwaps} swaps in ${samples.length} sample(s); ${seenIds.size} distinct pools`,
  );

  const pools = await resolvePools(logsT, [...seenIds], tip, gapMs);

  const candidates: string[] = [];
  for (const id of seenIds) {
    const init = pools.get(id);
    if (!init) continue;
    const c0 = classifyPoolToken(init.currency0, assets);
    const c1 = classifyPoolToken(init.currency1, assets);
    if (
      (c0.class === "REGISTERED_STOCK_TOKEN" && c1.class === "USDG") ||
      (c1.class === "REGISTERED_STOCK_TOKEN" && c0.class === "USDG")
    ) {
      candidates.push(id);
    }
  }
  console.log(`candidates (registered stock/USDG): ${candidates.length}`);

  // ---- pass two: every swap in the window for the candidate pools only ----
  const swapLogs: RpcLog[] = [];
  const IDS_PER_QUERY = 150;
  const batches = Math.ceil(candidates.length / IDS_PER_QUERY);
  for (let i = 0; i < candidates.length; i += IDS_PER_QUERY) {
    const batch = candidates.slice(i, i + IDS_PER_QUERY);
    const b = Math.floor(i / IDS_PER_QUERY) + 1;
    const logs = await fetchLogs(
      logsT,
      { fromBlock, toBlock, address: POOL_MANAGER, topics: [UNIV4_SWAP_TOPIC, batch] },
      {
        initialChunk: 200_000,
        minChunk: 500,
        throttleMs: gapMs,
        onProgress: (done, total, n) =>
          process.stdout.write(
            `\r  Swap batch ${b}/${batches} ${((done / total) * 100).toFixed(1)}%  ${n} swaps   `,
          ),
      },
    );
    swapLogs.push(...logs);
  }
  process.stdout.write("\n");
  console.log(`v4 swaps in window (candidate pools): ${swapLogs.length}`);

  const byId = new Map<string, ReturnType<typeof decodeV4Swap>[]>();
  for (const l of swapLogs) {
    const d = decodeV4Swap(l);
    const arr = byId.get(d.id);
    if (arr) arr.push(d);
    else byId.set(d.id, [d]);
  }

  const results: Record<string, unknown>[] = [];
  const decimalsCache = new Map<string, Promise<bigint>>();
  const decimalsOf = (token: string) => {
    let p = decimalsCache.get(token);
    if (!p) {
      p = callUint(stateT, token, SELECTORS.decimals);
      decimalsCache.set(token, p);
    }
    return p;
  };

  let n = 0;
  for (const [id, swaps] of byId) {
    n += 1;
    if (n % 50 === 0 || n === byId.size)
      process.stdout.write(`\r  classifying ${n}/${byId.size}   `);
    const init = pools.get(id);
    if (!init) {
      results.push({
        id,
        swaps: swaps.length,
        admissible: false,
        why: "Initialize not found (id filter returned nothing)",
      });
      continue;
    }
    const c0 = classifyPoolToken(init.currency0, assets);
    const c1 = classifyPoolToken(init.currency1, assets);
    let base: "currency0" | "currency1" | null = null;
    let baseSymbol: string | null = null;
    if (c0.class === "REGISTERED_STOCK_TOKEN" && c1.class === "USDG") {
      base = "currency0";
      baseSymbol = c0.tokenSymbol;
    } else if (c1.class === "REGISTERED_STOCK_TOKEN" && c0.class === "USDG") {
      base = "currency1";
      baseSymbol = c1.tokenSymbol;
    }
    const common = {
      id,
      currency0: init.currency0,
      currency1: init.currency1,
      feeTier: init.fee & UNIV4_DYNAMIC_FEE_FLAG ? null : init.fee / 1_000_000,
      dynamicFee: Boolean(init.fee & UNIV4_DYNAMIC_FEE_FLAG),
      tickSpacing: init.tickSpacing,
      hooks: init.hooks,
      hooked: init.hooks !== "0x0000000000000000000000000000000000000000",
      swaps: swaps.length,
    };
    if (!base) {
      results.push({
        ...common,
        admissible: false,
        why: `not a registered stock/USDG pair: currency0 ${c0.class}, currency1 ${c1.class}`,
      });
      continue;
    }
    try {
      const baseIsToken0 = base === "currency0";
      const [baseDecimals, quoteDecimals, slot0Raw, liqRaw] = await Promise.all([
        decimalsOf(baseIsToken0 ? init.currency0 : init.currency1),
        decimalsOf(baseIsToken0 ? init.currency1 : init.currency0),
        stateT("eth_call", [
          { to: STATE_VIEW, data: STATE_VIEW_SEL.getSlot0 + id.slice(2) },
          "latest",
        ]) as Promise<string>,
        stateT("eth_call", [
          { to: STATE_VIEW, data: STATE_VIEW_SEL.getLiquidity + id.slice(2) },
          "latest",
        ]) as Promise<string>,
      ]);
      const sqrtPriceX96 = BigInt(`0x${slot0Raw.slice(2, 66)}`);
      const liquidity = BigInt(liqRaw);

      const buckets: Record<SessionBucket, { swaps: number; notionalUsd: number; feeUsd: number }> =
        {
          rth: { swaps: 0, notionalUsd: 0, feeUsd: 0 },
          weekday_offhours: { swaps: 0, notionalUsd: 0, feeUsd: 0 },
          weekend: { swaps: 0, notionalUsd: 0, feeUsd: 0 },
        };
      let notionalUsd = 0;
      let feeUsd = 0;
      for (const s of swaps) {
        const rawQuote = baseIsToken0 ? s.amount1 : s.amount0;
        const q = Math.abs(Number(rawQuote)) / 10 ** Number(quoteDecimals);
        const f = q * (s.fee / 1_000_000);
        const b = buckets[sessionBucket(clock(s.blockNumber))];
        b.swaps += 1;
        b.notionalUsd += q;
        b.feeUsd += f;
        notionalUsd += q;
        feeUsd += f;
      }
      results.push({
        ...common,
        admissible: true,
        baseSymbol,
        base,
        baseDecimals: Number(baseDecimals),
        quoteDecimals: Number(quoteDecimals),
        hasFeed: feedNames.has(baseSymbol!),
        windowMinutes,
        notionalUsd,
        feeUsd,
        feeUsdPerDay: feeUsd * (1_440 / windowMinutes),
        buckets,
        liquidity: liquidity.toString(),
        activeLiquidityUsd: activeLiquidityQuoteValue({
          liquidity,
          sqrtPriceX96,
          baseDecimals: Number(baseDecimals),
          quoteDecimals: Number(quoteDecimals),
          baseIsToken0,
        }),
      });
    } catch (err) {
      results.push({ ...common, admissible: false, baseSymbol, error: (err as Error).message });
    }
  }
  process.stdout.write("\n");

  const admissible = results.filter((r) => r.admissible);
  admissible.sort((a, b) => (b.feeUsdPerDay as number) - (a.feeUsdPerDay as number));

  const outPath = resolve(HERE, join("generated", `${capturedAt.slice(0, 10)}-pool-scan-v4.json`));
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    `${JSON.stringify(
      {
        capturedAt,
        logsUrl,
        stateUrl: stateUrl === logsUrl ? logsUrl : "dwellir robinhood-mainnet-archive",
        window: { fromBlock, toBlock, minutes: windowMinutes, fromTsMs, toTsMs },
        counts: {
          discoverySamples: samples,
          discoveredPools: seenIds.size,
          candidates: candidates.length,
          swaps: swapLogs.length,
          pools: byId.size,
          admissible: admissible.length,
        },
        pools: results,
      },
      null,
      2,
    )}\n`,
  );

  console.log(`\n=== v4 REGISTERED STOCK/USDG POOLS WITH FLOW (${admissible.length}) ===`);
  console.log("  name     fee     feed hook  swaps   fees/day     activeL      rth%  offh%  wknd%");
  for (const r of admissible.slice(0, 40)) {
    const b = r.buckets as Record<SessionBucket, { notionalUsd: number }>;
    const tot = (r.notionalUsd as number) || 1;
    const pct = (x: number) => `${((x / tot) * 100).toFixed(0)}%`.padStart(5);
    console.log(
      `  ${String(r.baseSymbol).padEnd(8)}` +
        ` ${r.dynamicFee ? "dyn   " : `${((r.feeTier as number) * 100).toFixed(2)}%`.padEnd(6)}` +
        ` ${r.hasFeed ? "YES " : "no  "}` +
        ` ${r.hooked ? "HOOK" : "    "}` +
        ` ${String(r.swaps).padStart(6)}` +
        ` $${Math.round(r.feeUsdPerDay as number)
          .toLocaleString("en-US")
          .padStart(9)}` +
        ` $${Math.round(r.activeLiquidityUsd as number)
          .toLocaleString("en-US")
          .padStart(12)}` +
        ` ${pct(b.rth.notionalUsd)} ${pct(b.weekday_offhours.notionalUsd)} ${pct(b.weekend.notionalUsd)}`,
    );
  }
  console.log(`\nwrote ${outPath}`);
}

await main();
