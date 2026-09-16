repo: EthWiz/subway
branch: main

## Last sync

date: 2026-09-16T14:04:24Z

### Updated in this project

- Built the foundations (colour, type, spacing, motion tokens) from the product's posture; the repo ships no CSS.
- Authored 24 React primitives, four of them product-specific (TokenMark, RangeMeter, EpochTimer, AmountInput).
- Recreated the app's three routes from `docs/plan.md` → "Web app (apps/web)"; the repo has no frontend code.
- Recorded the Phase 0 verdicts (0-for-3 named pairs, 18 hedgeable names) as the UI kit's fixture data.

## Screen map

| Screen / file | Built from |
| --- | --- |
| `ui_kits/app/index.html` | `docs/plan.md` → Web app → Routes |
| `ui_kits/app/VaultList.jsx` | `docs/plan.md` route `/`; `README.md` → "What the evidence actually says" |
| `ui_kits/app/VaultDetail.jsx` | `docs/plan.md` route `/vault/[pair]`, Policies table, `README.md` → share-price section |
| `ui_kits/app/Portfolio.jsx` | `docs/plan.md` route `/portfolio`; `docs/decisions.md` → two-vault stack |
| `ui_kits/app/Shell.jsx` | `docs/plan.md` → jurisdiction gate; `README.md` → risks stated to holders |
| `ui_kits/app/data.js` | `research/2026-09-16-hedgeability-and-pool-screen.md` (verdicts quoted in `README.md`) |
| `readme.md` content + visual foundations | `README.md`, `docs/plan.md`, `docs/decisions.md` prose register |
