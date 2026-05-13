---
phase: 22-foundation-tokens
plan: 02
subsystem: ui
tags: [tokens, tailwind-v4, dark-mode, fouc, theme-bridge, custom-variant]

# Dependency graph
requires:
  - phase: 22-foundation-tokens
    provides: "Plan 01 outputs — src/ui/tokens/tokens.css declares .tpc / .tpc-dark CSS vars; src/ui/tokens/base.css ships the .tpc-* base primitives. Plan 22-02 imports both into the Vite build graph."
provides:
  - "Live token bridge — all 21 .tpc/.tpc-dark CSS vars + 3 radii + 3 fonts exposed as Tailwind utilities (bg-bg, bg-bg-2, text-ink-3, bg-warn-wash, text-accent, rounded-md, font-display, etc.)"
  - "Class-based dark mode — existing 282 dark: utilities now key off .tpc-dark on <html> instead of the prefers-color-scheme media query, with zero edits to component files"
  - "FOUC-free cold load — inline pre-paint <script> in index.html synchronously applies .tpc-dark before first paint when system is dark"
  - "Browser-chrome theming — paired <meta name=\"theme-color\"> (light #0089b4 default + dark #22b5e1 with media=prefers-color-scheme dark) so iOS/Chrome chrome matches the page accent in both modes"
  - "Phase 25-ready bootstrap — inline script is system-pref-only and idempotent; ThemeProvider can supersede without touching index.html"
affects: [22-03-init-theme-runtime, 22-04-tokens-04-guard, 24-lib-primitives, 25-theme-toggle, 26-screen-restyles]

# Tech tracking
tech-stack:
  added: []  # No new dependencies — uses Tailwind v4's existing @custom-variant + @theme inline directives
  patterns:
    - "@theme inline { --color-X: var(--X) } bridges runtime CSS vars to Tailwind utilities at use site (not definition site) so .tpc-dark cascade overrides reach utilities"
    - "@custom-variant dark (&:where(.tpc-dark, .tpc-dark *)) — class-based dark variant with :where() for 0,0,0 specificity"
    - "Pre-paint inline <script> (classical, no defer/async/type=module) for synchronous dark-class application before first paint"
    - "Paired <meta name=\"theme-color\"> with media=(prefers-color-scheme: dark) for browser-chrome theming"
    - "Strict CSS import order in entry file: tailwindcss → tokens → base → @custom-variant → @theme inline → @keyframes"

key-files:
  created: []
  modified:
    - "src/index.css — token imports + @custom-variant dark + @theme inline bridge + preserved slideUp keyframes"
    - "index.html — class=\"tpc\" on <html>, inline pre-paint script, paired theme-color meta"

key-decisions:
  - "Used @theme inline (NOT @theme) so .tpc-dark cascade overrides reach Tailwind utilities at the use site (D-12, RESEARCH Pattern 1, Pitfall 3)"
  - "@theme block lives in src/index.css (Tailwind v4 entry file), NOT inside imported tokens.css — Tailwind v4 silently ignores @theme in @import-ed files"
  - "Custom-variant uses :where() to keep specificity at 0,0,0 so component-level overrides remain easy"
  - "Pre-paint script is classical inline <script> (no defer/async/type=module) — those modes run after first paint and would FOUC the dark flash"
  - "Pre-paint script is system-pref-only (D-08): does NOT read localStorage or Supabase. Phase 25's ThemeProvider will supersede without touching index.html"
  - "theme-color hex pair is sRGB conversion of --accent OKLCH tokens (#0089b4 light, #22b5e1 dark) — derivation documented in HTML comment for re-derivation when tokens evolve"
  - "Preserved @keyframes slideUp verbatim — already used by app code; not in Phase 22 scope to refactor"
  - "Did NOT modify vite.config.ts manifest.theme_color — that's the installed-PWA chrome (separate concern, deferred per RESEARCH Pattern 5 §PWA-manifest-interaction)"

patterns-established:
  - "@theme inline bridge pattern — runtime CSS vars on host element, Tailwind utilities resolve at use site"
  - "Class-based dark mode via @custom-variant dark (&:where(.tpc-dark, .tpc-dark *))"
  - "Pre-paint dark bootstrap via classical inline script (the only way to guarantee class is set before first paint)"
  - "Paired theme-color meta tags as the canonical browser-chrome theming form (MDN-canonical, iOS Safari 15+/Chrome 93+ supported)"

requirements-completed: [TOKENS-01, TOKENS-02]

# Metrics
duration: 3min
completed: 2026-04-30
---

