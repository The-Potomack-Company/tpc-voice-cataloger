# Phase 23: Typography Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 23-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 23-typography-pipeline
**Areas discussed:** Variable vs static weight files, Where @fontsource imports live, Preload / FOUC strategy, Latin-ext subset coverage

---

## Variable vs static weight files

| Option | Description | Selected |
|--------|-------------|----------|
| Variable for Inter + EB Garamond (Recommended) | @fontsource-variable/inter and @fontsource-variable/eb-garamond covering all weights via variable WOFF2 axes; IBM Plex Mono stays static (@fontsource/ibm-plex-mono 400 + 500). Smaller aggregate footprint, room for future weight bumps, smoother weight interpolation. | ✓ |
| Static per-weight files | Per-weight imports for all three families (8 separate WOFF2 fetches). Smaller individual files, browser caches per-weight, but no growth room. | |
| Mixed: variable Inter, static EB Garamond + Plex Mono | Variable for the highest-traffic font; static elsewhere. Two patterns to maintain. | |

**User's choice:** Variable for Inter + EB Garamond (Recommended)
**Notes:** IBM Plex Mono has no official variable build, so it's static regardless. Researcher confirms exact axis-file paths for the variable packages.

---

## Where @fontsource imports live

| Option | Description | Selected |
|--------|-------------|----------|
| New src/ui/tokens/fonts.css, chained from index.css (Recommended) | New fonts.css alongside tokens.css and base.css; src/index.css adds @import "./ui/tokens/fonts.css" near the top. Keeps font wiring inside the TOKENS-04 allowlist directory; loads with the rest of the stylesheet pipeline. | ✓ |
| Top of src/main.tsx as TS imports | Idiomatic Vite imports; tree-shakes naturally. But fonts only start loading after JS bundle parses (worse FOUC) and spreads font config across multiple files. | |
| @import statements directly in src/index.css | Simplest, fewest files. But index.css already mixes Tailwind import, token imports, @custom-variant, and @theme bridge — adding 5+ font imports makes it harder to scan. | |

**User's choice:** New src/ui/tokens/fonts.css, chained from index.css (Recommended)
**Notes:** Insertion order in index.css: after `@import "tailwindcss"`, before `@import "./ui/tokens/tokens.css"`, so tokens.css's font-family declarations resolve to families already registered by the @font-face rules.

---

## Preload / FOUC strategy

| Option | Description | Selected |
|--------|-------------|----------|
| font-display: swap (default) + preload Inter 400 only (Recommended) | @fontsource's default font-display:swap; system fallback paints first, real font swaps in. Single <link rel="preload"> in index.html for the Inter variable WOFF2. EB Garamond and Plex Mono load on first reference. | ✓ |
| font-display: swap, no preload | Pure @fontsource default; zero index.html changes. More visible FOUT on Inter on first visit. | |
| font-display: optional + preload Inter 400 | Browser uses real font only if available within ~100ms, else system fallback for the page-view. Zero layout shift, but italic display + tnum receipt numbers might not render correctly first time. | |

**User's choice:** font-display: swap (default) + preload Inter 400 only (Recommended)
**Notes:** Preload is a single <link rel="preload" as="font" type="font/woff2" crossorigin> for the Inter variable latin WOFF2. EB Garamond and Plex Mono get no preload — preload budget is one file per phase; revisit if FOUT on italic display title is judged too jarring post-launch.

---

## Latin-ext subset coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — include latin-ext subsets (Recommended) | Auction catalogs frequently carry European maker names, decorative styles, and material terms with diacritics (Sèvres, Müller, façon de Venise). Latin-ext subset for each family adds ~80–120 KB gzipped total but ensures these render in the chosen font. | ✓ |
| No — latin only, document the limitation | Default latin-only @fontsource files; accented characters fall through to system fallback per-character (visually broken inside one word). Smaller bundle (~80–120 KB saved). | |
| Defer the decision — ship latin only, revisit if users complain | Same as latin-only but explicitly marked as a follow-up. Ships fastest; same rendering mismatch. | |

**User's choice:** Yes — include latin-ext subsets (Recommended)
**Notes:** Cyrillic, Greek, Vietnamese, and other subsets stay out of scope; latin + latin-ext only.

---

## Claude's Discretion

- Whether to surface `tnum` as a Tailwind utility (e.g., `font-tnum` via `@utility` or a `@theme` extension) in addition to the existing `.tpc .tnum` CSS class. CSS class already satisfies success criterion #3.
- Exact `@fontsource-variable/*` axis-file paths for the current package versions (e.g., the precise filename for the italic-axis variable WOFF2 inside `@fontsource-variable/eb-garamond`). Researcher confirms.
- Bundle-size delta documentation format — concise table inside the phase-transition section of STATE.md, or a dedicated BUNDLE-DELTA.md in the phase directory.
- Exact preload href and any Vite config required to land `@fontsource` font binaries at a stable URL referenced by `index.html`.
- Whether to add a `tokens.css ↔ @font-face name` sync-check Vitest test.

## Deferred Ideas

- `tnum` Tailwind utility surface — planner's call.
- Inter italic, EB Garamond roman 500, Inter 700+ — out of scope per ROADMAP.
- Variable IBM Plex Mono — no official build today.
- Preload for EB Garamond or Plex Mono — revisit if FOUT is too jarring.
- Cyrillic/Greek/Vietnamese subsets — separate phase if needed.
- Custom subsetting via glyphhanger / fonttools — not pursued.
- Service-worker font caching, PWA prefetch — out of scope for v1.2.
- Bundle-size CI guard — not for this phase.
- `tokens.css` ↔ `tokens.ts` sync test — same posture as Phase 22.
