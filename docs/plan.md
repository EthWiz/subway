# Handoff: Hedged stock-token LP app on Robinhood Chain (shared-vault plan)

- **Created:** 2026-09-16T08:57Z
- **From:** cloud · `claude/lp-meme-token-il-strategies-t9wd3q` @ `2210219587b05ee15150e971aab5ea8d158485df`
- **Code lives on:** branch `claude/lp-meme-token-il-strategies-t9wd3q` (pushed: yes). This
  branch carries only this document; no runtime code was written.

## Current state — Phase 0 RUN, NO-GO on THESE THREE PAIRS (2026-09-16)

**Phases 1–5 below are GATED and have not started.** The plan's own gate says
"go/no-go before any code beyond scaffolding". It returned no-go on this
plan's three named pairs — and **no verdict at all on the direction**, which
remains ungraded rather than killed.

- Phase 0 is complete: `research/2026-09-16-hedgeability-and-pool-screen.md`,
  its `generated/` evidence, the tooling under `research/`, the
  and the project README. Tests: `tests/phase0.test.ts`.
- **The three named pairs are 0-for-3 structurally.** HOOD is absent from the
  Robinhood Stock Token registry entirely — the HOOD/USDG pools this plan's
  APR research pointed at trade `0x32ac8c1d…`, an unregistered synthetic
  tracker, so that leg was never a stock token. MSTR has a registered token
  and pools paying 10.3% to a $25K vault but **no Lighter RH perp**. AMC has
  both legs; its perp does **$47K/24h on 115 trades**, carrying a ~$1,880
  vault against this plan's $20–30K Phase 4 sizing.
- **Every other name is ungraded.** On a 15-minute pre-open window, INTC,
  META and SPCX clear both pool-side bars. That says the direction is not
  structurally dead; it says nothing about profitability.
- **No markouts were run, for any pair, ever.** The +1 s/+10 s/+60 s grader is
  built and tested but has never been pointed at a real window.
- **The product shape is untested, not falsified.** The vault, NAV floor,
  epoch settlement, redemption queue and contract-owned Lighter account are
  all as written; what is falsified is the candidate list.
- **A first version of the Phase 0 report was wrong and is corrected.** It
  concluded that no name cleared both legs and that hedge depth and fee APR
  are anti-correlated on this chain. Both are withdrawn: the vault's fee share
  was modelled as full-range against a pool whose active liquidity is
  concentrated, understating it by ~34x at this plan's ±6% range, and the
  correlation was never measured. See the report's "Correction" section.
- Nothing in `apps/` or `packages/` changed. The recorder was deliberately
  NOT touched (see next steps).

## Implementation plan — next steps

1. **Do NOT add AMC or HOOD to the `lighter-rh` recorder venue** (the original
   step 1). HOOD has no market to add; AMC's $47K/24h is ~2% of the recorder's
   own $2M/day admission bar, for a pair the screen says cannot be hedged at
   any vault size worth operating. The recorder's 17 existing
   `lighterRhMarketId` entries were checked against the live venue in passing:
   no drift.
2. **Re-run `research/scan.ts` over a multi-day window**, restricted
   to the 18 hedgeable names and covering at least two US opens and a weekend,
   and let INTC / META / SPCX either survive or collapse on real flow. Their
   15-minute APRs are pre-open extrapolations from 52 / 41 / 91 swaps and
   should not be quoted. This needs an RPC that tolerates the request volume;
   the public endpoint escalates 429 → 403. The scan is also **v3-only** —
   Uniswap v4 fee income is missing entirely.
3. **Only then** run the markout week on whatever survives, using
   `research/lib/markout.ts` (`gradeGate` is the plan's go/no-go:
   fees net of adverse selection must beat funding plus gas after a 50% fee
   cut).
4. Phases 1–5 below remain as written, and remain gated on (3).

## Validation / done-when