# Phase 22 Plan 02: Bridge & Dark Variant Summary

**Live Tailwind v4 token bridge via `@theme inline` plus class-based dark mode via `@custom-variant dark (&:where(.tpc-dark, .tpc-dark *))` — existing 282 `dark:` utilities now key off `.tpc-dark` on `<html>` with zero component edits, plus FOUC-free cold load via synchronous pre-paint script.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-30T15:22:47Z
- **Completed:** 2026-04-30T15:26:02Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- **Tailwind utility bridge live.** All 21 color vars (`--bg`, `--bg-2`, `--bg-3`, `--rule`, `--rule-2`, `--ink` x4, `--accent` x4, `--sand` x2, semantic x6) + 3 radii (`--radius-sm`, `--radius`, `--radius-lg`) + 3 fonts (`--font-display`, `--font-ui`, `--font-mono`) are exposed as Tailwind utilities at use site via `@theme inline`. Verified in `dist/assets/index-*.css`: `.bg-bg{background-color:var(--bg)}`, `.bg-bg-2{background-color:var(--bg-2)}`, `.font-display{font-family:var(--font-display)}` — values resolve at the consuming element, so `.tpc-dark` overrides on `--bg`, `--ink`, etc. propagate correctly.
- **Dark mode rewired without touching components.** `@custom-variant dark (&:where(.tpc-dark, .tpc-dark *))` rewrote every existing `dark:` utility (e.g., `dark:bg-gray-900`, `dark:text-gray-400`) to target the `.tpc-dark` class. Verified in built CSS: `:where(.tpc-dark,.tpc-dark *){background-color:var(--accent)}` etc. The 282 occurrences across 29 component/page files continue to render correctly with zero file edits.
- **FOUC eliminated on cold load.** `<html lang="en" class="tpc">` is now literal markup. Inline `<head>` `<script>` (3 lines of code in try/catch, ≤5 lines total) synchronously calls `matchMedia('(prefers-color-scheme: dark)').matches` and `document.documentElement.classList.add('tpc-dark')` before first paint. Classical inline script (no `defer`/`async`/`type="module"`) is the only form that runs before paint.
- **Browser chrome theming live.** Paired `<meta name="theme-color">` — light `#0089b4` default + dark `#22b5e1` with `media="(prefers-color-scheme: dark)"`. Hex values are sRGB conversions of `--accent` OKLCH tokens (light `oklch(0.58 0.13 225)`, dark `oklch(0.72 0.13 225)`); derivation is documented in an HTML comment so the values are re-derivable when tokens evolve.
- **Phase 25-ready.** The inline script is system-pref-only (D-08) — does NOT read localStorage, Supabase, or any user preference. Phase 25's `ThemeProvider` can supersede this without touching `index.html`.
- **Legacy hex eliminated.** The previous `@theme { --color-accent: #2563eb; --color-accent-hover: #1d4ed8 }` block in `src/index.css` is gone — those values now flow from `--accent` / `--accent-hover` declared in `tokens.css`. The previous `<meta name="theme-color" content="#2563eb">` is replaced by the paired form. (This also resolves the second deferred item in `deferred-items.md` from Plan 22-01: "Pre-existing hex literals in `src/index.css`".)

## Task Commits

Each task was committed atomically (with `--no-verify` per worktree convention):

1. **Task 1: Replace `src/index.css` with token imports + `@custom-variant` + `@theme inline` bridge** — `df11444` (feat)
2. **Task 2: Update `index.html` with `.tpc` class, pre-paint script, paired theme-color meta** — `15412c1` (feat)

**Plan metadata commit:** _to be added_ (`docs(22-02): complete bridge-dark-variant plan` — captures `SUMMARY.md`).

## Files Created/Modified

### Modified

- **`src/index.css`** — Replaced entirely. New layout (in this exact order, mandated by Tailwind v4 + RESEARCH Pitfall 3):
  1. `@import "tailwindcss"`
  2. `@import "./ui/tokens/tokens.css"`
  3. `@import "./ui/tokens/base.css"`
  4. `@custom-variant dark (&:where(.tpc-dark, .tpc-dark *))` — class-based dark variant
  5. `@theme inline { ... }` — full 21-color + 3-radii + 3-font bridge
  6. `@keyframes slideUp { ... }` — preserved verbatim from prior file
- **`index.html`** — Added `class="tpc"` to `<html>`, replaced single `<meta name="theme-color">` with paired form, added inline pre-paint `<script>` in `<head>`. Preserved the rest (`<meta charset>`, viewport, apple-mobile-web-app metas, apple-touch-icon, title, root div, main.tsx module script).

