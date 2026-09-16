# Subway

AMM liquidity provision on [Robinhood Chain](https://chain.robinhood.com)
(chain id `4663`), hedged or not, as two fungible tokens.

A pooled vault (`xAMC`) LPs a Robinhood Stock Token against USDG on
Uniswap. A second vault (`hAMC`) holds `xAMC` and hedges its delta with a
short on Lighter's Robinhood Chain perp instance, whose settlement contract
lives on the same chain and is owned by that vault. Holding `xAMC` is equity
beta plus fees; holding `hAMC` is roughly dollar-stable with an on-chain NAV
floor other protocols can price. Any ratio in between is a mix of the two.

> **Status: pre-launch research and contracts. Nothing is deployed, and no
> pair has been shown to be profitable.** The evidence gate in `research/`
> rejected the three pairs this project started from and has not yet cleared
> any replacement. Read [the verdict](#what-the-evidence-actually-says) before
> assuming the strategy works.

---

## Why this shape

**Shares are the product.** A pooled vault mints a fungible token that can be
posted as collateral, LP'd, or wrapped by other protocols. Per-user vaults
cannot produce that.

**The hedge is a second vault, not a flag.** Holders want both modes. A
per-holder hedged/unhedged flag inside one vault would make its shares
non-fungible, which destroys the collateral use that is the whole reason for
pooling. So the modes are two tokens, and "toggle hedge" is wrapping `xAMC`
into `hAMC` or unwrapping it — **no LP position is closed or reopened**.

**The unhedged vault ships first.** `xAMC` has no keeper trading risk, no
rollup dependency, no epochs and no redemption queue, and it measures fees
against toxic-flow loss with real capital. That measurement decides whether
either mode is worth running. `hAMC` is then a second contract rather than a
rewrite.

**Same-chain custody root.** Lighter RH is an app-specific rollup whose L1 is
Robinhood Chain, so the vault contract can be the L1 owner of the pair's
Lighter account. Lighter's own rules then do the custody work: secure
withdrawals land only at the L1 owner, L2 transfers and fast withdrawals need
the L1 owner's signature, and API keys carry no withdrawal scope. **The
keeper's key is trade-only by construction, not by policy.**

**Hedge netting.** One Lighter account per pair. Opposite flows across
depositors cancel before touching the perp book; one key to rotate, one margin
balance to bound.

## The hard problem: what is a share worth?

**`xAMC` has a much smaller version of this problem.** Everything the base
vault owns is on this chain: LP value at the Chainlink feed price, plus fees
the range has earned, plus idle balances. Nothing is hidden inside a rollup, so
nothing has to be haircut to zero, and withdrawals come straight out of the
range.

What it is _not_ is independent of the pool. The two legs are priced at the
feed, but how much of each a range is holding is decided by the pool's current
price — so moving the pool inside the range moves `convertToAssets` even with
the feed still. The feed bounds the damage, because the inventory is always
marked at an honest price rather than at a tick an attacker chose. It does not
eliminate it. How deposits should be priced in the face of that is still open;
see [`docs/a1-deposit-pricing.md`](docs/a1-deposit-pricing.md).

The problem belongs to `hAMC`. Everything it owns is priceable — it holds
`xAMC`, which prices itself — **except the hedge equity**, which lives inside
Lighter's rollup and cannot be read from this chain. So `navFloor()` is a
deliberate undervaluation built only from things the contract can verify:

```
floor = idle balances + xAMC value at the FEED price + margin × (1 − haircut)
```

with unsettled hedge PnL counted as **zero**. The error is one-directional: the
floor can be too low, never too high. A lender reading it is safe; a depositor
is paid slightly less than fair, which is the side to be wrong on.

Two consequences that look like bugs and are not:

- **Depositors mint at the floor.** Note which way that cuts: shares are
  `value × supply / floor`, so a _lower_ denominator mints _more_ shares. A
  depositor entering at a floor below true NAV is therefore mildly **over**paid,
  at the expense of the holders already in. An earlier version of this file
  claimed the opposite and drew a security argument from it; the argument does
  not hold, and pricing an `hAMC` mint is an open Track B problem rather than
  something the floor solves for free.
- **The price uses the Chainlink feed, never the pool tick.** A pool tick is
  something an attacker can move with capital; a share price built on one is a
  share price they can print.

## `xAMC` redeems synchronously; `hAMC` cannot

`xAMC` is **not** a compliant ERC-4626, and deliberately so. A slice of a
Uniswap range is stock _and_ USDG, so `redeem` returns two amounts; the
single-asset ERC-4626 exits revert pointing at it, and `mint`/`previewMint`/
`maxDeposit`/`maxMint`/`previewWithdraw` are absent. What is implemented is
ERC-20 plus the ERC-4626 _accounting_ views (`asset`, `totalAssets`,
`convertTo*`, `previewDeposit`, `previewRedeem`), because that is the part an
oracle or a lending market actually reads. Implementing the 4626 exit signature
and quietly paying two tokens would break every integrator that trusted the
return value.

A redeemer is paid their pro-rata slice of the position, and nobody else's
claim changes. Fees take an extra step to make that true: Uniswap v4 pays a
position's **entire** accrued fee balance to whoever changes its liquidity, no
matter how small the change, so the vault sweeps fees into itself _before_ it
divides anything and then splits them like any other idle balance. Without that
step a one-share redeemer would leave with every other holder's fees. There is
no cash buffer, because none is needed.

`hAMC` cannot do that. Lighter withdrawals take minutes normally and up to 14
days through the escape hatch, so a synchronous `redeem()` would either lie
about that or hold a buffer big enough to defeat the strategy. Its redemption
is **request → settle → claim**, in the shape ERC-7540 describes.

So `hAMC` implements ERC-20 and the ERC-4626 _accounting_ view (`asset`,
`totalAssets`, `convertTo*`, `previewDeposit`) and deliberately does **not**
implement `withdraw`/`redeem` — they revert pointing at the queue. Claiming
4626 and then blocking withdrawal is worse than not claiming it: an
integrator's `redeem()` would revert in production instead of at integration
time.

One constraint this creates: `hAMC` is capped at a fraction of `xAMC` supply
(default 50%), so a run on the hedged side cannot force the unhedged side out
of the pool at an epoch boundary.

## What the evidence actually says

`research/` holds the Phase 0 gate and its verdict
([full report](research/2026-09-16-hedgeability-and-pool-screen.md)).

A pair needs **two** legs: a registered stock token to LP, and a Lighter RH
perp deep enough to carry the hedge. Screened live on 2026-09-16, the three
pairs this project began with are **0-for-3**:

| Name | LP leg                                                    | Hedge leg                                                          |
| ---- | --------------------------------------------------------- | ------------------------------------------------------------------ |
| HOOD | **none** — absent from the Robinhood Stock Token registry | **none** — no Lighter RH market                                    |
| MSTR | registered, live pools                                    | **none** — no Lighter RH perp                                      |
| AMC  | registered                                                | perp exists, but does **$47K/24h on 115 trades** — a ~$1,880 vault |

The HOOD/USDG pools that make this idea look attractive trade
`0x32ac8c1d…`, which is **not** a Robinhood Stock Token — an anonymous
synthetic tracker minted by a vault at an oracle price. It follows HOOD to
~1%, so ticker and price checks both pass while the LP holds uncollateralised
issuer credit risk. This is why the screen classifies pool tokens **by
address**, never by symbol.

Of 194 registered tokens against 57 Lighter RH perps, **18 names clear the
hedge bar**. On a 15-minute pre-open window, three of them clear the pool-side
bars too — which says the direction is not structurally dead, and **nothing
about profitability**. No markouts have ever been run on a real window.

**Do not quote the APRs in that report as returns.** They are sub-hour
extrapolations. The bar is a week including a weekend and two US opens.

## Layout

```
contracts/          Foundry. Vaults, Router, VaultFactory, RangePolicy,
                    HedgedShareOracle, the Uniswap v4 adapter and its
                    share-math libraries.
research/           The Phase 0 evidence gate: probe (hedge depth),
                    scan (pool fee income), rank (the join), and the
                    dated report with its generated evidence.
tests/              Node tests for the research tooling. Fixtures only.
docs/plan.md        The full product plan, including the parts not built.
```

## Getting started

Requires Node ≥ 22, pnpm, and [Foundry](https://getfoundry.sh).

```bash
git clone --recurse-submodules https://github.com/EthWiz/subway.git
cd subway
pnpm install
pnpm run check      # format, lint, typecheck, node tests, contracts build + test
```

Contracts only:

```bash
forge test --root contracts -vv
```

The research tools hit live endpoints and are run by hand:

```bash
pnpm run research:probe                 # hedge depth per name, one round trip
pnpm run research:scan -- --minutes 15  # pool fee income from v3 swap logs
pnpm run research:rank                  # vault economics + the hedge×pool join
```

### A note on the public RPC

`rpc.mainnet.chain.robinhood.com` caps `eth_getLogs` at 10,000 matched logs —
which the chain-wide v3 Swap topic clears inside an hour at ~100 ms blocks —
and escalates under sustained load from 429 to a **403 block**. A full pool
scan is ~3,000 throttled round trips and takes ~25 minutes. A multi-day window
needs a paid endpoint. Pass `--gap-ms` to widen request spacing rather than
retrying a failed scan.

## Not built yet

Honest list, so nobody mistakes the scaffold for a product:

- **`HedgedVault` (`hAMC`)** — Track B, gated on the unhedged vault producing
  a real fee-vs-loss number. `SubwayVault.sol` in the tree is the _pre-stack_
  hedged vault: it owns the Uniswap position directly rather than holding
  `xAMC`, and it is neither deployed by the factory nor reachable through the
  Router. It is kept as the starting point for that work — the queue, epoch
  settlement, margin ledger and panic path all carry over — and should not be
  read as the current design.
- **The keeper** (feeds, range management, hedging, epoch settlement) — the
  contracts expose the surface it needs; the process does not exist.
- **The web app.**
- **The Uniswap v3 path.** `UniV4Adapter` is built and tested against Uniswap's
  real `PoolManager`; the v3 adapter is not, and the v3 periphery addresses on
  chain 4663 were never resolved. Note the mismatch: the **research scan is
  v3-only**, so every fee number in the report comes from v3 pools while the
  only working adapter is v4. Neither side of that is wrong; they have not been
  joined yet.
- **Deployment.** No addresses are pinned and no contract is deployed.
- **An audit.** None of this has been reviewed by anyone but its authors.

## Security

Unaudited, undeployed, and holding no funds. Please open an issue rather than
a PR for anything that looks like a vulnerability in the vault's money-movement
or NAV logic.

**Known unfixed, and blocking any deposit path a stranger can reach.** A
two-model review on 2026-09-16 found one blocker that is fixed (a redeemer
taking every holder's Uniswap fees) and one family — how a deposit should be
priced — that is now half fixed.

Fixed: the first deposit has a virtual-share offset, so the donation attack
costs the attacker rather than the victim, and `deposit` takes a `minShares`
floor.

Still open, and still the reason not to put third-party money through
`deposit`: the mint denominator moves with the pool's price inside the range,
so a deposit mints in value-space at the feed while a redemption pays a
physical slice, and the two agree only while the vault's mix matches the
feed's. Measured, the distortion is quadratic in the pool-vs-feed divergence
and capped by the range width — 1.79% on a ±6% range, 8.04% on a ±25% one. The
options, the measurements and a recommendation are in
[`docs/a1-deposit-pricing.md`](docs/a1-deposit-pricing.md); the history is in
[`docs/decisions.md`](docs/decisions.md).

The invariants the design rests on are stated and tested in
[`contracts/test/SubwayVault.t.sol`](contracts/test/SubwayVault.t.sol) and
[`contracts/test/UniV4Adapter.t.sol`](contracts/test/UniV4Adapter.t.sol) — the
latter against Uniswap's genuine `PoolManager`, not a mock of it:

1. Money only ever moves between a vault, its pool position, the hedged
   vault's own Lighter account, and a share holder. **No keeper or adapter
   path takes a recipient** — a holder may name a receiver for their own
   deposit or redemption, and nobody else can name one for them — and the
   Uniswap adapter holds no balance between calls
   — it settles from the vault straight to the pool and takes from the pool
   straight back.
2. `convertToAssets` never reads a keeper-supplied value, and prices every
   leg at the Chainlink feed rather than at the pool. It is **not** fully
   tick-independent: the pool's price decides what mix the range holds, so it
   moves the quantities even though it never sets the prices. Tested with a
   bound on how far, not with a claim that it cannot move.
3. The keeper cannot exceed `maxMargin`, open a range that violates
   `RangePolicy`, or settle an epoch the queue cannot be paid from.
4. `panic()` leaves every `hAMC` holder able to exit without the keeper — and
   `xAMC` has no state a holder can be trapped in at all.

## Licence

MIT. See [LICENSE](LICENSE).
