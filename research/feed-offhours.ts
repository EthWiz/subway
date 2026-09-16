/**
 * A2 evidence: what a Robinhood Chain Chainlink equity feed actually does
 * outside US trading hours (`docs/plan.md` A2).
 *
 * The vault gates deposits and range moves on `requireFreshPrice`, which
 * rejects any feed older than `maxFeedAge` (2 h by default). The plan's
 * fixed-facts table says equity feeds have "no off-hours heartbeat", which if
 * true means deposits are blocked nights and weekends. Chainlink's own
 * directory says something different again: every equity feed is listed at a
 * 24 h heartbeat, 0.5% deviation, market hours "us_equities_24/5". Nobody has
 * read the chain. This script does, using the archive node to sample every
 * equity feed at fixed wall-clock points across a Friday close, the weekend,
 * Monday's open and a weekday overnight, and reconstructs the update cadence
 * of a few feeds at hourly resolution.
 *
 *   DWELLER_RPC_URL=... npx tsx research/feed-offhours.ts
 *
 * Research tooling: run by hand, never imported by a runtime app.
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { makeHttpTransport, blockNumber } from "./lib/rpcClient.ts";
import type { RpcTransport } from "./lib/poolscan.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const RPC = process.env.DWELLER_RPC_URL;
if (!RPC) throw new Error("DWELLER_RPC_URL is required (archive node; eth_call at old blocks)");

const SEL = {
  latestRoundData: "0xfeaf968c",
  decimals: "0x313ce567",
  description: "0x7284e416",
  oraclePaused: "0x7706ba52",
  uiMultiplier: "0xa60bf13d",
} as const;

// Wall-clock sample points, UTC. US RTH is 13:30–20:00 UTC in September (EDT).
const SAMPLES: { label: string; iso: string }[] = [
  { label: "Fri RTH", iso: "2026-09-11T19:30:00Z" },
  { label: "Fri +15m after close", iso: "2026-09-11T20:15:00Z" },
  { label: "Fri late evening", iso: "2026-09-11T23:30:00Z" },
  { label: "Sat noon", iso: "2026-09-12T12:00:00Z" },
  { label: "Sun noon", iso: "2026-09-13T12:00:00Z" },
  { label: "Sun 23:30 (before 20:00 ET reopen?)", iso: "2026-09-13T23:30:00Z" },
  { label: "Mon 01:00 (after 20:00 ET Sun)", iso: "2026-09-14T01:00:00Z" },
  { label: "Mon 08:00 overnight", iso: "2026-09-14T08:00:00Z" },
  { label: "Mon 13:00 premarket", iso: "2026-09-14T13:00:00Z" },
  { label: "Mon 13:45 just after open", iso: "2026-09-14T13:45:00Z" },
  { label: "Mon 20:30 after close", iso: "2026-09-14T20:30:00Z" },
  { label: "Tue 03:00 weekday overnight", iso: "2026-09-15T03:00:00Z" },
];

/** Feeds whose update cadence is reconstructed at hourly resolution. */
const CADENCE_FEEDS = ["TSLA", "NVDA", "INTC", "SPY", "GME"];
const CADENCE_FROM = Date.parse("2026-09-11T12:00:00Z");
const CADENCE_TO = Date.parse("2026-09-15T12:00:00Z");
const CADENCE_STEP_MS = 30 * 60_000;

interface Feed {
  name: string;
  proxy: string;
  decimals: number;
}

function word(hex: string, i: number): string {
  const body = hex.startsWith("0x") ? hex.slice(2) : hex;
  return body.slice(i * 64, (i + 1) * 64);
}
function int256(w: string): bigint {
  const v = BigInt(`0x${w}`);
  return v >= 1n << 255n ? v - (1n << 256n) : v;
}

async function callAt(
  t: RpcTransport,
  to: string,
  data: string,
  block: number,
): Promise<string | null> {
  try {
    return (await t("eth_call", [{ to, data }, `0x${block.toString(16)}`])) as string;
  } catch {
    return null;
  }
}

/** Highest block whose timestamp is <= ts (seconds), by binary search. */
function makeBlockAt(t: RpcTransport, tip: number) {
  const tsCache = new Map<number, number>();
  const ts = async (b: number): Promise<number> => {
    const hit = tsCache.get(b);
    if (hit !== undefined) return hit;
    const blk = (await t("eth_getBlockByNumber", [`0x${b.toString(16)}`, false])) as {
      timestamp: string;
    };
    const v = Number(BigInt(blk.timestamp));
    tsCache.set(b, v);
    return v;
  };
  return async (targetSec: number): Promise<number> => {
    let lo = 0;
    let hi = tip;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if ((await ts(mid)) <= targetSec) lo = mid;
      else hi = mid;
    }
    return lo;
  };
}

interface Reading {
  block: number;
  answer: string | null;
  price: number | null;
  updatedAt: number | null;
  ageSec: number | null;
  roundId: string | null;
  paused: boolean | "n/a";
  uiMultiplier: string | "n/a";
}

