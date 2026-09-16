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
