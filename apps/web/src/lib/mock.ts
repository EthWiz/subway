/**
 * Mock data for the Subway web app.
 *
 * NOTHING HERE IS LIVE. No contract is deployed on Robinhood Chain (4663), no
 * addresses are pinned, and the keeper process does not exist. Every number
 * below is either lifted from the Phase 0 research evidence or invented to
 * give the UI a plausible shape.
 *
 * Shaped after the two-vault stack in docs/plan.md:
 *
 *   xAMC (`BaseVault`)  — Track A, unhedged, the only contract touching
 *                         Uniswap. Deposit and redeem are both immediate, and
 *                         redeem pays BOTH tokens pro-rata on quantities.
 *   hAMC (`HedgedVault`) — Track B, wraps xAMC and owns the Lighter account.
 *                         Mints at floor NAV; redeem is request → queued →
 *                         claimable.
 *   Router              — one entry point for both.
 *
 * `Router.hedgeAvailable(stock)` is backed by a constant that is false in
 * Track A, so it answers FALSE FOR EVERY PAIR — including a pair whose hedged
 * vault has been registered — and the hedged paths revert
 * `HedgedVaultNotDeployed`. One pair below sets `hedgeAvailable: true` anyway.
 * That is a pure UI fixture to keep the Track B components reachable; it does
 * NOT describe any pair on chain, and the UI says so where it shows.
 *
 * xAMC is not a usable ERC-4626 either, so do not put a 4626 badge on it: the
 * single-asset exits revert, and `mint`, `previewMint`, `maxDeposit`,
 * `maxMint` and `previewWithdraw` do not exist.
 *
 * Replace this module with wagmi/viem reads once Track A pins addresses.
 */

export type HedgeVerdict = "HEDGEABLE" | "PERP_TOO_THIN" | "NO_PERP_MARKET" | "NO_STOCK_TOKEN";

/** The Phase 0 model parameters that the screen was graded against. */
export const PHASE0_MODEL = {
  vaultTvlUsd: 25_000,
  rangeHalfWidth: 0.06,
  hedgeCarryApr: 0.05475,
  minVaultFeeApr: 0.1095,
  capturedAt: "2026-09-16T10:32:32.435Z",
  windowMinutes: 15.07,
  /**
   * `concentratedLiquidityMultiplier(0.06)` from research/lib/poolscan.ts.
   * A vault concentrated over ±6% is worth this many times its face value
   * against a pool's full-range-equivalent active liquidity. Getting it wrong
   * moves a pool's APR by more than an order of magnitude — the first Phase 0
   * report modelled the vault as full-range and understated fees by ~34x.
   */
  concentrationMultiplier: 33.8,
} as const;

/** `xAMC` — the unhedged base vault. Track A. */
export type BaseVaultState = {
  tvlUsd: number;
  totalSupply: number;
  navPerShare: number;
  /** Reserves. Redemption is pro-rata on these quantities, not on TVL. */
  idleStock: number;
  idleUsdg: number;
  /** `IPoolAdapter.positionAmounts()` — PRINCIPAL only, fees excluded. */
  poolStock: number;
  poolUsdg: number;
  /**
   * `IPoolAdapter.pendingFees()` — earned by the range, not yet paid out.
   *
   * Uniswap v4 pays a position's entire accrued fee balance to whoever changes
   * its liquidity, so `redeem` sweeps these into the vault first. Nothing is
   * credited to anyone: `collectFees()` makes them an ordinary idle balance,
   * the redeemer's slice of that balance is measured, and the rest simply
   * stays in the vault backing everyone else's shares. Omitting them here
   * understates every quote.
   */
  pendingStockFees: number;
  pendingUsdgFees: number;
  spot: number;
  rangeLower: number;
  rangeUpper: number;
  /** Equity beta, stated plainly: stock move + fees − arb loss, over 30d. */
  stockMovePct: number;
  feesEarnedUsd: number;
  arbLossUsd: number;
  paused: boolean;
};

/** `hAMC` — the hedged wrapper. Track B; null when not deployed. */
export type HedgedVaultState = {
  tvlUsd: number;
  floorNavPerShare: number;
  attestedNavPerShare: number;
  hedgeRatio: number;
  queueDepthUsd: number;
  queuedRedemptions: number;
  nextEpochIso: string;
  hedgePnlUsd: number;
  fundingPaidUsd: number;
};

