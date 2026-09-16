/**
 * The Phase 0 grading model for the hedged stock-token LP plan
 * (`docs/plan.md`, "Evidence gate").
 *
 * An LP is the passive counterparty to every swap in its range. It is paid
 * the fee tier on notional and it is adversely selected by whoever knew more
 * than the pool did. Fee APR alone therefore says nothing: the plan's own
 * research found stock/USDG pools quoting 200–440% fee APR, and a pool can
 * quote any fee APR at all while losing money, because the same flow that
 * pays the fee is the flow that moves the price against the position.
 *
 * So the gate grades `fee income − adverse selection`, both per unit of
 * liquidity, using markouts against an independent reference price (the
 * Lighter RH mid) at +1 s / +10 s / +60 s.
 *
 * Sign convention, fixed once here because it is the easiest thing to get
 * backwards: `takerMarkoutUsd > 0` means the taker was right — the reference
 * price moved in the taker's favour after the fill — and the LP lost exactly
 * that.
 *
 * **The fee is already inside `execPrice`, so LP PnL is `−takerMarkoutUsd`,
 * not `feeUsd − takerMarkoutUsd`.** A v3 `Swap` event's amounts are the
 * pool's gross token deltas, fee included, so `|quote| / |base|` is the
 * taker's fee-inclusive execution price and the fee is already working
 * against them in the markout. Adding `feeUsd` on top counts it twice: a
 * swap into an unmoved reference would score `+2 × feeUsd` to the LP.
 * `feeUsd` is still reported, because the gate needs to stress fee income
 * separately from the price move.
 *
 * Pure functions only. The reference mid is supplied as a lookup so the
 * grader runs against recorder tape or fixtures without network access.
 */

export interface Swap {
  /** Swap timestamp, epoch milliseconds. */
  tsMs: number;
  /**
   * `true` when the taker bought the base (stock) token from the pool. The LP
   * is then short the move: it sold stock and holds more USDG.
   */
  takerBuysBase: boolean;
  /** Base (stock) units transacted, positive. */
  baseAmount: number;
  /** Execution price in USDG per base unit, positive. */
  execPrice: number;
  /** Pool fee tier as a fraction (0.003 = 0.3%). */
  feeTier: number;
}

/** Reference mid at a point in time, or `null` when the tape has no cover. */
export type MidLookup = (tsMs: number) => number | null;

export interface SwapMarkout {
  tsMs: number;
  horizonMs: number;
  notionalUsd: number;
  feeUsd: number;
  refMidAtFill: number;
  refMidAtHorizon: number;
  /** Positive when the taker was right and the LP was adversely selected. */
  takerMarkoutUsd: number;
  /** The reference move alone, fee excluded — the adverse-selection term. */
  refMoveUsd: number;
  lpPnlUsd: number;
  toxic: boolean;
}

export interface HorizonGrade {
  horizonMs: number;
  swaps: number;
  /** Swaps dropped because the reference tape did not cover the horizon. */
  uncovered: number;
  notionalUsd: number;
  feeUsd: number;
  takerMarkoutUsd: number;
  lpPnlUsd: number;
  toxicSwaps: number;
  toxicNotionalUsd: number;
  /**
   * Adverse selection the LP actually pays: the sum of reference moves on
   * TOXIC swaps only, kept apart from the benign ones. Netting the two into
   * one number lets a benign swap pay for a toxic one of equal size and
   * reports zero adverse selection for a tape that had plenty — the flow that
   * survives a fee cut is the toxic half, so it is graded on its own.
   */
  toxicRefMoveUsd: number;
  benignRefMoveUsd: number;
  /** `feeUsd / toxicRefMoveUsd`; > 1 means fees cover adverse selection. */
  feeCoverageRatio: number;
}

/**
 * Markout one swap at one horizon.
 *
 * Returns `null` when the reference tape does not cover either endpoint —
 * a missing mid is not a zero markout, and silently treating it as one is
 * how a thin tape turns into a free lunch.
 */
