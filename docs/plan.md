# Stock-Token LP Vaults on Robinhood Chain — Plan

**Status (2026-09-16):** Track A contracts built and panel-reviewed; nothing
deployed; no third-party money. One ship blocker open (deposit pricing, A1).

**Two products, shipped in order.** `xAMC` is a plain concentrated-LP vault —
the Arrakis/Gamma/Charm shape — on a Robinhood Stock Token against USDG. It
promises nothing about profitability; a holder takes equity beta plus fees
minus arbitrage loss, knowingly. `hAMC` is a hedged wrapper that holds `xAMC`
and shorts the delta on Lighter's Robinhood Chain perp instance, and it _does_
promise something — "roughly dollar-stable with an on-chain floor" — which is
only true if pool fees cover hedge carry plus adverse selection. That number
does not exist yet. **`xAMC` is the instrument that produces it**, so it ships
first and `hAMC` is gated on what it measures.

This document is in two tracks. **Track A** lists everything that stands
between the code that exists and a first deposit by someone who is not us.
**Track B** is the hedge, and nothing in it starts until Track A has shipped.

**One line:** a non-custodial app where users deposit a Robinhood Stock Token
and/or USDG into a per-pair vault and receive a share token, backed by a
concentrated Uniswap position on Robinhood Chain — unhedged (`xAMC`) or
delta-hedged against a short on Lighter RH (`hAMC`), whose settlement contract
lives on the same chain and is owned by the hedged vault.

Drafted 2026-09-16 from the Robinhood Chain LP research; revised the same day
from per-user vaults to shared vaults per pair (so the position is a fungible,
collateral-grade token), again to a two-vault stack (handoff
`two-vault-stack-20260916-131940Z`), and again after the first code review to
put the unhedged product's blockers ahead of every hedged task.

---

## Why this shape

- **Shares are the product.** A pooled vault mints a fungible token that can
  be posted as collateral (Morpho is live on Robinhood Chain and already backs
  Robinhood Earn), LP'd, or wrapped by other protocols. Per-user vaults cannot
  produce that; they were the first draft and are demoted to an optional
  isolation mode.
- **Two vaults, because a hedge flag would destroy the product.** Holders want
  both modes: equity beta with fees, or roughly dollar-stable. A per-holder
  hedged/unhedged flag inside ONE vault makes its shares non-fungible, which
  kills the collateral use that is the reason for pooling at all. So the modes
  are two tokens: `xAMC` (unhedged base) and `hAMC` (hedged wrapper holding
  `xAMC`). Any hedge ratio is a mix of the two, and "toggle hedge" is a
  wrap/unwrap — no LP is closed or reopened.
- **The base vault ships first and is the measuring instrument.** `xAMC` has
  no keeper trading risk, no rollup, no epochs and no queue. It is a shippable
  product on its own terms — the depositor takes the LP bet the way every
  Arrakis depositor does — and, once running, it produces the fee-vs-toxic-flow
  number that decides whether a hedged mode can ever pay for its hedge. `hAMC`
  is then a second contract, not a rewrite, and hedge netting across holders
  still happens in one Lighter account.
- **Same-chain custody root** (Track B). Lighter RH is an app-specific ZK
  rollup whose L1 is Robinhood Chain. The hedged vault contract is the L1 owner
  of the pair's Lighter account. Lighter's rules then do the custody work:
  secure withdrawals only land at the L1 owner, L2 transfers and fast
  withdrawals need the L1 owner's signature, and API keys carry no withdrawal
  scope. The keeper's key is trade-only by construction. Sherwood Protocol has
  already run a contract-owned Lighter account on chain 4663 with a trade-only
  agent key and a kill switch that force-closes and withdraws to the contract.
- **Hedge netting** (Track B). One Lighter account per pair. Opposite flows
  across depositors cancel before touching the perp book; one key to rotate;
  one margin balance to bound.
- **No hosted alternative.** Nothing on Robinhood Chain packages LP plus hedge.
  Revert, Delta Liquidity and SCOPL manage the LP leg only; Lighter Public
  Pools live inside the rollup and cannot hold the Uniswap leg; Alpaca and
  Hyperliquid cannot be non-custodial from this chain.

## What the Phase 0 evidence does and does not say

`research/2026-09-16-hedgeability-and-pool-screen.md` screened the three pairs
this project began with. Its verdict was on the **hedged** thesis:

- **AMC/HOOD/MSTR are 0-for-3 structurally as hedged pairs.** HOOD is absent
  from the Robinhood Stock Token registry (the HOOD/USDG pools trade
  `0x32ac8c1d…`, an unregistered synthetic tracker). MSTR has a token and pools
  paying 10.3% to a $25K vault but **no Lighter RH perp**. AMC has both legs;
  its perp does $47K/24h on 115 trades, carrying a ~$1,880 vault.
- **Every other name is ungraded.** On a 15-minute pre-open window, INTC, META
  and SPCX clear both pool-side bars. Do not quote those APRs.
- **No markouts have been run, for any pair, ever.**
- A first version of the report understated the vault's fee share ~34x by
  modelling it as full-range; corrected in place, see its "Correction" section.