export type Pair = {
  /** Slug used in the URL, e.g. "intc-usdg". */
  slug: string;
  base: string;
  quote: string;
  hedgeVerdict: HedgeVerdict;
  /** Uniswap v3 pool address on chain 4663. Real, from the Phase 0 scan. */
  pool: `0x${string}`;
  feeTier: number;
  /** Extrapolated from the 15-minute window. Fraction, not percent. */
  trailingFeeApr: number;
  maxVaultTvlUsd: number;
  perpDailyQuoteVolumeUsd: number;
  activeLiquidityUsd: number;
  x: BaseVaultState;
  /**
   * A UI fixture, NOT a mirror of `Router.hedgeAvailable(stock)` — that view
   * is false for every pair in Track A and cannot be made true by registering
   * a vault. True here only to keep the hedged components reachable.
   */
  hedgeAvailable: boolean;
  h: HedgedVaultState | null;
};

export const PAIRS: Pair[] = [
  {
    slug: "intc-usdg",
    base: "INTC",
    quote: "USDG",
    hedgeVerdict: "HEDGEABLE",
    pool: "0x2e5a92f5013a64661a49312111be2e8abd33f56a",
    feeTier: 0.003,
    trailingFeeApr: 17.091012778844178,
    maxVaultTvlUsd: 68_633.29,
    perpDailyQuoteVolumeUsd: 1_715_832.29,
    activeLiquidityUsd: 2_837_175.2,
    x: {
      tvlUsd: 24_180.0,
      totalSupply: 23_750.0,
      navPerShare: 1.01811,
      idleStock: 20,
      idleUsdg: 1_200,
      pendingStockFees: 0.42,
      pendingUsdgFees: 9.9,
      poolStock: 480,
      poolUsdg: 10_890,
      spot: 24.18,
      rangeLower: 22.73,
      rangeUpper: 25.63,
      stockMovePct: 0.041,
      feesEarnedUsd: 412.9,
      arbLossUsd: -188.4,
      paused: false,
    },
    hedgeAvailable: true,
    h: {
      tvlUsd: 9_640.0,
      floorNavPerShare: 1.0182,
      attestedNavPerShare: 1.0374,
      hedgeRatio: 0.97,
      queueDepthUsd: 3_200,
      queuedRedemptions: 2,
      nextEpochIso: "2026-09-16T20:00:00.000Z",
      hedgePnlUsd: 166.2,
      fundingPaidUsd: -41.8,
    },
  },
  {
    slug: "meta-usdg",
    base: "META",
    quote: "USDG",
    hedgeVerdict: "HEDGEABLE",
    pool: "0x960f79d8dfec7f2f0c1b24cdac6bb9df1371c6e2",
    feeTier: 0.000555,
    trailingFeeApr: 3.2628311838794484,
    maxVaultTvlUsd: 27_022.71,
    perpDailyQuoteVolumeUsd: 675_567.67,
    activeLiquidityUsd: 2_346_617.43,
    x: {
      tvlUsd: 18_905.12,
      totalSupply: 18_780.0,
      navPerShare: 1.00666,
      idleStock: 0.73,
      idleUsdg: 450,
      pendingStockFees: 0.011,
      pendingUsdgFees: 8.1,
      poolStock: 12.0,
      poolUsdg: 9_003.09,
      spot: 742.5,
      rangeLower: 697.95,
      rangeUpper: 787.05,
      stockMovePct: -0.018,
      feesEarnedUsd: 96.4,
      arbLossUsd: -52.1,
      paused: false,
    },
    hedgeAvailable: false,
    h: null,
  },
  {
    slug: "spcx-usdg",
    base: "SPCX",
    quote: "USDG",
    hedgeVerdict: "HEDGEABLE",
    pool: "0xc61284332117c3fb23a2a56cceffd07f7af60029",
    feeTier: 0.0005,
    trailingFeeApr: 0.3149273792962071,
    maxVaultTvlUsd: 228_478.48,
    perpDailyQuoteVolumeUsd: 5_711_961.98,
    activeLiquidityUsd: 115_030_815.88,
    x: {
      tvlUsd: 61_440.0,
      totalSupply: 61_520.0,
      navPerShare: 0.9987,
      idleStock: 9.46,
      idleUsdg: 2_720,
      pendingStockFees: 0.06,
      pendingUsdgFees: 7.4,
      poolStock: 250,
      poolUsdg: 28_000,
      spot: 118.4,
      rangeLower: 111.3,
      rangeUpper: 125.5,
      stockMovePct: 0.112,
      feesEarnedUsd: 58.2,
      arbLossUsd: -71.6,
      paused: true,
    },
    hedgeAvailable: false,
    h: null,
  },
];

export function getPair(slug: string): Pair | undefined {
  return PAIRS.find((p) => p.slug === slug);
}

