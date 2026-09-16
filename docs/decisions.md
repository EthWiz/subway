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

> All four faces settled 2026-09-16. (3) and (4) by the virtual-shares entry
> below; (1) and (2) by the divergence gate, reviewed against the measured
> numbers in `docs/a1-deposit-pricing.md`.

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

> Settled 2026-09-16 by the entry below: the realised bounds come back from
> `openRange` and the vault re-validates them.

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

> Settled 2026-09-16: admin is mutable. See the A4 entry below.

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

---

## 2026-09-16 — Virtual shares and `minShares`, and the mint distortion measured

**Decided**, for the two halves of the entry above that needed no product
choice; the other two are narrowed rather than closed.

**Faces (3) and (4) are fixed.** `deposit` takes a `minShares` floor, and the
mint and the `convertTo*` views carry an OpenZeppelin-style virtual offset of
`10 ** (18 - usdgDecimals)` shares against one virtual USDG unit. The offset
was chosen over dead shares because it costs nobody anything: dead shares
require a real first deposit to be burned by someone, and leave a permanent
unredeemable slice of the vault.

Two things about it worth keeping. The virtual terms live **only in
value-space** — `redeem` and `previewRedeemAmounts` still divide the physical
contents by the REAL supply, because crediting phantom shares with real tokens
would leave the last holder unable to empty the vault. And the offset
incidentally makes `decimals()` honest: an 18-decimal share against a
6-decimal asset minting `shares = value` priced a whole share at $1,000,000
and `convertToAssets(1e18)` — what a lending market reads as price-per-share —
at $1e12. A whole share now opens at $1.

**Faces (1) and (2) are measured, not fixed.** Swept against the real
`PoolManager`, the NAV distortion from pool-vs-feed divergence is quadratic in
the divergence and capped by the range width: 1.79% for a ±6% range, 8.04% for
a ±25% one — which confirms the ~8.6% figure the entry above derived on paper.
At 0.5% divergence the residual is about 2 bps.

Two findings that change how the remaining decision should be argued:

- **The end-to-end attack currently loses money.** Shove the pool, let a victim
  deposit, shove it back, exit: the attacker is down $3.41 on a $2,000 victim
  deposit, because they must move the price through the vault's own liquidity
  and the fee is first order in the move while the distortion is second order.
  This is **not** a reason to relax: it holds only because the vault is the
  pool's sole LP in the test, and A6's vault-≤-15%-of-pool-TVL cap guarantees
  the opposite in production.
- **A divergence gate's ε cannot be tighter than the pool's fee tier**, because
  the no-arbitrage band is the fee tier. A 1% pool — what the scan found for
  HOOD/USDG — forces ε ≈ 1.2% and a residual near 11 bps.

**Revisit if:** the A1 recommendation in `docs/a1-deposit-pricing.md` is
reviewed and either adopted or replaced; or the single-asset-deposit
requirement is dropped, which would make minting from quantities win outright
and take A2's deposit half off the board with it.

---

## 2026-09-16 — `RangePolicy` binds the position, not the request

**Decided.** `IPoolAdapter.openRange` returns the realised bounds in vault
units and `BaseVault.openRange` re-validates them against the same feed price
the request was judged on. The alternative the plan offered — an explicit
rounding tolerance — was rejected: a tolerance is a second number to get right,
it has to be re-derived whenever tick spacing changes, and it still leaves the
bound checked against something other than the position.

Returned from the call rather than read back through a view, so the vault
validates the range that call opened rather than whatever is open by the time
it looks.

Two things this surfaced that are worth keeping:

- **The rounding only ever widens**, because `toAlignedTick` rounds outward so
  the realised range contains the request. So the second check can fail only as
  `RangeTooWide` — straddling and `minHalfWidth` cannot be broken by widening.
  That is what makes one extra check sufficient rather than a new policy.
- **The realised bounds must come back in stock-price order, not tick order.**
  When USDG sorts as currency0 the price axis inverts and `tickLower` is the
  HIGHER stock price, so an adapter returning them tick-first would hand the
  vault a reversed range on exactly the pool ordering the vault tests least.

**Cost, accepted:** the keeper needs headroom. A request at exactly
`maxHalfWidth` now always reverts and one within a tick spacing of it usually
will, so `lp-manager` (A7) must ask for less than the bound. Moving the problem
to the keeper is correct — the contract's job is to be sure, not to guess how
much slack the grid needs.

**Revisit if:** an adapter is added whose grid rounds inward, which would make
`RangeTooNarrow` reachable from the second check and invalidate the argument
that one check is enough.

---