**For Track A this is a ranking input, not a gate.** A vanilla LP vault needs a
pair with enough volume to be worth running, and the scan is how pairs get
ranked. It does not need proof that LP beats holding — no vanilla vault has
ever shipped with that proof, and this one says so on its label. **For Track B
it is the gate**, unchanged: fees net of adverse selection must beat hedge
carry plus gas after a 50% fee cut, measured over a week with a weekend and two
US opens (`research/lib/markout.ts`, `gradeGate`).

---

## Fixed facts (verified 2026-09-15/16; re-read before coding)

| Item                                | Value                                                                                                                                                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Chain                               | Robinhood Chain, id `4663`, Arbitrum Orbit/Nitro, ETH gas, ~100 ms blocks, FCFS sequencer                                                                                                                                                  |
| Testnet                             | id `46630`, `https://rpc.testnet.chain.robinhood.com`, explorer `explorer.testnet.chain.robinhood.com`                                                                                                                                     |
| RPC                                 | Alchemy `robinhood-mainnet.g.alchemy.com/v2/{key}` (HTTP+WSS); public `rpc.mainnet.chain.robinhood.com` (rate-limited; `eth_getLogs` caps at 10k, escalates 429 → 403)                                                                     |
| Explorer                            | `robinhoodchain.blockscout.com`                                                                                                                                                                                                            |
| USDG                                | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` (**6 dp** — stock tokens are 18; every stock valuation goes through one `stockValueDivisor`)                                                                                                  |
| Uniswap v4 PoolManager              | `0x8366a39cc670b4001a1121b8f6a443a643e40951`                                                                                                                                                                                               |
| Uniswap v4 PositionManager          | `0x58daec3116aae6d93017baaea7749052e8a04fa7` (not used — the adapter holds liquidity directly)                                                                                                                                             |
| Uniswap v4 StateView                | `0xf3334192d15450cdd385c8b70e03f9a6bd9e673b`                                                                                                                                                                                               |
| Uniswap v4 Quoter                   | `0x8dc178efb8111bb0973dd9d722ebeff267c98f94`                                                                                                                                                                                               |
| Universal Router                    | `0x8876789976decbfcbbbe364623c63652db8c0904`                                                                                                                                                                                               |
| Permit2                             | `0x000000000022D473030F116dDEE9F6B43aC78BA3`                                                                                                                                                                                               |
| Lighter RH escrow (ZkLighter proxy) | `0x94bAB9693Ba2f6358507eFfcbd372b0660AFfF9d`                                                                                                                                                                                               |
| Lighter RH selectors                | `deposit` `0x8a857083`, `withdraw` (secure/forced) `0xd20191bd`, `changePubKey` `0x17010c68`, `cancelAllOrders` `0xa4b6f756`                                                                                                               |
| Lighter RH API                      | `https://api.rh.lighter.xyz`; Standard tier 0/0 bps, 300 ms taker/cancel delay; Premium 140 ms                                                                                                                                             |
| Lighter RH batch cadence            | ~1 batch/min commit→verify→execute; escape hatch after 14 days of unprocessed priority requests; **no upgrade delay on the escrow**                                                                                                        |
| Oracle                              | Chainlink per-token feeds, `AggregatorV3Interface`, value = equity price × `uiMultiplier()`; 24/5, **no heartbeat off-hours**, `oraclePaused()` during corporate actions. Addresses from Chainlink's Robinhood feeds page, never hardcoded |
| Lending                             | Morpho Blue live on Robinhood Chain (curated USDG vaults behind Robinhood Earn)                                                                                                                                                            |
| Stock tokens                        | Issued by Robinhood Assets (Jersey); **not for US persons**; also restricted UK/CA/CH; minted only by the authorised participant; supply grows with demand                                                                                 |
| AA                                  | ERC-4337 EntryPoints v0.6/0.7/0.8 live; EIP-7702 live; Alchemy Gas Manager and ZeroDev paymasters available                                                                                                                                |

Uniswap v3 is also deployed and carried the highest-fee stock pools at research
time (AMC/USDG 0.3%, HOOD/USDG 1%), but its Robinhood addresses were never
pinned, and the research scan is **v3-only** while the only adapter is **v4**.
Resolving where the volume actually is comes before choosing pairs (A5).

## Uniswap v4 facts the code depends on

Learned the hard way; recorded so they are not relearned.

- **A liquidity change pays the position's ENTIRE accrued fee balance to the
  caller, however small the change.** `Pool.modifyLiquidity` computes
  `feesOwed` against the whole pre-change liquidity and `PoolManager` returns
  `principalDelta + feesAccrued` as one number. A vault taking a pro-rata slice
  of liquidity does not take a pro-rata slice of fees. `BaseVault` therefore
  sweeps fees into itself before it divides anything, and exposes
  `pendingFees()` so NAV can count them without a poke.
- **`positionAmounts` is a quantity report, not a valuation.** The mix a range
  holds is decided by the pool's current price, so anything built on it reads
  pool state indirectly even when it prices the legs at Chainlink.
- **Tick alignment rounds outward.** Requested prices are floored/ceiled onto
  the tick grid, which can widen a range past the bound that approved it (A3).
- `PoolManager` is BUSL and pins `pragma 0.8.26`; our contracts pin `0.8.28`.
  Tests load the real manager by artifact (`vm.deployCode`) rather than import
  it — see `docs/decisions.md`.

---

## System overview

