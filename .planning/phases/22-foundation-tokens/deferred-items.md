# Phase 22 — Deferred Items

Items discovered out-of-scope of the current plan's intent but worth surfacing for follow-up.

## From Plan 22-01

### Pre-existing test suite failures (3 files, 18 tests)

**Discovered during:** Plan 22-01 final `npm test` run.
**Status:** Pre-existing — verified at HEAD~3 (commit `c608ee0`, before Plan 22-01 began). Not caused by this plan's changes.
**Test files affected:**
- `src/tests/persist-scoping.test.ts`
- `src/tests/photo-migration.test.ts`
- (third file, identical root cause)

**Symptom:** `TypeError: localStorage.clear is not a function` thrown in `beforeEach` / `afterEach` hooks. The Vitest setup at `src/tests/setup.ts` likely no longer exposes a `localStorage` polyfill with a `.clear()` method, or jsdom's storage shim has shifted.

**Why deferred:** Out of scope for Plan 22-01 (token scaffold). These failures predate this plan and do not block the plan's deliverables (the four token files, the barrel, the manifest test fix). Fixing them requires investigating the test harness/jsdom setup, which is unrelated to the design-system foundation.

**Recommended owner:** A future maintenance plan or a quick task. Not blocking Plans 22-02, 22-03, or 22-04.

### Pre-existing hex literals in `src/index.css`

**Discovered during:** Plan 22-01 success-criterion sweep (`grep -RnE "#[0-9a-fA-F]{3,8}\b" src/`).
**Status:** Pre-existing — added in commit `6e9a087` (project scaffold).
**Lines:**
- `src/index.css:4` — `--color-accent: #2563eb;`
- `src/index.css:5` — `--color-accent-hover: #1d4ed8;`

**Why deferred:** Plan 22-02 (bridge-dark-variant) explicitly replaces this entire `@theme` block with the full `@theme inline` bridge per CONTEXT D-12, eliminating both literals as part of its scope. Plan 22-01's verification found no NEW violations introduced by this plan's changes.

**Action:** None required. Plan 22-02 will clear these.
