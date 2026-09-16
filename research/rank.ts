/**
 * Phase 0 verdict table: joins the hedgeability screen and the pool scan into
 * one ranked candidate list for `docs/plan.md`.
 *
 *   npx tsx research/rank.ts \
 *     [--hedge generated/2026-09-16-hedgeability.json] \
 *     [--pools generated/2026-09-16-pool-scan.json]
 *
 * Reads only `generated/` artefacts — no network. Research tooling.
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  rankCandidates,
  HEDGE_CARRY_APR,
  HEDGE_CARRY_APR_AT_CAP,
  DEFAULT_RANGE_HALF_WIDTH,
  DEFAULT_VAULT_TVL_USD,
  type HedgeSide,
  type PoolSide,
} from "./lib/rank.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const today = new Date().toISOString().slice(0, 10);
const hedgePath = resolve(HERE, arg("hedge") ?? join("generated", `${today}-hedgeability.json`));
const poolsPath = resolve(HERE, arg("pools") ?? join("generated", `${today}-pool-scan.json`));

const hedgeDoc = JSON.parse(readFileSync(hedgePath, "utf8")) as {
  capturedAt: string;
  rows: HedgeSide[];
};
const poolDoc = JSON.parse(readFileSync(poolsPath, "utf8")) as {
  capturedAt: string;
  window: { minutes: number };
  pools: PoolSide[];
};

const ranked = rankCandidates({ hedge: hedgeDoc.rows, pools: poolDoc.pools });
const candidates = ranked.filter((r) => r.candidate);

const outPath = resolve(HERE, join("generated", `${today}-phase0-ranking.json`));
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(
  outPath,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      inputs: {
        hedge: { path: hedgePath, capturedAt: hedgeDoc.capturedAt },
        pools: {
          path: poolsPath,
          capturedAt: poolDoc.capturedAt,
          windowMinutes: poolDoc.window.minutes,
        },
      },
      model: {
        vaultTvlUsd: DEFAULT_VAULT_TVL_USD,
        rangeHalfWidth: DEFAULT_RANGE_HALF_WIDTH,
        hedgeCarryApr: HEDGE_CARRY_APR,
        hedgeCarryAprAtPlanFundingCap: HEDGE_CARRY_APR_AT_CAP,
        minVaultFeeApr: HEDGE_CARRY_APR * 2,
      },
      counts: { screened: ranked.length, candidates: candidates.length },
      rows: ranked,
    },
    null,
    2,
  )}\n`,
);

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const usd = (x: number) => `$${Math.round(x).toLocaleString("en-US")}`;

console.log(
  `\nVault $${DEFAULT_VAULT_TVL_USD.toLocaleString("en-US")} over +/-${(DEFAULT_RANGE_HALF_WIDTH * 100).toFixed(0)}% ` +
    `(concentrated liquidity counts ~${(2 / (1 - Math.sqrt(1 - DEFAULT_RANGE_HALF_WIDTH) + (1 - 1 / Math.sqrt(1 + DEFAULT_RANGE_HALF_WIDTH)))).toFixed(1)}x face value).\n` +
    `Assumed hedge carry ${pct(HEDGE_CARRY_APR)} APR (at the plan's emergency funding cap it is ${pct(HEDGE_CARRY_APR_AT_CAP)}); ` +
    `yield bar is 2x the assumed carry.\nPool window: ${poolDoc.window.minutes} min.\n`,
);

console.log("=== NAMES CLEARING BOTH LEGS (worth a multi-day window) ===");
if (candidates.length === 0) console.log("  none");
for (const r of candidates) {
  const p = r.bestQualifyingPool;
  console.log(
    `  ${r.name.padEnd(8)} ${pct(p?.vaultFeeApr ?? 0).padStart(9)} vault APR on ${String(p?.swaps ?? 0).padStart(4)} swaps` +
      `   hedge carries ${usd(r.maxVaultTvlUsd)}`,
  );
}

console.log("\n=== HEDGEABLE NAMES, BEST POOL (top 14) ===");
for (const r of ranked.filter((x) => x.hedgeVerdict === "HEDGEABLE").slice(0, 14)) {
  const q = r.bestQualifyingPool;
  const a = r.bestAprPool;
  console.log(
    `  ${r.name.padEnd(8)} maxVault=${usd(r.maxVaultTvlUsd).padStart(11)}` +
      ` qualifying=${(q ? pct(q.vaultFeeApr) : "-").padStart(9)}` +
      ` bestPrint=${pct(a?.vaultFeeApr ?? 0).padStart(9)} on ${String(a?.swaps ?? 0).padStart(4)} swaps` +
      ` activeL=${usd(a?.activeLiquidityUsd ?? 0).padStart(13)}`,
  );
}

console.log("\n=== THE PLAN'S NAMED CANDIDATES ===");
for (const name of ["AMC", "HOOD", "MSTR"]) {
  const r = ranked.find((x) => x.name === name);
  console.log(r ? `  ${name.padEnd(8)} ${r.why}` : `  ${name.padEnd(8)} absent from both sources`);
}

console.log(`\nwrote ${outPath}`);
