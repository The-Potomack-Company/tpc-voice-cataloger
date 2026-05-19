---
phase: 22-foundation-tokens
plan: 04
subsystem: testing
tags: [tokens, vitest, ci-guard, regex-sweep, tokens-04, design-system]

# Dependency graph
requires:
  - phase: 22-foundation-tokens
    provides: "Plans 22-01/02/03: canonical tokens at src/ui/tokens/, no hex literals in src/index.css, init-theme runtime files clean"
provides:
  - "TOKENS-04 build-time guard via Vitest regex sweep at src/ui/__tests__/no-hardcoded-literals.test.ts"
  - "Hard-fail CI enforcement: any new hex / oklch( / font-family literal in src/ outside src/ui/tokens/** breaks `npm test`"
  - "Aggregated structured failure UX: {file, line, snippet, pattern} printed to console.error before assertion fires"
affects:
  - "All future commits touching src/**/*.{ts,tsx,css}"
  - "Phase 24 LIB primitives — must consume tokens, not literals"
  - "Phases 26-29 per-screen restyles — guarded against hex regression during Tailwind utility swap"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Filesystem regex sweep via fs.readdirSync(root, { recursive: true, withFileTypes: true }) (Node 20+ stable)"
    - "Narrow allowlist via prefix match on relative path (startsWith) — no glob library needed"
    - "Per-file allowlist escape hatch (D-16) for files where the regex source itself IS the fixture"
    - "Triple-slash /// <reference types=\"node\" /> directive to opt a single file into Node typings under tsconfig.app.json"

key-files:
  created:
    - "src/ui/__tests__/no-hardcoded-literals.test.ts"
  modified: []

key-decisions:
  - "Added narrow per-file allowlist (single entry: src/ui/__tests__/no-hardcoded-literals.test.ts) as the D-16 escape hatch — the guard test's regex source code IS the literal it's scanning for, so excluding it is the canonical 'file is the fixture' case D-16 explicitly anticipates"
  - "Added /// <reference types=\"node\" /> at top of file because tsconfig.app.json includes src/ui/__tests__/ in type-checking but does not load @types/node by default; the existing src/tests/* path is excluded so the pattern there couldn't be reused"
  - "Removed the // eslint-disable-next-line no-console directive after lint flagged it as unused — this project's ESLint config does not enforce no-console, so the directive served no purpose and triggered its own warning"

patterns-established:
  - "TOKENS-04 guard pattern: filesystem walk + 3 regexes + aggregated structured failure output. Sub-25 ms over ~150 files. No new dependencies."
  - "Per-file allowlist constant ALLOW_FILES (alongside ALLOW_PREFIXES) for the rare 'file IS the fixture' case — narrow, documented, single entry."

requirements-completed: [TOKENS-04]

# Metrics
duration: 5min
completed: 2026-04-30
---

# Phase 22 Plan 04: TOKENS-04 Guard Summary

