# Phase 23: Typography Pipeline - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Self-host EB Garamond, Inter, and IBM Plex Mono via the `@fontsource` family of npm packages and load enough weights/styles that the existing Phase 22 token slots (`--font-display`, `--font-ui`, `--font-mono`) actually resolve to those fonts in production. Specifically: EB Garamond 400 + 400 italic + 500 italic, Inter 400 + 500 + 600, and IBM Plex Mono 400 + 500. Expose a `tnum` utility for tabular figures (the `.tpc .tnum` CSS class already exists from Phase 22; the question of whether to also expose a Tailwind utility is left to the planner). Document the bundle-size delta in the phase transition notes.

Out of this phase: per-screen restyles that consume the new italic display title or mono receipt numbers (Phases 26+), the LIB primitives that wrap typography decisions in components (Phase 24), the theme toggle UI (Phase 25), and any additional font weights beyond what TYPE-01/02/03 specifies.

</domain>

<decisions>
## Implementation Decisions

### Font format and packages
- **D-01:** Use `@fontsource-variable/inter` (single variable WOFF2 covers all weight axes including 400/500/600) and `@fontsource-variable/eb-garamond` (variable WOFF2 covering the roman and italic axes EB Garamond ships as separate files). Use `@fontsource/ibm-plex-mono` (static per-weight files for 400 and 500) — no official variable build exists for IBM Plex Mono. The mixed model is intentional: variable for the high-traffic and italic-axis-using families, static for the family that has no variable option.
- **D-02:** EB Garamond's italic axis ships as a separate variable file in `@fontsource-variable/eb-garamond` (the package conventions split `wght` and `wght-italic` into two files). Both axis files must be imported so 400 italic and 500 italic are available. Researcher confirms exact axis-file paths for the current package version.
- **D-03:** Plex Mono imports are per-weight static: `@fontsource/ibm-plex-mono/400.css` and `/500.css`. No additional weights (the spec is explicit — 400 + 500 only).

### Import site
- **D-04:** Create a new file `src/ui/tokens/fonts.css` that contains all `@import "@fontsource-..."` statements (variable Inter, variable EB Garamond roman + italic axes, static Plex Mono 400 + 500, all latin + latin-ext subsets — see D-08). This file lives alongside `tokens.css` and `base.css` inside the `src/ui/tokens/` directory the Phase 22 TOKENS-04 allowlist already covers.
- **D-05:** `src/index.css` adds `@import "./ui/tokens/fonts.css"` near the top — after `@import "tailwindcss"` (Tailwind's preflight should still come first) and before `@import "./ui/tokens/tokens.css"` (so tokens.css's font-family declarations resolve to families the browser has registered via the preceding @font-face rules). The existing `@custom-variant dark (...)` and `@theme inline { ... }` blocks stay where they are.
- **D-06:** No font imports in `src/main.tsx`. Keeping fonts out of the JS module graph means they start downloading as part of the stylesheet pipeline rather than waiting for the React bundle to parse — better cold-load behavior.

### FOUC strategy
- **D-07:** Rely on `@fontsource`'s default `font-display: swap`. System fallback paints first; the real font swaps in when its WOFF2 finishes downloading. Acceptable brief FOUT on first visit; cached on subsequent visits. Do **not** override `font-display` to `optional` — italic display title and mono receipt numbers are part of the visual identity and must render correctly even on slow networks.
- **D-08:** Add a single `<link rel="preload" as="font" type="font/woff2" crossorigin>` in `index.html` `<head>` for the Inter variable WOFF2 latin file (the most-used font on every screen). Do **not** preload EB Garamond or Plex Mono — they're used on a smaller surface area and the preload budget is one file per phase. Preload tag includes `crossorigin` (mandatory for fonts even when same-origin in many browsers) and the explicit `type="font/woff2"`. The exact href is the resolved path Vite emits for the @fontsource-variable/inter latin WOFF2 — the planner determines this (likely via a hash-stable Vite plugin or by referencing a stable filename pattern).

### Subset coverage
- **D-09:** Include the **latin-ext** subset for all three families in addition to the default latin subset. Auction catalog text frequently includes accented characters (Sèvres, Müller, façon de Venise, fauteuil, Limoges marks, ø, ñ). Without latin-ext, those glyphs fall through to the system fallback per-character — visually broken. The estimated extra footprint (~80–120 KB gzipped across all three families) is an acceptable trade for typographic correctness in a catalog product.
- **D-10:** Cyrillic, Greek, Vietnamese, and other subsets are **not** loaded. If a future product expansion needs them, that's a separate phase.