export function markoutSwap(swap: Swap, horizonMs: number, mid: MidLookup): SwapMarkout | null {
  const refMidAtFill = mid(swap.tsMs);
  const refMidAtHorizon = mid(swap.tsMs + horizonMs);
  if (refMidAtFill === null || refMidAtHorizon === null) return null;

  const notionalUsd = swap.baseAmount * swap.execPrice;
  const feeUsd = notionalUsd * swap.feeTier;

  // A taker who bought base profits when the reference price rises above
  // what they paid; a taker who sold base profits when it falls below.
  const direction = swap.takerBuysBase ? 1 : -1;
  const takerMarkoutUsd = direction * (refMidAtHorizon - swap.execPrice) * swap.baseAmount;
  // Not `feeUsd - takerMarkoutUsd`: execPrice is fee-inclusive (see header).
  const lpPnlUsd = -takerMarkoutUsd;

  // Adverse SELECTION is the reference price's move away from where it stood
  // when the pool filled — a property of the information in the flow. The
  // markout above also carries the fee, so measure the move on its own.
  const refMoveUsd = direction * (refMidAtHorizon - refMidAtFill) * swap.baseAmount;

  return {
    tsMs: swap.tsMs,
    horizonMs,
    notionalUsd,
    feeUsd,
    refMidAtFill,
    refMidAtHorizon,
    takerMarkoutUsd,
    lpPnlUsd,
    refMoveUsd,
    // Toxic is a property of the FLOW, not of the LP's net outcome: flow that
    // moved the reference away from where the pool filled is toxic even when
    // a fat fee tier happened to cover it. Splitting on `lpPnlUsd` instead
    // would hide exactly the decay risk the gate has to survive — and
    // splitting on `takerMarkoutUsd` would call a swap benign purely because
    // the fee it paid exceeded the move.
    toxic: refMoveUsd > 0,
  };
}

/** Grade a swap tape at one horizon. */
export function gradeHorizon(swaps: Swap[], horizonMs: number, mid: MidLookup): HorizonGrade {
  const grade: HorizonGrade = {
    horizonMs,
    swaps: 0,
    uncovered: 0,
    notionalUsd: 0,
    feeUsd: 0,
    takerMarkoutUsd: 0,
    lpPnlUsd: 0,
    toxicSwaps: 0,
    toxicNotionalUsd: 0,
    toxicRefMoveUsd: 0,
    benignRefMoveUsd: 0,
    feeCoverageRatio: 0,
  };

  for (const s of swaps) {
    const m = markoutSwap(s, horizonMs, mid);
    if (m === null) {
      grade.uncovered += 1;
      continue;
    }
    grade.swaps += 1;
    grade.notionalUsd += m.notionalUsd;
    grade.feeUsd += m.feeUsd;
    grade.takerMarkoutUsd += m.takerMarkoutUsd;
    grade.lpPnlUsd += m.lpPnlUsd;
    if (m.toxic) {
      grade.toxicSwaps += 1;
      grade.toxicNotionalUsd += m.notionalUsd;
      grade.toxicRefMoveUsd += m.refMoveUsd;
    } else {
      grade.benignRefMoveUsd += m.refMoveUsd;
    }
  }

  grade.feeCoverageRatio =
    grade.toxicRefMoveUsd > 0 ? grade.feeUsd / grade.toxicRefMoveUsd : Number.POSITIVE_INFINITY;
  return grade;
}

export const DEFAULT_HORIZONS_MS = [1_000, 10_000, 60_000] as const;

export interface GateInputs {
  grades: HorizonGrade[];
  /** Days the window spans, used to annualise. */
  windowDays: number;
  /** Liquidity the grade is per-unit-of, in USD. */
  liquidityUsd: number;
  /** 8h funding rate paid on the hedge, as a fraction. */
  fundingRate8h: number;
  /** Keeper gas over the window, USD. */
  gasUsd: number;
  /**
   * Fee decay the verdict must survive. The plan's gate requires the edge to
   * hold at a 50% fee cut, because today's fee APR on these pools is a
   * function of a small float and two transient meme flows, not a stable
   * property of the pair.
   */
  feeDecay?: number;
}

export interface GateVerdict {
  pass: boolean;
  /** The horizon the verdict is taken at — the longest one graded. */
  horizonMs: number;
  grossFeeUsd: number;
  decayedFeeUsd: number;
  adverseSelectionUsd: number;
  fundingCostUsd: number;
  gasUsd: number;
  netUsd: number;
  netApr: number;
  why: string;
}

const DEFAULT_FEE_DECAY = 0.5;
const FUNDING_PERIODS_PER_DAY = 3;

/**
 * The hedge shorts the LP's stock-side delta, which at the plan's balanced
 * two-sided range is about half the position, so funding accrues on half the
 * vault.
 */