```
 user wallet ──wagmi/viem──▶ Next.js app ──read──▶ Backend API (vault stats, NAV history, queue)
      │                                                    ▲
      │ tx: Router.deposit(pair, stock, usdg, minShares, hedged)  │ events + snapshots
      ▼                                                    │
   Router ── hedged=false ─▶ BaseVault  (xAMC)             │            ┐
      │                          │ owns  ┌───────────────────────────┐    │ TRACK A
      │                          ├──────▶│ Uniswap v4 position       │    │ (ships first)
      │                          │       └───────────────────────────┘    │
      │                          └── bounded operator ◀── Keeper (lp-manager)
      │                                                                   ┘
      └── hedged=true ──▶ BaseVault ──xAMC──▶ HedgedVault (hAMC)        ┐
                                                  │  holds xAMC; NEVER touches the pool     │ TRACK B
                                                  │  L1-owns ┌────────────────────────────┐ │ (after A ships)
                                                  ├─────────▶│ Lighter RH account (rollup) │◀── keeper trade-only key
                                                  │          └────────────────────────────┘ │
                                                  ├── bounded operator ◀── Keeper (hedger, settler)
                                                  └── guardian (multisig) ◀── panic only     ┘
```

Money only ever moves between a vault, its pool position, the hedged vault's
own Lighter account, and share holders on redemption. The Router holds nothing
between transactions — it is a convenience, not a custodian, and every path
through it is also reachable by calling the vaults directly. The keeper changes
_shape_ (range, hedge size, margin within cap); it cannot change _destination_.

## Repository layout

```
subway/
  contracts/            Foundry (Solidity 0.8.28)
    src/BaseVault.sol                   xAMC: ERC-20 + 4626 accounting views,
                                        dual-asset exits; the ONLY pool toucher   [built]
    src/Router.sol                      deposit/redeem with a `hedged` flag         [built, hedged path constant-off]
    src/VaultFactory.sol                pair registry, deploys BaseVault            [built]
    src/adapters/UniV4Adapter.sol       IPoolAdapter impl                           [built]
    src/adapters/UniV3Adapter.sol       IPoolAdapter impl, only if volume is v3     (A5)
    src/libraries/{LiquidityAmounts,PriceTick}.sol                                  [built]
    src/policy/RangePolicy.sol          feed-bounded range checks                   [built]
    src/interfaces/{IPoolAdapter,IZkLighter,IPriceFeed}.sol
    src/SubwayVault.sol                 PRE-STACK hedged vault, wired to nothing,
                                        three recorded defects — delete or retarget (A11 / B1)
    src/HedgedVault.sol                 hAMC: wrapper over xAMC + queue/epoch/Lighter  (B2)
    src/hedge/LighterRHHedge.sol        IZkLighter calls, key registration, exits      (B2)
    src/oracle/HedgedShareOracle.sol    Morpho-compatible price of hAMC in USDG        (B2; exists, imports SubwayVault)
    test/v4/                            real PoolManager loaded by artifact          [built]
    test/fork/*.t.sol                   Alchemy fork of 4663                          (A8)
  apps/web/             Next.js 15 (App Router), wagmi v2, viem, RainbowKit, Tailwind, shadcn/ui   (A10; mock scaffold in progress)
  apps/keeper/          Node 22 TS: feeds, lp-manager, accountant, api, alerts (A7);  hedger, settler (B4)
  packages/sdk/         viem-typed ABIs (wagmi CLI codegen), chain def, addresses, zod schemas
  packages/indexer/     Ponder project: vault/pool events → Postgres                  (A9)
  deploy/               Docker, Terraform (GCP us-east4), secrets layout
  docs/plan.md          this file;  docs/decisions.md  the ledger, incl. the OPEN items Track A closes
```

---

# Track A — ship `xAMC`

The target is a **first deposit by someone who is not us**, into a vault whose
label says exactly what it is. Ordered by what blocks that; nothing here is
hedge-related.

### A1. Deposit pricing — **the ship blocker**

