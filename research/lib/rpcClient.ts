/**
 * Minimal JSON-RPC client for Robinhood Chain (id 4663), sized for the Phase 0
 * scan in `docs/plan.md`.
 *
 * Deliberately not viem: this tree is research tooling that must not pull a
 * chain SDK into the repo's dependency graph for one study, and the only
 * calls needed are `eth_getLogs`, `eth_call`, `eth_getBlockByNumber` and four
 * zero-argument view functions whose ABI encoding is a constant selector.
 *
 * The public endpoint 429s under trivial concurrency, so every request goes
 * through one serialised queue with backoff. `fetchLogs` in `poolscan.ts`
 * layers range-splitting on top.
 */
import { RpcError, type RpcTransport } from "./poolscan.ts";

export const RH_PUBLIC_RPC = "https://rpc.mainnet.chain.robinhood.com";

export interface TransportOptions {
  url?: string;
  /** Minimum gap between requests, milliseconds. */
  minGapMs?: number;
  maxRetries?: number;
  timeoutMs?: number;
}

/**
 * Build a serialised, backing-off JSON-RPC transport.
 *
 * Serialisation is not caution, it is the measured behaviour of the public
 * endpoint: two concurrent `eth_getLogs` calls reliably return 429.
 */
export function makeHttpTransport(options: TransportOptions = {}): RpcTransport {
  const { url = RH_PUBLIC_RPC, minGapMs = 120, maxRetries = 6, timeoutMs = 60_000 } = options;

  let chain: Promise<unknown> = Promise.resolve();
  let lastAt = 0;
  let id = 0;

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  const send = async (method: string, params: unknown[]): Promise<unknown> => {
    for (let attempt = 0; ; attempt += 1) {
      const gap = minGapMs - (Date.now() - lastAt);
      if (gap > 0) await sleep(gap);
      lastAt = Date.now();

      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: (id += 1), method, params }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        if (attempt >= maxRetries) throw err;
        await sleep(minGapMs * 2 ** attempt);
        continue;
      }

      // Throttling arrives as an HTTP status, not a JSON-RPC error, and the
      // public endpoint escalates: sustained use first returns 429 and then
      // switches to a 403 block that persists for a while. Both are "wait",
      // not "narrow the range", so both back off — 403 from a longer base
      // because it is the endpoint's harder refusal.
      if (res.status === 429 || res.status === 403) {
        if (attempt >= maxRetries) {
          throw new RpcError(
            res.status,
            res.status === 403 ? "Forbidden (throttled)" : "Too Many Requests",
          );
        }
        const base = res.status === 403 ? minGapMs * 20 : minGapMs;
        await sleep(base * 2 ** attempt);
        continue;
      }
      if (!res.ok) throw new RpcError(res.status, `HTTP ${res.status} from ${url}`);

      const body = (await res.json()) as {
        result?: unknown;
        error?: { code: number; message: string };
      };
      if (body.error) throw new RpcError(body.error.code, body.error.message);
      return body.result;
    }
  };

  // One queue: every caller awaits the same chain, so requests never overlap.
  return (method, params) => {
    const next = chain.then(
      () => send(method, params),
      () => send(method, params),
    );
    chain = next.catch(() => undefined);
    return next;
  };
}

/** `keccak256("token0()")[0..4]` and friends — constants, not computed. */
export const SELECTORS = {
  token0: "0x0dfe1681",
  token1: "0xd21220a7",
  fee: "0xddca3f43",
  liquidity: "0x1a686502",
  decimals: "0x313ce567",
  symbol: "0x95d89b41",
  slot0: "0x3850c7bd",
} as const;

export async function ethCall(
  transport: RpcTransport,
  to: string,
  selector: string,
): Promise<string> {
  return (await transport("eth_call", [{ to, data: selector }, "latest"])) as string;
}

function requireWord(hex: string, what: string): string {
  const body = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (body.length < 64) throw new Error(`short ${what} return: ${hex}`);
  return body.slice(0, 64);
}

export async function callAddress(
  transport: RpcTransport,
  to: string,
  selector: string,
): Promise<string> {
  const raw = await ethCall(transport, to, selector);
  return `0x${requireWord(raw, "address").slice(24)}`.toLowerCase();
}

export async function callUint(
  transport: RpcTransport,
  to: string,
  selector: string,
): Promise<bigint> {
  const raw = await ethCall(transport, to, selector);
  return BigInt(`0x${requireWord(raw, "uint")}`);
}

/** Block timestamps, memoised: markouts need a wall clock per swap. */
export function makeBlockTimeReader(transport: RpcTransport): (block: number) => Promise<number> {
  const cache = new Map<number, Promise<number>>();
  return (block: number) => {
    const hit = cache.get(block);
    if (hit) return hit;
    const p = (async () => {
      const b = (await transport("eth_getBlockByNumber", [`0x${block.toString(16)}`, false])) as {
        timestamp: string;
      } | null;
      if (!b) throw new Error(`no block ${block}`);
      return Number(BigInt(b.timestamp)) * 1_000;
    })();
    cache.set(block, p);
    return p;
  };
}

export async function blockNumber(transport: RpcTransport): Promise<number> {
  return Number(BigInt((await transport("eth_blockNumber", [])) as string));
}