### Claude's Discretion
- Whether to surface `tnum` as a Tailwind utility (e.g., a `font-tnum` utility via Tailwind v4 `@utility` or an additional `@theme` entry) in addition to the existing `.tpc .tnum` CSS class from Phase 22. The CSS class is canonical and already satisfies success criterion #3; a Tailwind utility surface is convenience for screens that prefer the `font-*` family of utilities. Planner picks based on cost.
- Exact `@fontsource-variable/*` axis-file paths (e.g., the precise filename for the italic-axis variable WOFF2 inside `@fontsource-variable/eb-garamond`) — researcher confirms against the package's `package.json` exports and the current major version's file layout. Same for Inter's italic axis if it ships separately.
- Bundle-size delta documentation format — a concise before/after WOFF2-byte table inside the phase-transition section of `STATE.md`, or a dedicated `BUNDLE-DELTA.md` in the phase directory. Planner picks; either is fine as long as the numbers are captured.
- The exact preload href and any Vite config needed to make `@fontsource` font binaries land at a stable URL referenced by `index.html` — this is mechanical and lands in the planner's hands.
- Whether to include a sync-check test that asserts `tokens.css`'s declared font family names ("EB Garamond", "Inter", "IBM Plex Mono") match the names registered by the loaded `@font-face` rules from `@fontsource`. Cheap if Vitest can read the package CSS at test time; defer if not.

</decisions>

<specifics>
## Specific Ideas

- **Self-hosted, same-origin only.** Production network panel must show zero requests to `fonts.googleapis.com` or `fonts.gstatic.com`. This is the entire reason TYPE-01/02/03 exist — privacy posture, offline-tolerance, and shipping a single font binary set the team controls.
- **Italic display is the hero.** EB Garamond 400 italic powers the "Sessions" / "Recording" / "Review" screen titles via the `.tpc-display` class (already declared in `src/ui/tokens/base.css`). Phase 23's job is to make sure 400 italic actually loads — without it, `.tpc-display` falls back to italic Iowan Old Style or italic Georgia, which is wrong but graceful.
- **Mono receipt numbers must be visibly mono.** IBM Plex Mono is what gives session IDs and item numbers the receipt-paper feel from the mockups. Today, `font-mono` Tailwind utilities are already used in `src/components/RecordingIndicator.tsx` and `src/components/RecordingsList.tsx` — Phase 23 changes which font those resolve to.
- **Tabular numerics are non-negotiable.** Timer durations, item counts, and session IDs need `font-variant-numeric: tabular-nums` so columns of numbers don't wiggle. The `.tpc .tnum` class is already declared from Phase 22; Phase 23 doesn't redeclare it.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements (locked)
- `.planning/REQUIREMENTS.md` §"TYPE — Typography" (lines 22–25) — TYPE-01, TYPE-02, TYPE-03, TYPE-04 (the four requirements this phase delivers)
- `.planning/ROADMAP.md` §"Phase 23: Typography Pipeline" (lines 98–109) — phase goal, success criteria, depends on Phase 22
- `.planning/PROJECT.md` §"Current Milestone: v1.2 UI Overhaul" + §"Key Decisions" — milestone-level locks on self-hosted fonts and the no-Google-Fonts posture

### Phase 22 outputs this phase builds on (mandatory reads)
- `.planning/phases/22-foundation-tokens/22-CONTEXT.md` — token system architecture; especially **D-01..D-04** (file installation in `src/ui/tokens/`), **D-12** (the `@theme inline` bridge that exposes `--font-display`/`--font-ui`/`--font-mono` as Tailwind utilities), and **D-15..D-19** (the TOKENS-04 no-hardcoded-literals guard, including the `src/ui/tokens/**` allowlist that the new `fonts.css` inherits)
- `src/ui/tokens/tokens.css` — already declares `--font-display: "EB Garamond", ...`, `--font-ui: "Inter", ...`, `--font-mono: "IBM Plex Mono", ...`. Phase 23 does **not** redeclare these strings; the @font-face rules from @fontsource just need to register the same family names so the cascade resolves.
- `src/ui/tokens/base.css` — already declares `.tpc .tpc-display { font-family: var(--font-display); font-style: italic; ... }` and `.tpc .tnum { font-variant-numeric: tabular-nums; ... }`. Phase 23 does **not** modify base.css; it only ensures the families those classes reference are loaded.
- `src/ui/__tests__/no-hardcoded-literals.test.ts` — TOKENS-04 guard. The new `src/ui/tokens/fonts.css` lives under the existing `src/ui/tokens/**` allowlist and will not trip the guard. Imports of `@fontsource-variable/inter` etc. resolve to `node_modules/` which is not scanned.

### Files this phase modifies
- `src/index.css` — receives a new `@import "./ui/tokens/fonts.css"` near the top (after `@import "tailwindcss"`, before `@import "./ui/tokens/tokens.css"`).
- `index.html` — receives one new `<link rel="preload" as="font" type="font/woff2" crossorigin>` for Inter variable latin WOFF2.

