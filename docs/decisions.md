# Decisions

Append and compact; never rewrite. An entry that contradicts current code is
usually the most valuable line in the file — it records what we used to
believe. A reversed decision gets a **new** entry and the old one compacts to
one line naming the belief that proved false.

Each entry carries a `Revisit if:` line. Without one, a decision is either
frozen forever or permanently arguable.

---

## 2026-09-16 — Two-vault stack instead of one hedged vault

**Decision.** Replace the single hedged ERC-4626 per pair with a stack: an
unhedged base vault (`xAMC`) that is the only contract touching Uniswap, and a
hedged wrapper (`hAMC`) that holds `xAMC` shares and owns the pair's Lighter
account. One `Router` fronts both with a `hedged` flag. `xAMC` ships first;
`hAMC` is Phase 3.

**Why.** Three reasons, in order of weight:

1. **A per-holder hedge flag would make shares non-fungible.** Holders want
   both modes, but if "hedged" is a property of a position inside one vault,
   the vault's shares stop being interchangeable — which destroys the
   collateral use that is the entire reason for pooling rather than running
   per-user vaults. Two tokens keep both modes and both fungible, and any hedge
   ratio becomes a mix of the two.
2. **The unhedged vault answers the only question that matters, with less
   risk.** Whether concentrated LP on these pools earns more in fees than it
   loses to arbitrage decides both modes. `xAMC` measures it with real capital
   while carrying no keeper trading risk, no rollup dependency, no epoch clock
   and no redemption queue.
3. **`hAMC` becomes an addition rather than a rewrite**, and hedge netting
   across holders still happens in one Lighter account.

**What it costs.** Two contracts instead of one, a wrap/unwrap step in the UX
(hidden behind the Router), and a new failure mode: a run on the hedged side
could force the base vault out of the pool at an epoch, with unhedged holders
— who took no keeper risk — paying for it. Mitigated by capping `hAMC` at a
fraction of `xAMC` supply (default 50%).

**Not the reason.** The Phase 0 screen said nothing about vault shape. It
falsified the candidate pair list, not the product.

**Revisit if:** the fungibility argument stops binding — no collateral
integration materialises and nobody wraps the share — in which case one vault
with a flag is simpler and should win. Also revisit if the 50% cap turns out
to bind often enough to make the hedged side unusable.

**Source:** handoff `two-vault-stack-20260916-131940Z`, operator-confirmed.

---

## 2026-09-16 — Hold v4 liquidity directly, not through PositionManager

**Decision.** `UniV4Adapter` is its own position owner inside the Uniswap v4
`PoolManager`, via `unlock` + `modifyLiquidity`. No ERC-721 position token, no
`PositionManager`, no Permit2.

**Why.** The vault owns exactly one range and never transfers it, so the NFT
wrapper buys nothing and adds two contracts to the trust path. Going direct
also makes the adapter a pure conduit: it settles from the vault straight to
the `PoolManager` and takes from the pool straight back to the vault, so it
holds no balance between calls and there is no recipient parameter anywhere.
That is what lets the vault's money-movement invariant survive the AMM leg.

**Revisit if:** a design needs the position to be transferable or held by
something other than the vault (for example posting the LP position itself as
collateral), or if a future adapter targets a hook pool whose position
accounting lives in the periphery.

**Revisit if:** v4-core's `modifyLiquidity` or settlement interface changes
shape in a way that makes the periphery the only maintained path.

---

## 2026-09-16 — Test against the real `PoolManager`, loaded as an artifact

**Decision.** Adapter tests deploy Uniswap's genuine `PoolManager` bytecode
with `vm.deployCode`, rather than importing it or mocking the AMM.
`test/v4/Artifacts.sol` exists solely to make the compiler emit that artifact.

**Why.** `PoolManager` pins `pragma 0.8.26` and this repo pins `0.8.28`; solc
will not put two exact pragmas in one compilation unit. The options were to
relax our own pragma, or to load the artifact. Loading it keeps our production
pragma exact and still tests against the real contract — an adapter whose only
counterparty in tests is a mock AMM has been tested against the author's belief
about Uniswap, not against Uniswap. The tick-alignment containment bug that the
fuzz tests caught is the kind of thing a mock would have agreed with.

**Revisit if:** a fork test against live chain 4663 replaces the locally
deployed manager, or v4-core's pragma catches up with ours and a plain import
works.

---

## 2026-09-16 — Fees are swept before anything is divided

**Decision.** `BaseVault.redeem` calls `IPoolAdapter.collectFees()` before it
computes anyone's slice, and `totalAssets` counts `pendingFees()`. The adapter
exposes pending fees as a readable quantity rather than leaving them implicit
in the position.

**Why.** Uniswap v4 pays a position's **entire** accrued fee balance to whoever
changes its liquidity, however small the change: `Pool.modifyLiquidity` computes
`feesOwed` against the position's whole pre-change liquidity, and `PoolManager`
returns `principalDelta + feesAccrued` as one number. A vault that takes a
pro-rata slice of _liquidity_ therefore does **not** take a pro-rata slice of
_fees_ — the first redeemer after any fee-earning period takes all of them, and
one share is enough to do it. This plan and this repo's README both asserted the
opposite for a week; the belief that proved false was "removing x% of the
liquidity removes x% of the fees".

The same omission ran the other way on the mint side: `positionAmounts()` is
principal-only, so a NAV that excluded pending fees let a new depositor buy in
against an understated denominator and take a slice of yield they had not
earned.

**Cost.** An extra `unlock`/poke on every redemption. Paid deliberately:
the alternative is tracking fee growth in the vault and reimplementing
`Position.update`, which is more code in exactly the place least able to
afford a mistake.