async function read(t: RpcTransport, f: Feed, block: number, atSec: number): Promise<Reading> {
  const [lrd, paused, mult] = await Promise.all([
    callAt(t, f.proxy, SEL.latestRoundData, block),
    callAt(t, f.proxy, SEL.oraclePaused, block),
    callAt(t, f.proxy, SEL.uiMultiplier, block),
  ]);
  if (!lrd || lrd.length < 2 + 64 * 5) {
    return {
      block,
      answer: null,
      price: null,
      updatedAt: null,
      ageSec: null,
      roundId: null,
      paused: "n/a",
      uiMultiplier: "n/a",
    };
  }
  const answer = int256(word(lrd, 1));
  const updatedAt = Number(BigInt(`0x${word(lrd, 3)}`));
  return {
    block,
    answer: answer.toString(),
    price: Number(answer) / 10 ** f.decimals,
    updatedAt,
    ageSec: atSec - updatedAt,
    roundId: BigInt(`0x${word(lrd, 0)}`).toString(),
    paused: paused && paused.length >= 66 ? BigInt(paused) !== 0n : "n/a",
    uiMultiplier: mult && mult.length >= 66 ? BigInt(mult).toString() : "n/a",
  };
}

async function main(): Promise<void> {
  const capturedAt = new Date().toISOString();
  // The archive node does not throttle sequential calls; latency is the pace.
  const t = makeHttpTransport({ url: RPC, minGapMs: 0, timeoutMs: 90_000 });

  const dir = JSON.parse(
    readFileSync(resolve(HERE, "generated", "2026-09-16-chainlink-feeds.json"), "utf8"),
  ) as { feeds: { name: string; proxy: string; decimals: number; marketHours: string | null }[] };
  const feeds: Feed[] = dir.feeds
    .filter((f) => f.marketHours === "us_equities_24/5")
    .map((f) => ({
      name: f.name.replace("Robinhood ", "").replace(" / USD", "").replace("-USD", ""),
      proxy: f.proxy,
      decimals: f.decimals,
    }));
  console.log(`${feeds.length} equity feeds`);

  const tip = await blockNumber(t);
  const blockAt = makeBlockAt(t, tip);

  // ---- 1. every feed at every sample point ----
  const samples: Record<string, unknown>[] = [];
  for (const s of SAMPLES) {
    const sec = Math.floor(Date.parse(s.iso) / 1000);
    const block = await blockAt(sec);
    process.stdout.write(`${s.label.padEnd(38)} block ${block} … `);
    const rows: Record<string, unknown>[] = [];
    for (const f of feeds) {
      const r = await read(t, f, block, sec);
      rows.push({ feed: f.name, ...r });
    }
    const ages = rows.map((r) => r.ageSec as number | null).filter((a): a is number => a !== null);
    const fresh2h = ages.filter((a) => a <= 7_200).length;
    const pausedN = rows.filter((r) => r.paused === true).length;
    console.log(
      `age min/median/max = ${Math.min(...ages)}s / ${ages.sort((a, b) => a - b)[ages.length >> 1]}s / ${Math.max(...ages)}s; ` +
        `fresh(<=2h) ${fresh2h}/${ages.length}; paused ${pausedN}`,
    );
    samples.push({ ...s, atSec: sec, block, rows });
  }

  // ---- 2. update cadence for a few feeds ----
  //
  // Sample blocks are interpolated between two binary-searched anchors rather
  // than searched one by one: a search is ~26 round trips, and 190 samples
  // across five feeds would be two hours of them. Block time drifts under 1%,
  // so interpolation lands within a minute of the target, and for a cadence
  // read at 30-minute resolution that is exact enough — `updatedAt` is read
  // from the feed itself, not inferred from the block.
  const [a0, a1] = [await blockAt(CADENCE_FROM / 1000), await blockAt(CADENCE_TO / 1000)];
  const blockNear = (ms: number) =>
    Math.round(a0 + ((ms - CADENCE_FROM) * (a1 - a0)) / (CADENCE_TO - CADENCE_FROM));
  const cadence: Record<string, unknown> = {};
  for (const name of CADENCE_FEEDS) {
    const f = feeds.find((x) => x.name === name);
    if (!f) continue;
    process.stdout.write(`cadence ${name} … `);
    const seen = new Map<number, { roundId: string; price: number | null; firstSeenAt: string }>();
    for (let ms = CADENCE_FROM; ms <= CADENCE_TO; ms += CADENCE_STEP_MS) {
      const sec = Math.floor(ms / 1000);
      const block = blockNear(ms);
      const r = await read(t, f, block, sec);
      if (r.updatedAt !== null && !seen.has(r.updatedAt)) {
        seen.set(r.updatedAt, {
          roundId: r.roundId!,
          price: r.price,
          firstSeenAt: new Date(ms).toISOString(),
        });
      }
    }
    const updates = [...seen.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([updatedAt, v]) => ({
        updatedAt,
        iso: new Date(updatedAt * 1000).toISOString(),
        ...v,
      }));
    console.log(
      `${updates.length} distinct updates between ${new Date(CADENCE_FROM).toISOString()} and ${new Date(CADENCE_TO).toISOString()}`,
    );
    cadence[name] = updates;
  }

  const outPath = resolve(HERE, join("generated", `${capturedAt.slice(0, 10)}-feed-offhours.json`));
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    `${JSON.stringify({ capturedAt, rpc: "dwellir robinhood-mainnet-archive", tip, selectors: SEL, samples, cadence }, null, 2)}\n`,
  );
  console.log(`wrote ${outPath}`);
}

await main();
