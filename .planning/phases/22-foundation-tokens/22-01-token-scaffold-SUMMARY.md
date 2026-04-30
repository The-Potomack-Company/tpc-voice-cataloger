---
phase: 22-foundation-tokens
plan: 01
subsystem: ui
tags: [tokens, design-system, tailwind-v4, css-variables, oklch]

# Dependency graph
requires: []
provides:
  - Canonical TPC token CSS at src/ui/tokens/tokens.css (.tpc and .tpc.tpc-dark cascade)
  - Companion base CSS at src/ui/tokens/base.css (.tpc-btn / .tpc-badge / .tpc-input / .tpc-card / .tpc-eyebrow / .tpc-display / .tnum / .bar-track / .bar-fill helper classes)
  - JS-side palette mirror at src/ui/tokens/tokens.ts (tpcUnifiedLight, tpcUnifiedDark, fonts, radii, fontSizes, space, paletteFor, TpcUnifiedPalette)
  - Stable public API barrel at src/ui/tokens/index.ts for src/ui consumers and the future dashboard repo
  - PWA manifest test now uses regex-based theme_color assertion (no design literals)
affects:
  - 22-02-bridge-dark-variant (imports tokens.css and base.css from src/index.css)
  - 22-03-init-theme-runtime (adds initTheme.ts next to tokens.ts and uncomments the barrel line)
  - 22-04-tokens-04-guard (filesystem regex sweep relies on tokens dir being the only allowlisted hex/oklch source)
  - 24-component-library (consumes tokens via barrel re-export; future dashboard repo also consumes)

# Tech tracking
tech-stack:
  added: []  # No new dependencies — Tailwind v4 + Vitest already in package.json
  patterns:
    - "CSS-first design tokens — .tpc / .tpc.tpc-dark cascade declares CSS custom properties consumed by every component"
    - "TS↔CSS manual-mirror pattern — src/ui/tokens/tokens.ts and tokens.css are kept in sync by hand, both carry header comments documenting the manual-mirror status and the saturated-tone divergence (sand/ok/warn/err in dark mode)"
    - "Barrel re-export establishes stable public API surface for src/ui — consumers import from `./ui/tokens` (or future `@/ui/tokens` alias)"

key-files:
  created:
    - "src/ui/tokens/tokens.css — verbatim copy of docs/design-handoff/tpc-unified-tokens.css plus mirror-status header"
    - "src/ui/tokens/base.css — verbatim copy of docs/design-handoff/tpc-unified-base.css plus mirror-status header"
    - "src/ui/tokens/tokens.ts — verbatim copy of docs/design-handoff/tpc-unified-tokens.ts plus expanded mirror-status header; type widened on TpcUnifiedPalette per Rule 1 deviation"
    - "src/ui/tokens/index.ts — Phase 22 barrel re-export establishing the stable public API; initTheme line commented out for Plan 22-03 to uncomment"
  modified:
    - "src/tests/pwa-manifest.test.ts — replaced literal #2563eb assertion with regex toMatch(/theme_color:\\s*\"#[0-9a-fA-F]{3,8}\"/) so TOKENS-04 will not flag it"

key-decisions:
  - "Token type contract widened — TpcUnifiedPalette redefined as Record<keyof typeof tpcUnifiedLight, string> (rather than typeof tpcUnifiedLight) so the dark palette's genuinely different oklch strings assign correctly under strict + verbatimModuleSyntax. Public name and shape contract preserved."
  - "PWA manifest test fixture remediated via Option A (regex assertion) rather than Option B (allowlist file). Keeps the TOKENS-04 allowlist narrow per CONTEXT D-16."
  - "Manual-mirror header comments on tokens.css and tokens.ts explicitly document the saturated-tone divergence (CSS dark omits --sand/--ok/--warn/--err; TS redeclares all four with brighter values) so future maintainers do not accidentally 'fix' it."

patterns-established:
  - "Mirror-status header comment block at top of every src/ui/tokens/* file — names the source-of-record, the manual-sync requirement, and any documented intentional divergences from the handoff source."
  - "Type-widening on Record-of-strings palette — when a TS const carries `as const` AND a sibling const must satisfy a structural shape with different values, prefer Record<keyof T, ValueType> over typeof T to avoid literal-type collisions."
  - "Test fixture decoupling from design literals — tests that assert on file contents must not embed design-system literals; use regex assertions or non-design fixture values to keep TOKENS-04 allowlist narrow."

requirements-completed: [TOKENS-01, TOKENS-04]

# Metrics
duration: 7min
completed: 2026-04-30
---

# Phase 22 Plan 01: Token Scaffold Summary

**Canonical TPC tokens installed at `src/ui/tokens/` (CSS + base + TS + barrel) and the one pre-existing TOKENS-04 violation in the PWA manifest test cleared — foundation laid for Plans 22-02 / 22-03 / 22-04 to wire the bridge, the runtime listener, and the build-time guard.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-30T15:09:28Z
- **Completed:** 2026-04-30T15:16:17Z
- **Tasks:** 3
- **Files created:** 4
- **Files modified:** 1

