---
phase: 22-foundation-tokens
plan: 03
subsystem: ui
tags: [tokens, dark-mode, runtime, vitest, jsdom, matchMedia, hmr, react-19]

# Dependency graph
requires:
  - phase: 22-foundation-tokens
    provides: "Plan 01 token scaffold (src/ui/tokens/{tokens.css,base.css,tokens.ts,index.ts}); the barrel had a commented placeholder line for initTheme that this plan uncommented"
provides:
  - "src/ui/tokens/initTheme.ts: matchMedia('change') runtime listener that flips .tpc-dark on <html> live, returns idempotent teardown"
  - "Stable public API on the barrel: initTheme + InitThemeOpts/ThemeOverride types exported from src/ui/tokens"
  - "main.tsx wiring: initTheme() called before createRoot(); HMR dispose tears down theme listener alongside auth unsubscribe"
  - "Vitest unit test (6 cases) locking the Phase-25 contract: opts shape, listener attach/teardown, SSR/legacy guard, idempotent re-sync, live change-event flip"
affects: [22-foundation-tokens (Plan 04 phase verify), 25-theme-toggle, 24-lib-primitives]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-piece dark-mode bootstrap: inline pre-paint script (Plan 02) + runtime matchMedia listener (this plan) — converged via idempotent re-sync on initTheme() call"
    - "Extensible function signature: opts param accepted and ignored in current phase, populated by future phase without changing call sites (D-08 forward-compat with Phase 25)"
    - "Teardown-returning side-effect helpers: mirror the existing useAuthStore unsubscribe pattern in main.tsx so HMR dispose is symmetric"
    - "TDD with separate RED/GREEN commits: failing test landed first, implementation landed second, both verified independently"

key-files:
  created:
    - "src/ui/tokens/initTheme.ts"
    - "src/ui/__tests__/init-theme.test.ts"
  modified:
    - "src/ui/tokens/index.ts"
    - "src/main.tsx"

key-decisions:
  - "Phase 22 stays system-pref-only (D-08): initTheme accepts opts.override but ignores it; Phase 25 will populate. Implemented via `void opts;` to satisfy ESLint while preserving the documented forward-compat shape."
  - "Idempotent re-sync inside initTheme: apply(mq.matches) runs on every call so the inline pre-paint script (Plan 02) and the runtime listener converge — no race between HTML parse and React mount."
  - "SSR/legacy guard returns a no-op teardown so callers can store the return value unconditionally (no `if (teardown) teardown()` ceremony in main.tsx HMR)."

patterns-established:
  - "Phase 25 ThemeProvider extension contract: opts.override === 'system' | undefined preserves Phase 22 behavior; opts.override === 'light' | 'dark' will short-circuit listener and force class state. Teardown shape stays stable so attach/detach during user toggle does not leak listeners."
  - "Module-top-level side-effect helpers (initTheme, useAuthStore.initialize) live in main.tsx outside any React tree — runs exactly once per page load, immune to StrictMode dev double-mount, and safe to call before createRoot()."

requirements-completed: [TOKENS-02]

# Metrics
duration: 6min
completed: 2026-04-30
---

# Phase 22 Plan 03: Init Theme Runtime Summary

**matchMedia('change') runtime listener that flips .tpc-dark on <html> live during a session, with extensible opts/teardown contract locked for Phase 25 by 6 jsdom unit tests**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-30T15:23:21Z
- **Completed:** 2026-04-30T15:29:05Z
- **Tasks:** 2 (Task 1 split into RED + GREEN per TDD)
- **Files created:** 2 (`src/ui/tokens/initTheme.ts`, `src/ui/__tests__/init-theme.test.ts`)
- **Files modified:** 2 (`src/ui/tokens/index.ts`, `src/main.tsx`)

## Accomplishments

- Runtime arm of the dark-mode bootstrap is live: with this plan, an OS dark/light flip during an open session re-themes the page within one frame without a reload.
- `initTheme()` returns an idempotent teardown so Phase 25's `ThemeProvider` can supersede cleanly when the user picks a non-System mode — no listener leaks.
- Phase 22 stays strictly system-pref-only per D-08: `initTheme` does not read localStorage, does not query Supabase, does not ship UI, and the `opts.override` parameter is accepted-and-ignored so Phase 25 populates it without touching call sites.
- The barrel at `src/ui/tokens/index.ts` re-exports `initTheme`, `InitThemeOpts`, and `ThemeOverride` — the stable public API the future dashboard repo will consume per CONTEXT specifics.
- HMR dispose is symmetric: `import.meta.hot.dispose(() => { unsubscribe(); teardownTheme(); })` mirrors the existing auth pattern so dev reloads do not leak listeners.
- 6 jsdom unit tests lock the Phase-25 contract: dark/light initial sync, live change-event flip, teardown removes listener, SSR/legacy guard returns a no-op teardown, opts.override forward-compat. All 6 green.

