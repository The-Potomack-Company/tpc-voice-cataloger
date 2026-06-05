---
phase: 35-ai-correctness-track-2
plan: 01
subsystem: ai-pipeline
tags: [tdd, red, dexie, provenance, gemini, vitest]
requires: []
provides:
  - "Dexie v11 userEditedFields provenance store ([itemId+field], itemId)"
  - "UserEditedField type"
  - "Four RED test files: SC-1 determinism, SC-2 confab guard, SC-3 no-clobber, SC-4 list-card failure row"
affects:
  - src/db/types.ts
  - src/db/index.ts
tech-stack:
  added: []
  patterns: [dexie-version-bump-new-table, vitest-hoisted-supabase-mock, tdd-red-gate]
key-files:
  created:
    - src/tests/gemini-determinism.test.ts
    - src/tests/gemini-confab-guard.test.ts
    - src/tests/gemini-no-clobber.test.ts
    - src/tests/item-card-ai-failure.test.tsx
  modified:
    - src/db/types.ts
    - src/db/index.ts
decisions:
  - "D-05: per-field user-edited provenance stored client-side in a dedicated Dexie table keyed by Supabase UUID itemId, not in Supabase and not on the integer-keyed legacy Dexie item records"
  - "O-1 (resolved): SC-3 test calls processAudioWithAi with an explicit 4th isRetry arg; the implementation (Wave 1/2) must adopt this signature"
metrics:
  duration: ~13m
  completed: 2026-06-01
---

# Phase 35 Plan 01: Wave-0 RED Foundation Summary

Dexie v11 `userEditedFields` provenance store (the SC-3 prerequisite) plus four RED test files — one per success criterion — each failing because the behavior is absent, not because of a setup/import error.

## What Was Built

**Task 1 — Dexie v11 `userEditedFields` store + `UserEditedField` type** (`feat`, `4767677`)
- `src/db/types.ts`: `interface UserEditedField { itemId: string; field: string }`, with a WHY-comment noting `itemId` is the Supabase UUID (the value `updateItemField`/`processAudioWithAi` pass), explicitly NOT the integer Dexie id (RESEARCH Pitfall 1).
- `src/db/index.ts`: added `UserEditedField` to the type import, the `userEditedFields: EntityTable<UserEditedField, "itemId">` typed handle, and a new `db.version(11).stores({...})` block repeating all 11 v10 stores verbatim plus `userEditedFields: "[itemId+field], itemId"`. No `.upgrade()` — new empty table; absence of a row === field not user-edited.
- `npx tsc --noEmit -p tsconfig.app.json` clean.

**Task 2 — RED tests SC-1 (determinism) + SC-4 (list-card failure row)** (`test`, `4c0b41a`)
- `src/tests/gemini-determinism.test.ts`: spies `globalThis.fetch`, parses the captured request body, asserts `payload.generationConfig.temperature === 0` (RED: key absent). Second test snapshots the catalog write across two identical mocked runs (minus the non-deterministic `completed_at`) — passes today and guards the determinism contract against regression once `temperature:0` lands.
- `src/tests/item-card-ai-failure.test.tsx`: `ai_status="failed"` must render `role="alert"` + `/AI processing failed/i` + a Retry control (RED: only a terse `<Badge>` today); `ai_status="done"` renders no alert (passes — absence already correct). Forces `useAudioUploadStatus` → `"none"` so the upload pill never competes with the alert query.

**Task 3 — RED tests SC-2 (confab guard) + SC-3 (no-clobber)** (`test`, `0d244ac`)
- `src/tests/gemini-confab-guard.test.ts`: `transcript: null` and `transcript: "   "` cases each assert the only writes are `{ai_status:"processing"}` then `{ai_status:"failed"}`, with NO catalog key in any write (RED: title/estimate currently persist on empty transcript).
- `src/tests/gemini-no-clobber.test.ts`: seeds `db.userEditedFields` directly (real fake-indexeddb against the v11 store). Retry case (explicit 4th `isRetry=true`) asserts the flagged `title` is omitted but `description` flows through (RED: title clobbered). Fresh case (no `isRetry` arg) asserts the item's flags are cleared afterward (RED: never cleared).

## RED Gate Reasons (verified behavioral, not setup)

| File | Failing assertion | Reason (behavior absent) |
|------|-------------------|--------------------------|
| gemini-determinism | `expected undefined to be +0` | `temperature` key not in `generationConfig` |
| item-card-ai-failure | `getByRole("alert")` not found | card renders only a terse `Failed` Badge |
| gemini-confab-guard (x2) | `expected 'done' to be 'failed'` | confab fields persist; status not set to failed |
| gemini-no-clobber (retry) | `expected 'AI REWRITTEN TITLE' to be undefined` | flagged field clobbered on retry |
| gemini-no-clobber (fresh) | `expected [...] to have a length of +0 but got 1` | flags never cleared on fresh success |

The two passing tests (SC-1 deterministic snapshot, SC-4 done-state absence) are intentionally green — they assert already-correct behavior. `db.userEditedFields` seeded-array read returning the row confirms the v11 store is live and queryable for SC-3.

## Verification

- `npx tsc --noEmit -p tsconfig.app.json` → exit 0, no new errors
- `grep -c "db.version(11)" src/db/index.ts` → 1
- `grep -c "\.skip\|\.todo"` across all four test files → 0
- `npx vitest --run` of all four files → 4 files, 6 RED (behavior-absent) + 2 pass, no import/mock-wiring failures

## Deviations from Plan

**1. [Rule 3 - Blocking] SC-4 harness mocks trimmed to ItemCard's actual imports**
- **Found during:** Task 2
- **Issue:** The 35-PATTERNS analog (`item-card-audio-status.test.tsx`) mocks `../db`, `dexie-react-hooks`, `../hooks/useWriteAheadQueue`, `../db/idMapping`, `../db/audioLookup` — modules the current `ItemCard.tsx` no longer imports (it imports `../db/items`, `../services/gemini`, `../hooks/useAudioUploadStatus`, `../services/audioUploadQueue`).
- **Fix:** Mocked only the modules ItemCard actually imports, keeping the harness green so the RED reason stays the missing `role="alert"` row, not a stale mock.
- **Files modified:** src/tests/item-card-ai-failure.test.tsx
- **Commit:** 4c0b41a

**2. [Rule 3 - Blocking] SC-3 isRetry call typed via a local signature alias**
- **Found during:** Task 3
- **Issue:** `processAudioWithAi` is 3-arg today; the plan requires the SC-3 test to pass an explicit 4th `isRetry` arg (O-1). A raw 4-arg call would be a TS compile error (setup failure), not a behavioral RED.
- **Fix:** Declared a local `ProcessAudioWithAi` type with the optional 4th `isRetry` param and cast the imported function to it at the call site. The test compiles cleanly and stays RED for the behavioral reason. The Wave-1/2 implementation must adopt the 4-arg signature.
- **Files modified:** src/tests/gemini-no-clobber.test.ts
- **Commit:** 0d244ac

## Known Stubs

None. The v11 store is real implementation (not a stub); the four test files are intentional RED tests, not stubbed behavior.

## Self-Check: PASSED

- src/db/types.ts — FOUND
- src/db/index.ts — FOUND
- src/tests/gemini-determinism.test.ts — FOUND
- src/tests/gemini-confab-guard.test.ts — FOUND
- src/tests/gemini-no-clobber.test.ts — FOUND
- src/tests/item-card-ai-failure.test.tsx — FOUND
- Commit 4767677 — FOUND
- Commit 4c0b41a — FOUND
- Commit 0d244ac — FOUND