## Decisions Made

All decisions were already made in CONTEXT.md (D-04 through D-14) and elaborated in RESEARCH.md (Patterns 1, 2, 3, 5; Pitfalls 3, 4). The plan executed without needing new decisions. Notable executed-as-specified items:

- **`@theme inline` (not `@theme`)** — required so the bridge resolves at use site, allowing `.tpc-dark`-scoped `--bg` overrides to reach `bg-bg` utilities. Confirmed in build output: `.bg-bg{background-color:var(--bg)}` (not `var(--color-bg)`).
- **`@theme` block lives in `src/index.css`, not inside `tokens.css`** — Tailwind v4 silently ignores `@theme` inside imported files (RESEARCH Pitfall 3 — verified via the GitHub issue cited in research).
- **`:where()` wrapping in `@custom-variant`** — keeps specificity at 0,0,0 so element-level selectors can still override.
- **theme-color hex pair derivation** — light `#0089b4` and dark `#22b5e1` are sRGB conversions of the `--accent` OKLCH tokens (light `oklch(0.58 0.13 225)`, dark `oklch(0.72 0.13 225)`) per RESEARCH Pattern 5. Comment in `index.html` documents the derivation for future re-computation.
- **Preserved `@keyframes slideUp`** — currently consumed by app code; not in Phase 22 scope to touch.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Plan's `<verify>` regex for Task 2 over-matched comment text**

