---
project: subway
status: NO-GO
verdict: "The plan's three named pairs are 0-for-3 structurally — HOOD has no stock token, MSTR has no Lighter RH perp, AMC's perp does $47K/24h (a ~$1,880 vault) — so Phases 1-5 do not start on those pairs; the wider pool screen is DIAGNOSTIC and does NOT kill the direction"
window: 2026-09-16 (venue snapshot; 15.07-min on-chain pool window, blocks 64,420,508-64,429,508, ~05:10 ET pre-open)
defn: "HEDGE_DEPTH v1 (2% of daily perp quote volume, $20K vault floor); VAULT_YIELD v2 (fee income vs ACTIVE liquidity, share = k*size/(active + k*size) with k = 33.8 at the plan's ±6% range); bar = 2x assumed carry, min 30 swaps"
reopen_if: "AMC or MSTR gains a Lighter RH perp doing ~$1M/24h, or a registered HOOD stock token is listed — the pair-level kill is about these three names only and carries no verdict on the family"
evidence:
  [
    generated/2026-09-16-hedgeability.json,
    generated/2026-09-16-pool-scan.json,
    generated/2026-09-16-phase0-ranking.json,
  ]
---

# Phase 0: hedgeability and pool screen — hedged stock-token LP

The evidence gate for `docs/plan.md`. The plan proposes a
shared ERC-4626 vault that LPs a Robinhood Stock Token against USDG on
Robinhood Chain (id 4663) and hedges the delta with a short on Lighter's
Robinhood Chain perp instance, and gates Phases 1–5 on a week of markout tape
for AMC, HOOD and MSTR.

The markout week was not run. A cheaper structural screen closes the question
for those three pairs on leg existence alone, which is a stronger result than
an economic one and did not need a week to obtain.

## Verdict

**NO-GO on the plan's three named pairs.** Do not start Phase 1 on AMC, HOOD
or MSTR.

**This is not a verdict on the direction.** The wider screen of all 194
registered stock tokens is `DIAGNOSTIC`: three hedgeable names clear both
pool-side bars on a 15-minute window, so the product is not structurally dead —
it has no _evaluated_ pair, which is a different and much weaker statement.
The next step is a multi-day window and the markout week, not abandonment.

## The plan's three pairs

| Name | LP leg                                                                                     | Hedge leg                                          | Verdict           |
| ---- | ------------------------------------------------------------------------------------------ | -------------------------------------------------- | ----------------- |
| HOOD | **none** — absent from the Robinhood Stock Token registry (194 assets, checked 2026-09-16) | **none** — no Lighter RH market                    | dead on both legs |
| MSTR | registered (`0xec262a75…`), pools live                                                     | **none** — Lighter RH lists no MSTR perp           | unhedgeable       |
| AMC  | registered (`0x05a3d1Cd…`), pools live                                                     | listed (perp 56) but **$47,006/24h on 115 trades** | hedge too thin    |

These three rejections are the durable part of this report. They rest on leg
existence and on a 24-hour venue statistic, neither of which a longer on-chain
window would change.

HOOD deserves a second line, because there _are_ HOOD/USDG pools on this chain
and they are the ones the plan's 200–440% APR research pointed at. The token
in them is `0x32ac8c1d7672667d5ebdea22935f7b06fc8d496f`, which is not
Robinhood's, not Backed's and not Ondo's — an anonymous synthetic tracker
minted by a UUPS vault at an oracle price, with USDG swept to an owner EOA.
It tracks HOOD to ~1%, so a ticker check and a price check both pass while the
LP holds uncollateralised issuer credit risk. This is why the screen
classifies pool tokens **by address**, not by symbol.

AMC is the instructive one: both legs exist, so a listed/not-listed screen
passes it. At 2% participation its perp supports a $1,880 vault — **10.6x
under** this screen's $20K floor, and 42x under the recorder's own $2M/day
admission bar. A vault of the size the plan wants would _be_ that book.

## What the pool side actually shows

A 15.07-minute window (blocks 64,420,508–64,429,508, measured from block
timestamps) carried 8,001 v3 swaps across 555 pools, of which 82 pair a
registered stock token against USDG.

Yield is what a **$25K vault over the plan's ±6% range** would receive. That
range matters enormously and is the correction described below: a concentrated
deposit buys ~33.8x the liquidity the same dollars buy full-range, so its fee
share is `k·size / (active + k·size)`, not `size / (active + size)`.

Hedgeable names, best pool:

| Name | max vault (hedge) | best vault APR | swaps | active liquidity | clears both bars |
| ---- | ----------------- | -------------- | ----- | ---------------- | ---------------- |
| INTC | $68,633           | 1709%          | 52    | $2,837,175       | yes              |
| META | $27,023           | 326%           | 41    | $2,346,617       | yes              |
| SPCX | $228,478          | 31.5%          | 91    | $115,030,816     | yes              |
| USO  | $70,600           | 176%           | 13    | $64,599,600      | no — 13 swaps    |
| CRCL | $120,439          | 69.4%          | 6     | $20,331,166      | no — 6 swaps     |
| SPY  | $2,625,721        | 10.4%          | 57    | $34,682,902      | no — under bar   |
| NVDA | $211,393          | 10.1%          | 82    | $386,192,741     | no — under bar   |

The bar is 11.0% vault APR — twice the 5.5% assumed hedge carry — plus 30
swaps so the annualisation is not pure noise.