- Phase 0 is done (report + index row landed 2026-09-16).
- Phase 0 tooling: `node --import ./tests/support/no-network.mjs --import tsx
--test tests/phase0.test.ts`, plus `pnpm lint` and the root gate.
- Any future Phase 0 code under `apps/genesis/**`: `pnpm genesis:check`.

---

# Hedged Stock-Token LP App — Plan

**Status:** Plan (nothing shipped). Drafted 2026-09-16 from the Robinhood
Chain LP research in the `claude/lp-meme-token-il-strategies-t9wd3q` session.
Revised the same day from per-user vaults to **shared ERC-4626 vaults per
pair** so the position is a fungible, collateral-grade token.

**One line:** a non-custodial app where users deposit a Robinhood Stock
Token and/or USDG into a per-pair vault, receive a share token, and the vault
runs a concentrated Uniswap position on Robinhood Chain for that pair, hedged
by default with a short on Lighter's Robinhood Chain instance, whose
settlement contract lives on the same chain and is owned by the vault.

## Why this shape

- **Shares are the product.** A pooled vault mints `hAMC`, `hHOOD`, … whose
  value is roughly dollar-stable because the position is delta-hedged. That
  token can be posted as collateral (Morpho is live on Robinhood Chain and
  already backs Robinhood Earn), LP'd, or wrapped by other protocols. Per-user
  vaults cannot produce that; they were the first draft and are demoted to an
  optional isolation mode.
- **Same-chain custody root.** Lighter RH is an app-specific ZK rollup whose
  L1 is Robinhood Chain. The vault contract is the L1 owner of the pair's
  Lighter account. Lighter's rules then do the custody work: secure
  withdrawals only land at the L1 owner, L2 transfers and fast withdrawals
  need the L1 owner's signature, and API keys carry no withdrawal scope. The
  keeper's key is trade-only by construction. Sherwood Protocol has already run
  a contract-owned Lighter account on chain 4663 with a trade-only agent key
  and a kill switch that force-closes and withdraws to the contract.
- **Hedge netting.** One Lighter account per pair. Opposite flows across
  depositors cancel before touching the perp book; one key to rotate; one
  margin balance to bound.
- **No hosted alternative.** Nothing on Robinhood Chain packages LP plus
  hedge. Revert, Delta Liquidity and SCOPL manage the LP leg only; Lighter
  Public Pools live inside the rollup and cannot hold the Uniswap leg; Alpaca
  and Hyperliquid cannot be non-custodial from this chain.

## The one hard problem: share price

Everything in the vault is on-chain and priceable **except the hedge
equity**, which lives in Lighter's rollup and cannot be read from Robinhood
Chain. A share used as collateral needs a manipulation-resistant on-chain
price. The design answers with three mechanisms that together make
`convertToAssets` a **conservative, fully on-chain floor**:

1. **NAV floor.** `NAV_floor = LP value + idle balances + margin × (1 − h)`,
   where LP value comes from Uniswap `StateView` liquidity math priced at the
   Chainlink feed (not the pool tick, which is manipulable), idle balances are
   token balances of the vault, margin is the cumulative USDG deposited to the
   vault's Lighter account minus withdrawals (an on-chain event trail the
   vault itself maintains), and `h` is a haircut set from the liquidation
   distance at target leverage (3x → h ≈ 0.35). **Unsettled hedge PnL counts
   as zero.** The floor undervalues the share, which is the safe direction
   for a lender.
2. **Epoch settlement.** Once per epoch (daily at MVP) the keeper realises
   hedge PnL by secure-withdrawing it to the vault (or topping up margin from
   the vault). At that moment the PnL becomes idle balance and enters NAV. An
   epoch NAV is snapshotted on-chain by the vault (`settleEpoch()`), with the
   keeper's Lighter-side accounting posted as an attestation the indexer can
   dispute off-chain.