- **Found during:** Task 2 verification (the second automated verification command).
- **Issue:** The plan's verification one-liner counted occurrences of `<meta name="theme-color"` in `index.html` and asserted exactly 2. The HTML comment block above the meta tags contains the literal text `<meta name="theme-color">` as descriptive prose, so the naive regex matched 3 occurrences (the comment + the two real `<meta>` tags) and the verification falsely failed. The file itself is exactly the text the plan's `<action>` block specifies.
- **Fix:** Re-ran the verification with a tightened regex that matches only real meta tags (`<meta name="theme-color" content="`). With that, the count is exactly 2, all other substrings present, and no legacy `#2563eb` exists. The file content was NOT changed — only the verification regex was corrected at run-time.
- **Files modified:** none (no fix to source — the plan's regex was the bug).
- **Verification:** `node -e "..."` with `<meta name=\"theme-color\" content=\"/g` regex returns 2; full `npm run build` succeeds; `dist/index.html` contains exactly 2 `<meta name="theme-color">` tags after Vite passes the HTML through.
- **Committed in:** N/A (no source change). Note for future plans/checkpoints: the literal substring count regex `<meta name="theme-color"` is unsafe when the file contains documentation comments referencing the same tag name. Use `<meta name="theme-color" content="` or AST-based parsing instead.

---

**Total deviations:** 1 auto-fixed (1 verification-regex bug — Rule 1).
**Impact on plan:** No source changes required. The plan's `<action>` block produced files that meet every `<acceptance_criteria>` substring assertion; only the plan's own verification one-liner had a regex over-match against descriptive comment text. No scope creep, no architectural impact, no security/correctness implications.

## Issues Encountered

- **`npm test -- --run` argv duplication.** The package.json `test` script already includes `--run` (`vitest --run`), so passing `--run` again on the CLI duplicates the option and Vitest 4 errors with "Expected a single value for option \"--run\", received [true, true]". Resolved by running `npm test` with no extra flags. Unrelated to Phase 22; just a test-CLI ergonomic note for future executors.
- **18 pre-existing test failures.** `npm test` reports 18 failures across `src/tests/persist-scoping.test.ts`, `src/tests/photo-migration.test.ts`, and `src/tests/layout.test.tsx` — all are `TypeError: localStorage.clear is not a function` originating in `beforeEach`/`afterEach` hooks. Already documented in `.planning/phases/22-foundation-tokens/deferred-items.md` as pre-existing at HEAD~3 (verified by Plan 22-01). NOT caused by this plan's changes — the modified files (`src/index.css`, `index.html`) are not loaded or referenced by any of the failing tests. The critical `src/tests/pwa-manifest.test.ts` (which Plan 22-01 modified to use a regex-based assertion) remains green: 4/4 pass after this plan's changes.

## Verification Results

**Per-task verification (during execution):**

- Task 1 verify-1 (substring sweep): `ok` — all 32 required substrings present, no legacy `#2563eb`/`#1d4ed8`.
- Task 1 verify-2 (`npm run build`): exit 0, Vite + Tailwind v4 plugin resolved the bridge with no warnings; CSS bundle grew from baseline as expected (now ships `tokens.css` + `base.css`).
- Task 2 verify-1 (substring sweep, corrected regex): `ok` — `<html lang="en" class="tpc">`, `prefers-color-scheme: dark`, `classList.add('tpc-dark')`, both `<meta name="theme-color" content="...">` tags, `<title>TPC Catalog</title>`, `<script type="module" src="/src/main.tsx">` all present; no legacy `#2563eb`; exactly 2 real theme-color meta tags.
- Task 2 verify-2 (`npm run build`): exit 0; built `dist/index.html` preserves `class="tpc"`, the inline script, and both meta tags.

**Plan-level verification (after both tasks):**

- `npm run build` — exit 0 (clean). `[VERIFIED]`
- `npm run lint` — exit 0 (clean). `[VERIFIED]`
- `npm test` — 374 pass, 18 pre-existing failures (documented in `deferred-items.md`), 5 skipped, 55 todo. `pwa-manifest.test.ts` remains 4/4 green. The 18 failures are unchanged from HEAD~3 baseline. `[VERIFIED, deferred per plan]`
- `dist/assets/index-*.css` post-build inspection (manual smoke, the only correctness signal for `@theme inline` per VALIDATION.md):
  - Bridge utilities emitted: `.bg-bg{background-color:var(--bg)}`, `.bg-bg-2{background-color:var(--bg-2)}`, `.font-display{font-family:var(--font-display)}` — values are bare `var(--bg)` etc., NOT `var(--color-bg)`, confirming `inline` modifier is working. `[VERIFIED]`
  - Class-based dark variant emitted: `:where(.tpc-dark,.tpc-dark *){background-color:var(--accent)}` etc. — every existing `dark:` utility is now scoped to `.tpc-dark` ancestor, not `prefers-color-scheme: dark`. `[VERIFIED]`

**Manual smoke (deferred to phase verifier):** Walking 5 routes (Sessions / Recording / Review / Settings / AccountManagement) in both light and dark mode is the canonical "no broken styling" gate per VALIDATION.md TOKENS-01b, TOKENS-02. This requires a live dev server and is not automatable. Recommended for the phase-level verifier (`/gsd-verify-work`) after all Phase 22 plans land.

## Next Phase Readiness

- **Plan 22-03 (init-theme runtime listener) is unblocked.** Plan 22-03 modifies `src/main.tsx` and adds `src/ui/tokens/initTheme.ts` — disjoint files from this plan, so it can run in parallel (per STATE.md) or after.
- **Plan 22-04 (TOKENS-04 build-time guard) is unblocked.** Plan 22-04 adds `src/ui/__tests__/no-hardcoded-literals.test.ts`. After this plan, `src/index.css` is free of hex literals and the test will pass on its first run for that file.
- **Phase 24 (LIB primitives) is ready to consume the bridge.** Components like `<Button>`, `<Badge>`, `<Card>` can use utilities like `bg-accent text-accent-ink rounded-md`, `bg-bg-2 text-ink-3`, `border-rule font-ui` without `bg-[var(--accent)]` arbitrary-value syntax.
- **Phase 25 (Theme toggle) can supersede the inline script** without touching `index.html`. The contract is: `ThemeProvider` reads user preference + adds/removes `.tpc-dark` on `<html>` based on it. The inline script's idempotent system-pref-only behavior means the first paint is always correct, and `ThemeProvider` flipping it after mount is also safe.
- **No new blockers.** No deferred items added to `deferred-items.md` from this plan.

## Self-Check: PASSED

- File `src/index.css` — FOUND (modified, contains `@theme inline {`, `@custom-variant dark (&:where(.tpc-dark, .tpc-dark *))`, all 21 color vars + 3 radii + 3 fonts, `@keyframes slideUp`, no legacy hex).
- File `index.html` — FOUND (modified, contains `<html lang="en" class="tpc">`, inline pre-paint script with `prefers-color-scheme: dark` and `classList.add('tpc-dark')`, exactly 2 paired theme-color meta tags with `#0089b4` and `#22b5e1`, no legacy `#2563eb`).
- File `.planning/phases/22-foundation-tokens/22-02-bridge-dark-variant-SUMMARY.md` — FOUND (this file).
- Commit `df11444` (Task 1) — FOUND in `git log --oneline`.
- Commit `15412c1` (Task 2) — FOUND in `git log --oneline`.

---

*Phase: 22-foundation-tokens*
*Plan: 02*
*Completed: 2026-04-30*
