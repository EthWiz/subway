# Subway Design System

Subway is a non-custodial liquidity product on **Robinhood Chain** (chain id `4663`). Tokenized
stocks are the first on-chain asset with a real reference price, yet they trade in pools designed
for assets that have none: every price move on Nasdaq is discovered on-chain by an arbitrageur
trading against a stale quote, and the liquidity provider pays for it. Subway's pools quote at the
external fair price plus a spread, charge informed flow for the staleness it exploits, and keep the
fee income from retail flow that Robinhood Chain generates around the clock.

Depositors receive a fungible share token per name — `xNVDA`, `xAMC` — that holds a fee-earning
position in that stock with a fully on-chain price, usable as collateral across the chain. An
optional hedged share (`hNVDA`) removes the equity exposure and leaves a dollar-denominated yield,
with the hedge held in a Lighter account **the vault itself owns**, so no operator ever custodies
funds.

## Sources this system was built from

| Source | What was read | What it gave |
| --- | --- | --- |
| https://github.com/EthWiz/subway (branch `main`) | `README.md`, `docs/plan.md`, `docs/decisions.md`, repo tree | Product model, the two-vault stack, route spec for `apps/web`, per-pair policy defaults, holder-facing risk copy, Phase 0 verdicts |
| https://maple.finance/ | Marketing site content and structure | Reference for the institutional register: figure-led sections, plain-spoken product claims, restrained palette |
| https://nookapp.xyz/ | Cited by the user as a look-and-feel reference | Noted; nothing was copied |

**Read the repository before designing anything new for this product.** `docs/plan.md` is the
authoritative spec — routes, policies, roles, what is built and what is not — and it will tell you
more than this system can summarise.

### What the sources did NOT contain

- **No frontend.** `apps/web` is on the repo's "Not built yet" list. There is no existing UI, no
  component library, no CSS, no Tailwind config, no screenshots.
- **No logo, no icons, no illustrations, no imagery.** Nothing has been invented in their place.
- **No fonts.** The typefaces here are a chosen direction, not a brand asset (see Font substitution).

So: the **information architecture, copy register and numbers** in this system come from the
repository; the **visual language is original**, designed for the product's institutional posture
using Maple as a register reference.

## Products / surfaces

1. **The app** (`ui_kits/app/`) — the only product surface the repo defines. Routes: `/` vault list
   with the jurisdiction gate, `/vault/[pair]` with a hedged/unhedged toggle, `/portfolio` with both
   share balances and the implied hedge ratio.