**Vitest filesystem regex sweep that hard-fails CI on any new hex / oklch( / font-family literal under src/ outside src/ui/tokens/** — Phase 22 success criterion #3 structurally locked.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-30T15:35:15Z
- **Completed:** 2026-04-30T15:40:49Z
- **Tasks:** 1
- **Files created:** 1

## Accomplishments

- Created `src/ui/__tests__/no-hardcoded-literals.test.ts` (~130 lines, no new dependencies)
- Test passes on the clean post-Plan-22-03 tree in 17–25 ms (well under the 200 ms RESEARCH benchmark)
- Manual sanity check verified: injecting `// fake hex #abcdef for test` into `src/main.tsx` triggers a structured failure report (`main.tsx:1 [hex] // fake hex #abcdef for test`); revert restores green
- Three regex patterns enumerated per D-15: `/#[0-9a-fA-F]{3,8}\b/`, `/\boklch\s*\(/`, `/font[-_]?family\s*[:=]\s*["']?[A-Za-z]/i`
- Allowlist remains narrow per D-16: `src/ui/tokens/**` (verbatim handoff copies) plus a single per-file exception for the guard test itself
- Hard-fail in CI per D-18: `expect(violations).toEqual([])` after console.error printout — no soft-warn snapshot
- Tailwind utility classes (`text-blue-700`, etc.) confirmed not flagged per D-19 (the regexes by construction skip them)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the TOKENS-04 hardcoded-literals guard test** - `91095ce` (test)

_No plan-metadata commit yet — this SUMMARY/STATE/ROADMAP commit is appended after self-check below._

## Files Created/Modified

- `src/ui/__tests__/no-hardcoded-literals.test.ts` — new Vitest filesystem regex sweep enforcing TOKENS-04. Walks `src/` recursively (Node `fs.readdirSync` with `recursive: true, withFileTypes: true`), checks every `.ts/.tsx/.css` file against three regexes, aggregates `{file, line, snippet, pattern}` violations, prints them via `console.error`, then hard-fails via `expect(violations).toEqual([])`.

## Decisions Made

- **Narrow per-file allowlist for the guard test itself.** The test file contains the three regex source patterns it scans for (`oklch(`, `#abc`, `font-family:`) inside the regex literals and explanatory comments. With no allowlist, the test would self-flag on lines 5, 38, 40, 42, 43, 45 (a self-referential failure). Per D-16's explicit escape-hatch language ("if a violation surfaces during implementation, add a narrow per-file exception with a comment explaining why"), added a single-entry `ALLOW_FILES` constant excluding only this exact path. Documented inline. Scope is single-file — does NOT widen to all of `__tests__`.

- **Triple-slash node types reference.** `tsconfig.app.json` includes `src/ui/__tests__/` (unlike `src/tests/`, which is excluded), so the test file is type-checked. The config has no `"types": ["node"]` entry, so `node:fs`, `node:path`, and `__dirname` produced TS2307 / TS2304 errors. Adding `/// <reference types="node" />` opts only this file into Node typings without changing the global tsconfig — minimal blast radius. (Alternatives considered: adding node to tsconfig.app.json types — would affect every file in src/; moving test to src/tests/ — would lose the `src/ui/` co-location D-15 prescribes.)

- **Removed an unused eslint-disable directive.** Initial draft included `// eslint-disable-next-line no-console` above the `console.error` call (defensive; many React/Vite projects ban console). This project's ESLint config does not enable `no-console`, so the directive itself was flagged as unused. Removed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Self-referential test failure on first run**
- **Found during:** Task 1 verify step (`npm test -- src/ui/__tests__/no-hardcoded-literals.test.ts`)
- **Issue:** The newly-created guard test failed on its own source code — the regex source patterns (`oklch(`, `#`-prefixed hex sequences in comments, `font-family:` mention in comments) all matched against the test file itself. Six self-violations on lines 5, 38, 40, 42, 43, 45.
- **Fix:** Added a narrow per-file allowlist constant `ALLOW_FILES` containing the single relative path `ui/__tests__/no-hardcoded-literals.test.ts` (using `sep` for platform portability), with `isAllowed()` checking it before the prefix list. Documented inline as the D-16 escape hatch — "the file IS the fixture" — with explicit scope language ("Scope is single-file: only this exact path is excluded, not all of __tests__"). The plan's `<read_first>` directive itself notes this caveat (CONTEXT D-16: "if a violation surfaces during implementation, add a narrow per-file exception with a comment").
- **Files modified:** `src/ui/__tests__/no-hardcoded-literals.test.ts`
- **Verification:** Test re-run after fix passes in 17 ms with empty violations array.
- **Committed in:** `91095ce` (Task 1 commit)

**2. [Rule 3 - Blocking] Type-check failure under tsconfig.app.json**
- **Found during:** Task 1 verify step (`npx tsc -p tsconfig.app.json --noEmit`)
- **Issue:** Five TS errors — `Cannot find module 'node:fs'` (TS2307), `Cannot find module 'node:path'` (TS2307), `Cannot find name '__dirname'` (TS2304), and two `Parameter implicitly has 'any' type` (TS7006) cascading from the failed Node imports. Root cause: `tsconfig.app.json` does not include `@types/node` (only `vite/client`), and unlike `src/tests/` it does NOT exclude `src/ui/__tests__/`.
- **Fix:** Added `/// <reference types="node" />` as the first line of the file. Opts only this single file into Node typings; no global config change. RESEARCH Pitfall 5 anticipated `verbatimModuleSyntax` issues but not the missing-types-config issue specifically.
- **Files modified:** `src/ui/__tests__/no-hardcoded-literals.test.ts`
- **Verification:** `npx tsc -p tsconfig.app.json --noEmit` exits 0 (no output).
- **Committed in:** `91095ce` (Task 1 commit)

**3. [Rule 1 - Bug] Unused eslint-disable directive**
- **Found during:** Task 1 verify step (`npm run lint`)
- **Issue:** Lint warning — `Unused eslint-disable directive (no problems were reported from 'no-console')` on the line preceding `console.error`. The project's ESLint config does not enable `no-console`, so the defensive directive served no purpose and was itself flagged.
- **Fix:** Removed the `// eslint-disable-next-line no-console` line. Single-line edit; the `console.error` call remains.
- **Files modified:** `src/ui/__tests__/no-hardcoded-literals.test.ts`
- **Verification:** `npm run lint` exits 0 with no warnings.
- **Committed in:** `91095ce` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 Rule 3 blocking, 1 Rule 1 bug-style)
**Impact on plan:** All three were inherent in the plan-as-written but expected by CONTEXT D-16's escape-hatch provision. No scope creep — every fix kept the test narrow, single-file, and aligned with locked decisions. The plan's reference implementation in RESEARCH Pattern 6 didn't include the per-file allowlist or the node-types directive; both were necessary to make the test land green on this codebase's specific tsconfig + ESLint setup.

## Issues Encountered

- **Pre-existing unrelated test failures (18 tests across 3 files):** `persist-scoping.test.ts`, `photo-migration.test.ts`, `layout.test.tsx` fail with `TypeError: localStorage.clear is not a function` and related jsdom/storage shim issues. Verified pre-existing by stashing the new test file and running `npm test` on the pristine HEAD — same 18 failures. Already documented in `deferred-items.md` and STATE.md blockers from Plan 22-01. Not caused by this plan; out of scope per the executor's scope-boundary rule.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Phase 22 success criterion #3 ("CI fails on a hex / oklch / font-family literal in src/") is now structurally enforced** for every future commit. The test runs as part of the existing `npm test` step under GitHub Actions.
- **Phase 24 LIB primitives (next phase that touches src/ui/)** can lean on this guard with confidence: any accidental hex literal in `Button.tsx`, `Badge.tsx`, etc. will fail CI before merge.
- **Phases 26-29 per-screen restyles** are guarded against hex regression while they swap Tailwind stock palette utilities for token-bridged equivalents.
- **No blockers.** The 18 pre-existing test failures remain deferred per the existing deferred-items.md entry; they are unrelated to TOKENS-04 and to Phase 22's foundation-token deliverables.

## Self-Check

Verifying claims before finalizing.

**Files created:**
- `src/ui/__tests__/no-hardcoded-literals.test.ts` — FOUND

**Commits exist:**
- `91095ce` (test: TOKENS-04 guard) — FOUND

**Verification commands re-run on final state:**
- `npm test -- src/ui/__tests__/no-hardcoded-literals.test.ts` — passes (17 ms)
- `npx tsc -p tsconfig.app.json --noEmit` — passes (exit 0)
- `npm run lint` — passes (0 errors, 0 warnings)
- `npm run build` — passes (exit 0)
- Manual sanity check (insert + revert): violation correctly detected, structured output rendered

**Self-Check: PASSED**

---
*Phase: 22-foundation-tokens*
*Completed: 2026-04-30*
