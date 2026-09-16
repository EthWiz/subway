# `@subway/web`

The user-facing app from `docs/plan.md` § "Web app (`apps/web`)", scaffolded
against **mock data only**.

```bash
pnpm install
pnpm --filter @subway/web dev   # http://localhost:3000
```

## What is here

Next.js 15 (App Router), TypeScript, Tailwind v4, rendered with the Subway
design system. Four routes, shaped after the two-vault stack
(`docs/decisions.md`, two-vault-stack-20260916-131940Z):

| Route           | Shows                                                                   |
| --------------- | ----------------------------------------------------------------------- |
| `/`             | Jurisdiction gate, vault list, the pairs Phase 0 rejected               |
| `/vault/[pair]` | Hedged/unhedged toggle, mode-specific panels, position, decisions       |
| `/portfolio`    | xAMC and hAMC balances per pair, implied hedge ratio, queue, claimables |
| `/docs/[slug]`  | How the stack works, the two share tokens, fee APR, what is not built   |

The toggle is gated on `Router.hedgeAvailable(stock)` rather than on a reverted
transaction, and the two modes render genuinely different panels:

- **Unhedged (`xAMC`)** — dual-asset deposit, immediate dual-asset withdraw.
  `previewRedeemAmounts(shares)` is mirrored in `src/lib/mock.ts`, so the panel
  shows `(stockOut, usdgOut)` and never a single USDG figure. The single-asset
  exits revert `UseDualAssetRedeem`; showing one number would misrepresent the
  product. The mirror includes the range's **pending fees**, which `redeem`
  sweeps into the vault and divides across every holder before taking the
  redeemer's slice — omitting them understates every quote.

  Do not put an ERC-4626 badge on `xAMC`. The single-asset exits revert, and
  `mint`, `previewMint`, `maxDeposit`, `maxMint` and `previewWithdraw` do not
  exist.

- **Hedged (`hAMC`)** — mints at floor NAV with the "the floor undervalues you
  slightly" note; redeem is request → queued → claimable.

## The design system

`src/ds/` is the Subway design system, vendored from the `subway-design` skill
(`.claude/skills/subway-design/`). `src/ds/tokens/*.css` are copied **verbatim**
from the skill's `tokens/` — do not hand-edit them; re-copy on an upstream sync.
They are in `.prettierignore` for that reason, so a sync diffs against upstream
rather than against our formatter. The components in `src/ds/` are the skill's
JSX ported to TSX, with two documented adaptations: `Icon` resolves glyphs from
`/icons/` so it renders in a server component, and `TopNav` takes `next/link`
routes and carries class hooks for the responsive rules `globals.css` adds.

The one token file deliberately not copied is `tokens/fonts.css`: it pulls the
three families from the Google Fonts CDN with an `@import`, which blocks render.
`next/font/google` in `layout.tsx` loads the same families and publishes them as
`--ff-*`, which the `@theme` block re-exports under the names the tokens expect.

Components never name a raw colour, and neither do the pages. Every colour,
radius and typeface a Tailwind utility can reach is mapped to a system token
through `@theme` in `src/app/globals.css`, so a utility and a component cannot
disagree about what "surface" means. **Tailwind is for layout only** — grid,
flex, gap, spacing.

**Light is the default and is what every visitor gets.** The dark palette is
scoped to `.theme-dark`, so adding a toggle means putting that class on a
wrapper element and nothing else. Nothing switches on the operating system's
`prefers-color-scheme` — light by default means light.

## Docs

`/docs` is [fumadocs](https://fumadocs.dev), but only its content layer:
`fumadocs-core` + `fumadocs-mdx`, and deliberately **not** `fumadocs-ui`. The UI
package ships a full theme of its own, which would put a second visual language
in an app built on one design system. Pages render with Subway's own primitives
through `src/mdx-components.tsx`.

The versions are pinned and fragile. `fumadocs-core@16` peer-requires Next 16
and this app is on 15.5, so core is held at `15.8.5`. `fumadocs-mdx@14.x`
_declares_ support for core 15 but reaches for core 16's file layout and fails
at `ERR_MODULE_NOT_FOUND`; `13.0.8` is the newest that actually works against
core 15. Bump either one and check that `pnpm --filter @subway/web build` still
generates `.source/`.

Prose in `content/docs/*.mdx` imports live figures from `src/lib/mock.ts` rather
than restating them, so the docs cannot drift from what the app renders.

`.source/` is generated — by the `postinstall` script and by `next build` — and
gitignored. A fresh clone needs `pnpm install` before `typecheck` will pass.

## What is deliberately missing

No wagmi, viem, RainbowKit or WalletConnect. No `packages/sdk` chain definition
for 4663. No ABI codegen from `contracts/out`. None of it would have anything to
talk to: no contract is deployed and no addresses are pinned.

The connected address in the header is a constant. Every button that would send
a transaction is disabled and says why.

This app is not covered by the root ESLint config, which ignores `apps/**`.

## Where the numbers come from

`src/lib/mock.ts` is the single source. Pool addresses, fee tiers, fee APRs, TVL
ceilings and perp volumes are real, taken from
`research/generated/2026-09-16-phase0-ranking.json` — a single ~15-minute
pre-open window on 2026-09-16. Annualising that window yields very large APRs
(INTC screens at ~1709%); they are a screen, not a forecast, and the UI labels
them as extrapolated.

Everything else — vault TVL, NAV per share, reserves, hedge ratios, queue depth,
fees, arb loss, hedge PnL, funding, holdings — is invented.

Only INTC, META and SPCX appear, because those are the three names that cleared
both pool-side bars. The plan's original three pairs (AMC, HOOD, MSTR) failed
the gate and are listed on `/` with the reason.

`hedgeAvailable` is true for INTC only, so the Track B UI is reachable at all.
That is a **UI fixture, not a mirror of the contract**. `Router.hedgeAvailable`
is backed by a Track A constant and answers false for every pair — registering
a hedged vault does not change it — so the UI labels INTC's hedged mode as a
preview and says the contract answers false for that pair too.

## Next

Replace `src/lib/mock.ts` with wagmi reads once Track A deploys and pins
addresses. `previewRedeemAmounts` and `impliedHedgeRatio` are written to mirror
the contract surface, so the swap is a data-source change, not a redesign.