Two reviewers independently found one family of problem in `BaseVault`, written
up with worked numbers in `docs/decisions.md` ("OPEN: how a deposit should be
priced"). Four faces:

1. deposits mint in value-space at the feed, redemptions pay a physical slice
   — they agree only while the vault's mix matches the feed's;
2. the mint denominator (`totalAssets`) moves with the pool's price inside the
   range, because the pool decides the mix even though the feed prices it;
3. first-deposit inflation: `shares = value` at zero supply, no virtual offset,
   no dead shares — a 1-unit deposit plus a donation takes $20 off a $100
   victim;
4. no `minShares`, so a depositor cannot defend against any of the above.

**Do regardless — DONE.** `minShares` on `deposit` (threaded through the
Router) and an OZ-style virtual offset of `10 ** (18 − usdgDecimals)` shares
against one virtual USDG unit. Closes (3), gives (4), changes no product
semantics — and incidentally makes `decimals()` honest: a whole share opens at
$1 rather than $1,000,000. The virtual terms are value-space only; `redeem`
still divides physical contents by the real supply.

**Tests to add either way — DONE.** All four, in `BaseVault.t.sol`: the full
manipulate → victim deposits → reverse sequence; donation with nonzero minted
shares; deposit while fees are pending; both currency orderings through
`BaseVault` rather than only the adapter.

**Decide — DONE.** Reviewed 2026-09-16 and resolved in favour of the
**divergence gate**: `deposit` reverts while `|poolPriceWad − feed| > ε`. The
write-up with the measurements is `docs/a1-deposit-pricing.md`.

As built:

- ε lives in `RangePolicy.Bounds` as `maxDivergence`, and `requireValidBounds`
  fences it from both sides. It **cannot be tighter than the pool's swap fee**,
  because the fee is the width of the no-arbitrage band — nobody closes a gap
  smaller than the fee they would pay to close it, so a 0.3% pool sits within
  ±0.3% of fair with nobody manipulating anything, and a tighter gate blocks
  honest depositors rather than attackers. It **cannot be wider than
  `maxHalfWidth`**, because the distortion it bounds is itself capped by the
  range width, so a wider gate never binds first.
- `poolPriceWad()` and `swapFeeWad()` moved onto `IPoolAdapter`.
- **The gate is skipped when the vault holds no position**, which is not a
  loophole: with nothing in the pool, NAV is idle balances priced at the feed
  and has no pool term at all. Gating anyway would block every deposit before
  the first range opens.
- `minShares` stays as the depositor's own backstop, because the gate bounds
  the error rather than removing it.

**Measured, against the real `PoolManager`:** at ε = 0.5% on a 0.3% pool, a
legal 0.44% divergence costs a $2,000 depositor **1.8 bps**. That is the number
the choice was made on, and the comparison that matters is not against zero but
against the 30–100 bps of pool fee a depositor pays to go acquire the other leg
themselves — which is what minting from quantities would have forced on them.

Outside the gate the deposit reverts and **redemption is untouched**: the same
asymmetry as the feed check, since it is always safe to refuse new money and
never safe to trap existing money.

### A2. Off-hours feed policy

Chainlink equity feeds on 4663 have **no off-hours heartbeat**. Every `deposit`
and every keeper range action goes through `requireFreshPrice` with a 2-hour
`maxFeedAge`, so as written **deposits and range changes are blocked nights
and weekends** while the pool trades 24/7. Redemption is unaffected — it reads
no price — and that property is kept.

1. **Verify on chain** what the feed actually does off-hours: does
   `updatedAt` freeze at the close, does `answer` hold the last print, does
   `oraclePaused()` flip? Read a real feed across a Friday close before
   deciding anything.
2. **Decide** between: (a) `xAMC` is an RTH product — deposits and range
   moves only while the feed is live, stated on the label; (b) accept the last
   close for deposits under a wider `maxFeedAge` **and** a tighter divergence
   gate (A1), since off-hours the pool is the only live price and the feed is
   the only sane one. The plan's earlier answer, "use Lighter mid as fair
   off-hours", is a Track B answer — `xAMC` has no Lighter.
3. Pull-before-open / weekend-pull policy (see Policies) is a keeper behaviour
   and lands with A7; it is not a contract change.

### A3. Realised range must satisfy `RangePolicy` — **DONE**

`openRange` validated the keeper's _requested_ prices; the adapter then rounded
ticks outward onto the grid, and the realised half-width could exceed
`maxHalfWidth` (worked case in `docs/decisions.md`). A safety bound must bind
the position, not the request.

Taken the first way: `IPoolAdapter.openRange` now returns its realised bounds
in vault units — returned from the call rather than exposed as a view, so the
vault validates the range that call opened and not whatever is open by the time
it looks — and `BaseVault.openRange` re-checks them against `RangePolicy` at
the same feed price the request was judged on. The rounding only ever widens,
so the second check can only fail as `RangeTooWide`; straddling and
`minHalfWidth` survive widening by construction.

**Consequence for A7:** the keeper now needs headroom. A request at exactly
`maxHalfWidth` always reverts, and one within a tick spacing of it usually
will. `lp-manager` must ask for less than the bound.

Tested three ways against the real `PoolManager`: the documented $150–$250 case
now reverts, a request with headroom still opens, and a fuzz run asserts that
every range the vault ends up holding satisfies the policy — recomputed from
the adapter's own ticks, so an adapter that reported bounds it had not opened
would still be caught. Removing the guard fails both concrete tests and the
fuzzer finds a 25.08% realised half-width within 150 runs.

### A4. Keys: admin rotation and a timelock on policy — **mostly DONE**

- **Admin is now mutable**, `setAdmin`, only by the current admin. Decided
  2026-09-16 against the other two options. `BaseVault.admin` used to be
  immutable and set to the factory owner at `addPair`, so rotating a
  compromised factory key left `setKeeper`/`setBounds` on every live vault with
  the old key. Rotation is the more useful property: an admin that cannot move
  funds is worth less to an attacker than a stuck admin is worth to a defender.
  No two-step handshake — the role cannot move funds, so handing it to a typo
  costs a vault frozen at its current keeper and policy, never anyone's money.
  `address(0)` is refused.
- **`setBounds` is now a timelock.** `proposeBounds` → wait `boundsDelay` →
  `applyBounds`, with `cancelBounds` as the admin's escape hatch. `boundsDelay`
  is immutable, because a timelock the admin can shorten is one they can
  shorten to zero in the same transaction as the change it was meant to delay.
  `applyBounds` is callable by anyone: the admin already decided, and there is
  nothing left to choose. Tested as the thing it prevents — a keeper range that
  violates the policy still violates it after the wider bound is proposed, and
  only opens once the delay has run.
- **Still to do:** keeper signer in KMS and a rotation runbook (keeper `keys`
  module, A7). And nothing enforces a nonzero `boundsDelay` — it is a
  deployment parameter, publicly readable, and must be checked in the deploy
  path rather than by the contract, which would otherwise block testnet.

### A5. Pool selection — where the volume actually is

The scan is v3-only; the adapter is v4-only. Before choosing pairs:

1. Extend `research/scan.ts` to v4 `Swap` events off `PoolManager`, or pin the
   v3 factory/NPM/router addresses and build `UniV3Adapter` — whichever the
   volume says. Run it over a multi-day window (two US opens and a weekend) on
   a paid RPC; the public endpoint cannot carry it.
2. Rank pairs by volume, fee tier, and pool TVL for the vault-≤-15%-of-pool
   cap. **This is ranking, not a go/no-go**; the label carries the risk.
3. Classify pool tokens **by address** against the Robinhood Stock Token
   registry, never by symbol — the HOOD lesson.

### A6. Deposit pause and caps

The factory owner must be able to pause deposits per pair and the vault must
enforce a TVL cap and a vault-≤-15%-of-pool-TVL cap. All three are called for
below and none exist. Pause is a keeper-independent brake on new money and
never on exits.

### A7. Keeper v0 — LP only

`feeds` + `lp-manager` + `accountant` + `alerts` + `keys` for `xAMC` only. No
hedger, no settler, no Lighter, no API keys. Rebalances after single-asset
deposits, pulls before US open and over weekends per Policies, recenters on
drift. **A v0 where the operator sets the range by hand and the contract
enforces `RangePolicy` is a legitimate first ship** (Arrakis v1 shipped that
way); automate once the manual cadence is understood. Bounded L1 signer; no
key can name a destination.

### A8. Fork tests against live 4663

Alchemy fork: deposit, range open/close with feed-bounded rejections, direct
withdrawal settled out of the range, two-holder fee split after real swaps,
both currency orderings, realised-range policy (A3), a real Chainlink feed
across an off-hours boundary (A2). Today's tests run a locally deployed
`PoolManager`; that proved the AMM semantics, not the chain.

### A9. Indexer and accountant — the instrument's output

Ponder over vault and pool events → Postgres; accountant computes fees, IL vs
hold, arbitrage loss (markouts at +1 s/+10 s/+60 s against the feed), gas, and
NAV per vault. **This is the number Track B is gated on.** It exists to be
read, not to gate `xAMC`.

### A10. Web MVP — unhedged only

Connect, jurisdiction gate (geo + self-attestation; not US/UK/CA/CH), vault
list, `/vault/[pair]` unhedged panel (dual-asset deposit with `minShares`,
immediate dual-asset withdraw, both quantities shown and never a single USDG
figure), `/portfolio`. The hedged toggle renders disabled and says why;
`Router.hedgeAvailable` is a constant false in Track A and the UI must not
imply otherwise. Copy states plainly: equity beta, plus fees, minus arbitrage
loss; no pair has been shown to be profitable; deposits may be unavailable
off-hours (A2). Testnet first, then mainnet behind an allowlist.

### A11. Repository hygiene before strangers read it

- **Decide on `SubwayVault.sol`.** Pre-stack hedged vault, reachable from
  nothing, three recorded defects, and the README reasoning it embodied was
  inverted. Recommended: delete it now — git keeps it, and Track B is a
  retarget to hold `xAMC`, not an edit of this file. Whatever the decision,
  `HedgedShareOracle` must stop importing it.
- Permit2 deposits: called for below, not built. UX, not safety; required
  before public, not before closed beta.
- CI on the repo (`pnpm run check` on push), release tagging, pinned
  addresses in `packages/sdk`.

### A12. Closed beta

Own capital, $20–30K per vault, a handful of allowlisted holders, one or two
pairs from A5. **Grade on cash, not fee APR.** Let A9 run for a week with a
weekend and two US opens. Fix the unwind edge cases (Sherwood's open item: a
both-side close with zero base amount may open the opposite side).

### A13. Audit and collateral

External audit of `BaseVault`, `Router`, `VaultFactory`, `UniV4Adapter`.
Optional Morpho market for `xAMC` at a low LLTV — it is honest equity beta,
priceable at the feed, and the market's oracle reads `convertToAssets` with the
"feed prices, pool mix" caveat stated. Gas sponsorship for `redeem` so a holder
with zero ETH can always leave.

**Track A is shipped when:** A1–A8 are done, A10 is on mainnet behind an
allowlist, A12 has run a full week, and the label on the vault is true.

---

# Track B — `hAMC`, after Track A ships

_(Called "Phase 3" in earlier drafts and in `docs/decisions.md`; Track A was
"Phase 1". Same work, resequenced.)_

Nothing here starts before A12 has produced a week of A9 data. The gate is the
original one and it has never been passed:

> **B0. Gate.** Fees net of adverse selection, from A9 on the running `xAMC`
> vault(s), beat Lighter RH funding plus hedge execution plus gas by a margin
> that survives a 50% fee cut, over a week with a weekend and two US opens. And
> the pair has a Lighter RH perp deep enough to carry the hedge at the vault's
> size (the screen's 2% participation bar). AMC/HOOD/MSTR already fail the
> second half. Of 194 registered tokens, 18 clear it; none is graded on the
> first half.

### B1. Fix the three recorded defects before reusing any of the seed

If `SubwayVault.sol` survives A11, these are inherited; if it was deleted,
they are the mistakes the new `HedgedVault` must not repeat. All three are in
`docs/decisions.md` with worked numbers:

- **Issuance vs collateral valuation are different numbers.** Minting at the
  floor **overpays** the depositor — `shares = value × supply / floor` and a
  smaller denominator mints more shares — so the floor is the right number for
  a lender and the wrong one for a mint. Decide the issuance price (attested
  NAV with a dispute window, mint at max(floor, last attested), or mint only at
  epoch boundaries) before writing `deposit`.
- **Queued holders must survive a panic.** `requestRedeem` burns into
  `pendingShares`; `emergencyRedeem` must count them, and settlement must not
  be `onlyKeeper` while frozen.
- **Panic must create a claim on in-flight Lighter proceeds**, not burn
  against balances physically present. `MockLighter` pays synchronously and
  hides this; the test double must model the delay.

### B2. `HedgedVault` (`hAMC`) — wrapper over `xAMC`

Holds `xAMC` shares and owns the pair's Lighter account. **It never touches the
pool.** Everything hard lives here and only here: margin ledger, NAV floor,
epoch settlement, redemption queue, panic. Its asset is `xAMC`, not USDG.

- **The hedge target is a pure on-chain read**: `hAMC`'s `xAMC` balance ÷
  `xAMC` total supply × stock tokens currently in the range. What the hedge
  _should_ be needs nothing off-chain, which is what makes a keeper's failure
  to hedge detectable.
- Holder surface: `deposit`/`mint` take `xAMC` (the Router wraps in one tx);
  `requestRedeem(shares)` → queue slot at the current epoch id; `claim(slot)`
  after `settleEpoch`. `convertToAssets` returns the **floor**;
  `withdraw`/`redeem` revert pointing at the queue — claiming ERC-4626 and then
  blocking withdrawal fails at an integrator's runtime rather than at their
  integration.
- Keeper surface: `fundHedge`/`withdrawHedge` (capped at `maxMargin`, margin
  ledger), `registerHedgeKey`, `settleEpoch`.
- Panic (guardian or keeper; always callable): `cancelAllOrders` and
  `withdraw` on ZkLighter via the L1 priority path, freeze the keeper, open a
  holder-callable `emergencyRedeem` paying pro-rata `xAMC` **plus a claim on
  the matured Lighter withdrawal** (B1). The exit is in `xAMC`, not USDG: the
  wrapper never needs the pool unwound for its holders to leave, because
  `xAMC` is itself always redeemable.
- **`hAMC` ≤ 50% of `xAMC` supply**, else a hedged-side run forces the base
  vault out of the pool at an epoch and the unhedged holders pay for it.
- **Epoch sequencing is fixed**: reduce hedge → redeem `xAMC` → withdraw
  margin as needed → `settleEpoch`, which reverts if idle balances cannot cover
  the queue.
- `LighterRHHedge` wraps the four ZkLighter calls with the RH escrow address
  and asset indices. MVP uses USDG margin only; posting withdrawn stock
  inventory as margin for the same-name short is a later policy flag.
- `HedgedShareOracle` returns the floor in USDG with a staleness check on the
  underlying feed, for a Morpho market at a low LLTV. Because the floor counts
  unsettled hedge PnL as zero and haircuts margin, the only way it overstates
  is a Chainlink error — the same risk the lender already carries.

#### The share-price problem, which is `hAMC`'s alone

Everything the wrapper owns is priceable on-chain — it holds `xAMC`, which
prices itself — **except the hedge equity**, which lives in Lighter's rollup and
cannot be read from Robinhood Chain. Three mechanisms make `convertToAssets` a
conservative, fully on-chain floor:

1. **NAV floor.** `xAMC` value + idle balances + margin × (1 − h), with
   unsettled hedge PnL counted as zero and `h` set from the liquidation
   distance at target leverage (3x → h ≈ 0.35). It undervalues, which is the
   safe direction for a lender — and the wrong direction for a mint (B1).
2. **Epoch settlement.** Daily at MVP, the keeper realises hedge PnL by
   secure-withdrawing it to the vault (or topping up margin). It becomes idle
   balance and enters NAV. `settleEpoch()` snapshots it on-chain; the keeper's
   Lighter-side accounting is posted as an attestation the indexer can dispute.
3. **Epoch-priced withdrawals.** Queue, then settle at the next epoch NAV
   after the hedge is reduced pro rata and the Lighter withdrawal matures —
   minutes normally, up to 14 days in the escape-hatch case.

**What the contract cannot see:** rollup state. It cannot verify hedge size or
side. The mitigation is the bounded margin ledger (`maxMargin` ≈ hedge
notional / 3x), a floor that already assumes the margin is at risk, and the
panic path. This is the residual trust surface and the frontend states it.

### B3. Router — hedged routing and wrap/unwrap

Flip `HEDGED_ROUTING_LIVE` in the same change that implements the route:
`deposit(hedged=true)` → `xAMC` → `hAMC` in one tx, `redeem(hedged=true)` the
mirror, and `wrap`/`unwrap` — deliberately absent today rather than reverting
stubs, because a stub whose state mutability must change later puts a lie in
the ABI. `hedgeAvailable` becomes true per pair only once its wrapper is
registered **and** routable.

### B4. Keeper — `hedger` and `settler`

`hedger`: target short read on-chain from `hAMC`'s share of the range; trade
only when |target − current| > band; IOC on Lighter with the vault's
trade-only key; funding monitor that unwinds when 8h funding > cap; margin
top-up/down inside `maxMargin`. `settler`: epoch clock — size the queue,
reduce range and hedge pro rata, secure-withdraw realised PnL and queue cover,
wait for maturity, `settleEpoch` with the attestation. Lighter API key per
vault in Secret Manager.

Confirm before B4 ships: Lighter RH API reachability from `us-east4`
(CloudFront fronting, Standard tier), account-index resolution for a contract
address, deposit crediting time, secure-withdraw latency end to end, epoch
cycle wall-clock, whether a testnet Lighter exists on 46630 (else dust on
mainnet), and whether `changePubKey` from a contract needs any EIP-1271 path
(it should not: the check is `msg.sender == account L1 address`).

### B5. Web — the hedged half

The toggle goes live per pair off `hedgeAvailable`. Hedged panel: deposit
mints at the issuance price B1 chose, with honest copy about the floor;
redeem is request → queued → claimable with the epoch timer and the Lighter
wait; hedge PnL and funding in the position view. `/portfolio` shows the
implied hedge ratio the `xAMC`/`hAMC` mix produces and says that toggling is a
wrap, not an exit and re-entry.

### B6. Hedged closed beta, audit, collateral

Own capital, one pair. Measure floor vs attested NAV drift. Audit
`HedgedVault`, `LighterRHHedge`, `HedgedShareOracle`, the hedged Router paths.
Morpho market for `hAMC` at a conservative LLTV. Gas sponsorship for `claim`
and `emergencyRedeem`. Per-user isolation mode only if a large holder asks.

---

## Contracts — invariants pinned by tests

1. No function moves tokens anywhere except a vault, its pool position, the
   hedged vault's own Lighter account, or a share holder on redemption. **No
   keeper or adapter path takes a recipient**; a holder may name a receiver
   for their own deposit or redemption.
2. `convertToAssets` never reads a keeper-supplied value and never takes a
   price from the pool. It is **not** tick-independent — the pool sets the mix
   the range holds — and the test bounds how far it can move rather than
   claiming it cannot. Binds both vaults.
3. Fees are realised before any share-math decision: swept before a
   redemption divides, counted in NAV before a deposit mints. A one-share
   redeemer cannot take another holder's fees. (Proved by a two-holder test
   that fails on the pre-review code by $23.88 on a $400 claim.)
4. The keeper cannot exceed `maxMargin`, open a range whose **realised** ticks
   violate `RangePolicy` (A3), register a key when frozen, or settle an epoch
   the queue cannot be paid from.
5. `xAMC` has no state a holder can be trapped in: redemption reads no price
   and needs no keeper. `panic()` leaves every `hAMC` holder able to exit
   without the keeper, queued holders included (B1).
6. `hAMC` cannot exceed its configured share of `xAMC` supply.

## Keeper (`apps/keeper`)

One process per environment, one worker per vault. Modules, each with one job:

| Module       | Track | Job                                                                                                                                                                                                                                                                                                  |
| ------------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `feeds`      | A     | Chainlink feed reads (staleness and paused aware); optional Alpaca SIP during RTH as a faster head; in Track B, Lighter RH WS mid for the hedge market. Publishes one `fair` per pair with a source tag.                                                                                             |
| `lp-manager` | A     | In-range state from `StateView`; apply the pair's `RangePolicy` (recenter when fair leaves the inner band, widen on high realised vol, pull before US open / over weekends / earnings); submit range txs through a bounded L1 signer. Rebalances the stock/USDG mix after single-asset deposits.     |
| `accountant` | A     | Fees, IL vs hold, arbitrage loss (markouts vs the feed), gas; NAV per vault; in Track B also hedge PnL and funding from Lighter fills, and the attested-vs-floor dispute check. **Its Track A output is Track B's gate.**                                                                            |
| `keys`       | A     | L1 keeper signer in KMS; rotation runbook. Track B adds the Lighter API key per vault in Secret Manager.                                                                                                                                                                                             |
| `api`        | A     | Read-only HTTP for the web app: vault stats, NAV history, per-holder positions; Track B adds queue state. Writes do not exist; state changes are on-chain.                                                                                                                                           |
| `alerts`     | A     | Telegram on: feed stale > N min while in range, keeper signer balance low, range out of policy. Track B adds hedge band breach, margin ratio < floor, attested NAV below floor, Lighter API errors, queue cover shortfall.                                                                           |
| `hedger`     | B     | Target short read on-chain from `hAMC`'s share of the range; LP delta = stock tokens in the position at the current tick; target = −delta × hedgeRatio; trade only when \|target − current\| > band; IOC on Lighter with the trade-only key; funding monitor; margin top-up/down inside `maxMargin`. |
| `settler`    | B     | Epoch clock. Before `settleEpoch`: size the queue, reduce range and hedge pro rata, secure-withdraw realised PnL and queue cover, wait for maturity, then `settleEpoch` with the attestation.                                                                                                        |

Storage: Postgres (Ponder-indexed on-chain events plus keeper tables). No
Redis at MVP. Placement: GCP `us-east4`, near the RH sequencer and Lighter RH;
latency is not the edge here.

## Web app (`apps/web`)

Stack: Next.js 15 App Router, TypeScript, wagmi v2 + viem 2, RainbowKit
(WalletConnect project id; Robinhood Wallet connects over WalletConnect),
TanStack Query, Tailwind + shadcn/ui, zod, wagmi CLI codegen from
`contracts/out`. Chain definition in `packages/sdk/chain.ts` (`id: 4663`,
Alchemy + public RPCs, Blockscout, `multicall3` if deployed); testnet `46630`
under an env flag.

Routes: `/` (connect, jurisdiction gate, vault list), `/vault/[pair]` (the
hedged/unhedged toggle backed by the Router — disabled with the reason in
Track A — and panels that genuinely differ per mode), `/portfolio` (both share
balances per pair and the implied hedge ratio). Deposit = one Permit2 signature

- one tx (A11); `xAMC` redeem = one tx; `hAMC` redeem = request then claim.
  The app never holds keys.

## Policies (defaults per pair; factory owner sets; changes timelocked — A4)

**Track A**

| Policy         | Default                                                                      | Why                                            |
| -------------- | ---------------------------------------------------------------------------- | ---------------------------------------------- |
| Range preset   | ±6% around feed, recenter at ±3% drift                                       | survives intraday moves, still earns           |
| Feed staleness | hold deposits and range moves if `updatedAt` > 2 h in RTH; off-hours: **A2** | Chainlink has no off-hours heartbeat           |
| Divergence     | refuse deposits while \|pool − feed\| > ε; ε = fee tier + 20 bps (**A1**)    | value-space mint vs quantity-space redeem      |
| Open gap       | pull liquidity 15 min before US open, reopen 10 min after                    | jumps through a range are the dominant LP loss |
| Weekend        | pull liquidity Fri 20:00 ET → Sun 20:00 ET                                   | no reference price                             |
| Earnings       | pull liquidity from the close before to the open after                       | gap risk                                       |
| Caps           | vault ≤ 15% of pool TVL; per-pair TVL cap; deposits pausable (**A6**)        | fee dilution and unwind depth                  |
| Policy delay   | `boundsDelay` 2 days, immutable per vault; **never 0 on mainnet** (A4)       | a bound widened on demand is not a bound       |

**Track B**

| Policy         | Default                                                | Why                                                         |
| -------------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| Hedge band     | rehedge when \|Δ\| > 10% of position notional          | Lighter 300 ms delay and gas make per-fill hedging wasteful |
| Hedge leverage | 3x; top-up at 4x; alert at 5x; `h` = 0.35 in the floor | gap risk                                                    |
| Funding cap    | unhedge and alert if 8h funding > 0.1%                 | perps can price the hedge out                               |
| Epoch          | daily at 21:00 ET                                      | after the close, before overnight                           |
| Margin cap     | `maxMargin` ≤ 40% of vault TVL                         | unwind depth                                                |
| Hedged share   | `hAMC` ≤ 50% of `xAMC` supply                          | a hedged-side run must not force the unhedged side out      |

## Open questions

**Track A** — resolve before A12:

- Chainlink equity feed behaviour off-hours on 4663 (A2), read from chain.
- Where the stock-token volume is: v3 or v4 (A5); v3 addresses if v3.
- USDG ERC-2612 permit support (else Permit2 only).
- Legal wrapper for a pooled stock-token LP share offered to non-US users.
- Morpho Blue on Robinhood Chain: curators, and whether a custom oracle
  adapter is accepted for a new market (A13, optional).

**Track B** — none blocks Track A:

- Lighter RH testnet on 46630; account-creation flow for a contract L1 owner
  (Sherwood's accounts 623/843 prove it works; pin the call sequence); minimum
  deposit; API access from a cloud IP; `changePubKey` from a contract.
- The `hAMC` issuance price (B1).
- Legal wrapper for a hedged share specifically.

## Risks stated to holders (frontend copy, not fine print)

**`xAMC`**

- This tracks the stock, plus trading fees, minus what arbitrageurs take when
  the price moves. It is equity exposure, not a stable claim. **No pair has
  been shown to be profitable**; this vault is how that gets measured.
- Deposits and range changes may be unavailable when the price feed is not
  live (nights, weekends, corporate actions). Withdrawal is always available
  and needs no price and no operator.
- The keeper can choose a bad range; it cannot move funds anywhere but this
  vault, and cannot stop you leaving.
- Stock tokens are not available to US, UK, Canadian or Swiss persons.

**`hAMC`** (Track B)

- The keeper can trade the hedge badly; it cannot move funds anywhere but this
  vault. Losses from a bad hedge are shared by all holders of this pair.
- The share price shown is a floor: unsettled hedge profit counts as zero until
  the daily epoch.
- Redemptions settle at the next epoch. Lighter's escrow has no upgrade delay
  and three operators; exits take minutes normally and up to 14 days in the
  escape-hatch case.
- Hedging removes direction, not impermanent loss; fee yields shown are
  trailing and decay.

### Noted, not scoped

The longer-term product for sophisticated LPs is an **oracle-anchored Uniswap
v4 hook pool** — quote at Chainlink ± spread, dynamic fee against the oracle
gap — with the vault as its deposit layer. Plain ranges are the benchmark it
would have to beat, which is another reason to measure them first.
`IPoolAdapter` is deliberately version- and shape-agnostic so a hook pool is a
different adapter rather than a rewrite; `UniV4Adapter` passes
`IHooks(address(0))` in one place.
