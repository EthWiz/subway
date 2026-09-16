/**
 * Phase 0 LP-side measurement: what do the stock-token pools on Robinhood
 * Chain actually pay, and to whom (`docs/plan.md`).
 *
 * The plan's thesis rests on fee APR: stock/USDG pools quoting 200–440%
 * against a small float. The structural screen (`probe.ts`) already showed
 * that the deep hedge books belong to the LARGE-float names, so the question
 * this answers is whether fee APR and hedgeability can coexist on any pair —
 * if the only high-APR pools are the unhedgeable ones, the product has no
 * pair to launch on and Phase 1 should not start.
 *
 * Pools are discovered from swap logs rather than from a factory, because the
 * plan never pinned the Uniswap v3 addresses on this chain and a discovery
 * pass that depends on them would inherit that gap. Every discovered pool is
 * then classified BY TOKEN ADDRESS against the registry, which is what keeps
 * an unregistered same-ticker synthetic out of the candidate set.
 *
 *   npx tsx research/scan.ts [--minutes 60] [--rpc <url>]
 *
 * Research tooling: run by hand, never imported by a runtime app.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { classifyPoolToken, type StockTokenAsset } from "./lib/hedgeability.ts";
import {
  fetchLogs,
  decodeV3Swap,
  activeLiquidityQuoteValue,
  decodeSlot0SqrtPrice,
  UNIV3_SWAP_TOPIC,
  type RpcLog,
} from "./lib/poolscan.ts";
import {
  makeHttpTransport,
  blockNumber,
  makeBlockTimeReader,
  callAddress,
  callUint,
  ethCall,
  SELECTORS,
  RH_PUBLIC_RPC,
} from "./lib/rpcClient.ts";

// What a vault would EARN from these pools is not computed here. Fee share
// depends on the vault's size and its range — modelling choices, not chain
// facts — and they live in `lib/rank.ts` so the model can be corrected
// without a 25-minute rescan. This file records only what the chain says.

const HERE = dirname(fileURLToPath(import.meta.url));
const RH_ASSETS_URL = "https://api.robinhood.com/rhj/assets";

/**
 * Used only to TARGET a window from `--minutes`. The window's real duration is
 * then read from the block timestamps, and that is what per-day figures are
 * scaled by, so drift in block rate cannot silently rescale fee income.
 * (Measured 2026-09-16: 596.7 blocks/min, 0.6% off this nominal.)
 */
const BLOCKS_PER_MINUTE = 600;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

interface PoolFacts {
  pool: string;
  token0: string;
  token1: string;
  feeTier: number;
  liquidity: bigint;
  base: "token0" | "token1" | null;
  baseSymbol: string | null;
  admissible: boolean;
  why: string;
}

async function readPool(
  transport: ReturnType<typeof makeHttpTransport>,
  pool: string,
  assets: StockTokenAsset[],
): Promise<PoolFacts> {
  const [token0, token1, feeRaw, liquidity] = await Promise.all([
    callAddress(transport, pool, SELECTORS.token0),
    callAddress(transport, pool, SELECTORS.token1),
    callUint(transport, pool, SELECTORS.fee),
    callUint(transport, pool, SELECTORS.liquidity),
  ]);

  const c0 = classifyPoolToken(token0, assets);
  const c1 = classifyPoolToken(token1, assets);

  let base: "token0" | "token1" | null = null;
  let baseSymbol: string | null = null;
  let admissible = false;
  let why: string;

  if (c0.class === "REGISTERED_STOCK_TOKEN" && c1.class === "USDG") {
    base = "token0";
    baseSymbol = c0.tokenSymbol;
    admissible = true;
    why = `${c0.tokenSymbol}/USDG`;
  } else if (c1.class === "REGISTERED_STOCK_TOKEN" && c0.class === "USDG") {
    base = "token1";
    baseSymbol = c1.tokenSymbol;
    admissible = true;
    why = `${c1.tokenSymbol}/USDG`;
  } else {
    why = `not a registered stock/USDG pair: token0 ${c0.class}, token1 ${c1.class}`;
  }

  return {
    pool,
    token0,
    token1,
    feeTier: Number(feeRaw) / 1_000_000,
    liquidity,
    base,
    baseSymbol,
    admissible,
    why,
  };
}

