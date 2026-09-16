# A1 — how a deposit should be priced

**Status: decided 2026-09-16 — Option A, the divergence gate, with ε floored
at the pool's fee tier and defaulting to fee + 20 bps.** Built and tested; see
`docs/decisions.md` and A1 in `docs/plan.md`. Measured at ε = 0.5% on a 0.3%
pool, a legal 0.44% divergence costs a $2,000 depositor **1.8 bps**, which is
the 2 bps this document predicted.

The rest is kept as written, as the argument the decision was made on. It also
records the one thing that would reverse it: Option B wins outright if the
single-asset-deposit requirement is ever dropped.

## The defect, restated

`deposit` values the incoming tokens at the Chainlink feed and divides by
`totalAssets()`. `redeem` hands over a physical slice of what the vault holds
and reads no price at all. The two agree only while the vault's token mix
matches the mix the feed implies.

It does not stay matched. `totalAssets()` prices both legs at the feed, but the
QUANTITIES come from `positionAmounts()`, and what mix a Uniswap range is
holding is decided by the pool's current price. Marking a range at a static
feed while the pool walks away from it OVERSTATES the range: every trade the
position actually made happened at a price better than the mark. So the
denominator a depositor divides by inflates when the pool diverges, and they
mint too few shares. The shortfall stays with the incumbent holders.

## How big, measured

Swept against the real `PoolManager`: a $40,000 vault, sole LP in the pool,
feed pinned at $200, pushing the pool with swaps of increasing size and reading
`totalAssets()` and `previewDeposit(2_000e6)` at each step.

| pool vs feed | NAV distortion, ±6% range | NAV distortion, ±25% range |
| ------------ | ------------------------- | -------------------------- |
| 0.06%        | 0.002%                    | —                          |
| 0.27%        | —                         | 0.002%                     |
| 0.63%        | 0.031%                    | 0.008%                     |
| 1.9%         | 0.185%                    | 0.046%                     |
| 3.7%         | 0.64%                     | 0.18%                      |
| 7.7%         | —                         | 0.63%                      |
| 14.5%        | —                         | 2.34%                      |
| 22.4%        | —                         | 6.10%                      |
| out of range | **1.79%** (cap)           | **8.04%** (cap)            |

The quote shortfall tracks the NAV distortion within a few percent of itself
throughout, as it must.

Three things fall out of this table.

**It is quadratic in the divergence.** Tripling the divergence roughly
sextuples the error. That is what makes a gate work: halving ε quarters the
residual mispricing, so a modest bound buys a large reduction.

**It is bounded by the range width.** Once the pool leaves the range the
position is entirely one-sided and the distortion stops growing — 1.79% on a
±6% range, 8.04% on a ±25% one. The ±25% figure confirms the ~8.6% estimate
recorded in `docs/decisions.md` from first principles.

**At a 0.5% gate the residual is about 2 bps** on a ±6% range and well under 1
bp on a ±25% one. That is the number that decides this.

## What the end-to-end attack actually costs today

`test_A1_poolManipulationAroundAVictimDeposit_isMeasured` runs the full
sequence: shove the pool, let a victim deposit against the moved NAV, shove it
back, exit. The attacker **loses $3.41** on the victim's $2,000.

The reason is structural: the attacker must push the price through the vault's
own liquidity and pays ~0.3% each way on the size it takes. The fee is first
order in the price move; the distortion is second order. So for small moves the
fee dominates, and for large ones the distortion has already hit its cap.

**This does not make the defect safe, and it is the main thing a reviewer
should push on.** It holds only because the vault is this pool's sole LP, so
every fee the attacker pays comes back to the vault and mostly to the victim. A
vault that is a minority of the pool pays those fees to other LPs while eating
the whole distortion — and A6's vault-≤-15%-of-pool-TVL cap guarantees the
vault is exactly that. An attacker who can move the price on a cheaper venue
and let arbitrage carry it here pays nothing at all. The right reading is: the
attack is not free, the defect is not self-closing, and the cost of the fix
should be judged against a genuine but bounded exposure rather than a crisis.

## Option A — feed-vs-pool divergence gate

`deposit` reverts while `|poolPriceWad − feed| / feed > ε`.