## Task Commits

Each task was committed atomically. Task 1 was a TDD task and produced two commits (RED then GREEN); Task 2 produced one commit:

1. **Task 1 RED: Failing initTheme unit test** — `782b1d7` (test)
2. **Task 1 GREEN: initTheme implementation** — `7f62a3b` (feat)
3. **Task 2: Wire initTheme into main.tsx + barrel update** — `5a9704c` (feat)

## TDD Gate Compliance

- RED gate: `782b1d7 test(22-03): add failing test for initTheme runtime listener` — verified failing in isolation before GREEN landed (`Failed to resolve import "../tokens/initTheme"`).
- GREEN gate: `7f62a3b feat(22-03): implement initTheme runtime dark-mode listener` — 6/6 tests pass after this commit.
- No REFACTOR commit needed (the GREEN implementation matched the documented contract verbatim; lint cleanup folded into Task 2 commit since it modified call-site shape, not behavior).

## Files Created/Modified

- `src/ui/tokens/initTheme.ts` (created, 67 lines) — Runtime dark-mode listener helper. Exports `initTheme(opts?: InitThemeOpts): () => void`, `InitThemeOpts`, `ThemeOverride`. Idempotent, SSR-safe, `addEventListener('change', ...)`-based.
- `src/ui/__tests__/init-theme.test.ts` (created, 125 lines) — 6 Vitest cases driven by an in-test `FakeMQL` factory that lets each test override `window.matchMedia` to simulate dark/light/missing scenarios. Lives under `src/ui/__tests__/` so it is type-checked by `tsconfig.app.json` (`src/tests/` is excluded).
- `src/ui/tokens/index.ts` (modified) — Uncommented the `initTheme` re-export and added `export type { InitThemeOpts, ThemeOverride }` (required by `verbatimModuleSyntax: true`).
- `src/main.tsx` (modified) — Added `import { initTheme } from "./ui/tokens";`. Added `const teardownTheme = initTheme();` immediately above the existing `useAuthStore.getState().initialize()` call so the listener attaches before any other side-effect-producing code. Updated `import.meta.hot.dispose` to call `teardownTheme()` alongside `unsubscribe()`.

## Decisions Made

- **`void opts;` pattern over `_opts` rename** — see Deviations §1 for full rationale.
- **No REFACTOR commit** — the implementation matched the contract on first pass; the lint deviation modified the param signature (a contract change, not a refactor), so the fix landed inside the Task 2 wiring commit rather than as a standalone third commit.
- **Idempotent re-sync inside initTheme** — `apply(mq.matches)` runs on every call (not just on listener events) so the inline pre-paint script (Plan 02) and this runtime path converge regardless of which fired first or whether the OS preference changed between HTML parse and React boot.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ESLint `@typescript-eslint/no-unused-vars` flagged `_opts` parameter**

- **Found during:** Task 2 verification (`npm run lint`).
- **Issue:** The plan's `<action>` section asserted that "the leading underscore on `_opts` signals 'intentionally unused in Phase 22' and matches the project's existing convention for ignored params (no ESLint rule will flag it)." This premise did not hold for this project — `eslint.config.js` uses `tseslint.configs.recommended` directly with no `argsIgnorePattern: "^_"` override, so `_opts` triggered `'_opts' is assigned a value but never used  @typescript-eslint/no-unused-vars` and blocked the verification gate.
- **Fix:** Renamed `_opts` → `opts` and added an explicit `void opts;` statement at the top of the function body, with a comment explaining the Phase 22 / Phase 25 contract. This satisfies the lint rule (the param is "used" by the void expression) while preserving the documented behavior — `opts` is still ignored at runtime, the function signature is still `(opts?: InitThemeOpts)` so Phase 25 can populate it without changing call sites.
- **Files modified:** `src/ui/tokens/initTheme.ts`
- **Verification:** `npm run lint` exits 0; `npm test -- src/ui/__tests__/init-theme.test.ts` still 6/6; `npx tsc -p tsconfig.app.json --noEmit` exits 0; `npm run build` exits 0.
- **Committed in:** `5a9704c` (Task 2 commit, alongside the main.tsx + barrel changes).
- **Phase 25 impact:** Zero. The rename `_opts` → `opts` is the natural name Phase 25 will read from anyway. The `void opts;` statement should be removed when Phase 25 actually consumes `opts.override` — a one-line change.

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Strictly required to pass the verification gate. No scope creep; the fix preserves the documented Phase-22/Phase-25 contract verbatim and lands in the same commit as the wiring task that surfaced it.

