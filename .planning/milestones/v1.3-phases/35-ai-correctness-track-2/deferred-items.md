# Phase 35 — Deferred Items

## src/tests/db.test.ts — stale table-count invariant (pre-existing, NOT 35-04 scope)

- **Discovered during:** Plan 35-04 full-suite regression check.
- **Symptom:** 2 failing assertions in `src/tests/db.test.ts`:
  - `"opens successfully and has 11 tables"`
  - `"has 11 tables including audioUploadQueue after v10 migration"`
  Both expect exactly 11 Dexie tables; the live schema now has 12 (the v11
  `userEditedFields` store added by Plan 35-01).
- **Pre-existing:** Verified failing at the wave base commit `e908af8` —
  `userEditedFields` is present in `src/db/index.ts` at base (3 refs) but
  `db.test.ts` was never updated to 12. The failure predates Plan 35-04 and is
  in a file Plan 35-04 does not touch (out of SCOPE BOUNDARY).
- **Owner:** Plan 35-01 (schema bump) or a phase-level test-invariant cleanup.
- **Fix:** Update the two count invariants from 11 → 12 and add
  `"userEditedFields"` to the expected sorted table-name array.