**Revisit if:** a v4 release lets a caller remove liquidity without realising
fees, or the gas of the poke becomes material next to the redemption itself.

---

## 2026-09-16 — OPEN: how a deposit should be priced

**Not decided.** Recorded so it is not mistaken for settled. Two reviewers
(codex, grok) independently found the same family of problem in `BaseVault`,
and it is one question with several faces:

1. **Deposits mint in value-space; redemptions pay in quantity-space.** A
   deposit is valued at the Chainlink feed, while a redemption hands over a
   physical slice of what the vault holds. Those agree only while the vault's
   mix matches the feed's. After the pool moves inside the range they diverge,
   and the gap is capturable by depositing and immediately redeeming.
2. **The mint denominator is pool-movable.** `totalAssets` prices legs at the
   feed, but the _quantities_ come from `positionAmounts`, which reads the
   pool's current price to decide the mix. Moving the pool inside the range and
   back moves the NAV a deposit is priced against. Roughly ±8.6% for a ±25%
   range, per codex's arithmetic; the repo's own test allows 2% and calls it
   "does not track the tick", which is weaker than the README used to claim.
3. **First-deposit inflation.** `shares = value` when supply is zero, with no
   virtual offset and no dead shares. Concretely: deposit 1 raw USDG unit,
   donate 59,999,999, let a victim deposit $100 for one share, redeem $80 on a
   $60 outlay. `NothingToMint` blocks the zero-share form and nothing else.
4. **No slippage bound.** `deposit` has no `minShares`, so a depositor cannot
   defend against any of the above even in principle.

**Why it is open rather than fixed.** Each plausible fix — virtual
shares/dead shares, minting from quantities rather than value, a
feed-vs-pool divergence gate on deposits, a `minShares` parameter — changes
the economics of the product, not just its code, and some of them trade
against each other. Picking one in a review pass would be choosing the
product's shape by accident.

**Revisit if:** before any deposit path is exposed to a third party, and
certainly before deployment. This is a ship blocker, not a backlog item.

---

## 2026-09-16 — OPEN: `SubwayVault` is a Phase 3 seed with known defects

**Not decided.** `SubwayVault.sol` is the pre-stack hedged vault, wired into
neither the factory nor the Router. Reviewers found real bugs in it. They are
recorded here rather than fixed, because fixing them _is_ the Phase 3 work of
retargeting the contract to hold `xAMC`:

- **Minting at the floor dilutes existing holders.** `shares = value × supply /
navFloor()`, and a floor below true NAV is a _smaller_ denominator, so it
  mints _more_ shares. Worked example: Alice deposits $10,000 with $4,000
  margined at a 35% haircut, floor $8,600; Bob deposits $8,600 and receives as
  many shares as Alice; when the margin returns, Bob holds $9,300. $700 moved
  from Alice to Bob. Conservative _collateral_ valuation and _issuance_ pricing
  are not the same number and this vault used one for both.
- **Queued holders can be wiped out by a panic.** `requestRedeem` burns shares
  into `pendingShares`, but `emergencyRedeem` divides by circulating
  `totalSupply` and reserves only already-settled claims, so an unqueued holder
  can take the whole vault while a queued one cannot settle — `onlyKeeper`
  rejects settlement while frozen.
- **`panic()` discards the claim on delayed Lighter proceeds.**
  `emergencyRedeem` burns against balances physically present and creates no
  claim on funds still in flight, so early redeemers forfeit their margin
  entitlement to whoever is left — and if everyone exits before maturity, the
  arriving funds have no outstanding claim at all. `MockLighter` pays
  synchronously, which is exactly why the tests do not show this.

**Revisit if:** Phase 3 starts, or `SubwayVault.sol` is ever deployed,
imported by something reachable, or read as the current design. If Phase 3
slips much further, delete the file instead — git keeps it.

---

## 2026-09-16 — OPEN: tick alignment can widen a range past its approved bound

**Not decided.** `BaseVault.openRange` validates the keeper's requested prices
against `RangePolicy`, and `UniV4Adapter._ticksFor` then rounds the lower tick
down and the upper tick up onto the spacing grid. Rounding outward can push the
realised half-width past `maxHalfWidth` — with a $200 feed, a requested
$150–$250 at 25% max and spacing 60, the realised range is about
$149.33–$250.17, whose narrow side already exceeds the bound that approved it.

The policy is a safety bound, so the position rather than the request should
have to satisfy it. Left open because the fix needs the adapter to report its
realised bounds back in vault units and the vault to re-validate, and it is
worth doing once alongside the deposit-pricing work above rather than twice.

**Revisit if:** a keeper is given a live range, or `maxHalfWidth` is ever
relied on as a risk limit rather than a sanity check.

---

## 2026-09-16 — OPEN: rotating the factory owner does not rotate vault admin

**Not decided.** `VaultFactory.setOwner` moves the factory's owner, but each
`BaseVault` was constructed with `admin` as an **immutable** set to whoever
owned the factory at `addPair` time. So rotating a compromised factory key
leaves `setKeeper` and `setBounds` on every live vault with the old key. That
admin cannot move funds — the vault's safety argument does not rest on it — but
it can zero the keeper or jam the range policy, which is enough to stop a vault
working.

The immutability is deliberate: an admin that can be reassigned is an admin
that can be reassigned _by an attacker_. Making it mutable, walking the vault
list on rotation, and simply documenting the limitation are all defensible, and
the choice depends on who ends up holding the key.

**Revisit if:** a vault is deployed with a real admin key, or the factory owner
becomes anything other than a single operator wallet.