### External package references
- `@fontsource-variable/inter` — npm package; researcher confirms current version's CSS file paths and which subsets are exposed (latin, latin-ext)
- `@fontsource-variable/eb-garamond` — npm package; researcher confirms wght and italic axis file paths
- `@fontsource/ibm-plex-mono` — npm package; researcher confirms 400.css, 500.css, and any -latin-ext.css subset paths
- `@fontsource` documentation index: https://fontsource.org/docs — for the package conventions on subset suffixes (e.g., `-latin-ext` filenames) and `font-display` defaults

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Token slots already declared:** `src/ui/tokens/tokens.css` carries `--font-display`, `--font-ui`, `--font-mono` with the final family names ("EB Garamond", "Inter", "IBM Plex Mono") quoted at the front of each fallback stack. Phase 23 only loads the matching @font-face rules.
- **Tailwind utility bridge already wired:** `src/index.css`'s `@theme inline` block exposes `--font-display`, `--font-ui`, `--font-mono` so screens can write `className="font-display"` / `font-ui` / `font-mono` and resolve to the loaded family.
- **`.tpc .tpc-display` class already declared** in `src/ui/tokens/base.css` (italic + display family + tracking) — the canonical hook for hero italic titles like "Sessions" / "Recording" / "Review."
- **`.tpc .tnum` class already declared** in `src/ui/tokens/base.css` (`font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1`) — satisfies success criterion #3 once a tabular-figures-supporting font is loaded. Both Inter and IBM Plex Mono support `tnum`; EB Garamond's variable build does too.
- **TOKENS-04 allowlist already covers `src/ui/tokens/**`** — the new `fonts.css` inherits this and won't trip the no-hardcoded-literals guard.

### Established Patterns
- **Single source of truth in `src/ui/tokens/`** (Phase 22 D-01..D-04). Adding `fonts.css` next to `tokens.css` and `base.css` extends this pattern rather than carving a new directory.
- **CSS-first import order in `src/index.css`:** Tailwind import → token CSS imports → `@custom-variant dark` → `@theme inline` bridge. Phase 23 inserts `@import "./ui/tokens/fonts.css"` between Tailwind and `tokens.css` so font-family literals exist before tokens.css references them.
- **Pre-paint critical-path discipline in `index.html`:** Phase 22 added an inline pre-paint script + paired `theme-color` meta to fight dark-mode FOUC. The new font-preload `<link>` follows the same critical-path mindset (one preload, justified by traffic).
- **GitHub Actions CI runs `lint, typecheck, test, build`** (per PROJECT.md). No new CI workflow needed — `npm run build` will incorporate the new `@fontsource` deps via Vite's standard module resolution.

### Integration Points
- `package.json` gains three runtime deps: `@fontsource-variable/inter`, `@fontsource-variable/eb-garamond`, `@fontsource/ibm-plex-mono`.
- `src/ui/tokens/fonts.css` is a new file; CSS-only; lists `@import` statements for the variable and static `@fontsource` files plus their latin-ext subset siblings.
- `src/index.css` gains exactly one `@import` line (`./ui/tokens/fonts.css`).
- `index.html` gains exactly one `<link rel="preload">` line for Inter.
- `src/components/RecordingIndicator.tsx` and `src/components/RecordingsList.tsx` already use `font-mono` Tailwind utility — no edits needed; the family they resolve to changes from system mono to IBM Plex Mono once Phase 23 lands.
- The `@fontsource` packages place their CSS and WOFF2 files inside `node_modules/` — out of TOKENS-04's scan scope — so importing them does not require allowlist changes.
- Vite's default behavior copies WOFF2 binaries into the production bundle and emits hash-stable URLs; the planner needs to confirm the preload href format works with that bundling step.

</code_context>

<deferred>
## Deferred Ideas

- **`tnum` Tailwind utility surface (`font-tnum` or similar)** — left to Claude's discretion in planning; the `.tpc .tnum` CSS class already satisfies success criterion #3. Add a Tailwind utility wrapper only if cheap.
- **Inter italic, EB Garamond roman 500, additional Inter weights (700, etc.)** — explicitly out of scope per ROADMAP. Italic display is EB Garamond's job; Inter loads only roman 400 / 500 / 600.
- **Variable IBM Plex Mono** — no official `@fontsource` variable build exists today. Revisit if/when one ships.
- **Preload for EB Garamond or Plex Mono** — only Inter is preloaded. If post-launch FOUT on the italic display title is judged too jarring, adding a second preload is a small follow-up.
- **Cyrillic, Greek, Vietnamese, or other subsets** — not loaded. International expansion would be a separate phase.
- **Custom subsetting via glyphhanger / fonttools** — `@fontsource`'s default subsets are the source of truth. Custom subsetting would shrink WOFF2s but adds tooling and breaks the simple "self-host via npm package" story.
- **Cross-tab font preload coordination, service-worker font caching, or any PWA install-time prefetch** — out of scope for v1.2; the project doesn't ship as a PWA yet.
- **Bundle-size guard test** (CI fails if @fontsource imports balloon beyond a budget) — not for this phase. The phase-transition note documents the delta; a budget guard could land later if drift becomes a problem.
- **Font-family sync test between `tokens.css` and `tokens.ts`** — Phase 22 left this as planner discretion; Phase 23 inherits the same posture.

</deferred>

---

*Phase: 23-typography-pipeline*
*Context gathered: 2026-04-30*