/**
 * Mirrors `BaseVault.previewRedeemAmounts`. Pro-rata on token quantities;
 * reads no price at all.
 *
 * Two terms, and the order matters. `redeem` first sweeps the range's pending
 * fees into the vault — they are idle balance by the time anyone's slice is
 * taken — then divides (idle + fees) by supply. The position's PRINCIPAL is
 * sliced separately, pro-rata on liquidity. Treating fees as if they belonged
 * to the redeemer is the bug this mirrors the fix for: a holder with 0.5% of
 * the supply was being paid $424 against a $400 quote, and the extra $24 was
 * everyone else's fees.
 */
export function previewRedeemAmounts(
  x: BaseVaultState,
  shares: number,
): { stockOut: number; usdgOut: number } {
  if (x.totalSupply === 0 || shares <= 0) return { stockOut: 0, usdgOut: 0 };
  const frac = shares / x.totalSupply;
  return {
    stockOut: (x.idleStock + x.pendingStockFees) * frac + x.poolStock * frac,
    usdgOut: (x.idleUsdg + x.pendingUsdgFees) * frac + x.poolUsdg * frac,
  };
}

/** Pairs the Phase 0 gate rejected, kept so the UI can show why. */
export const REJECTED = [
  {
    base: "HOOD",
    reason:
      "No registered stock token — the HOOD/USDG pools trade an unregistered synthetic tracker.",
  },
  {
    base: "MSTR",
    reason: "Registered token and a paying pool, but no Lighter RH perp to hedge against.",
  },
  { base: "AMC", reason: "Both legs exist, but the perp does $47K/24h — a ~$1,880 vault ceiling." },
] as const;

export type DecisionEntry = {
  at: string;
  action: string;
  vault: "xAMC" | "hAMC";
  detail: string;
};

export const DECISIONS: Record<string, DecisionEntry[]> = {
  "intc-usdg": [
    {
      at: "2026-09-16T13:40:00.000Z",
      action: "rebalance",
      vault: "xAMC",
      detail: "Range recentred to ±6% on a 1.9% feed drift.",
    },
    {
      at: "2026-09-16T13:05:00.000Z",
      action: "hedge",
      vault: "hAMC",
      detail: "Short increased to 0.97 delta after a 4,000 USDG wrap.",
    },
    {
      at: "2026-09-16T09:30:00.000Z",
      action: "settle",
      vault: "hAMC",
      detail: "Epoch 41 settled. 1 redemption paid at floor NAV 1.0175.",
    },
  ],
  "meta-usdg": [
    {
      at: "2026-09-16T12:15:00.000Z",
      action: "rebalance",
      vault: "xAMC",
      detail: "Range held; feed within 0.4% of centre.",
    },
    {
      at: "2026-09-16T09:30:00.000Z",
      action: "collect",
      vault: "xAMC",
      detail: "Fees collected into idle reserves.",
    },
  ],
  "spcx-usdg": [
    {
      at: "2026-09-16T14:02:00.000Z",
      action: "pause",
      vault: "xAMC",
      detail: "Deposits paused: Chainlink feed stale past its max age off-hours.",
    },
    {
      at: "2026-09-16T11:20:00.000Z",
      action: "rebalance",
      vault: "xAMC",
      detail: "Range widened; vault share of active liquidity is only 0.7%.",
    },
  ],
};

export type Position = {
  slug: string;
  /** Unhedged base-vault shares. */
  xShares: number;
  /** Hedged wrapper shares. Zero wherever hAMC is not deployed. */
  hShares: number;
  queued?: {
    shares: number;
    requestedAt: string;
    claimableAt: string;
    status: "queued" | "claimable";
  };
};

/** The "connected" address's holdings. Entirely invented. */
export const MOCK_ADDRESS = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F" as const;

export const POSITIONS: Position[] = [
  {
    slug: "intc-usdg",
    xShares: 4_912.33,
    hShares: 2_400.0,
    queued: {
      shares: 750,
      requestedAt: "2026-09-15T20:00:00.000Z",
      claimableAt: "2026-09-16T20:00:00.000Z",
      status: "claimable",
    },
  },
  { slug: "spcx-usdg", xShares: 2_000.0, hShares: 0 },
];

/**
 * The hedge ratio a holder's xAMC/hAMC mix actually produces.
 *
 * Holding only xAMC is full equity beta (0). Holding only hAMC inherits that
 * vault's own hedge ratio, which is not exactly 1.
 */
export function impliedHedgeRatio(pair: Pair, pos: Position): number {
  const xValue = pos.xShares * pair.x.navPerShare;
  const hValue = pos.hShares * (pair.h?.floorNavPerShare ?? 0);
  const total = xValue + hValue;
  if (total === 0) return 0;
  return (hValue / total) * (pair.h?.hedgeRatio ?? 0);
}
