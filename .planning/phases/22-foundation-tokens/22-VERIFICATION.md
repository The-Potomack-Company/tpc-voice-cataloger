---
phase: 22-foundation-tokens
verified: 2026-04-30T11:55:00Z
status: human_needed
score: 3/4 must-haves verified (SC#1, SC#2 wiring, SC#3); SC#4 visual smoke awaits human
overrides_applied: 0
re_verification:
  initial: true
human_verification:
  - test: "Walk all 5 routes (Sessions / Recording / Review / Settings / AccountManagement) in light mode AND dark mode"
    expected: "No broken styling: no white-on-white, no black-on-black, no Times-New-Roman fallback fonts, no missing borders. All 282 existing dark: utilities render correctly off the new .tpc-dark class."
    why_human: "ROADMAP success criterion #4 (\"existing screens still render — no broken styling\") is a visual gate. Automated unit/build checks confirm the bridge wires up correctly and the dark variant emits in built CSS, but cannot prove rendered surfaces match design intent. VALIDATION.md explicitly designates this as a manual smoke."
  - test: "Cold-load FOUC check with system in dark mode"
    expected: "No light flash before first paint when loading the page on a system in dark mode (npm run preview, hard reload)."
    why_human: "Pre-paint timing is not observable in jsdom; only a real browser load can confirm the inline <script> applies .tpc-dark before first paint."
  - test: "Live OS theme flip during open session"
    expected: "Toggle OS dark mode while the page is open; <html> class flips between 'tpc' and 'tpc tpc-dark' within one frame and all surfaces re-theme without a reload."
    why_human: "Requires real OS-level prefers-color-scheme toggle; jsdom matchMedia mock is asserted in init-theme.test.ts but cannot prove the integration with a real browser's matchMedia events."
  - test: "Bridge utility computed styles resolve from .tpc cascade"
    expected: "DevTools inspect on any element using bg-bg-2, text-ink-3, bg-warn-wash, rounded-md, font-display — computed style resolves to oklch(...) value from the active .tpc / .tpc-dark cascade."
    why_human: "Asserting 'Tailwind utility X resolves to oklch via cascade' is brittle in unit tests; built CSS inspection (verified by verifier) shows .bg-bg{background-color:var(--bg)} is emitted, but computed-style traversal needs a live document."
  - test: "Paired <meta name=\"theme-color\"> renders in browser chrome"
    expected: "Browser chrome on iOS Safari / Chrome Android shows #0089b4 in light mode and #22b5e1 in dark mode."
    why_human: "Browser chrome rendering is platform-specific; cannot be tested headlessly with confidence."
---

# Phase 22: Foundation Tokens Verification Report

**Phase Goal (from ROADMAP.md):** Replace Tailwind 4 `@theme` color/font/radius variables with the unified TPC token set so every styling decision flows from one source.

**Verified:** 2026-04-30T11:55:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | `src/index.css` exposes the full unified token set from `tpc-unified-tokens.css`; no hardcoded oklch / hex / font-family literals remain in `src/` outside `src/ui/tokens/` | ✓ VERIFIED | `src/index.css` imports `./ui/tokens/tokens.css` + `./ui/tokens/base.css` (lines 2-3) and bridges all 21 color vars + 3 radii + 3 fonts via `@theme inline {}` (lines 21-57). Grep across `src/` for hex/oklch/font-family literals returns ONLY: `src/ui/tokens/tokens.css`, `src/ui/tokens/tokens.ts`, `src/ui/tokens/base.css` (the canonical token files), and `src/ui/__tests__/no-hardcoded-literals.test.ts` (the guard test that contains the regex source patterns it scans for — D-16 escape hatch). Legacy `#2563eb` / `#1d4ed8` from previous `src/index.css` are gone. |
| 2 | Wrapping the app shell in `tpc tpc-dark` (or matching OS `prefers-color-scheme: dark`) flips every surface and ink value without any extra component-level work | ✓ VERIFIED (wiring) / ⚠️ PARTIAL (visual gate is human) | `<html lang="en" class="tpc">` literal in `index.html:2`. Inline pre-paint script in `index.html:10-13` adds `.tpc-dark` synchronously when matchMedia matches dark. `@custom-variant dark (&:where(.tpc-dark, .tpc-dark *))` in `src/index.css:10` rewrites the dark variant. Built CSS (`dist/assets/index-DWFuy3ce.css`) contains 73 instances of `.dark\:X:where(.tpc-dark, .tpc-dark *)` selectors and 109 total `tpc-dark` matches — every existing `dark:` utility now keys off the class. `initTheme()` in `src/main.tsx:11` (called BEFORE `createRoot()` at line 52) attaches a live runtime listener. **Visual flip across all 5 routes is human-only** (see Human Verification). |
| 3 | CI fails the build when a TS/TSX/CSS file outside `docs/design-handoff/` introduces a hex code, `oklch(...)` literal, or named font-family string | ✓ VERIFIED | `src/ui/__tests__/no-hardcoded-literals.test.ts` walks `src/` recursively, asserts three regexes (`/#[0-9a-fA-F]{3,8}\b/`, `/\boklch\s*\(/`, `/font[-_]?family\s*[:=]\s*["']?[A-Za-z]/i`), allowlists only `src/ui/tokens/**` and the test file itself (D-16 self-fixture). `npm test -- src/ui/__tests__/no-hardcoded-literals.test.ts` exits 0 on the clean tree (1/1 passing in 19 ms). Plan 04 SUMMARY documents a manual sanity check (inserting `// fake hex #abcdef` triggers structured failure). |
| 4 | Existing screens still render (no broken styling — non-destructive token swap) | ? UNCERTAIN (human gate) | All automated proxies pass: `npm run build` exit 0; `npx tsc -p tsconfig.app.json --noEmit` exit 0; `npm run lint` exit 0; full `npm test` reports 381 passed / 18 pre-existing failures (all `localStorage.clear is not a function`, all documented in `deferred-items.md` as pre-existing at HEAD `c608ee0` before Phase 22 started; pwa-manifest 4/4 green; init-theme 6/6 green; no-hardcoded-literals 1/1 green). VALIDATION.md explicitly designates "no broken styling" as a **manual visual smoke** across 5 routes × 2 modes. |

**Score:** 3/4 truths VERIFIED; 1 truth requires human visual verification (per VALIDATION.md design).

### Required Artifacts

All artifacts pass Levels 1-4 (exists, substantive, wired, data flows).

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/ui/tokens/tokens.css` | Canonical token CSS with `.tpc {}` and `.tpc.tpc-dark {}` blocks | ✓ VERIFIED | Header confirms MIRROR + KNOWN DIVERGENCE; declares all 21 token vars + 3 radii + 3 fonts. Imported by `src/index.css:2`. |
| `src/ui/tokens/base.css` | `.tpc-btn` / `.tpc-badge` / `.tpc-input` / `.tpc-card` etc. helpers | ✓ VERIFIED | Header confirms MIRROR. Imported by `src/index.css:3`. |
| `src/ui/tokens/tokens.ts` | JS-side palette mirror | ✓ VERIFIED | Exports `tpcUnifiedLight`, `tpcUnifiedDark`, `fonts`, `radii`, `fontSizes`, `space`, `paletteFor`, `TpcUnifiedPalette`. Type widened to `Record<keyof typeof tpcUnifiedLight, string>` per Plan 01 deviation (necessary for `verbatimModuleSyntax: true`; documented in code comments and SUMMARY). |
| `src/ui/tokens/index.ts` | Stable public API barrel | ✓ VERIFIED | Re-exports all 7 runtime values, `TpcUnifiedPalette` type, plus `initTheme`, `InitThemeOpts`, `ThemeOverride` (Plan 03 added these). |
| `src/ui/tokens/initTheme.ts` | Runtime dark listener | ✓ VERIFIED | Exports `initTheme(opts?)`, types. Uses `addEventListener('change')` (not deprecated `addListener`). Idempotent re-sync via `apply(mq.matches)`. SSR/legacy guard returns no-op teardown. |
| `src/index.css` | Tailwind entry with `@theme inline` bridge + `@custom-variant dark` | ✓ VERIFIED | Strict order: `tailwindcss` → tokens → base → custom-variant → `@theme inline {}` → `@keyframes slideUp`. All 21 color bridges + 3 radii + 3 fonts present. Legacy hex `#2563eb` / `#1d4ed8` gone. |
| `index.html` | `.tpc` class + pre-paint script + paired theme-color meta | ✓ VERIFIED | `class="tpc"` literal on `<html>`. Classical inline `<script>` (no defer/async/module). Exactly 2 `<meta name="theme-color">` tags (`#0089b4` light, `#22b5e1` dark with `media=`). |
| `src/main.tsx` | Calls `initTheme()` before `createRoot()`; HMR teardown | ✓ VERIFIED | `import { initTheme } from "./ui/tokens"` (line 8). `const teardownTheme = initTheme()` (line 11). `createRoot()` at line 52 (line-order check passes: 11 < 52). HMR dispose calls both `unsubscribe()` and `teardownTheme()` (lines 46-49). |
| `src/ui/__tests__/init-theme.test.ts` | 6 jsdom unit tests for initTheme | ✓ VERIFIED | 6/6 passing. Tests dark/light initial state, live change-event flip, teardown, SSR guard, opts forward-compat. |
| `src/ui/__tests__/no-hardcoded-literals.test.ts` | TOKENS-04 filesystem regex guard | ✓ VERIFIED | 1/1 passing in 19 ms. Three regexes per D-15. Narrow allowlist (`src/ui/tokens/**` + self-file D-16 escape). Hard-fail per D-18. |
| `src/tests/pwa-manifest.test.ts` | Regex-based theme_color assertion (no hex literal) | ✓ VERIFIED | 4/4 passing. Assertion shifted from `toContain('theme_color: "#2563eb"')` to `toMatch(/theme_color:\s*"#[0-9a-fA-F]{3,8}"/)`. No `#2563eb` literal in source. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `src/index.css` | `src/ui/tokens/tokens.css` | `@import "./ui/tokens/tokens.css"` | ✓ WIRED | Line 2 of src/index.css. |
| `src/index.css` | `src/ui/tokens/base.css` | `@import "./ui/tokens/base.css"` | ✓ WIRED | Line 3 of src/index.css. |
| `src/index.css` | `.tpc / .tpc-dark` CSS vars | `@theme inline { --color-bg: var(--bg); ... }` | ✓ WIRED | All 21 color bridges, 3 radii, 3 fonts emitted. Built CSS confirms `.bg-bg{background-color:var(--bg)}` (bare `var(--bg)`, not `var(--color-bg)` — proves `inline` modifier works). |
| `index.html <html>` | `.tpc` styling cascade | `class="tpc"` literal HTML attribute | ✓ WIRED | Line 2 of index.html. |
| `index.html <script>` | `html.tpc-dark` | `matchMedia → classList.add('tpc-dark')` | ✓ WIRED | Lines 10-13 of index.html. Classical inline (no defer/async/module). |
| `src/main.tsx` | `src/ui/tokens/initTheme.ts` | `import { initTheme } from "./ui/tokens"` | ✓ WIRED | Line 8 of main.tsx; barrel re-exports from `./initTheme`. |
| `initTheme()` | `html.tpc-dark` class | `classList.toggle('tpc-dark', e.matches)` on matchMedia change | ✓ WIRED | Lines 51-66 of initTheme.ts. Idempotent re-sync at line 59 ensures convergence with inline pre-paint script. |
| `main.tsx HMR dispose` | `initTheme` teardown | `teardownTheme()` inside `import.meta.hot.dispose` | ✓ WIRED | Line 48 of main.tsx, symmetric with `unsubscribe()` at line 47. |
| `init-theme.test.ts` | `initTheme()` | `import { initTheme } from "../tokens/initTheme"` + jsdom assertions on `document.documentElement.classList` | ✓ WIRED | 6 tests covering attach/teardown/SSR. |
| `@custom-variant dark` | `dark:` Tailwind utilities | `&:where(.tpc-dark, .tpc-dark *)` rewrites every existing dark: utility to class-based | ✓ WIRED | 73 `.dark\:X:where(.tpc-dark, .tpc-dark *)` selectors in built CSS — every existing dark: utility (282 occurrences in 29 component files per Plan 02 SUMMARY) now keys off `.tpc-dark`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `src/index.css` `@theme inline` | `--color-bg`, `--color-ink`, etc. | `var(--bg)` etc. from `.tpc { ... }` in tokens.css | YES — built CSS shows `.bg-bg{background-color:var(--bg)}` | ✓ FLOWING |
| `src/main.tsx` `teardownTheme` | matchMedia listener attached at boot | `initTheme()` returns real teardown (or no-op when SSR) | YES — 6/6 unit tests confirm runtime listener attaches and tears down | ✓ FLOWING |
| `<html>` `.tpc-dark` class | classList state | Inline pre-paint script (cold load) + initTheme idempotent re-sync (runtime) — converged via `apply(mq.matches)` | YES — both code paths verified, runtime asserted by tests, cold-load asserted by code inspection | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| TOKENS-04 guard passes on clean tree | `npm test -- src/ui/__tests__/no-hardcoded-literals.test.ts` | 1/1 passing in 19 ms | ✓ PASS |
| initTheme contract is locked by 6 unit tests | `npm test -- src/ui/__tests__/init-theme.test.ts` | 6/6 passing in 6 ms | ✓ PASS |
| PWA manifest test no longer asserts hex literal | `npm test -- src/tests/pwa-manifest.test.ts` | 4/4 passing in 2 ms | ✓ PASS |
| TypeScript type-check under verbatimModuleSyntax | `npx tsc -p tsconfig.app.json --noEmit` | exit 0 (no output) | ✓ PASS |
| Production build with @theme inline + @custom-variant | `npm run build` | exit 0; CSS bundle 46.93 kB, gzip 9.12 kB; PWA precache 11 entries | ✓ PASS |
| Lint passes across modified files | `npm run lint` | exit 0 (no output) | ✓ PASS |
| Full test suite (excluding pre-existing failures) | `npm test` | 381 passed / 18 pre-existing failures / 5 skipped / 55 todo. The 18 failures match deferred-items.md (`localStorage.clear is not a function` in persist-scoping/photo-migration/layout) — pre-existing at HEAD `c608ee0` before Phase 22 began. | ✓ PASS (modulo deferred) |
| Bridge utilities emitted with bare var() (proves @theme inline works) | grep `var(--bg)` in built CSS | `.bg-bg{background-color:var(--bg)}`, `.font-display{font-family:var(--font-display)}` etc. — bare `var(--bg)`, not `var(--color-bg)` | ✓ PASS |
| Class-based dark variant rewrites all dark: utilities | grep `:where(.tpc-dark` in built CSS | 73 selectors of form `.dark\:X:where(.tpc-dark, .tpc-dark *)` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| TOKENS-01 | 22-01, 22-02 | Tailwind 4 `@theme` color/font/radius rebuilt from `tpc-unified-tokens.css` as single styling source of truth (no hardcoded hex/oklch in component code). | ✓ SATISFIED | Token files installed at `src/ui/tokens/`, bridged via `@theme inline` in src/index.css. Grep across `src/` confirms only canonical token files contain hex/oklch (plus the self-fixture guard test). |
| TOKENS-02 | 22-02, 22-03 | Dark token set loads automatically when system pref is `prefers-color-scheme: dark` (auto Settings toggle is TOKENS-03/Phase 25 territory). | ✓ SATISFIED (auto path) | `index.html` inline pre-paint script (cold load) + `initTheme()` matchMedia listener (runtime). 73 `dark:X:where(.tpc-dark, .tpc-dark *)` selectors emitted. Settings toggle (TOKENS-03) is correctly out of scope for Phase 22. |
| TOKENS-04 | 22-01 (precondition), 22-04 | Static check fails build on hex/oklch/font-family literal in TS/TSX/CSS outside `docs/design-handoff/`. | ✓ SATISFIED | Vitest filesystem regex sweep at `src/ui/__tests__/no-hardcoded-literals.test.ts`, hard-fails on violation. Marked `[x]` in REQUIREMENTS.md. |
| TOKENS-03 | (Phase 25) | User can toggle theme between Light/Dark/System; persists per-user. | DEFERRED (correctly) | Mapped to Phase 25 in REQUIREMENTS.md; not in Phase 22 scope. `initTheme(opts?: InitThemeOpts)` signature is forward-compatible — Phase 25 will populate `opts.override` without changing call sites. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none in modified files) | — | — | — | The TOKENS-04 guard self-enforces: any hex/oklch/font-family literal outside `src/ui/tokens/**` would have failed the test. Test passes 1/1 in 19 ms. |