## Accomplishments

- **Canonical token files in build graph.** `src/ui/tokens/tokens.css` and `src/ui/tokens/base.css` are byte-equivalent to the `docs/design-handoff/` source files (with prepended mirror-status header comments). Plan 22-02 can now import them from `src/index.css` to drive the `@theme inline` bridge.
- **JS-side palette mirror with stable barrel API.** `src/ui/tokens/tokens.ts` exports `tpcUnifiedLight`, `tpcUnifiedDark`, `fonts`, `radii`, `fontSizes`, `space`, `paletteFor`, and `TpcUnifiedPalette`; `src/ui/tokens/index.ts` re-exports the runtime values and types so the future dashboard repo can consume them via a single import path.
- **TOKENS-04 precondition cleared.** The PWA manifest test's literal `theme_color: "#2563eb"` assertion is replaced with a regex match — Plan 22-04's filesystem regex sweep will not flag this fixture file, and the TOKENS-04 allowlist remains narrow per CONTEXT D-16.
- **Manual-mirror divergence documented in source.** Both `tokens.css` and `tokens.ts` now carry header comments explicitly calling out the intentional saturated-tone divergence in dark mode (CSS cascade-inherits `--sand` / `--ok` / `--warn` / `--err`; TS redeclares all four with brighter values) — future maintainers will not silently "fix" the divergence.

## Task Commits

Each task was committed atomically:

1. **Task 1: Copy token CSS files verbatim with mirror-status header** — `f254df4` (feat)
2. **Task 2: Copy token TS verbatim and create barrel index** — `8660e98` (feat)
3. **Task 3: Modify pwa-manifest.test.ts to remove hex literals (TOKENS-04 precondition)** — `2f624cc` (test)

**Plan metadata commit:** appended after STATE.md / ROADMAP.md / REQUIREMENTS.md updates.

## Files Created/Modified

- `src/ui/tokens/tokens.css` — verbatim copy of `docs/design-handoff/tpc-unified-tokens.css` (`.tpc` light block + `.tpc.tpc-dark` dark block; surfaces, rules, ink, accent, sand, semantic, type, radii) with prepended mirror-status header documenting the saturated-tone divergence.
- `src/ui/tokens/base.css` — verbatim copy of `docs/design-handoff/tpc-unified-base.css` (`.tpc-btn*`, `.tpc-badge*`, `.tpc-dot`, `.tpc-input` + `:focus`, `.tpc-card`, `.hide-scroll`, `.tpc-kbd`, `.tpc-placeholder`, `.bar-track`, `.bar-fill`, `.tpc-eyebrow`, `.tpc-display`, `.tnum`) with prepended mirror-status header.
- `src/ui/tokens/tokens.ts` — mirror of `docs/design-handoff/tpc-unified-tokens.ts` with expanded mirror-status header; exports `tpcUnifiedLight`, `tpcUnifiedDark`, `fonts`, `radii`, `fontSizes`, `space`, `paletteFor`, `TpcUnifiedPalette`. `TpcUnifiedPalette` widened to `Record<keyof typeof tpcUnifiedLight, string>` (Rule 1 deviation, see below).
- `src/ui/tokens/index.ts` — barrel re-export. Runtime values exported via `export { ... } from "./tokens"`; type-only export `export type { TpcUnifiedPalette }` per `verbatimModuleSyntax: true`. The `initTheme` line is commented out and Plan 22-03 will uncomment it.
- `src/tests/pwa-manifest.test.ts` — single `it(...)` block updated; assertion shifted from `toContain('theme_color: "#2563eb"')` to `toMatch(/theme_color:\s*"#[0-9a-fA-F]{3,8}"/)`. Other three tests (name, display, icon entries) untouched.

## Decisions Made

- **Type-widening of `TpcUnifiedPalette`** (forced by `verbatimModuleSyntax: true` + `as const` on the light palette). Documented in detail under Deviations.
- **Option A (regex assertion) chosen over Option B (allowlist)** for the PWA manifest test — preserves the narrow allowlist policy from CONTEXT D-16 (the only allowlisted prefix going into Plan 22-04 is `src/ui/tokens/**`).
- **Header comments include both manual-mirror status AND the documented saturated-tone divergence** so the divergence is visible at the source-of-truth level, not buried in research docs.
- **`@theme` directives intentionally absent from `tokens.css` and `base.css`** per RESEARCH Pitfall 3 — the bridge belongs in `src/index.css` (Plan 22-02 territory).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Widened `TpcUnifiedPalette` from `typeof tpcUnifiedLight` to `Record<keyof typeof tpcUnifiedLight, string>`**
- **Found during:** Task 2 (the `npx tsc -p tsconfig.app.json --noEmit` verify step)
- **Issue:** The handoff source file has `as const` on `tpcUnifiedLight`, which makes each value a string-literal type (e.g., `"oklch(0.985 0.003 240)"`). The handoff source then declares `tpcUnifiedDark: typeof tpcUnifiedLight = { ... }` with genuinely different values (`"oklch(0.19 0.015 255)"` etc.). Under our project's `strict: true` + `verbatimModuleSyntax: true` + `noUncheckedSideEffectImports: true` config, TypeScript correctly rejects every dark assignment as a literal-type mismatch. 21 TS2322 errors per `tsc --noEmit`. The plan instructed a "verbatim copy" but also required `tsc --noEmit` to exit 0 — these are mutually exclusive given the handoff's pre-existing type bug.
- **Fix:** Two edits in `src/ui/tokens/tokens.ts`:
  - Replaced the type annotation on `tpcUnifiedDark` from `typeof tpcUnifiedLight` to `Record<keyof typeof tpcUnifiedLight, string>` with a comment explaining the divergence from the handoff source.
  - Redefined `TpcUnifiedPalette` from `typeof tpcUnifiedLight` to `Record<keyof typeof tpcUnifiedLight, string>` so `paletteFor`'s return type is satisfied by both palettes.