3. **Epoch-priced deposits and withdrawals.** Deposits mint at the current
   floor NAV immediately (a depositor can only be underpaid, never overpaid,
   so there is no dilution attack). Withdrawals **queue** and settle at the
   next epoch NAV after the keeper reduces the hedge pro rata and the Lighter
   withdrawal matures. This is honest about Lighter's plumbing: minutes
   normally, up to 14 days in the escape-hatch case.

A Morpho market for `hAMC` reads `convertToAssets` (the floor) through a
thin oracle adapter and sets a low LLTV. Because the floor is on-chain and
monotone in verifiable inputs, it does not depend on the keeper.

## Not in this repo's runtime

This is a user-facing product, not an operator surface, so it does **not**
live under `apps/dashboard` (the only supported operator frontend) and does
not consume Zig or Genesis code. It is a **new repository** (`subway`, pnpm
workspace). This document stays here because the evidence gate (Phase 0)
reuses Genesis tooling and the research lineage is in this repo. Decisions
that survive shipping move to the new repo's own decision ledger.

## Fixed facts (verified 2026-09-15/16; re-read before coding)

| Item                                | Value                                                                                                                                                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Chain                               | Robinhood Chain, id `4663`, Arbitrum Orbit/Nitro, ETH gas, ~100 ms blocks, FCFS sequencer                                                                                                                                                  |
| Testnet                             | id `46630`, `https://rpc.testnet.chain.robinhood.com`, explorer `explorer.testnet.chain.robinhood.com`                                                                                                                                     |
| RPC                                 | Alchemy `robinhood-mainnet.g.alchemy.com/v2/{key}` (HTTP+WSS); public `rpc.mainnet.chain.robinhood.com` (rate-limited)                                                                                                                     |
| Explorer                            | `robinhoodchain.blockscout.com`                                                                                                                                                                                                            |
| USDG                                | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` (6 dp)                                                                                                                                                                                        |
| Uniswap v4 PoolManager              | `0x8366a39cc670b4001a1121b8f6a443a643e40951`                                                                                                                                                                                               |
| Uniswap v4 PositionManager          | `0x58daec3116aae6d93017baaea7749052e8a04fa7`                                                                                                                                                                                               |
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

Uniswap v3 is also deployed and carries the highest-fee stock pools today
(AMC/USDG 0.3%, HOOD/USDG 1%), but its Robinhood addresses were not pinned
during research. Resolve before Phase 1; the LP adapter interface below is
version-agnostic for that reason.

## System overview

```
 user wallet ──wagmi/viem──▶ Next.js app ──read──▶ Backend API (vault stats, NAV history, queue)
      │                                                    ▲
      │ tx: deposit / requestRedeem / claim                 │ events + snapshots (Ponder)
      ▼                                                    │
 HedgedLPVault (ERC-4626, one per pair) ──mints──▶ hAMC / hHOOD / … (collateral-grade)
      │  owns   ┌──────────────────────────────┐
      ├────────▶│ Uniswap v4 position (ERC-721) │
      │         └──────────────────────────────┘
      │  L1-owns ┌────────────────────────────┐
      ├─────────▶│ Lighter RH account (rollup) │◀── keeper trade-only API key
      │          └────────────────────────────┘
      └── bounded operator role ◀── Keeper (LP policy, band hedge, epoch settlement)
      └── guardian (multisig) ◀── panic only
