---
phase: 43-photomigration-itemid-collision
verified: 2026-06-04T15:38:00Z
status: passed
score: 3/3 must-haves verified
overrides_applied: 0
---

# Phase 43: Photo-Migration itemId Collision Fix — Verification Report

**Phase Goal:** Fix the confirmed house/sale `++id` keyspace collision in `src/services/photoMigration.ts`. Its `oldId + type==='item'` idMapping lookup is missing the `itemTable` discriminator that Phase 38 added to migrateToSupabase, so a photo belonging to a sale item can resolve to the wrong Supabase item id when a house item shares the same legacy integer id (UAT finding 38-3).
**Verified:** 2026-06-04T15:38:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `photoMigration.ts`'s idMapping lookup is scoped by the photo's source table (`itemTable`) via `photo.itemType`, matching Phase 38's `migrateToSupabase` path. | VERIFIED | `photoMigration.ts:55` calls `getNewIdByOldId(photo.itemId, "item", photo.itemType)` with `photo.itemType` as the `itemTable` arg; `photoMigration.ts:2` imports `getNewIdByOldId` from `"../db/idMapping"`. No `.where("oldId")` chain remains in the file. |
| 2 | A house item and a sale item sharing the same legacy integer id resolve to DISTINCT Supabase item ids — a sale photo is never queued against a house item's UUID (and vice versa). | VERIFIED | `photo-migration-collision.test.ts` seeds two photos with `itemId: 1`, `itemType: "house"` and `itemType: "sale"` respectively; mock dispatcher returns `"uuid-house-1"` / `"uuid-sale-1"` based on the `itemTable` arg; assertions confirm `dexiePhotoId: 100 → uuid-house-1` and `dexiePhotoId: 101 → uuid-sale-1`. Test passes (1/1). |
| 3 | The existing fallback (no mapping found → treat `itemId` as already a Supabase UUID string) and the skip/queue/flag/DAT-6 logic are preserved unchanged. | VERIFIED | `photoMigration.ts:57-58`: `const supabaseItemId = newId ?? String(photo.itemId)` — null-coalesce fallback intact. Lines 60–84 (session lookup, skip-continue, enqueuePhotoUpload, DAT-6 flag gate, drainPhotoQueue) are untouched; `photo-migration.test.ts` (9 tests) continues to pass, exercising this logic path. |

**Score:** 3/3 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/services/photoMigration.ts` | itemTable-scoped idMapping resolution in `migrateExistingPhotos` via `getNewIdByOldId` | VERIFIED | File exists, substantive (87 lines), imports `getNewIdByOldId`, calls it at line 55 with `photo.itemType` as `itemTable`, inline `.where("oldId")` chain absent. |
| `src/tests/photo-migration-collision.test.ts` | Collision regression test proving distinct resolution for colliding house/sale ids | VERIFIED | File exists (134 lines), mocks `"../db/idMapping"` with hoisted `mockGetNewIdByOldId` dispatcher keyed on `itemTable`, seeds colliding `itemId: 1` photos, asserts distinct UUIDs and explicit call args `(1, "item", "house")` / `(1, "item", "sale")`. Test passes. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/services/photoMigration.ts` | `src/db/idMapping.ts:getNewIdByOldId` | `import + call with photo.itemType as itemTable arg` | WIRED | `photoMigration.ts:2` imports `getNewIdByOldId`; `photoMigration.ts:55` calls `getNewIdByOldId(photo.itemId, "item", photo.itemType)` — exact call pattern from plan. |

### Data-Flow Trace (Level 4)

Not applicable — `photoMigration.ts` is a service function, not a rendering component. The critical data path is the `oldId → newId` lookup chain which is directly observable at the call site and verified by the regression test.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Collision test passes GREEN | `npx vitest --run src/tests/photo-migration-collision.test.ts` | 1/1 passed | PASS |
| Existing photo-migration tests still pass | `npx vitest --run src/tests/photo-migration.test.ts` | 9/9 passed | PASS |
| TypeScript build clean | `npx tsc -b` | exit 0 | PASS |

### Probe Execution

No probes declared in PLAN. The plan's `<verification>` block uses vitest commands as acceptance gates — run above in behavioral spot-checks.

### Requirements Coverage

Phase 43 PLAN frontmatter declares `requirements: []` — this is a v1.3 UAT bug fix (UAT finding 38-3) not mapped to any v1.2 REQUIREMENTS.md REQ-ID. REQUIREMENTS.md covers only v1.2 UI Overhaul requirements. No orphaned requirement IDs to reconcile.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | None found |

No debt markers (TBD / FIXME / XXX / TODO / HACK / PLACEHOLDER) in any phase-modified file. No stub return patterns. No hardcoded empty data.

### Human Verification Required

None. The fix is fully verifiable via code inspection, grep, and test execution. No visual, real-time, or external service behavior involved.

### Gaps Summary

No gaps. All three must-have truths verified, both artifacts exist and are substantive and wired, the key link is confirmed at the call site, both commits (21c432e RED, da7e508 GREEN) exist in git history, and all acceptance criteria from the plan's `<verification>` block pass.

The scope fence was honored with one documented deviation: `photo-migration.test.ts` was also modified (re-pointing its `setupIdMappingMock` from the superseded raw `db.idMapping` chain to `getNewIdByOldId`) because the plan's own success criteria required that test suite to remain green after the fix. This is consistent with the plan's stated Rule 1 precedent.

---

_Verified: 2026-06-04T15:38:00Z_
_Verifier: Claude (gsd-verifier)_
