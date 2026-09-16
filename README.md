# Subway

Delta-hedged AMM liquidity provision on [Robinhood Chain](https://chain.robinhood.com) (chain id `4663`).

A pooled ERC-4626-shaped vault LPs a Robinhood Stock Token against USDG on
Uniswap and hedges the resulting delta with a short on Lighter's Robinhood
Chain perp instance, whose settlement contract lives on the same chain and is
owned by the vault. Depositors hold a fungible share whose value is roughly
dollar-stable, with an on-chain NAV floor that other protocols can price.

> **Status: pre-launch research and contracts. Nothing is deployed, and no
> pair has been shown to be profitable.** The evidence gate in `research/`
> rejected the three pairs this project started from and has not yet cleared
> any replacement. Read [the verdict](#what-the-evidence-actually-says) before
> assuming the strategy works.

---

## Why this shape

**Shares are the product.** A pooled vault mints `subAAPL`, `subMETA`, … whose
value is roughly dollar-stable because the position is delta-hedged. That token
can be posted as collateral, LP'd, or wrapped by other protocols. Per-user
vaults cannot produce that.

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

Everything the vault owns is on-chain and priceable **except the hedge equity**,
which lives inside Lighter's rollup and cannot be read from this chain. So
`navFloor()` is a deliberate undervaluation built only from things the contract
can verify:

```
floor = idle balances + LP value at the FEED price + margin × (1 − haircut)
```

with unsettled hedge PnL counted as **zero**. The error is one-directional: the
floor can be too low, never too high. A lender reading it is safe; a depositor
is paid slightly less than fair, which is the side to be wrong on.

Two consequences that look like bugs and are not:

- **Depositors mint at the floor**, so they are mildly underpaid. That
  asymmetry is exactly what makes a deposit-time manipulation pointless.
- **The price uses the Chainlink feed, never the pool tick.** A pool tick is
  something an attacker can move with capital; a share price built on one is a
  share price they can print.

## Redemption is asynchronous — this is not a compliant ERC-4626

Lighter withdrawals take minutes normally and up to 14 days through the escape
hatch. A synchronous `redeem()` would either lie about that or hold a cash
buffer big enough to defeat the strategy. Redemption is therefore
**request → settle → claim**, in the shape ERC-7540 describes.

The vault implements ERC-20 and the ERC-4626 _accounting_ view (`asset`,
`totalAssets`, `convertTo*`, `previewDeposit`) and deliberately does **not**
implement `withdraw`/`redeem` — they revert pointing at the queue. Claiming
4626 and then blocking withdrawal is worse than not claiming it: an
integrator's `redeem()` would revert in production instead of at integration
time.

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
contracts/          Foundry. SubwayVault, VaultFactory, RangePolicy,
                    HedgedShareOracle, adapters and interfaces.
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

- **The keeper** (feeds, range management, hedging, epoch settlement) — the
  contracts expose the surface it needs; the process does not exist.
- **The web app.**
- **The Uniswap v4 path.** The scan and adapters are v3-only; v4 keeps
  positions inside a singleton PoolManager and needs a separate discovery and
  valuation path. v4 fee income is missing from every number here.
- **Deployment.** No addresses are pinned, no contract is deployed, and the
  Uniswap v3 periphery addresses on chain 4663 were never resolved — the
  adapter takes them by constructor for that reason.
- **An audit.** None of this has been reviewed by anyone but its authors.

## Security

Unaudited, undeployed, and holding no funds. Please open an issue rather than
a PR for anything that looks like a vulnerability in the vault's money-movement
or NAV logic.

The invariants the design rests on are stated and tested in
[`contracts/test/SubwayVault.t.sol`](contracts/test/SubwayVault.t.sol):

1. Money only ever moves between the vault, its pool position, its own Lighter
   account, and a share holder. **No vault entry point takes a recipient.**
2. `convertToAssets` never reads the pool tick or a keeper-supplied value.
3. The keeper cannot exceed `maxMargin`, open a range that violates
   `RangePolicy`, or settle an epoch the queue cannot be paid from.
4. `panic()` leaves every holder able to exit without the keeper.

## Licence

MIT. See [LICENSE](LICENSE).