**Do not read INTC's 1709% as an APR.** It is 52 swaps in fifteen minutes
before the US open, annualised. It says the pool is not empty and the name is
hedgeable; it does not say the seat is profitable, or even that the number
survives to lunchtime.

## Correction to the first version of this report

The first version of this report (commit `9b512193`) concluded that **no name
cleared both legs** and asserted that hedge depth and fee APR are
anti-correlated on this chain. **Both claims are withdrawn.**

The cause was a modelling error found in review. `activeLiquidityQuoteValue`
returns the _full-range-equivalent_ value of the pool's active `L` (`2·L·√P`,
the virtual reserves). Dividing a vault's face dollars into that treats the
vault as a full-range depositor, while the plan's vault runs ±6%. The same
dollars concentrated into ±6% create ~33.8x the liquidity, so every vault
share — and every vault APR — was understated by that factor. META read 6.8%
and is 326%.

A second, independent bug was found at the same time:
`activeLiquidityQuoteValue` folded the token decimal correction into a
token1-per-token0 price and then inverted the whole expression, which is wrong
by `10^(2·(d0−d1))` when the base is token1. For an 18-decimal stock against
6-decimal USDG that zeroed the base half of the pool and returned exactly half
the true value — for 53 of the 90 pools in the first scan.

The anti-correlation claim was never measured; it was inferred from the
(wrong) numbers, and INTC and META falsify it — both are hedgeable and both
pay well. No float series or correlation was computed, and none is claimed
now.

Both bugs are fixed and pinned: `tests/phase0.test.ts` covers the
token-order case and the range-aware share, and a golden test re-derives the
committed ranking from the committed inputs, so a model change that is not
regenerated now fails the build. That last test exists because its absence is
exactly what let the first version ship.

## What this screen does NOT establish

- **It does not grade any pair.** No markouts were run. Fee income net of
  adverse selection is unmeasured for every name, so nothing here is a
  profitability result — the grader (`lib/markout.ts`) is built and tested but
  has never been pointed at a real window.
- **Fifteen minutes cannot grade a pool.** The window is one pre-open slice
  with no open, no close, no weekend and no regime variation. The family's own
  verdict bar is a week including a weekend and two US opens. Every APR above
  is an extrapolation whose error bars exceed its value.
- **The scan is v3-only.** Uniswap v4 pools live inside the PoolManager
  singleton and need a different discovery path; v4 fee income is missing
  entirely, and the plan named an AMC/USDG v4 0.1% pool specifically.
- **Daily perp volume is a proxy for depth, not depth itself.** It is reliable
  for rejecting a book that misses by an order of magnitude (AMC) and should
  not be trusted for a name near the bar without reading the order book.
- **It does not falsify the vault design.** The NAV floor, epoch settlement,
  redemption queue and contract-owned Lighter account are untested, not
  disproven.

## What to do instead

1. **Do not add AMC or HOOD to the `lighter-rh` recorder venue** (the
   handoff's first step). HOOD has no market to add. AMC's $47K/24h is 2.4% of
   the recorder's $2M/day admission bar and 6% of its 2,000-print bar, for a
   pair whose hedge cannot carry a vault worth operating. If AMC tape is
   wanted anyway, take it as temporary research capture rather than permanent
   recorder admission. (The recorder's 17 existing `lighterRhMarketId` entries
   were checked against the live venue in passing: no drift.)
2. **Re-run the pool scan over a multi-day window** restricted to the 18
   hedgeable names, covering at least two US opens and a weekend, and let
   INTC/META/SPCX either survive or collapse. This needs an RPC that tolerates
   the request volume — the public endpoint escalates 429 → 403.
3. **Then run the markout week** on whatever survives, using `lib/markout.ts`
   (`gradeGate` is the plan's go/no-go: fees net of adverse selection must
   beat funding plus gas after a 50% fee cut).
4. Phases 1–5 stay gated on (3).

## Method and reproduction

```bash
npx tsx research/probe.ts              # hedge depth per name
npx tsx research/scan.ts --minutes 15  # raw pool facts
npx tsx research/rank.ts               # vault economics + the join
```

Pools are discovered from v3 swap logs, not from a factory: the plan never
pinned the Uniswap v3 addresses on chain 4663, and a discovery pass needing
them would inherit that gap. `scan.ts` records only chain facts; what a vault
earns from them is a modelling choice and lives in `lib/rank.ts`, so the model
can be corrected without a 25-minute rescan — which is precisely what the
correction above required. Grading logic is pure and fixture-tested in
`tests/phase0.test.ts`; no test touches a venue or an RPC.

**RPC constraint, measured.** `rpc.mainnet.chain.robinhood.com` caps
`eth_getLogs` at 10,000 matched logs — which the chain-wide v3 Swap topic
clears inside an hour at ~100 ms blocks — and escalates under sustained load
from 429 to a **403 block**. A full pool scan is ~3,000 throttled round trips
and takes ~25 minutes at a 250 ms gap. Block rate measured at 596.7
blocks/min, but per-day figures are scaled by the window's actual timestamp
span rather than by that nominal.

## Numbers that are venue snapshots, not measurements

Perp volumes are Lighter RH's own `daily_quote_token_volume` at
2026-09-16T09:0xZ, a single 24-hour reading, used only to reject books that
are orders of magnitude too thin. Funding is assumed at 0.01%/8h; the plan's
0.1%/8h is an _emergency cap_, not an expected rate, and at that level carry
alone is 54.8% APR — which would sink every name in the table above. No
verdict here should rest on a name whose sign flips between the two.