```

Money only ever moves between the vault, its pool position, its own Lighter
account, and share holders on redemption. The keeper changes _shape_ (range,
hedge size, margin within cap); it cannot change _destination_.

## Repository layout (new repo `subway`)

```
subway/
  contracts/            Foundry (Solidity 0.8.28), fork tests vs chain 4663
    src/HedgedLPVault.sol               ERC-4626 + queue + epoch NAV
    src/VaultFactory.sol                pair registry, deploys vaults
    src/adapters/UniV4Adapter.sol       IPoolAdapter impl
    src/adapters/UniV3Adapter.sol       IPoolAdapter impl (Phase 1b)
    src/hedge/LighterRHHedge.sol        IZkLighter calls, key registration, exits
    src/policy/RangePolicy.sol          feed-bounded range checks
    src/oracle/HedgedShareOracle.sol    Morpho-compatible price of hX in USDG
    src/interfaces/{IPoolAdapter,IZkLighter,IHedgeVenue}.sol
    test/fork/*.t.sol                   Alchemy fork of 4663; ZkLighter live
  apps/web/             Next.js 15 (App Router), wagmi v2, viem, RainbowKit, Tailwind, shadcn/ui
  apps/keeper/          Node 22 TS: feeds, lp-manager, hedger, settler, accountant, api, alerts
  packages/sdk/         viem-typed ABIs (wagmi CLI codegen), chain def, addresses, zod schemas
  packages/indexer/     Ponder project: vault/pool/Lighter events → Postgres
  deploy/               Docker, Terraform (GCP us-east4), secrets layout
```

## Contracts

### `VaultFactory`

- Pair registry: stock token, USDG, pool key and fee tier, Chainlink feed,
  Lighter market id and asset index, per-pair caps (TVL, max margin, max
  share of pool TVL). Deploys one `HedgedLPVault` per pair. Owner-multisig
  can add pairs and pause deposits; it can never move vault funds.

### `HedgedLPVault` (ERC-4626, one per pair)

Roles: `keeper` (bounded operator, rotatable by the factory owner),
`guardian` (protocol multisig, **panic-only**). No per-user roles: holders
interact only through the 4626 surface and the queue.

Holder surface:

- `deposit(stockAmt, usdgAmt, receiver)` — dual-asset deposit valued at the
  Chainlink feed; mints shares at the **floor NAV**. Single-asset deposits
  allowed; the keeper rebalances the mix at the next range move. Permit2 for
  approvals.
- `requestRedeem(shares)` → burns into a queue slot with the current epoch
  id. `claim(slot)` after `settleEpoch` pays USDG (default) or pro-rata
  stock+USDG (holder's choice at request time).
- Standard 4626 reads. `convertToAssets` returns the **floor**; `previewRedeem`
  returns the floor and the UI explains the queue.

Keeper surface (each call checked against on-chain policy):

- `openRange`, `closeRange`, `rebalance` via `IPoolAdapter`. `RangePolicy`
  requires: feed fresh (`updatedAt` within the pair's max age), feed not
  paused, range straddles the feed price, width within bounds, no open in a
  blocked window.
- `collectFees` — fees stay in the vault (auto-compound is a policy flag).
- `fundHedge(amount)` → `ZkLighter.deposit(to = address(this), USDG …)`,
  capped at `maxMargin` and recorded in the vault's margin ledger.
- `registerHedgeKey(pubKey)` → `ZkLighter.changePubKey` (`msg.sender` must be
  the account's L1 address, i.e. the vault). One active key; rotation emits
  an event.
- `withdrawHedge(amount)` — secure withdrawal, lands at the vault, debits the
  margin ledger.
- `settleEpoch(attestation)` — snapshots floor NAV, advances the epoch,
  processes the redemption queue against idle balances (the keeper must have
  withdrawn enough from Lighter and closed enough range first; the call
  reverts if idle balances cannot cover the queue).

Panic (guardian or keeper; always callable):

- `panic()` — pull liquidity, `cancelAllOrders` and `withdraw` on ZkLighter
  via the L1 priority path, freeze keeper, open a **holder-callable**
  `emergencyRedeem` that pays pro-rata idle balances plus a claim on the
  matured Lighter withdrawal. Nobody needs the keeper to leave.

Invariants pinned by tests:

1. No function moves tokens anywhere except the vault, its pool position,
   its own Lighter account, or a share holder on claim/emergency redeem.
2. `convertToAssets` never reads the pool tick or any keeper-supplied value.
3. Keeper cannot register a key when frozen, exceed `maxMargin`, open a range
   that violates `RangePolicy`, or settle an epoch the queue cannot be paid
   from.
4. `panic()` leaves the vault in a state from which every holder can exit
   without the keeper.

### `HedgedShareOracle`

Returns `convertToAssets(1e18)` in USDG with a staleness check on the
underlying Chainlink feed. Intended for a Morpho Blue market
(`hAMC` collateral, USDG loan, low LLTV). Because the floor treats unsettled
hedge PnL as zero and haircuts margin, the only way it can overstate is a
Chainlink feed error, which is the same risk the lender already carries.

### `LighterRHHedge`

Wraps the four ZkLighter calls with the RH escrow address and asset indices.
Stock tokens are accepted as Lighter collateral; a later policy flag lets the
vault post withdrawn stock inventory as margin for the same-name short. MVP
uses USDG margin only.

### What the contract cannot see

Rollup state. The vault cannot verify hedge size or side. The mitigation is
the bounded margin ledger (`maxMargin` ≈ hedge notional / 3x), the floor NAV
that already assumes the margin is at risk, and the panic path. This is the
residual trust surface and the frontend states it plainly.

## Keeper (`apps/keeper`)

One process per environment, one worker per vault. Modules, each with a
single job:

| Module       | Job                                                                                                                                                                                                                                                                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `feeds`      | Chainlink feed reads (staleness and paused aware), Lighter RH WS mid for the hedge market, optional Alpaca SIP during RTH as a faster head. Publishes one `fair` per pair with a source tag.                                                                                                                                                       |
| `lp-manager` | In-range state from `StateView`; apply the pair's `RangePolicy` (recenter when fair leaves the inner band, widen on high realised vol, pull before US open / over weekends / earnings); submit `rebalance` txs through a bounded L1 signer. Rebalances the stock/USDG mix after single-asset deposits.                                             |
| `hedger`     | LP delta = stock tokens currently in the position (token amount at current tick from `StateView`); target short = −delta × hedgeRatio; trade only when \|target − current\| > band; IOC on Lighter with the vault's trade-only key; funding monitor that unwinds when 8h funding > cap and flags the vault; margin top-up/down inside `maxMargin`. |
| `settler`    | Epoch clock. Before `settleEpoch`: size the redemption queue, reduce range and hedge pro rata, secure-withdraw realised PnL and queue cover to the vault, wait for maturity, then call `settleEpoch` with the attestation (Lighter-side equity, fills, funding).                                                                                   |
| `accountant` | Fees, IL vs hold, hedge PnL and funding from Lighter fills, gas; NAV (floor and attested) per vault; feeds the API and the dispute check (attested vs floor drift).                                                                                                                                                                                |
| `keys`       | Lighter API key per vault in GCP Secret Manager; L1 keeper signer in KMS; rotation runbook.                                                                                                                                                                                                                                                        |
| `api`        | Read-only HTTP for the web app: vault stats, NAV history, queue state, per-holder positions by address. Writes do not exist; state changes are on-chain.                                                                                                                                                                                           |
| `alerts`     | Telegram on: feed stale > N min while in range, hedge band breach > M min, margin ratio < floor, attested NAV below floor (impossible unless the ledger is wrong), Lighter API errors, keeper signer balance low, queue cover shortfall before an epoch.                                                                                           |

Storage: Postgres (Ponder-indexed on-chain events plus keeper tables: hedge
fills, NAV snapshots, decisions log). No Redis at MVP.

Placement: GCP `us-east4` (near the RH sequencer and Lighter RH). Latency is
not the edge here; the band hedge tolerates seconds.

## Web app (`apps/web`)

Stack: Next.js 15 App Router, TypeScript, wagmi v2 + viem 2, RainbowKit
(WalletConnect/Reown project id required; Robinhood Wallet connects over
WalletConnect), TanStack Query (bundled with wagmi), Tailwind + shadcn/ui,
zod for API payloads, wagmi CLI for ABI codegen from `contracts/out`.

Chain definition: viem does not ship Robinhood mainnet at research time.
Define it in `packages/sdk/chain.ts` (`id: 4663`, Alchemy + public RPCs,
Blockscout explorer, `multicall3` if deployed) and pass it to both wagmi's
`createConfig` and RainbowKit. Testnet `46630` under an env flag.

Routes:

- `/` — connect, jurisdiction gate (geo + self-attestation; stock tokens are
  not offered to US/UK/CA/CH persons), vault list: pair, TVL, trailing fee
  APR, hedge ratio, floor NAV vs attested NAV, queue depth, next epoch.
- `/vault/[pair]` — deposit panel (stock, USDG or both; shows shares at
  floor NAV and the "floor undervalues you slightly" note), redeem panel
  (request → queued → claimable, with the epoch timer and the honest
  Lighter-withdrawal wait copy), position view (range vs feed, delta and
  hedge ratio, fees, IL, hedge PnL, funding), decisions log, "use as
  collateral" link to the Morpho market when live.
- `/portfolio` — the connected address's shares across vaults, queue slots,
  claimables.

Transaction UX: deposit = one Permit2 signature + one tx; redeem = one tx to
request, one to claim. The app never holds keys. Optional Phase 4:
ERC-4337/7702 with Alchemy Gas Manager to sponsor `claim` and
`emergencyRedeem` so a holder with zero ETH can always leave.

## Policies (defaults per pair; factory owner sets, changes are timelocked)

| Policy         | Default                                                                                              | Why                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Range preset   | ±6% around feed, recenter at ±3% drift                                                               | survives intraday AMC/HOOD moves, still earns               |
| Feed staleness | hold rebalances if `updatedAt` > 2 h in RTH; off-hours use Lighter mid as fair, feed as sanity bound | Chainlink has no off-hours heartbeat                        |
| Open gap       | pull liquidity 15 min before US open, reopen 10 min after                                            | jumps through a range are the dominant LP loss              |
| Weekend        | pull liquidity Fri 20:00 ET → Sun 20:00 ET                                                           | no reference price, meme-driven flow                        |
| Hedge band     | rehedge when \|Δ\| > 10% of position notional                                                        | Lighter 300 ms delay and gas make per-fill hedging wasteful |
| Hedge leverage | 3x; top-up at 4x; alert at 5x; `h` = 0.35 in the floor                                               | AMC/HOOD gap risk                                           |
| Funding cap    | unhedge and alert if 8h funding > 0.1%                                                               | meme perps can price the hedge out                          |
| Earnings       | pull liquidity from close before to open after                                                       | gap risk                                                    |
| Epoch          | daily at 21:00 ET                                                                                    | after the close, before overnight                           |
| Caps           | vault ≤ 15% of pool TVL; `maxMargin` ≤ 40% of vault TVL                                              | fee dilution and unwind depth                               |

## Evidence gate (Phase 0) — go/no-go before any code beyond scaffolding

> **RUN 2026-09-16 — NO-GO on the three pairs below, direction UNGRADED.** A
> cheaper structural screen closed the question before the markout week:
> AMC/HOOD/MSTR are 0-for-3 on leg existence and hedge depth. Other names were
> NOT graded — no markouts have been run. See
> `research/2026-09-16-hedgeability-and-pool-screen.md` and
> the project README. The paragraph below is the ORIGINAL gate,
> kept because steps 2–3 above still reference its markout definitions.

The AMC/USDG evaluation from the research session: index the pool's swap
events, compute markouts at +1 s / +10 s / +60 s against the Lighter RH AMC
mid, split toxic vs benign flow, and grade fee income minus arb loss per unit
liquidity over one week including a weekend and two US opens. Run the same
for HOOD/USDG and MSTR/USDG. Reuse the Genesis recorder (`lighter-rh` venue,
add AMC/HOOD market ids) and the maker-replay markout definitions. **Go** if
net-of-toxicity fee yield exceeds funding plus gas by a margin that survives
a 50% fee decay. This gate reuses this repo's tooling; its report lands in
`research/` under the report contract.

## Phases

> **GATED — none started.** Phase 0 returned NO-GO on AMC/HOOD/MSTR and no
> economic grade for any other pair (see Current state).

1. **Contracts core (3 weeks).** Factory, vault with queue and epoch NAV,
   `UniV4Adapter`, `LighterRHHedge`, `RangePolicy`, `HedgedShareOracle`.
   Fork tests against live 4663 (Alchemy fork or Tenderly vnet as Sherwood
   did): deposit/mint at floor, range open/close with feed-bounded rejections,
   Lighter deposit → account creation → `changePubKey` → secure withdraw
   back to the vault, epoch settle with a queued redemption, `panic` and
   `emergencyRedeem` without the keeper. Resolve v3 addresses; `UniV3Adapter`
   if AMC/HOOD stay v3-dominant.
2. **Keeper on testnet/paper (2 weeks).** Feeds, lp-manager, hedger, settler
   against a dev vault. Confirm Lighter RH API reachability from `us-east4`
   (CloudFront fronting, Standard tier), account-index resolution for a
   contract address, deposit crediting time, secure-withdraw latency end to
   end, and the epoch cycle wall-clock. Ponder indexer and accountant.
3. **Web MVP (2 weeks).** Connect, jurisdiction gate, vault list, deposit,
   request/claim, portfolio. Testnet first, then mainnet behind an allowlist.
4. **Closed beta (3–4 weeks).** Own capital, AMC and HOOD vaults, $20–30K
   each, a handful of allowlisted holders. Grade on cash, not fee APR. Fix the
   unwind edge cases (Sherwood's open item: a both-side close with zero base
   amount may open the opposite side instead of no-oping). Measure floor vs
   attested NAV drift.
5. **Audit + collateral (after beta).** External audit; deploy the Morpho
   market with `HedgedShareOracle` at a conservative LLTV; gas sponsorship for
   exits; per-user isolation mode only if a large holder asks for it.

## Open questions (resolve in Phase 1–2; none blocks Phase 0)

- Does Lighter RH have a testnet instance on 46630? If not, Phase 2 runs on
  mainnet with dust.
- Uniswap v3 addresses on Robinhood Chain (factory, NPM, router).
- USDG ERC-2612 permit support (else Permit2 only).
- Lighter API access from a cloud IP without Robinhood Wallet: confirmed for
  mainnet SDK users; verify on the RH deployment from the keeper's PoP.
- Lighter minimum deposit and account-creation flow for a contract L1 owner
  (Sherwood's accounts 623/843 prove it works; pin the exact call sequence).
- Whether `changePubKey` from a contract needs any EIP-1271 path (it should
  not: the check is `msg.sender == account L1 address`).
- Morpho Blue on Robinhood Chain: which curators, and whether a custom
  oracle adapter is accepted for a new market.
- Legal wrapper for a pooled hedged-equity share offered to non-US users.

## Risks stated to holders (frontend copy, not fine print)

- The keeper can trade the hedge badly; it cannot move funds anywhere but
  this vault. Losses from a bad hedge are shared by all holders of this pair.
- Share price shown is a floor: unsettled hedge profit is counted as zero
  until the daily epoch, so the true value is usually a little higher.
- Redemptions settle at the next epoch. Lighter's escrow has no upgrade delay
  and three operators; exits take minutes normally and up to 14 days in the
  escape-hatch case.
- Fee yields shown are trailing 24 h and decay; hedging removes direction,
  not impermanent loss.
- Stock tokens are not available to US, UK, Canadian or Swiss persons.
