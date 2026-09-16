/**
 * The Phase 0 join: hedge depth (from `probe.ts`) against LP yield (from
 * `scan.ts`), per name.
 *
 * Neither half decides anything alone. A pool paying 400% is worthless if its
 * name has no perp to hedge into, and a deep perp is worthless if the pool
 * pays nothing. The candidate set for `docs/plan.md` is
 * the intersection, which is what this produces.
 *
 * **Vault economics live here, not in `scan.ts`.** The scanner records raw
 * chain facts (fee income, active liquidity, price); what a vault earns from
 * them depends on its size and its range, which are modelling choices. Keeping
 * them separate means the model can be corrected without a 25-minute rescan —
 * which is not hypothetical: the first version valued the vault's deposit as
 * full-range against a pool whose active `L` is concentrated, understating
 * every share by ~34x.
 *
 * Pure: inputs are already-written `generated/` artefacts.
 */
import { hedgeCarryApr } from "./markout.ts";
import { concentratedLiquidityMultiplier } from "./poolscan.ts";

export interface HedgeSide {
  name: string;
  verdict: string;
  perpMarketId: number | null;
  perpDailyQuoteVolumeUsd: number;
  maxVaultTvlUsd: number;
}

export interface PoolSide {
  baseSymbol: string | null;
  admissible?: boolean;
  pool?: string;
  feeTier?: number;
  swaps?: number;
  /** Full-range-equivalent value of the pool's ACTIVE liquidity, in USDG. */
  activeLiquidityUsd?: number;
  feeUsdPerDay?: number;
}

export interface PoolEconomics extends PoolSide {
  /** Vault's share of the active liquidity, range-aware. */
  vaultShare: number;
  vaultFeeUsdPerDay: number;
  vaultFeeApr: number;
  /** False when active liquidity could not be read — the APR means nothing. */
  gradeable: boolean;
  /** Clears the yield bar AND rests on enough swaps to be a measurement. */
  qualifies: boolean;
}

export interface RankedCandidate {
  name: string;
  hedgeVerdict: string;
  maxVaultTvlUsd: number;
  perpDailyQuoteVolumeUsd: number;
  /** Best pool that clears BOTH pool-side bars, if any. */
  bestQualifyingPool: PoolEconomics | null;
  /** Highest-APR pool regardless of bars — kept so noise stays visible. */
  bestAprPool: PoolEconomics | null;
  candidate: boolean;
  why: string;
}

/** The plan's default range preset: ±6% around the feed price. */
export const DEFAULT_RANGE_HALF_WIDTH = 0.06;

/** The plan's Phase 4 beta sizing floor. */
export const DEFAULT_VAULT_TVL_USD = 25_000;

/**
 * Funding assumed on the hedge, per 8h.
 *
 * NOT the plan's funding cap. The plan's 0.1%/8h is an EMERGENCY threshold —
 * the level at which the keeper unwinds and flags the vault — so using it as
 * the expected rate would price a permanent crisis (54.8% APR carry) into
 * every screen. 0.01%/8h is an ordinary-conditions placeholder; because it is
 * an assumption rather than a measurement, the cap case is reported alongside
 * it and no verdict should rest on a name whose sign flips between the two.
 */
export const ASSUMED_FUNDING_RATE_8H = 0.0001;

/** The plan's emergency funding cap, carried for sensitivity. */
export const PLAN_FUNDING_CAP_8H = 0.001;

// Carry is priced by `hedgeCarryApr` in `markout.ts`, which is also what the
// gate uses. Duplicating the formula here would let the screen's bar and the
// gate's funding drift apart on arithmetic alone.
export const HEDGE_CARRY_APR = hedgeCarryApr(ASSUMED_FUNDING_RATE_8H);
export const HEDGE_CARRY_APR_AT_CAP = hedgeCarryApr(PLAN_FUNDING_CAP_8H);

export interface RankInputs {
  hedge: HedgeSide[];
  pools: PoolSide[];
  vaultTvlUsd?: number;
  rangeHalfWidth?: number;
  /** Minimum vault-diluted fee APR worth carrying a hedge for. */
  minVaultFeeApr?: number;
  /**
   * Swaps the pool must have shown in the scan window before its APR is
   * treated as a measurement rather than an extrapolation from noise. This is
   * a NOISE floor, not a sufficiency bar: clearing it makes an annualised
   * number worth looking at, not worth acting on. Only a multi-day window
   * covering opens, closes and a weekend can do that.
   */
  minPoolSwaps?: number;
}

const DEFAULT_MIN_POOL_SWAPS = 30;