export const HEDGE_DELTA_SHARE_OF_VAULT = 0.5;

/**
 * Annualised hedge carry as a fraction of vault TVL.
 *
 * THE one place this model lives. `gradeGate` below prices the gate with it
 * and `lib/rank.ts` sets the screen's yield bar from it — if the two drifted
 * apart, a name could clear the screen's bar and fail the gate's funding on
 * arithmetic alone.
 */
export function hedgeCarryApr(fundingRate8h: number): number {
  return HEDGE_DELTA_SHARE_OF_VAULT * fundingRate8h * FUNDING_PERIODS_PER_DAY * 365;
}

/**
 * The plan's go/no-go: net-of-toxicity fee yield must exceed funding plus gas
 * with the edge surviving a 50% fee cut.
 *
 * Graded at the LONGEST horizon. A short horizon flatters the LP because the
 * reference price has not finished moving — the +1 s number is a latency
 * artefact, not an economic one.
 */
export function gradeGate(inputs: GateInputs): GateVerdict {
  const {
    grades,
    windowDays,
    liquidityUsd,
    fundingRate8h,
    gasUsd,
    feeDecay = DEFAULT_FEE_DECAY,
  } = inputs;

  if (grades.length === 0) throw new Error("gradeGate needs at least one graded horizon");
  if (!(windowDays > 0)) throw new Error(`windowDays must be > 0, got ${windowDays}`);
  if (!(liquidityUsd > 0)) throw new Error(`liquidityUsd must be > 0, got ${liquidityUsd}`);

  const g = grades.reduce((a, b) => (b.horizonMs > a.horizonMs ? b : a));

  const fundingCostUsd = liquidityUsd * hedgeCarryApr(fundingRate8h) * (windowDays / 365);

  const grossFeeUsd = g.feeUsd;
  const decayedFeeUsd = grossFeeUsd * (1 - feeDecay);
  // Toxic flow only. Benign flow's favourable move is not income the vault
  // can rely on — it is the other half of the same distribution — and letting
  // it net against the toxic half is how a tape with real adverse selection
  // scores zero.
  const adverseSelectionUsd = g.toxicRefMoveUsd;
  const netUsd = decayedFeeUsd - adverseSelectionUsd - fundingCostUsd - gasUsd;
  const netApr = (netUsd / liquidityUsd) * (365 / windowDays);
  const pass = netUsd > 0;

  const why = pass
    ? `net +$${netUsd.toFixed(2)} over ${windowDays.toFixed(2)} d on $${liquidityUsd.toLocaleString("en-US")} ` +
      `liquidity (${(netApr * 100).toFixed(1)}% APR) after a ${(feeDecay * 100).toFixed(0)}% fee cut, ` +
      `adverse selection and funding`
    : `net −$${Math.abs(netUsd).toFixed(2)} over ${windowDays.toFixed(2)} d: decayed fees ` +
      `$${decayedFeeUsd.toFixed(2)} do not cover adverse selection $${adverseSelectionUsd.toFixed(2)} ` +
      `plus funding $${fundingCostUsd.toFixed(2)} plus gas $${gasUsd.toFixed(2)}`;

  return {
    pass,
    horizonMs: g.horizonMs,
    grossFeeUsd,
    decayedFeeUsd,
    adverseSelectionUsd,
    fundingCostUsd,
    gasUsd,
    netUsd,
    netApr,
    why,
  };
}

/**
 * Build a `MidLookup` over a sorted reference tape using last-observation-
 * carried-forward, refusing to carry a quote older than `maxAgeMs`.
 *
 * The staleness bound is the point: Lighter RH's book goes quiet outside US
 * hours, and carrying a two-hour-old mid forward would manufacture a zero
 * markout across exactly the overnight gaps the plan flags as the dominant
 * LP loss.
 */
export function midLookupFromTape(
  tape: { tsMs: number; mid: number }[],
  maxAgeMs = 5_000,
): MidLookup {
  const sorted = [...tape].sort((a, b) => a.tsMs - b.tsMs);
  return (tsMs: number) => {
    let lo = 0;
    let hi = sorted.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid]!.tsMs <= tsMs) {
        found = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (found < 0) return null;
    const q = sorted[found]!;
    return tsMs - q.tsMs <= maxAgeMs ? q.mid : null;
  };
}