async function main(): Promise<void> {
  const capturedAt = new Date().toISOString();
  const minutes = Number(arg("minutes") ?? 60);
  const rpcUrl = arg("rpc") ?? RH_PUBLIC_RPC;
  // The public endpoint escalates 429 -> 403 under sustained load, and a
  // pool-by-pool scan is thousands of eth_calls. A wider gap is slower but
  // finishes; a tighter one gets blocked partway and loses the whole scan.
  const transport = makeHttpTransport({ url: rpcUrl, minGapMs: Number(arg("gap-ms") ?? 250) });

  const assetsRes = await fetch(RH_ASSETS_URL, { signal: AbortSignal.timeout(30_000) });
  const assetsBody = (await assetsRes.json()) as { assets?: StockTokenAsset[] };
  const assets = assetsBody.assets ?? [];
  if (assets.length === 0)
    throw new Error("empty stock-token registry; refusing to classify pools");

  const tip = await blockNumber(transport);
  const fromBlock = tip - Math.round(minutes * BLOCKS_PER_MINUTE);

  const blockTime = makeBlockTimeReader(transport);
  const [fromTsMs, toTsMs] = await Promise.all([blockTime(fromBlock), blockTime(tip)]);
  const windowMinutes = (toTsMs - fromTsMs) / 60_000;
  if (!(windowMinutes > 0)) {
    throw new Error(`non-positive window: blocks ${fromBlock}..${tip} span ${windowMinutes} min`);
  }
  console.log(
    `tip=${tip} scanning ${fromBlock}..${tip} (${windowMinutes.toFixed(2)} min measured, ` +
      `${minutes} requested) via ${rpcUrl}`,
  );

  const logs = await fetchLogs(
    transport,
    { fromBlock, toBlock: tip, topics: [UNIV3_SWAP_TOPIC] },
    {
      onProgress: (done, total, n) =>
        process.stdout.write(`\r  ${((done / total) * 100).toFixed(1)}%  ${n} swaps   `),
    },
  );
  process.stdout.write("\n");
  console.log(`v3 swaps: ${logs.length}`);

  const byPool = new Map<string, RpcLog[]>();
  for (const l of logs) {
    const key = l.address.toLowerCase();
    const arr = byPool.get(key);
    if (arr) arr.push(l);
    else byPool.set(key, [l]);
  }
  console.log(`distinct v3 pools with flow: ${byPool.size}`);

  const results: Record<string, unknown>[] = [];
  let scanned = 0;
  for (const [pool, poolLogs] of byPool) {
    scanned += 1;
    if (scanned % 25 === 0 || scanned === byPool.size) {
      process.stdout.write(`\r  reading pool ${scanned}/${byPool.size}   `);
    }
    // A non-v3 contract can emit the same Swap topic, in which case any of
    // token0/fee/slot0/decimals reverts. Record it and move on: a scan is
    // hundreds of throttled round trips and is expensive to restart.
    try {
      const facts = await readPool(transport, pool, assets);
      if (!facts.admissible) {
        results.push({ ...facts, liquidity: facts.liquidity.toString(), swaps: poolLogs.length });
        continue;
      }

      const baseIsToken0 = facts.base === "token0";
      const [baseDecimals, quoteDecimals, slot0Raw] = await Promise.all([
        callUint(transport, baseIsToken0 ? facts.token0 : facts.token1, SELECTORS.decimals),
        callUint(transport, baseIsToken0 ? facts.token1 : facts.token0, SELECTORS.decimals),
        ethCall(transport, pool, SELECTORS.slot0),
      ]);

      let notionalUsd = 0;
      for (const l of poolLogs) {
        const d = decodeV3Swap(l);
        const rawQuote = baseIsToken0 ? d.amount1 : d.amount0;
        notionalUsd += Math.abs(Number(rawQuote)) / 10 ** Number(quoteDecimals);
      }
      const feeUsd = notionalUsd * facts.feeTier;
      const feeUsdPerDay = feeUsd * (1_440 / windowMinutes);

      const activeLiquidityUsd = activeLiquidityQuoteValue({
        liquidity: facts.liquidity,
        sqrtPriceX96: decodeSlot0SqrtPrice(slot0Raw),
        baseDecimals: Number(baseDecimals),
        quoteDecimals: Number(quoteDecimals),
        baseIsToken0,
      });

      results.push({
        ...facts,
        liquidity: facts.liquidity.toString(),
        baseDecimals: Number(baseDecimals),
        quoteDecimals: Number(quoteDecimals),
        swaps: poolLogs.length,
        windowMinutes,
        notionalUsd,
        feeUsd,
        // Annualised from the window. Stated as what it is — an extrapolation
        // from one window, which is exactly the number the plan's 50% fee-decay
        // stress exists to discount.
        feeUsdPerDay,
        activeLiquidityUsd,
      });
    } catch (err) {
      results.push({
        pool,
        error: (err as Error).message,
        admissible: false,
        swaps: poolLogs.length,
      });
    }
  }
  process.stdout.write("\n");

  const admissible = results.filter((r) => r.admissible);
  admissible.sort((a, b) => (b.feeUsdPerDay as number) - (a.feeUsdPerDay as number));

  const outPath = resolve(HERE, join("generated", `${capturedAt.slice(0, 10)}-pool-scan.json`));
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    `${JSON.stringify(
      {
        capturedAt,
        rpcUrl,
        window: {
          fromBlock,
          toBlock: tip,
          requestedMinutes: minutes,
          minutes: windowMinutes,
          fromTsMs,
          toTsMs,
        },
        counts: { swaps: logs.length, pools: byPool.size, admissible: admissible.length },
        pools: results,
      },
      null,
      2,
    )}\n`,
  );

  console.log(`\n=== REGISTERED STOCK/USDG POOLS WITH FLOW (${admissible.length}) ===`);
  for (const r of admissible.slice(0, 25)) {
    console.log(
      `  ${String(r.baseSymbol).padEnd(8)} fee=${((r.feeTier as number) * 100).toFixed(2)}%` +
        ` swaps=${String(r.swaps).padStart(5)}` +
        ` activeL=$${Math.round(r.activeLiquidityUsd as number)
          .toLocaleString("en-US")
          .padStart(11)}` +
        ` poolFees/day=$${Math.round(r.feeUsdPerDay as number)
          .toLocaleString("en-US")
          .padStart(8)}`,
    );
  }
  if (admissible.length === 0) {
    console.log("  none — no pool pairs a REGISTERED stock token against USDG in this window");
  }
  console.log(`\nwrote ${outPath}`);
}

await main();