## 2026-09-16 — Deposits are gated on pool-vs-feed divergence

**Decided**, after review of `docs/a1-deposit-pricing.md`. `deposit` reverts
while `|poolPriceWad − feed| / feed > ε`. This closes faces (1) and (2) of the
deposit-pricing entry above — value-space mint against quantity-space redeem,
and a mint denominator the pool can move.

**Why the gate and not minting from quantities.** Minting from quantities is
strictly safer: it reads no price at all, makes mint the exact inverse of
redeem, and would have taken A2's deposit half off the board with it. It lost
on one requirement — single-asset deposits — and the arithmetic that settled it
is that the gate's residual mispricing is _smaller than the alternative's cost
to the same depositor_. At ε = 0.5% on a 0.3% pool, a legal 0.44% divergence
costs a $2,000 depositor 1.8 bps, measured against the real `PoolManager`.
Minting from quantities would send that depositor to the pool to buy the other
leg, at 30–100 bps. Being told to pay 30 bps to avoid a 2 bps error is not
protection.

**ε is fenced from both sides, and the floor is the interesting one.** It
cannot be tighter than the pool's swap fee, because the fee IS the
no-arbitrage band: nobody closes a gap smaller than the fee they would pay to
close it, so a 0.3% pool sits anywhere within ±0.3% of fair with nobody
manipulating anything, and a 1% pool within ±1%. A gate tighter than that does
not catch attackers, it blocks depositors during ordinary pool behaviour — so
ε is per pair, floored at the fee tier, defaulting to fee + 20 bps. The ceiling
is `maxHalfWidth`: the distortion the gate bounds is itself capped by the range
width, so a wider gate never binds first and is not a gate.

**The gate is skipped when the vault holds no position.** Not a loophole: with
nothing in the pool, NAV is idle balances priced at the feed and has no pool
term in it. Gating anyway would block every deposit taken before the first
range opens, which is every deposit a vault starts life with.

**What it does not do.** It bounds the error; it does not remove it. Mint is
still value-space and redeem still quantity-space, and inside ε they still
disagree slightly — which is why `minShares` stays. It is also a liveness cost
in exactly the moments a depositor most wants in: deposits stop during genuine
volatility, when the pool leads the feed. Redemption is untouched throughout.

**Revisit if:** the single-asset-deposit requirement is dropped, which flips
the answer to minting from quantities; a pair is listed on a fee tier wide
enough that `fee + 20 bps` admits a residual the label cannot honestly state;
or A2 decides to accept a frozen off-hours feed, since divergence against a
stale mark grows with real news and will block most overnight deposits — which
is arguably correct, and makes A2 option (b) collapse into option (a).

---

## 2026-09-16 — Vault admin is mutable, and policy changes are timelocked

**Decided.** `BaseVault.admin` becomes mutable via `setAdmin`, callable only by
the current admin; and `setBounds` becomes `proposeBounds` → `boundsDelay` →
`applyBounds`, with `cancelBounds`.

**On mutability**, against the entry above that left it open. The immutability
was deliberate — an admin that can be reassigned is one an attacker can
reassign — but the defending side of that trade is worth more here: the role
cannot move funds, so what an attacker gains by capturing it is the ability to
zero the keeper or jam the policy, while what a defender loses by being unable
to rotate is the same thing permanently. No two-step handshake, for the same
reason: handing the role to a typo costs a vault frozen at its current keeper
and policy, which is recoverable by redeploying and is never anyone's money.
`address(0)` is refused, since that is the one typo that cannot be undone.

**On the timelock.** This document always said policy changes were timelocked
and the code always changed them in the same block. A keeper bound that can be
widened in the block it is exceeded constrains nothing, and the entire argument
for letting a keeper touch the position is that `RangePolicy` fences it in. The
delay buys holders time to leave — and leaving needs no admin, no keeper and no
feed, so a proposal a holder dislikes is an exit they can always take.

`boundsDelay` is **immutable**: a timelock the admin can shorten is one they can
shorten to zero in the same transaction as the change it was meant to delay.
`applyBounds` is callable by **anyone**, because the admin already decided and
there is nothing left for a stranger to choose; making the admin show up twice
is a liveness dependency for no gain.

