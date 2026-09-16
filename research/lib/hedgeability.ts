/**
 * Phase 0 structural screen for the hedged stock-token LP plan
 * (`docs/plan.md`).
 *
 * The plan assumes a vault can LP a Robinhood Stock Token against USDG on
 * Robinhood Chain and hedge the resulting delta with a short on Lighter's
 * Robinhood Chain perp instance. That assumption has two independent
 * preconditions, and the plan named three candidate pairs (AMC, HOOD, MSTR)
 * without checking either:
 *
 *   1. the name must actually BE a Robinhood Stock Token (an LP leg exists), and
 *   2. the same name must have a Lighter RH perp deep enough to carry the
 *      hedge (a hedge leg exists AT SIZE).
 *
 * Precondition 2 is the one that bites. A perp market being listed says
 * nothing about whether a vault can short into it; a book doing $47K/day
 * cannot hedge a $25K vault, because the vault would BE the book. So this
 * module does not return a boolean — it returns the largest vault each name
 * can actually hedge, which is the number the plan's Phase 4 sizing needs.
 *
 * Pure by construction: callers pass already-fetched venue snapshots, so the
 * screen is reproducible from `generated/` fixtures and testable without
 * network access (the no-network test rule).
 */

/** One entry of `GET https://api.robinhood.com/rhj/assets`. */
export interface StockTokenAsset {
  tokenSymbol: string;
  tokenName?: string;
  status?: string;
  deployments?: { contractAddress: string; chainId: number }[];
}

/** One entry of `GET https://api.rh.lighter.xyz/api/v1/orderBooks`. */
export interface LighterOrderBook {
  symbol: string;
  market_id: number;
  market_type: "perp" | "spot" | string;
  status?: string;
  min_base_amount?: string;
}

/** One entry of `GET https://api.rh.lighter.xyz/api/v1/exchangeStats`. */
export interface LighterBookStats {
  symbol: string;
  daily_quote_token_volume?: number | string;
  daily_trades_count?: number | string;
  last_trade_price?: number | string;
}

export interface HedgeabilityInputs {
  assets: StockTokenAsset[];
  orderBooks: LighterOrderBook[];
  stats: LighterBookStats[];
  /**
   * Share of a perp's daily quote volume a single vault's hedge notional may
   * represent. The hedge is a standing short that must be opened, rebalanced
   * on every band breach, and fully unwound on redemption, so the vault is
   * recurring flow in this book rather than a one-off print. At 2% a full
   * unwind is roughly half a typical hour's volume (2% × 24 ≈ 48%) —
   * demanding, but doable inside one epoch without the vault setting the
   * price.
   *
   * **Daily volume is a proxy for depth, not depth itself.** A book can turn
   * over its whole day against a tight spread or against a cliff, and this
   * screen cannot tell the difference. It is therefore only trustworthy for
   * rejecting books that miss by an order of magnitude; for a name near the
   * bar, read the order book before believing the number.
   */
  maxDailyFlowShare?: number;
  /** Robinhood Chain id; a token deployed elsewhere is not an LP leg here. */
  chainId?: number;
}

export type HedgeVerdict =
  "HEDGEABLE" | "NO_STOCK_TOKEN" | "NO_PERP_MARKET" | "PERP_TOO_THIN" | "PERP_INACTIVE";

export interface HedgeabilityRow {
  name: string;
  /** Robinhood Stock Token address on chain 4663, when one exists. */
  tokenAddress: string | null;
  /** Lighter RH perp market id, when one exists. */
  perpMarketId: number | null;
  perpDailyQuoteVolumeUsd: number;
  perpDailyTrades: number;
  /**
   * Largest hedge notional this book supports at `maxDailyFlowShare`. The
   * vault's stock-side exposure equals its hedge, so total vault TVL is
   * roughly twice this in a balanced two-sided position.
   */
  maxHedgeNotionalUsd: number;
  maxVaultTvlUsd: number;
  verdict: HedgeVerdict;
  why: string;
}

