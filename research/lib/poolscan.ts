/**
 * Uniswap swap-log scanning on Robinhood Chain (id 4663) for the Phase 0
 * evidence gate (`docs/plan.md`).
 *
 * Two constraints shape this module, both measured against the public RPC
 * (`rpc.mainnet.chain.robinhood.com`) on 2026-09-16:
 *
 *   - `eth_getLogs` rejects any query matching more than 10,000 logs, and the
 *     chain-wide v3 Swap topic clears that inside one hour (~100 ms blocks),
 *     so a range must be split until it fits rather than sized up front.
 *   - the endpoint returns 429 under trivial concurrency, so requests are
 *     serialised with a delay and retried with backoff.
 *
 * The transport is injected, so the splitting and backoff logic is testable
 * without network access (tests never reach an RPC).
 */

export interface RpcLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: string;
}

export interface LogFilter {
  fromBlock: number;
  toBlock: number;
  address?: string | string[];
  topics?: (string | string[] | null)[];
}

/** A JSON-RPC transport. Throws `RpcError` for protocol-level failures. */
export type RpcTransport = (method: string, params: unknown[]) => Promise<unknown>;

export class RpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = "RpcError";
  }
}

/** `eth_getLogs` result-size cap. The only fix is a narrower range. */
export function isLimitExceeded(err: unknown): boolean {
  if (!(err instanceof RpcError)) return false;
  return /exceeds? limit|more than \d+ results|query returned more than/i.test(err.message);
}

/** Endpoint throttling. The fix is to wait, not to narrow. */
export function isRateLimited(err: unknown): boolean {
  if (!(err instanceof RpcError)) return false;
  // 403 too: the public endpoint escalates from 429 to a 403 block under
  // sustained load, and both mean "wait", never "narrow the range".
  return (
    err.code === 429 ||
    err.code === 403 ||
    /too many requests|rate limit|forbidden/i.test(err.message)
  );
}

/**
 * Uniswap v3 `Swap`. This module is v3-only: v4 pools live inside the
 * PoolManager singleton and carry no per-pool `token0()`/`fee()`/`slot0()`
 * to read, so they need a different discovery and valuation path entirely.
 * v4 fee income is therefore MISSING from any scan built on this — recorded
 * as a known gap rather than approximated.
 */
export const UNIV3_SWAP_TOPIC =
  "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67";

export interface ScanOptions {
  /** Blocks per request before any splitting. */
  initialChunk?: number;
  /** Never split below this; a range this small that still overflows throws. */
  minChunk?: number;
  /** Delay between requests, milliseconds. */
  throttleMs?: number;
  maxRetries?: number;
  sleep?: (ms: number) => Promise<void>;
  onProgress?: (done: number, total: number, logs: number) => void;
}

