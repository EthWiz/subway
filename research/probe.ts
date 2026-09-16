/**
 * Phase 0 structural screen, live.
 *
 * Snapshots the Robinhood Stock Token registry and Lighter RH's perp books,
 * runs `screenHedgeability`, and writes the ranked table to `generated/`.
 *
 * This is the CHEAP half of the evidence gate and it runs first on purpose:
 * it answers "which names can be hedged at all, and at what size" in one
 * round trip, before anyone spends a week of recorder tape computing markouts
 * for a pair whose hedge book does not exist.
 *
 *   npx tsx research/probe.ts [--out generated/<date>-hedgeability.json]
 *
 * Research tooling: run by hand, never imported by a runtime app.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  screenHedgeability,
  hedgeableNames,
  MIN_VIABLE_VAULT_TVL_USD,
  type HedgeabilityRow,
  type StockTokenAsset,
  type LighterOrderBook,
  type LighterBookStats,
} from "./lib/hedgeability.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

const RH_ASSETS_URL = "https://api.robinhood.com/rhj/assets";
const LIGHTER_RH_BOOKS_URL = "https://api.rh.lighter.xyz/api/v1/orderBooks";
const LIGHTER_RH_STATS_URL = "https://api.rh.lighter.xyz/api/v1/exchangeStats";

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function fmtUsd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

async function main(): Promise<void> {
  const capturedAt = new Date().toISOString();

  const [assetsRaw, booksRaw, statsRaw] = await Promise.all([
    getJson(RH_ASSETS_URL),
    getJson(LIGHTER_RH_BOOKS_URL),
    getJson(LIGHTER_RH_STATS_URL),
  ]);

  const assets = (
    Array.isArray(assetsRaw) ? assetsRaw : ((assetsRaw as Record<string, unknown>).assets ?? [])
  ) as StockTokenAsset[];
  const orderBooks = ((booksRaw as Record<string, unknown>).order_books ??
    []) as LighterOrderBook[];
  const stats = ((statsRaw as Record<string, unknown>).order_book_stats ??
    []) as LighterBookStats[];

  if (assets.length === 0 || orderBooks.length === 0) {
    throw new Error(
      `empty venue snapshot (assets=${assets.length} books=${orderBooks.length}); ` +
        "refusing to emit a screen that would read as 'nothing is hedgeable'",
    );
  }

  const maxDailyFlowShare = Number(arg("flow-share") ?? 0.02);
  const rows = screenHedgeability({ assets, orderBooks, stats, maxDailyFlowShare });
  const hedgeable = hedgeableNames(rows);

  const out = {
    capturedAt,
    sources: { RH_ASSETS_URL, LIGHTER_RH_BOOKS_URL, LIGHTER_RH_STATS_URL },
    params: { maxDailyFlowShare, minViableVaultTvlUsd: MIN_VIABLE_VAULT_TVL_USD },
    counts: {
      stockTokens: assets.length,
      perpBooks: orderBooks.filter((b) => b.market_type === "perp").length,
      screened: rows.length,
      hedgeable: hedgeable.length,
    },
    rows,
  };

  const outPath = resolve(
    HERE,
    arg("out") ?? join("generated", `${capturedAt.slice(0, 10)}-hedgeability.json`),
  );
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);

  const show = (r: HedgeabilityRow) =>
    `  ${r.name.padEnd(10)} ${r.verdict.padEnd(16)} perp=${String(r.perpMarketId ?? "-").padEnd(5)}` +
    ` 24h=${fmtUsd(r.perpDailyQuoteVolumeUsd).padStart(14)} maxVault=${fmtUsd(r.maxVaultTvlUsd).padStart(12)}`;

  console.log(`\nStock tokens: ${assets.length}   Lighter RH perps: ${out.counts.perpBooks}`);
  console.log(
    `Hedgeable at ${(maxDailyFlowShare * 100).toFixed(1)}% participation and a ` +
      `${fmtUsd(MIN_VIABLE_VAULT_TVL_USD)} vault floor: ${hedgeable.length}/${rows.length}\n`,
  );
  console.log("=== HEDGEABLE (deepest first) ===");
  for (const r of hedgeable) console.log(show(r));

  console.log("\n=== THE PLAN'S NAMED CANDIDATES ===");
  for (const name of ["AMC", "HOOD", "MSTR"]) {
    const r = rows.find((x) => x.name === name);
    console.log(r ? show(r) : `  ${name.padEnd(10)} ABSENT from both the registry and Lighter RH`);
  }

  console.log(`\nwrote ${outPath}`);
}

await main();