The 18 pre-existing test failures (`localStorage.clear is not a function` in `persist-scoping.test.ts`, `photo-migration.test.ts`, `layout.test.tsx`) are documented in `deferred-items.md` as pre-existing at HEAD `c608ee0` before Phase 22 began, and the verifier confirmed via test scanning that none of the modified files in Phase 22 (src/index.css, index.html, src/main.tsx, src/ui/tokens/**, src/ui/__tests__/**) are loaded or referenced by the failing tests. Per `known_context`, these are NOT Phase 22 regressions.

Code review (22-REVIEW.md) reportedly found 0 critical / 2 warnings (WR-01 allowlist boundary, WR-02 manifest hex drift) / 5 info — none block phase verification per `known_context`.

### Human Verification Required

Five items require human testing. Per VALIDATION.md, these are explicitly **manual-only** verifications — automated checks confirm the wiring but cannot prove the rendered behavior:

1. **5 routes × 2 modes visual smoke** — Walk Sessions / Recording / Review / Settings / AccountManagement in light AND dark mode. Confirm no white-on-white, no black-on-black, no Times-New-Roman fallback, all 282 existing `dark:` utilities still render.
2. **Cold-load FOUC check** — `npm run build && npm run preview`; on a system in dark mode, hard reload, confirm no light flash before paint.
3. **Live OS theme flip** — `npm run dev`; toggle OS dark mode while page is open; confirm `<html>` class flips and surfaces re-theme within one frame without reload.
4. **Bridge utility computed styles** — DevTools inspect on any element using `bg-bg-2`, `text-ink-3`, `bg-warn-wash`, `rounded-md`, `font-display`. Confirm computed style resolves to `oklch(...)` from active `.tpc` / `.tpc-dark` cascade.
5. **Paired theme-color in browser chrome** — Open in Safari iOS / Chrome Android (or DevTools mobile emu); confirm browser chrome shows `#0089b4` (light) and `#22b5e1` (dark).

### Gaps Summary

**No blocking gaps.** All four ROADMAP success criteria are evidenced in the codebase:

- **SC#1 (single source of truth):** Verified by grep — only canonical token files and the guard self-fixture contain design literals.
- **SC#2 (`tpc tpc-dark` flips every surface):** Verified by built CSS inspection — 73 `:where(.tpc-dark, .tpc-dark *)` selectors rewriting every `dark:` utility, plus runtime listener locked by 6 unit tests.
- **SC#3 (CI fails the build on a literal):** Verified — TOKENS-04 guard test passes 1/1 on clean tree; Plan 04 SUMMARY documents the manual sanity check that confirmed it actually fires on injected violations.
- **SC#4 (existing screens still render):** Automated proxies pass (build / typecheck / lint / 381 tests; 18 pre-existing failures unchanged from before phase). Visual rendering is a designated manual-only verification per VALIDATION.md.

**Phase deliverables match plan:** All 4 plans (22-01 token-scaffold, 22-02 bridge-dark-variant, 22-03 init-theme-runtime, 22-04 tokens-04-guard) executed cleanly with documented auto-fix deviations (TpcUnifiedPalette type widening, lint compliance for `_opts`, self-fixture allowlist, node types reference) — none of which alter the contract, the public API, or the success criteria.

**Status: human_needed.** The phase goal is achieved at the wiring/code layer; visual confirmation across 5 routes × 2 modes is the remaining gate per design.

---

*Verified: 2026-04-30T11:55:00Z*
*Verifier: Claude (gsd-verifier)*