const DEFAULT_MAX_DAILY_FLOW_SHARE = 0.02;
const ROBINHOOD_CHAIN_ID = 4663;

/**
 * Minimum vault size worth operating. Below this the keeper's gas, the
 * Lighter margin floor and the operator's attention exceed any plausible fee
 * income, so a name that screens under it is a no-go regardless of markout.
 * The plan's own Phase 4 beta sizes vaults at $20–30K; this is the floor of
 * that range.
 */
export const MIN_VIABLE_VAULT_TVL_USD = 20_000;

function num(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : 0;
  return Number.isFinite(n) ? n : 0;
}

/**
 * Cross-reference the Robinhood Stock Token registry against Lighter RH's
 * perp books and grade every name that appears in either.
 *
 * Names are graded even when one leg is missing: "HOOD has no stock token"
 * and "MSTR has no perp" are the findings that falsify the plan's candidate
 * list, so they must survive into the output rather than be filtered away.
 */
export function screenHedgeability(inputs: HedgeabilityInputs): HedgeabilityRow[] {
  const {
    assets,
    orderBooks,
    stats,
    maxDailyFlowShare = DEFAULT_MAX_DAILY_FLOW_SHARE,
    chainId = ROBINHOOD_CHAIN_ID,
  } = inputs;

  if (!(maxDailyFlowShare > 0) || maxDailyFlowShare > 1) {
    throw new Error(`maxDailyFlowShare must be in (0, 1], got ${maxDailyFlowShare}`);
  }

  const tokenBySymbol = new Map<string, StockTokenAsset>();
  for (const a of assets) {
    if (a.status && a.status !== "ASSET_STATUS_ACTIVE") continue;
    const dep = (a.deployments ?? []).find((d) => d.chainId === chainId);
    if (!dep) continue;
    tokenBySymbol.set(a.tokenSymbol, a);
  }

  const perpBySymbol = new Map<string, LighterOrderBook>();
  for (const o of orderBooks) {
    if (o.market_type !== "perp") continue;
    perpBySymbol.set(o.symbol, o);
  }

  const statsBySymbol = new Map<string, LighterBookStats>();
  for (const s of stats) statsBySymbol.set(s.symbol, s);

  const names = new Set<string>([...tokenBySymbol.keys(), ...perpBySymbol.keys()]);

  const rows: HedgeabilityRow[] = [];
  for (const name of names) {
    const token = tokenBySymbol.get(name) ?? null;
    const perp = perpBySymbol.get(name) ?? null;
    const st = statsBySymbol.get(name);

    const perpDailyQuoteVolumeUsd = num(st?.daily_quote_token_volume);
    const perpDailyTrades = num(st?.daily_trades_count);
    const maxHedgeNotionalUsd = perp ? perpDailyQuoteVolumeUsd * maxDailyFlowShare : 0;
    const maxVaultTvlUsd = maxHedgeNotionalUsd * 2;

    const tokenAddress =
      (token?.deployments ?? []).find((d) => d.chainId === chainId)?.contractAddress ?? null;

    let verdict: HedgeVerdict;
    let why: string;
    if (!token) {
      verdict = "NO_STOCK_TOKEN";
      why = `no Robinhood Stock Token on chain ${chainId}: there is no LP leg to hedge`;
    } else if (!perp) {
      verdict = "NO_PERP_MARKET";
      why = "stock token exists but Lighter RH lists no perp: the LP leg cannot be hedged";
    } else if (perp.status && perp.status !== "active") {
      verdict = "PERP_INACTIVE";
      why = `Lighter RH perp ${perp.market_id} is ${perp.status}`;
    } else if (maxVaultTvlUsd < MIN_VIABLE_VAULT_TVL_USD) {
      verdict = "PERP_TOO_THIN";
      why =
        `perp does $${Math.round(perpDailyQuoteVolumeUsd).toLocaleString("en-US")}/24h on ` +
        `${perpDailyTrades} trades; at ${(maxDailyFlowShare * 100).toFixed(1)}% participation that ` +
        `supports a $${Math.round(maxVaultTvlUsd).toLocaleString("en-US")} vault, below the ` +
        `$${MIN_VIABLE_VAULT_TVL_USD.toLocaleString("en-US")} floor`;
    } else {
      verdict = "HEDGEABLE";
      why =
        `perp ${perp.market_id} does $${Math.round(perpDailyQuoteVolumeUsd).toLocaleString("en-US")}/24h; ` +
        `supports a $${Math.round(maxVaultTvlUsd).toLocaleString("en-US")} vault at ` +
        `${(maxDailyFlowShare * 100).toFixed(1)}% participation`;
    }

    rows.push({
      name,
      tokenAddress,
      perpMarketId: perp?.market_id ?? null,
      perpDailyQuoteVolumeUsd,
      perpDailyTrades,
      maxHedgeNotionalUsd,
      maxVaultTvlUsd,
      verdict,
      why,
    });
  }

  // Deepest hedge first: the screen's job is to hand Phase 1 a ranked
  // candidate list, and ties sort by name so the generated table is stable
  // across runs (it is committed as evidence).
  rows.sort((a, b) => b.maxVaultTvlUsd - a.maxVaultTvlUsd || a.name.localeCompare(b.name));
  return rows;
}

