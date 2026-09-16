# Subway app — UI kit

Recreation of the product surfaces described in `docs/plan.md` → "Web app (`apps/web`)" of
[EthWiz/subway](https://github.com/EthWiz/subway). **The repository contains no frontend code** —
`apps/web` is listed under "Not built yet" — so these screens are built from the written route spec,
the stated holder copy and the policy tables, not from an existing implementation. Layout and visual
language are this design system's; the information architecture is the repo's.

| File | Surface | Source in repo |
| --- | --- | --- |
| `index.html` | Click-through app shell and router | `docs/plan.md` → Web app → Routes |
| `Shell.jsx` | `TopNav` frame, page header, jurisdiction gate | Routes → `/` connect + jurisdiction gate |
| `VaultList.jsx` | `/` vault list: pair, TVL, fee APR, hedge depth, share price, state | Routes → `/` |
| `VaultDetail.jsx` | `/vault/[pair]`: hedged/unhedged toggle, range vs feed, position, policy, queue, decisions log, deposit/redeem panel | Routes → `/vault/[pair]`, Policies table |
| `Portfolio.jsx` | `/portfolio`: both share balances, implied hedge ratio, queue slots, claimables | Routes → `/portfolio` |
| `data.js` | Fixture data — pairs, positions, queue, keeper log | `research/2026-09-16-hedgeability-and-pool-screen.md` verdicts |

Interactions that work: connect → jurisdiction attestation → vault row → hedged/unhedged switch →
tab through position/policy/queue/log → deposit or redeem → confirmation dialog; portfolio wrap ratio.

Deliberately blank: the docs route. No documentation site exists in the source.