const DEFAULTS = {
  initialChunk: 2_000,
  minChunk: 8,
  throttleMs: 120,
  maxRetries: 6,
} as const;

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Fetch every log matching `filter`, splitting any range the endpoint refuses
 * as too large and backing off on 429.
 *
 * Adaptive rather than fixed-chunk: activity on this chain is extremely
 * bursty (a meme pool can put a day's logs into one minute), so a chunk size
 * that works at 03:00 overflows at the US open. Successful chunks grow the
 * window back, so the scan does not stay pessimistic for the whole range
 * after one busy patch.
 */
export async function fetchLogs(
  transport: RpcTransport,
  filter: LogFilter,
  options: ScanOptions = {},
): Promise<RpcLog[]> {
  const opts = { ...DEFAULTS, ...options };
  const sleep = options.sleep ?? defaultSleep;
  const out: RpcLog[] = [];

  if (filter.toBlock < filter.fromBlock) {
    throw new Error(`empty range: ${filter.fromBlock}..${filter.toBlock}`);
  }

  const total = filter.toBlock - filter.fromBlock + 1;
  let cursor = filter.fromBlock;
  let chunk = Math.min(opts.initialChunk, total);

  while (cursor <= filter.toBlock) {
    const to = Math.min(cursor + chunk - 1, filter.toBlock);
    let attempt = 0;
    let logs: RpcLog[] | null = null;

    for (;;) {
      try {
        const params: Record<string, unknown> = {
          fromBlock: `0x${cursor.toString(16)}`,
          toBlock: `0x${to.toString(16)}`,
        };
        if (filter.address) params.address = filter.address;
        if (filter.topics) params.topics = filter.topics;
        logs = (await transport("eth_getLogs", [params])) as RpcLog[];
        break;
      } catch (err) {
        if (isLimitExceeded(err)) {
          if (chunk <= opts.minChunk) {
            throw new Error(
              `range ${cursor}..${to} still exceeds the log limit at the minimum chunk of ` +
                `${opts.minChunk} blocks; narrow the filter (add an address) instead`,
            );
          }
          chunk = Math.max(opts.minChunk, Math.floor(chunk / 4));
          break; // retry the same cursor with a smaller window
        }
        if (isRateLimited(err) && attempt < opts.maxRetries) {
          await sleep(opts.throttleMs * 2 ** attempt);
          attempt += 1;
          continue;
        }
        throw err;
      }
    }

    if (logs === null) continue; // split happened; re-enter with the smaller chunk

    out.push(...logs);
    cursor = to + 1;
    options.onProgress?.(cursor - filter.fromBlock, total, out.length);

    // Grow back toward the configured chunk after a clean pass, but only
    // gently: doubling straight back into a busy window just re-triggers the
    // split and wastes the request.
    if (logs.length < 4_000) chunk = Math.min(opts.initialChunk, Math.ceil(chunk * 1.5));

    if (cursor <= filter.toBlock) await sleep(opts.throttleMs);
  }

  return out;
}

/**
 * Uniswap v3 `Swap(address,address,int256,int256,uint160,uint128,int24)`.
 * `amount0`/`amount1` are signed from the POOL's perspective: positive means
 * the pool received that token.
 */
export interface DecodedV3Swap {
  pool: string;
  blockNumber: number;
  amount0: bigint;
  amount1: bigint;
  sqrtPriceX96: bigint;
  liquidity: bigint;
  tick: number;
  transactionHash: string;
  logIndex: number;
}

function int256(hex: string): bigint {
  const v = BigInt(`0x${hex}`);
  return v >= 1n << 255n ? v - (1n << 256n) : v;
}

function int24(hex: string): number {
  const v = Number(BigInt(`0x${hex}`) & 0xffffffn);
  return v >= 0x800000 ? v - 0x1000000 : v;
}

export function decodeV3Swap(log: RpcLog): DecodedV3Swap {
  const body = log.data.startsWith("0x") ? log.data.slice(2) : log.data;
  if (body.length < 64 * 5) {
    throw new Error(`v3 Swap data too short for ${log.transactionHash}: ${body.length} chars`);
  }
  const word = (i: number) => body.slice(i * 64, (i + 1) * 64);
  return {
    pool: log.address.toLowerCase(),
    blockNumber: Number(BigInt(log.blockNumber)),
    amount0: int256(word(0)),
    amount1: int256(word(1)),
    sqrtPriceX96: BigInt(`0x${word(2)}`),
    liquidity: BigInt(`0x${word(3)}`),
    tick: int24(word(4)),
    transactionHash: log.transactionHash,
    logIndex: Number(BigInt(log.logIndex)),
  };
}

const Q96 = 2n ** 96n;
/** Scale bigint ratios through a fixed denominator before going to float. */
const SCALE = 10n ** 18n;

/**
 * Value of a v3 pool's ACTIVE liquidity, in quote-token units.
 *
 * This is the right denominator for a fee yield, and it is not the same as
 * the pool's total TVL. Fees accrue only to liquidity covering the current
 * tick, so a depositor's share — and therefore its fee income — is set by the
 * active `L`, not by capital parked in ranges the price has left. Quoting APR
 * against total TVL understates dilution and is one way a 400% headline
 * survives contact with a real deposit.
 *
 * At the current tick the virtual reserves are `x = L/√P` and `y = L·√P`, so
 * the position is worth `2·L·√P` in quote units before decimal scaling.
 */
export function activeLiquidityQuoteValue(args: {
  liquidity: bigint;
  sqrtPriceX96: bigint;
  baseDecimals: number;
  quoteDecimals: number;
  baseIsToken0: boolean;
}): number {
  const { liquidity, sqrtPriceX96, baseDecimals, quoteDecimals, baseIsToken0 } = args;
  if (liquidity <= 0n || sqrtPriceX96 <= 0n) return 0;

  // Raw virtual reserves of token0 and token1.
  const raw1 = (liquidity * sqrtPriceX96) / Q96;
  const raw0 = (liquidity * Q96) / sqrtPriceX96;

  const [rawBase, rawQuote] = baseIsToken0 ? [raw0, raw1] : [raw1, raw0];
  const base = Number((rawBase * SCALE) / 10n ** BigInt(baseDecimals)) / Number(SCALE);
  const quote = Number((rawQuote * SCALE) / 10n ** BigInt(quoteDecimals)) / Number(SCALE);

  // `sqrtPriceX96` encodes the RAW ratio token1/token0, so the price inverts
  // with token order but the decimal correction does NOT: converting raw to
  // human units is always 10^(baseDecimals - quoteDecimals), whichever side
  // the stock sorted onto. Folding the decimals into a token1-per-token0
  // price and then inverting the whole thing gets the exponent backwards and
  // is wrong by 10^(2·(d0−d1)) — for an 18-decimal stock against 6-decimal
  // USDG that is 10^24, which silently zeroes the base half of the pool.
  const priceRaw = (Number(sqrtPriceX96) / Number(Q96)) ** 2;
  const quotePerBase =
    (baseIsToken0 ? priceRaw : 1 / priceRaw) * 10 ** (baseDecimals - quoteDecimals);
  if (!Number.isFinite(quotePerBase) || quotePerBase <= 0) return 0;

  return quote + base * quotePerBase;
}

/**
 * How many times more liquidity a dollar creates when deployed over
 * `±halfWidth` around the current price instead of full-range.
 *
 * `activeLiquidityQuoteValue` returns the FULL-RANGE-equivalent value of the
 * pool's active `L` (`2·L·√P`, the virtual reserves). That is the correct
 * denominator only if the depositor is also full-range. The plan's vault is
 * not: it runs a ±6% concentrated position, where the same dollars buy ~34x
 * the liquidity — and therefore ~34x the fee share.
 *
 * Comparing a concentrated vault's DOLLARS against the pool's virtual
 * dollars understates its share by exactly this factor. Getting it wrong
 * moves a pool's vault APR by more than an order of magnitude, which is
 * enough to flip a go/no-go.
 *
 * A position over `[P(1−d), P(1+d)]` holding both tokens is worth
 * `L·√P·[(1−√(1−d)) + (1−1/√(1+d))]`; full range is the `d→∞` limit `2·L·√P`.
 */
export function concentratedLiquidityMultiplier(halfWidth: number): number {
  if (!(halfWidth > 0) || halfWidth >= 1) {
    throw new Error(`halfWidth must be in (0, 1), got ${halfWidth}`);
  }
  const perL = 1 - Math.sqrt(1 - halfWidth) + (1 - 1 / Math.sqrt(1 + halfWidth));
  return 2 / perL;
}

/** Uniswap v3 `slot0()`; only `sqrtPriceX96` is needed here. */
export function decodeSlot0SqrtPrice(raw: string): bigint {
  const body = raw.startsWith("0x") ? raw.slice(2) : raw;
  if (body.length < 64) throw new Error(`short slot0 return: ${raw}`);
  return BigInt(`0x${body.slice(0, 64)}`);
}

/**
 * Convert a decoded v3 swap into the grader's `Swap` shape.
 *
 * `baseIsToken0` says which side of the pool is the stock token. The caller
 * resolves that from the pool's `token0()`/`token1()` — never from the
 * ordering of the pair's name, which says nothing about sort order.
 */
export function toGraderSwap(
  s: DecodedV3Swap,
  opts: {
    baseIsToken0: boolean;
    baseDecimals: number;
    quoteDecimals: number;
    feeTier: number;
    tsMs: number;
  },
): {
  tsMs: number;
  takerBuysBase: boolean;
  baseAmount: number;
  execPrice: number;
  feeTier: number;
} {
  const rawBase = opts.baseIsToken0 ? s.amount0 : s.amount1;
  const rawQuote = opts.baseIsToken0 ? s.amount1 : s.amount0;

  const base = Math.abs(Number(rawBase)) / 10 ** opts.baseDecimals;
  const quote = Math.abs(Number(rawQuote)) / 10 ** opts.quoteDecimals;
  if (base === 0) throw new Error(`zero base amount in ${s.transactionHash}`);

  return {
    tsMs: opts.tsMs,
    // The pool RECEIVING base means the taker sold base into it.
    takerBuysBase: rawBase < 0n,
    baseAmount: base,
    execPrice: quote / base,
    feeTier: opts.feeTier,
  };
}