/** The names that clear both legs, deepest hedge first. */
export function hedgeableNames(rows: HedgeabilityRow[]): HedgeabilityRow[] {
  return rows.filter((r) => r.verdict === "HEDGEABLE");
}

export type PoolTokenClass = "REGISTERED_STOCK_TOKEN" | "USDG" | "UNREGISTERED";

export interface PoolTokenClassification {
  address: string;
  class: PoolTokenClass;
  /** Registry ticker, only when `class` is `REGISTERED_STOCK_TOKEN`. */
  tokenSymbol: string | null;
  why: string;
}

/** Canonical USDG on Robinhood Chain (`docs/plan.md`). */
export const USDG_ADDRESS = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";

/**
 * Classify a pool's token BY ADDRESS against the registry.
 *
 * Screening by ticker is not enough, and this is not hypothetical: the
 * HOOD/USDG pools on Robinhood Chain trade
 * `0x32ac8c1d7672667d5ebdea22935f7b06fc8d496f`, which is not Robinhood's
 * token (HOOD is absent from the registry entirely), not Backed's and not
 * Ondo's. It is a synthetic tracker minted by a UUPS vault at an oracle
 * price whose USDG is swept to an owner EOA. It tracks HOOD to ~1%, so every
 * ticker-level and price-level check passes while the LP carries
 * uncollateralised issuer credit risk.
 *
 * A pool is only an admissible LP leg if BOTH of its tokens classify — the
 * stock side as `REGISTERED_STOCK_TOKEN` and the quote side as `USDG`.
 */
export function classifyPoolToken(
  address: string,
  assets: StockTokenAsset[],
  chainId: number = ROBINHOOD_CHAIN_ID,
): PoolTokenClassification {
  const want = address.toLowerCase();

  if (want === USDG_ADDRESS.toLowerCase()) {
    return { address, class: "USDG", tokenSymbol: null, why: "canonical USDG" };
  }

  for (const a of assets) {
    for (const d of a.deployments ?? []) {
      if (d.chainId !== chainId) continue;
      if (d.contractAddress.toLowerCase() !== want) continue;
      if (a.status && a.status !== "ASSET_STATUS_ACTIVE") {
        return {
          address,
          class: "UNREGISTERED",
          tokenSymbol: a.tokenSymbol,
          why: `registry lists ${a.tokenSymbol} at this address but status is ${a.status}`,
        };
      }
      return {
        address,
        class: "REGISTERED_STOCK_TOKEN",
        tokenSymbol: a.tokenSymbol,
        why: `registered Robinhood Stock Token ${a.tokenSymbol}`,
      };
    }
  }

  return {
    address,
    class: "UNREGISTERED",
    tokenSymbol: null,
    why:
      "not in the Robinhood Stock Token registry and not USDG; a same-ticker token at " +
      "an unregistered address carries issuer credit risk and is not an LP leg",
  };
}