- **Files modified:** `src/ui/tokens/tokens.ts`
- **Verification:** `npx tsc -p tsconfig.app.json --noEmit` exits 0. Public API surface unchanged (`TpcUnifiedPalette` still exported, same name; same keys). The runtime shape contract is preserved — only the value-types are widened from literal-string to `string`.
- **Committed in:** `8660e98` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix is necessary for the plan's own automated verify step to pass (`tsc --noEmit`). It does not change the runtime behavior, the exported names, or the handoff design values. The handoff source itself has the same type bug; if the handoff repo is updated later, the same widening should apply there.

## Issues Encountered

- **Pre-existing test-suite failures surfaced during overall verification.** `npm test` reports 18 failed tests across 3 files (`persist-scoping.test.ts`, `photo-migration.test.ts`, and a third with the same root cause) — `TypeError: localStorage.clear is not a function`. Verified by `git checkout HEAD~3` that these failures predate this plan; they are NOT caused by Plan 22-01's changes. Recorded in `.planning/phases/22-foundation-tokens/deferred-items.md`. Out of scope per the SCOPE BOUNDARY rule. Does not block downstream plans 22-02 / 22-03 / 22-04.
- **Pre-existing hex literals in `src/index.css`** (`#2563eb`, `#1d4ed8`) confirmed by `git log -S` to predate this plan (added in commit `6e9a087`, project scaffold). Plan 22-02 will replace this entire `@theme` block with the full `@theme inline` bridge per CONTEXT D-12. Recorded in `deferred-items.md`. No action required.
- **`npm test -- ... --run` invocation pattern broke.** The `test` script in `package.json` already includes `--run`; appending another `--run` produced "Expected a single value for option '--run', received [true, true]". Worked around by dropping the redundant flag (`npm test -- src/tests/pwa-manifest.test.ts`). The plan's `<verify>` block as written would fail in environments where the npm script already supplies `--run`; future plans should be aware.

## User Setup Required

None — no external service configuration required. The token files are pure data declarations; no secrets, no environment variables, no third-party services touched.

## Self-Check

```
git log --oneline:
  2f624cc test(22-01): replace pwa-manifest hex literal with regex assertion
  8660e98 feat(22-01): add unified token TS mirror and barrel re-export
  f254df4 feat(22-01): copy unified token CSS files to src/ui/tokens/

Files verified to exist:
  FOUND: src/ui/tokens/tokens.css
  FOUND: src/ui/tokens/base.css
  FOUND: src/ui/tokens/tokens.ts
  FOUND: src/ui/tokens/index.ts
  FOUND: src/tests/pwa-manifest.test.ts (modified)

Commits verified:
  FOUND: f254df4
  FOUND: 8660e98
  FOUND: 2f624cc

Build/typecheck status:
  npx tsc -p tsconfig.app.json --noEmit  →  exit 0
  npm run build                          →  exit 0
  npm run lint                           →  exit 0
  npm test -- src/tests/pwa-manifest.test.ts  →  4/4 passing
```

## Self-Check: PASSED

## Next Phase Readiness

**Plan 22-02 (bridge-dark-variant) can begin.** Required imports are in place:
- `@import "./ui/tokens/tokens.css"` → reads `src/ui/tokens/tokens.css` ✓
- `@import "./ui/tokens/base.css"` → reads `src/ui/tokens/base.css` ✓
- `@theme inline { ... }` block → goes in `src/index.css` (NOT in any token file, per RESEARCH Pitfall 3)

**Plan 22-03 (init-theme-runtime)** can land `src/ui/tokens/initTheme.ts` next to `tokens.ts` and uncomment the commented-out export line in `src/ui/tokens/index.ts`.

**Plan 22-04 (tokens-04-guard)** can begin its filesystem regex sweep with the allowlist `src/ui/tokens/**`. The PWA manifest test no longer carries any hex literal, so the guard's first run will not produce a false positive.

**Pre-existing test failures** in `persist-scoping.test.ts` / `photo-migration.test.ts` need a separate maintenance pass at some point but do NOT block Phase 22 plans 02 / 03 / 04. They are unrelated to the token system.

---

*Phase: 22-foundation-tokens*
*Completed: 2026-04-30*
