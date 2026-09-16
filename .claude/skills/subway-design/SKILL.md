---
name: subway-design
description: Use this skill to generate well-branded interfaces and assets for Subway, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for protoyping.
user-invocable: true
---

Read the readme.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## What is in here

- `readme.md` — product context, content fundamentals, visual foundations, iconography, and the index of everything else. Read this first.
- `styles.css` + `tokens/` — the only stylesheet a consumer links; `@import`s the token files.
- `components/` — React primitives (`<Name>.jsx`, `<Name>.d.ts`, `<Name>.prompt.md`, one card HTML per group).
- `ui_kits/app/` — click-through recreation of the app's routes; read its README.md for the screen map.
- `templates/vault-dashboard/` — a ready starting page: app shell, vault list, deposit panel.
- `guidelines/*.card.html` — foundation specimens (colour, type, spacing, brand).
- `assets/icons/` — the 17 vendored Lucide SVGs that are the entire icon set. `assets/README.md` explains what brand assets do and do not exist.
- `github.md` — which repo and commit this system was built from.

`_ds_bundle.js`, `_ds_manifest.json` and `_adherence.oxlintrc.json` are generated; the component
cards and kits load the bundle, so keep it alongside the sources.

## Caveats to state before designing

- Subway has **no logo and no licensed typefaces**. The wordmark is Instrument Serif set as type; Schibsted Grotesk stands in for a Söhne-class grotesk. Do not invent a mark.
- Figures never omit their window ("trailing 24h, decays") and prices always name their source ("at feed").
- No emoji, no exclamation marks, no title case.