**Known gap:** nothing enforces a nonzero `boundsDelay`. A contract minimum
would block testnet, so this is a deploy-path check (A11's CI) rather than a
constructor revert. It is a public immutable, so it can be read and displayed.

**Revisit if:** the admin key becomes anything other than a single operator
wallet — a multisig or a governance contract changes both halves of this, since
a contract admin can hold its own delay and a two-step handshake stops being
pure cost.

---

## 2026-09-16 — Pause and caps are immediate; the share cap counts ACTIVE liquidity

**Decided.** `BaseVault` gains `setDepositsPaused`, `maxTotalAssets` and
`maxPoolShare` (A6). Three choices in there are worth recording.

**They are not timelocked, while `bounds` is.** The bounds timelock exists for
one specific shape of problem: a keeper limit that can be widened in the block
it is exceeded never said no to anything. Neither a pause nor a cap has that
shape. A pause only ever refuses new money, so delaying it delays the brake and
not the risk; lowering a cap is likewise a brake; raising a cap lets in money
that dilutes nobody, since new shares are priced at NAV. Timelocking them would
buy holders nothing and cost the operator the ability to react.

**The share cap counts the pool's ACTIVE liquidity, not its TVL.** The plan
said "vault ≤ 15% of pool TVL", and TVL is the wrong denominator: fees are
split among the liquidity in range, so it is the share of THAT which decides
whether the vault is diluting its own fee take and whether the depth it would
unwind into is really there. Checked in `openRange` after the position is
placed, so the denominator includes it. Deposits are not gated on it — the cap
is about how much of itself the vault puts in the pool, and gating deposits
would mean a vault over the line stops working rather than simply stops adding.

**Zero is refused on both caps.** A zero NAV ceiling reads as "unlimited" on
one deployment and "closed" on another depending on who is guessing;
`type(uint256).max` says "none" and cannot be misread.

**Consequence: the test fixture changed, and it should have changed earlier.**
The suite made the vault the pool's only liquidity, which the share cap now
forbids outright — and which had been flattering every economic result in it,
because every fee an attacker paid came straight back to the vault under test.
That is precisely the caveat `docs/a1-deposit-pricing.md` flagged and could not
then test. There is now a background `LiquidityProvider` and the vault sits at
~10% of the pool. A1's residual measurement survived unchanged at 1.85 bps,
which is worth knowing: the mint distortion at a given divergence is a property
of the range, not of who else is in the pool.

**Revisit if:** a pair's pool has liquidity concentrated far from the feed
price, where active liquidity at the current tick is a poor proxy for the depth
an unwind would actually find.

---

## 2026-09-16 — Feed staleness is 26 h, and the divergence gate is the off-hours check

**Decided**, from chain reads rather than the feeds page. `research/feed-offhours.ts`
sampled all 35 Robinhood equity feeds at twelve points across the 11–15 Sep
weekend and reconstructed five feeds' update cadence at 30-minute resolution.

**What the feeds actually do.** One heartbeat print at 00:00 UTC (20:00 ET) on
weekdays; otherwise deviation-only at 0.5%. Weekday overnight updates happen.
Nothing prints from the last Friday deviation print until Sunday 20:00 ET, so
by Sunday noon every feed is 36–47 h old. `oraclePaused()` stayed false
throughout. The fixed-facts table used to say "no heartbeat off-hours", which
was true of the weekend and false of weekday nights, and it missed the thing
that matters more: **there is no time-based heartbeat under 24 h at all**.
SPY printed five times in four days. Even mid-RTH only 23–31 of 35 feeds were
under two hours old.

**Why the old default was wrong.** `maxFeedAge` = 2 h treats a deviation feed
as if it were a heartbeat feed. A feed that has not printed for three hours is
reporting that the price has not moved 0.5% — that is information, not
staleness — and the old bound would have refused deposits on a third of names
in the middle of the trading day.

**The decision.** `maxFeedAge` = 26 h: the weekday heartbeat plus slack. That
bounds the mark to one session on weekdays and, because the heartbeat does not
run on weekends, blocks deposits by age from roughly Saturday 22:00 ET until the
Sunday-evening reopen. Inside that bound the **divergence gate** is the live
check: off-hours the pool is the only live price and the feed the only sane
one, and a deposit is refused exactly when they disagree by more than ε. The
plan's option (a), deposits only while the feed is "live", was rejected because
the feed is live for two thirds of the week and a 2 h test cannot tell.

**What this does not fix.** A stale-but-converged weekend: pool and Friday
print agree, deposit lands, Monday gaps. The depositor bought at Friday's price
into a position that will reprice at the open — the same bet every LP in the
pool is making, and the label says so. Also, holidays: no 00:00 UTC print on a
weekday holiday means deposits block the following evening; correct, if
surprising, and worth an alert (A7).

**Revisit if:** Chainlink changes the heartbeat or deviation on these feeds
(both are in the committed directory snapshot to diff against); a feed is
observed printing on a weekend; or a pair is listed whose feed has a wider
deviation than ε, at which point the gate is doing the feed's job.