## Issues Encountered

- **`npm test --run` double-flag error.** First test invocation used `npm test -- src/ui/__tests__/init-theme.test.ts --run`, which forwarded `--run` twice to vitest because the npm script `"test": "vitest --run"` already includes it. Vitest 4 errors with `Expected a single value for option "--run", received [true, true]`. Resolved by dropping the user-side `--run`. Documented here for any future executor agent following the same plan template — the plan's `<verify><automated>` blocks contain the duplicate flag and need a follow-up edit if any later plan re-uses that idiom.

- **18 pre-existing test failures in full `npm test` run.** All 18 failures are `TypeError: localStorage.clear is not a function` in `src/tests/persist-scoping.test.ts` and `src/tests/photo-migration.test.ts` (and one third file with the same root cause). These are pre-existing and explicitly documented in `STATE.md` (Blockers/Concerns) and `.planning/phases/22-foundation-tokens/deferred-items.md` as "not blocking Phase 22 plans 02/03/04". Verified at the worktree base commit (`7800f5d`) before any Plan 22-03 work began. Out of scope per the SCOPE BOUNDARY rule; not fixed here.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Wave 2 of Phase 22 status:
- Plan 22-02 (bridge-dark-variant) runs in parallel — disjoint files (`src/index.css` + `index.html` vs. this plan's `src/ui/tokens/initTheme.ts` + `src/ui/tokens/index.ts` + `src/main.tsx` + `src/ui/__tests__/init-theme.test.ts`). The combined effect (`.tpc-dark` flips synchronously on cold load AND live during a session) is verified by Plan 04 + the manual visual smoke before phase verify.
- After both Wave 2 plans land, Plan 22-04 (verify) runs the manual visual smoke per VALIDATION.md — toggle OS dark mode in dev mode and confirm the page re-themes within one frame without reload, plus DevTools HMR dispose check.

Phase 25 (theme toggle) readiness from this plan:
- The `initTheme(opts?: InitThemeOpts)` signature is locked. Phase 25 should remove the `void opts;` line and add the override-aware branch (`if (opts.override === 'light' || opts.override === 'dark') { apply(opts.override === 'dark'); return () => {}; }`) before the matchMedia listener attach.
- The teardown shape is locked at `() => void` and is documented as idempotent; ThemeProvider can call it safely on user toggle without leaking listeners.

Hand-offs to subsequent phases:
- Phase 24 (LIB primitives) consumers can now `import { initTheme, paletteFor, fonts, radii } from "./ui/tokens"` from a single barrel.
- Future dashboard repo can mirror the same barrel surface — the public API for `src/ui/tokens` is now stable across `tpcUnifiedLight/Dark`, `paletteFor`, `fonts`, `radii`, `fontSizes`, `space`, `TpcUnifiedPalette`, `initTheme`, `InitThemeOpts`, `ThemeOverride`.

## Self-Check: PASSED

Verified all claimed artifacts exist on disk and all claimed commits exist in the worktree's git log:

- File `src/ui/tokens/initTheme.ts` — FOUND
- File `src/ui/__tests__/init-theme.test.ts` — FOUND
- File `src/ui/tokens/index.ts` (modified) — FOUND
- File `src/main.tsx` (modified) — FOUND
- Commit `782b1d7` (Task 1 RED) — FOUND
- Commit `7f62a3b` (Task 1 GREEN) — FOUND
- Commit `5a9704c` (Task 2) — FOUND

Verification commands run:
- `npx tsc -p tsconfig.app.json --noEmit` → 0
- `npm run lint` → 0
- `npm run build` → 0
- `npm test -- src/ui/__tests__/init-theme.test.ts` → 6/6 (all green)
- `npm test` (full suite) → 380 passed / 18 pre-existing failures unchanged (logged in deferred-items.md, not caused by this plan)

---
*Phase: 22-foundation-tokens*
*Completed: 2026-04-30*