**For.** Keeps single-asset deposits, which the product wants and which the
keeper's `lp-manager` already expects to rebalance after. Small change:
`poolPriceWad()` moves from `UniV4Adapter` onto `IPoolAdapter`, plus one
comparison and one bound in `RangePolicy.Bounds`. Bounds the error rather than
redesigning the mint, and the table says the bound is tight.

**Against, and this is the real cost: ε cannot be smaller than the pool's fee
tier.** Arbitrage only closes a gap once it exceeds the fee plus gas, so a
0.3% pool sits anywhere in a ±0.3% band with nobody manipulating anything, and
a 1% pool — which is what the research scan found for HOOD/USDG — sits in a ±1%
band. A gate tighter than that band blocks honest deposits most of the time.
So ε is `feeTier + ~20 bps`, giving a residual of ~2 bps on a 0.3% pool and
~11 bps on a 1% pool at a ±6% range.

**Is 2–11 bps acceptable?** Yes, and the comparison that settles it is not
"versus zero". A depositor who cannot deposit one asset must go buy the other
leg first, and pays the pool's own 30–100 bps to do it. The gate's residual
mispricing is smaller than the fee the alternative charges them.

**Other costs.** Deposits are blocked during genuine volatility, which is
exactly when the pool leads the feed — a liveness loss, never a safety one, and
redemption is untouched. An attacker can hold the pool off-peg to keep deposits
blocked, but pays fees continuously to do it while arbitrageurs are paid to
undo it. And it compounds with A2: off-hours the feed is frozen at the last
close while the pool trades, so divergence grows with real news and the gate
will block most overnight deposits. That is arguably correct behaviour — the
feed is uninformative then — but it means A2 option (b) collapses into option
(a) in practice, and A2 should be decided knowing that.

## Option B — mint from quantities

Shares ∝ the binding leg measured against the vault's own inventory, LP-token
style: a deposit that adds q% of every physical thing the vault holds mints q%
more shares.

**For.** Airtight, and in a stronger sense than the gate. It reads no price at
all, so it is immune to pool movement, to feed staleness and to a paused feed
together — mint becomes the exact inverse of redeem, and the deposit path stops
depending on Chainlink entirely, which would also dissolve A2's deposit half.

**Against.** It kills single-asset deposits. A depositor holding only USDG
mints against the binding leg and the excess is refunded or donated, so in
practice they must bring both legs in the vault's current ratio. That is a
materially worse product for the audience the web MVP is aimed at, and it
pushes the swap the gate avoids onto the depositor anyway — at the same 30–100
bps, but now unconditionally rather than only while the pool is off-peg.

It is also not quite free of the pool: the ratio a depositor must match is read
from `positionAmounts()`, which reports the mix at the current tick. That does
not corrupt the arithmetic — contributing q% of each reported quantity is q% of
the position however the pool moves afterwards — but it does mean the quoted
ratio goes stale between quote and execution, so a deposit still needs its
excess leg handled.

## Recommendation

Option A, with:

- ε per pair in `RangePolicy.Bounds`, defaulting to `feeTier + 20 bps`, and a
  hard floor at the fee tier enforced in `setBounds` so it cannot be set to a
  value that blocks every honest deposit.
- `poolPriceWad()` promoted to `IPoolAdapter`.
- `minShares` — already shipped — left as the depositor's own backstop, since
  the gate bounds the error and does not eliminate it.
- The A3 realised-bounds fix landed in the same pass, since both touch the
  adapter's reporting surface.

Option B is the better answer to a question we are not being asked: if `xAMC`
were meant to be a pure LP token with no oracle in the deposit path, it would
win outright. It loses here only because single-asset deposits are a stated
product requirement. **If review decides that requirement is softer than the
plan states, Option B should win** — it is strictly safer, and it would take
the whole A2 deposit question off the board with it.

## What a reviewer should check

1. Is the single-asset-deposit requirement real, or inherited from the plan
   without being re-examined? Option B turns on this and nothing else.
2. Is `feeTier + 20 bps` the right floor for ε, or is the no-arb band on a
   100 ms FCFS chain with an unusual token wider than the fee suggests?
3. Does the "the attack loses money today" measurement change anyone's urgency?
   It should not — the property it rests on disappears at the 15% pool cap.
4. Is a residual of 2–11 bps on the mint acceptable to state on the label, or
   does the gate need to be tighter than honest pool behaviour permits — in
   which case neither option is adequate and the mint needs redesigning.