/** Vault economics for one pool, at a given size and range. */
export function poolEconomics(
  p: PoolSide,
  opts: {
    vaultTvlUsd: number;
    rangeHalfWidth: number;
    minVaultFeeApr: number;
    minPoolSwaps: number;
  },
): PoolEconomics {
  const { vaultTvlUsd, rangeHalfWidth, minVaultFeeApr, minPoolSwaps } = opts;
  const active = p.activeLiquidityUsd ?? 0;

  // The vault's dollars count for `k` times their face value against the
  // pool's full-range-equivalent active liquidity, because the vault is
  // concentrated over ±rangeHalfWidth and the denominator is virtual.
  const k = concentratedLiquidityMultiplier(rangeHalfWidth);
  const effective = vaultTvlUsd * k;

  // Active liquidity of zero is a READ FAILURE or a pool whose range the
  // price has left, not an empty pool the vault would own outright. Treating
  // it as share = 1 hands the vault 100% of the window's fees and prints an
  // unbounded APR — the exact shape of a false positive this screen exists to
  // avoid. Such a pool is ungradeable, so it scores zero and cannot qualify.
  const gradeable = active > 0;
  const vaultShare = gradeable ? effective / (active + effective) : 0;

  const vaultFeeUsdPerDay = (p.feeUsdPerDay ?? 0) * vaultShare;
  const vaultFeeApr = (vaultFeeUsdPerDay * 365) / vaultTvlUsd;

  return {
    ...p,
    vaultShare,
    vaultFeeUsdPerDay,
    vaultFeeApr,
    gradeable,
    qualifies: gradeable && vaultFeeApr >= minVaultFeeApr && (p.swaps ?? 0) >= minPoolSwaps,
  };
}

export function rankCandidates(inputs: RankInputs): RankedCandidate[] {
  const {
    hedge,
    pools,
    vaultTvlUsd = DEFAULT_VAULT_TVL_USD,
    rangeHalfWidth = DEFAULT_RANGE_HALF_WIDTH,
    minVaultFeeApr = HEDGE_CARRY_APR * 2,
    minPoolSwaps = DEFAULT_MIN_POOL_SWAPS,
  } = inputs;

  const opts = { vaultTvlUsd, rangeHalfWidth, minVaultFeeApr, minPoolSwaps };

  const poolsByName = new Map<string, PoolEconomics[]>();
  for (const p of pools) {
    if (p.admissible === false || !p.baseSymbol) continue;
    const e = poolEconomics(p, opts);
    const arr = poolsByName.get(p.baseSymbol);
    if (arr) arr.push(e);
    else poolsByName.set(p.baseSymbol, [e]);
  }

  const best = (arr: PoolEconomics[]) =>
    arr.reduce<PoolEconomics | null>(
      (a, b) => (b.vaultFeeApr > (a?.vaultFeeApr ?? -1) ? b : a),
      null,
    );

  const out: RankedCandidate[] = [];
  for (const h of hedge) {
    const forName = poolsByName.get(h.name) ?? [];
    // Pick the best QUALIFYING pool, not the best pool. Selecting on APR
    // first and checking the noise floor afterwards lets a two-swap outlier
    // mask a slightly lower-yield pool that actually clears both bars.
    const bestQualifyingPool = best(forName.filter((p) => p.qualifies));
    const bestAprPool = best(forName);

    const hedgeOk = h.verdict === "HEDGEABLE";
    const apr = bestAprPool?.vaultFeeApr ?? 0;

    let why: string;
    if (!hedgeOk && forName.length === 0) {
      // Say WHICH leg failed. Collapsing every hedge-side verdict into "no
      // hedgeable perp" misreports a name that has a real book which is
      // merely too thin, or a perp with no registered token behind it.
      why =
        `neither leg: ${h.verdict} on the hedge side` +
        (h.perpMarketId === null ? "" : ` (perp ${h.perpMarketId} exists)`) +
        ", and no registered stock/USDG pool with flow";
    } else if (!hedgeOk) {
      why = `pool pays ${(apr * 100).toFixed(1)}% to a vault but the hedge leg fails (${h.verdict})`;
    } else if (forName.length === 0) {
      why = "hedgeable, but no registered stock/USDG pool showed flow in the scan window";
    } else if (bestQualifyingPool) {
      why =
        `hedge carries $${Math.round(h.maxVaultTvlUsd).toLocaleString("en-US")}; best qualifying pool pays ` +
        `${(bestQualifyingPool.vaultFeeApr * 100).toFixed(1)}% to a vault on ` +
        `${bestQualifyingPool.swaps} swaps — worth a multi-day window, not yet a verdict`;
    } else if (apr < minVaultFeeApr) {
      why =
        `hedgeable, but the best pool pays ${(apr * 100).toFixed(1)}% to a vault — under the ` +
        `${(minVaultFeeApr * 100).toFixed(1)}% bar (${(HEDGE_CARRY_APR * 100).toFixed(1)}% is assumed hedge carry, ` +
        "before adverse selection and gas)";
    } else {
      why =
        `hedgeable and the best pool prints ${(apr * 100).toFixed(1)}%, but on ` +
        `${bestAprPool?.swaps ?? 0} swaps in the scan window — an extrapolation, not a measurement`;
    }

    out.push({
      name: h.name,
      hedgeVerdict: h.verdict,
      maxVaultTvlUsd: h.maxVaultTvlUsd,
      perpDailyQuoteVolumeUsd: h.perpDailyQuoteVolumeUsd,
      bestQualifyingPool,
      bestAprPool,
      candidate: hedgeOk && bestQualifyingPool !== null,
      why,
    });
  }

  out.sort(
    (a, b) =>
      Number(b.candidate) - Number(a.candidate) ||
      (b.bestQualifyingPool?.vaultFeeApr ?? b.bestAprPool?.vaultFeeApr ?? 0) -
        (a.bestQualifyingPool?.vaultFeeApr ?? a.bestAprPool?.vaultFeeApr ?? 0) ||
      a.name.localeCompare(b.name),
  );
  return out;
}