2. **Operator/keeper surfaces** — explicitly out of scope in the repo ("does not live under
   `apps/dashboard`"). Not recreated.
3. **Marketing site, docs site** — do not exist. Not invented.

---

## Content fundamentals

The repository's own prose is the brand voice, and it is unusually disciplined. Copy the register.

**Plain declaratives, mechanism first.** "A pooled vault mints a fungible token that can be posted
as collateral." No throat-clearing, no "we believe", no vision language.

**Second person for the holder, third person for the system.** "You mint at the floor." "The vault
contract is the L1 owner of the pair's Lighter account." Never "we" — the protocol is not a company
speaking.

**State the unflattering number.** The source writes "AMC's perp does $47K/24h on 115 trades — a
~$1,880 vault" and "no pair has been shown to be profitable." Any figure that could mislead gets its
qualifier in the same sentence: "Trailing 24h and decays. Not a return."

**Name the thing that looks like a bug.** "Two consequences that look like bugs and are not:
depositors mint at the floor, so they are mildly underpaid." Design UI that has room for this — see
the `Callout` component; risks go **in the flow**, never in fine print.

**Casing.** Sentence case for headings, buttons and labels-as-prose. Mono UPPERCASE with 0.08em
tracking only for figure captions ("TVL", "TRAILING 24H FEE APR"). Never title case.

**Numbers.** Tabular mono everywhere. Percentages to one decimal (`10.3%`), share prices to four
(`$1.0412`), token amounts to two, addresses truncated mid-string (`0x4f2a…9c1b`). Ranges as
`±6%`. Durations as `04:12:08`.

**Vocabulary that is load-bearing** (use exactly these words): floor NAV, attested NAV, haircut,
margin ledger, epoch, request → settle → claim, range, recenter, feed (never "oracle price" in UI),
pool tick, markout, toxic flow, informed flow, keeper, bounded operator, panic, hedge band, funding.

**No emoji. Ever.** No exclamation marks. No "🎉 deposited!" — the confirmation reads
"Deposited. 11,904.12 xINTC minted at the feed price."

**Length.** Body copy tops out around 40 words per block; the measure is 640px. If an explanation
needs more, it is a `Tooltip` on a term plus a link to the docs the repo hasn't written yet.

---

## Visual foundations

**Register.** Editorial research note that happens to be interactive. Warm off-white paper, navy
ink, a single serif moment for the wordmark and page titles, and everything else — data, labels,
controls — in a neutral grotesk with tabular figures. Card and shadow discipline follows the modern
finance-dashboard idiom (crisp white panels, soft layered shadows); the type and palette position
Subway as a house that publishes its own evidence, which is how the repository actually writes.

**Colour.** Warm off-white page (`--paper-1` `#FBFAF7`) with white surfaces, navy ink
(`--ink-0` `#14213A`) and a single accent, terracotta `#B3553B`, used for committing actions, the
active nav underline, progress and the unhedged share tile. Semantics sit in the same muted register:
`--pos` `#3F6B4F` (fee income, in range), `--neg` `#A33326` (loss, out of range, blocked),
`--warn` `#8A6516` (queued, pre-open pull, stale feed), `--info` `#2B4A7E` (mechanism notes). A
`.theme-dark` scope moves the navy forward for terminal-style views. **Two background colours per
layout maximum** (paper + white, or paper + one navy block).

**No gradients.** No bluish-purple anything. No glassmorphism. Transparency appears in exactly two
places: tint fills computed with `color-mix` on semantic colours, and the dialog scrim
(ink at 44% with a 2px blur). Nothing else is translucent.

**Type.** Two families, with a strict division of labour. **Instrument Serif** (`--font-serif`)
carries the wordmark, display copy and H1 only — 62/44px display at -0.018em, H1 34px. **Schibsted
Grotesk** (`--font-ui`, `--font-num`) carries everything else: H2 23px and H3 18px semibold, body
15px/1.5 with a 13.5px secondary, captions 12px uppercase at 0.05em, and all figures with
`font-variant-numeric: tabular-nums` plus `--ls-num`. **IBM Plex Mono is reserved for hashes,
addresses, calldata and code** (`--font-mono`, `--type-code`); a figure a user reads is never
monospaced. One serif per screen — a second serif heading kills the effect.

**Spacing.** 4px base: 2, 4, 8, 12, 16, 20, 24, 32, 40, 56, 80. Page max 1200px, panel column 380–400px,
prose 640px, page padding 32px, gutter 24px, card padding 20px (28px for panels), section gap 56px.
Controls are 30/38/46px tall.

**Backgrounds.** Flat colour. No imagery, no illustration, no pattern, no texture, no noise — the
source ships none, and the product's credibility comes from data density, not decoration. Full-bleed
means a flat ink or paper band, never a photo.

**Cards.** White surface, 1px `--line-1` border, 12px radius, `--shadow-1` at rest — a two-part
shadow (1px contact + 5px diffuse) that reads as lift rather than outline. Nested blocks use
`tone="sunken"` (`--paper-2`) rather than a second card. No left-border accent stripes. No card
should carry more than one idea.

**Shadows are layered, not blurred blobs.** Three only: `--shadow-1` rest, `--shadow-2` hover
(contact + 24px diffuse), `--shadow-3` modal (60px at -24px spread). Each pairs a tight contact
shadow with a wide soft one. Tables use hairline row rules and no zebra striping.

**Radii.** 4px badges, 8px controls and inputs, 10px callouts, 12px cards, 16px panels and dialogs,
pill only for `Tag`, `StatusPill` and progress tracks. Nothing is fully rounded that contains a number.

**Hover.** Fills lighten one step (`--bg-hover` `#F5F2EC`); the accent lightens to `--accent-hover`;
secondary buttons darken their border to ink; interactive cards lift 1px and take `--shadow-2`;
table rows take a flat fill. Never opacity-based hover, never scale.

**Press.** 0.5px downward nudge plus the pressed accent (`--accent-press`). No shrink, no ripple.

**Focus.** 3px ring in `rgba(179,85,59,.30)` via `--ring-focus`, on every interactive element,
never removed.

**Disabled.** 42% opacity and `not-allowed`. Used constantly and meaningfully — a stale feed, a
bound TVL cap, a market that doesn't exist — and the reason is always stated next to it.

**Motion.** 110ms for colour and hover, 180ms for toggles and tabs, 260ms for dialog entrance
(6px rise + fade), 420ms for epoch and NAV bars. Easing `cubic-bezier(.2,.7,.3,1)`. **No bounce, no
spring, no parallax, no scroll-jacking, no number count-ups** — a figure that animates is a figure
you can't read. `prefers-reduced-motion` zeroes every duration.

**Layout rules.** One fixed element: the 64px top nav. The deposit/redeem panel is sticky within its
column. Content is a 12-column-equivalent grid of `minmax(0,1fr)` tracks plus a 380px panel; below
~900px the panel drops under the content. Figures right-align in tables, left-align in `Stat` blocks.

**Data display.** Every yield names its window ("trailing 24h, decays"). Every price names its source
("at feed"). Range is always shown against the **feed** marker, never the pool tick. Two NAVs are
shown side by side when both exist (floor / attested).

---

## Iconography

- **Set:** [Lucide](https://lucide.dev) — 2px stroke, 24px grid, rounded caps. The 17 glyphs the
  product uses are **vendored into `assets/icons/`** from
  https://github.com/lucide-icons/lucide and masked to `currentColor` by `components/core/Icon.jsx`,
  which resolves them relative to wherever `_ds_bundle.js` loaded (override with
  `window.SUBWAY_ICON_BASE`). Nothing is fetched from a CDN at runtime.
- **This is a substitution, and it is flagged.** The source repository defines no icon system — no
  icon font, no sprite, no SVG directory. Lucide was chosen because its stroke weight matches the
  hairline borders in this system. If Subway adopts a set, drop the SVGs into `assets/icons/`.
- **Sizes:** 11px inside badges, 13–14px inside buttons and pills, 16px in rows, nav and callouts,
  20px in empty states. Icons never appear larger than 20px; there are no hero icons.
- **Colour:** always `currentColor` — icons inherit from their container and are never multi-colour.
- **Glyphs in product use:** `wallet`, `link`, `external-link`, `arrow-left`, `arrow-up-right`,
  `arrow-down-right`, `refresh-cw`, `clock`, `info`, `triangle-alert`, `octagon-alert`,
  `circle-check`, `check`, `chevron-down`, `x`, `loader`, `shield-check`.
- **No emoji, ever.** No unicode glyphs as icons, with two exceptions used as *typography* rather
  than iconography: `±` in range copy, `≈` in estimates, and `—` for an absent value.
- **No per-stock logos.** Share identity is `TokenMark`: an `x`/`h` tile plus the mono ticker.

---

## Font substitution — please confirm

No font binaries exist in the source repository, so the typefaces are a **choice, not brand truth**:

- **Instrument Serif** (Google Fonts) for the wordmark, display copy and H1.
- **Schibsted Grotesk** (Google Fonts) for UI, labels and all figures — standing in for a
  Söhne-class licensed grotesk, which is what this register really wants.
- **IBM Plex Mono** (Google Fonts) for hashes, addresses and code only.

Both load from the Google Fonts CDN in `tokens/fonts.css`. **If Subway has real typefaces, send the
files** and I'll swap the `@font-face` rules and re-tune the scale.

---

## Index

| Path | What it is |
| --- | --- |
| `styles.css` | The one file consumers link — `@import`s only |
| `tokens/fonts.css` | Font loading + `--font-serif` / `--font-ui` / `--font-num` / `--font-mono` |
| `tokens/colors.css` | Surfaces, navy ink, terracotta accent, semantics, vault states, `.theme-dark` scope |
| `tokens/typography.css` | Sizes, weights, tracking, `--type-*` composites |
| `tokens/spacing.css` | 4px scale, layout maxima, control heights |
| `tokens/radii.css`, `tokens/elevation.css`, `tokens/motion.css` | Radii, three shadows + focus ring, durations and easings |
| `tokens/base.css` | Element resets, link colours, `.num` |
| `guidelines/*.card.html` | 19 foundation specimen cards (Colors, Type, Spacing, Brand) |
| `components/` | React primitives — see below |
| `ui_kits/app/` | Click-through recreation of the app's three routes |
| `templates/vault-dashboard/` | Template consuming projects can start from: app shell + vault list + deposit panel |
| `Identity directions.html` | The three identity directions explored; 1b (this one) was chosen |
| `assets/icons/` | 17 vendored Lucide SVGs — the whole icon set in use |
| `assets/README.md` | Why there are no brand image assets, and what stands in |
| `thumbnail.html` | Homepage tile |
| `SKILL.md` | Agent-skill entry point |
| `github.md` | Source-repo association for upstream sync |

### Components

Grouped by concern; each has `<Name>.jsx`, `<Name>.d.ts`, `<Name>.prompt.md`, and one `@dsCard` per
directory.

- **`components/core/`** — `Button`, `IconButton`, `Icon`, `Card`, `Badge`, `Tag`, `Stat`
- **`components/forms/`** — `AmountInput`, `Input`, `Select`, `Switch`, `SegmentedControl`, `Checkbox`
- **`components/data/`** — `DataTable`, `TokenMark`, `KeyValue`, `RangeMeter`, `StatusPill`, `EpochTimer`
- **`components/feedback/`** — `Callout`, `Dialog`, `Tooltip`
- **`components/navigation/`** — `TopNav`, `Tabs`

**Intentional additions.** The source defines no component inventory, so this is an authored set
sized to the product's screens. Four entries are product-specific rather than generic primitives,
and exist because the spec demands them: `TokenMark` (x/h share identity, standing in for absent
token artwork), `RangeMeter` (concentrated range against the feed price), `EpochTimer` (the hedged
vault's settlement clock), `AmountInput` (deposit field with balance, MAX and feed-priced
equivalent). `Icon` is a wrapper over the substituted Lucide set.
