# `@subway/web`

The user-facing app from `docs/plan.md` § "Web app (`apps/web`)", scaffolded
against **mock data only**.

```bash
pnpm install
pnpm --filter @subway/web dev   # http://localhost:3000
```

## What is here

Next.js 15 (App Router), TypeScript, Tailwind v4. Three routes, shaped after
the two-vault stack (`docs/decisions.md`, two-vault-stack-20260916-131940Z):

| Route           | Shows                                                                   |
| --------------- | ----------------------------------------------------------------------- |
| `/`             | Jurisdiction gate, vault list, the pairs Phase 0 rejected               |
| `/vault/[pair]` | Hedged/unhedged toggle, mode-specific panels, position, decisions       |
| `/portfolio`    | xAMC and hAMC balances per pair, implied hedge ratio, queue, claimables |

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

## Theming

Components never name a raw colour. They use semantic tokens — `bg-panel`,
`border-line`, `text-ink-3`, `text-pos`, `bg-warn-soft` — defined in
`src/app/globals.css` and mapped into Tailwind through `@theme`.

**Light is the default and is what every visitor gets.** A complete dark
palette sits behind `:root[data-theme="dark"]`, so adding a toggle means
setting that attribute on `<html>` and nothing else. Nothing switches on the
operating system's `prefers-color-scheme` — light by default means light.

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
