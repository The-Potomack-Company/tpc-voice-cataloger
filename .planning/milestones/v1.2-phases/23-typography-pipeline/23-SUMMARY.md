# Phase 23: Typography Pipeline — Summary

**Completed:** 2026-05-12

## Shipped (TYPE-01..04)

- Added three `@fontsource` runtime deps:
  - `@fontsource-variable/inter` (variable WOFF2; weights 100–900 via single axis file)
  - `@fontsource-variable/eb-garamond` (variable; wght + wght-italic axes both imported)
  - `@fontsource/ibm-plex-mono` (static 400 + 500 per spec; no variable build exists)
- New file `src/ui/tokens/fonts.css` containing the six `@import` statements (under the TOKENS-04 allowlist).
- Wired `@import "./ui/tokens/fonts.css"` into `src/index.css` immediately after the Tailwind import and before `tokens.css` so `@font-face` rules register before `--font-display`/`--font-ui`/`--font-mono` reference them.
- Updated `src/ui/tokens/tokens.css` and `src/ui/tokens/tokens.ts` so the display/UI font-family stacks list the variable family names (`"EB Garamond Variable"`, `"Inter Variable"`) first, with the historical names retained as fallbacks for graceful degradation.

## Decisions made during execution

- **No `<link rel="preload">` for Inter.** D-08 made this optional; emitting a hash-stable href requires extra Vite config and is deferred. `font-display: swap` already covers FOUT.
- **No latin-ext sibling imports.** The `wght.css` variable file already bakes in all subsets (latin, latin-ext, cyrillic, greek, vietnamese) as separate `@font-face` rules with `unicode-range` constraints, so the browser only downloads the subset the page actually needs. Importing additional `*-latin-ext.css` files would double-register the same fonts.
- **Variable family-name handling.** `@fontsource-variable/*` packages register WOFF2s as `"<Family> Variable"`. Token fallback stack now lists both the variable and the historical names so consumers don't need to know which is loaded.

## Verification

- `npx tsc -b` — clean
- `vitest --run src/ui/__tests__/no-hardcoded-literals.test.ts` — TOKENS-04 guard passes (fonts.css is under the `src/ui/tokens/**` allowlist)

## Bundle delta (advisory)

Self-hosted via `@fontsource` adds Inter variable WOFF2 (~26 KB latin), EB Garamond variable wght (~20 KB latin) + italic (~20 KB latin), IBM Plex Mono 400 + 500 (~15 KB each, latin). Non-latin subsets only download when matched by `unicode-range`. Total cold-load network cost for typical English page is ~95 KB gzipped.
