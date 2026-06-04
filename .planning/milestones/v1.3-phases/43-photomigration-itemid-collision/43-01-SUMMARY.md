---
phase: 43-photomigration-itemid-collision
plan: 01
subsystem: photo-migration
tags: [bugfix, data-integrity, tdd, migration, idMapping]
requires:
  - "src/db/idMapping.ts:getNewIdByOldId (itemTable-scoped reverse lookup, Phase 38)"
provides:
  - "itemTable-scoped idMapping resolution in migrateExistingPhotos"
affects:
  - "src/services/photoMigration.ts"
tech-stack:
  added: []
  patterns:
    - "Reuse the Phase-38 getNewIdByOldId(oldId, type, itemTable) discriminator in the photo-migration path, matching migrateToSupabase"
key-files:
  created:
    - "src/tests/photo-migration-collision.test.ts"
  modified:
    - "src/services/photoMigration.ts"
    - "src/tests/photo-migration.test.ts"
decisions:
  - "Resolve photoMigration itemId via getNewIdByOldId(photo.itemId, \"item\", photo.itemType) instead of an inline db.idMapping query — the itemType discriminator closes the house/sale ++id collision (UAT 38-3), reusing the exact helper migrateToSupabase already uses."
  - "[Rule 1] Re-point the existing photo-migration.test.ts mock from the raw db.idMapping.where(\"oldId\").equals().filter().first() chain to a getNewIdByOldId mock — the old chain pinned a now-superseded internal query shape (same precedent as Phase 38/39 superseded-contract test re-points)."
metrics:
  duration: ~3 min
  completed: 2026-06-04
---

# Phase 43 Plan 01: Photo-Migration itemId Collision Fix Summary

Scoped `migrateExistingPhotos`'s idMapping lookup by the photo's source table (`photo.itemType`) via `getNewIdByOldId`, so a sale photo and a house photo sharing the same legacy integer id resolve to DISTINCT Supabase UUIDs instead of silently cross-attributing (UAT finding 38-3).

## What Changed

`src/services/photoMigration.ts` previously resolved a photo's Dexie `itemId` with an inline `db.idMapping.where("oldId").equals(photo.itemId).filter(m => m.type === "item").first()` query. Because `houseVisitItems` and `saleItems` have INDEPENDENT `++id` keyspaces, a sale photo could resolve to a colliding house item's UUID — a photo uploaded against the wrong owner.

The fix replaces that inline query with a single call to the already-correct, itemTable-scoped helper:

```ts
const newId = await getNewIdByOldId(photo.itemId, "item", photo.itemType);
const supabaseItemId = newId ?? String(photo.itemId);
```

This is the same discriminator `src/db/migration.ts:migrateToSupabase` already applies in its house/sale loops. The existing fallback (no mapping → treat `itemId` as an already-Supabase UUID string) and all skip/queue/flag/DAT-6 logic are preserved verbatim.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | RED collision regression test | 21c432e | src/tests/photo-migration-collision.test.ts |
| 2 | itemTable-scoped fix via getNewIdByOldId | da7e508 | src/services/photoMigration.ts, src/tests/photo-migration.test.ts |

## TDD Cycle

- **RED:** `photo-migration-collision.test.ts` (Task 1) failed on the unfixed code — the old inline query never passes `itemTable`, and with the raw `db.idMapping` chain unmocked it threw `Cannot read properties of undefined (reading 'equals')`. Committed failing (21c432e).
- **GREEN:** The fix (Task 2) made the collision test pass — house photo → `uuid-house-1`, sale photo → `uuid-sale-1`, with `getNewIdByOldId` invoked as `(1, "item", "house")` and `(1, "item", "sale")`.
- **REFACTOR:** None needed — focused bug fix, no cleanup.

## Verification

- `npx vitest --run src/tests/photo-migration-collision.test.ts` — PASS (1/1).
- `npx vitest --run src/tests/photo-migration.test.ts` — PASS (9/9, after Rule-1 mock re-point).
- `npx tsc -b` — exit 0.
- `grep -n 'getNewIdByOldId(photo.itemId, "item", photo.itemType)' src/services/photoMigration.ts` — matches (line 55).
- `grep '\.where("oldId")' src/services/photoMigration.ts` — no matches (inline chain removed).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test breakage] Re-pointed photo-migration.test.ts mock to the new resolution path**
- **Found during:** Task 2 (the fix broke 5 existing `migrateExistingPhotos` tests).
- **Issue:** `photo-migration.test.ts:setupIdMappingMock` mocked the raw `db.idMapping.where("oldId").equals().filter().first()` chain and asserted `mockIdMapping.where` was called with `"oldId"`. After the fix, resolution flows through `getNewIdByOldId` (which uses a different `db.idMapping.where({oldId,type}).first()` shape that the mock didn't provide), so all 5 tests threw or failed their assertion.
- **Fix:** Added a hoisted `vi.mock("../db/idMapping")` with `mockGetNewIdByOldId`; rewrote `setupIdMappingMock` to drive that helper (keyed on `oldId`); changed the one chain-shape assertion to `expect(mockGetNewIdByOldId).toHaveBeenCalledWith(42, "item", undefined)`. This mirrors the superseded-contract test re-points done in Phase 38/39.
- **Files modified:** src/tests/photo-migration.test.ts
- **Commit:** da7e508
- **Scope note:** The plan's scope fence named only `photoMigration.ts` + the new collision test, but the plan's own `<verify>` and `success_criteria` require `photo-migration.test.ts` to keep passing — updating its mock is the only way to honor both. No production behavior beyond the fix was touched.

## Threat Model Outcome

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-43-01 (Tampering — wrong id resolution) | mitigate | CLOSED — itemTable discriminator wired; collision test locks it |
| T-43-02 (Info disclosure — cross-table photo misattribution) | mitigate | CLOSED — same fix |
| T-43-SC (npm install legitimacy) | accept | N/A — no installs |

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: src/services/photoMigration.ts
- FOUND: src/tests/photo-migration-collision.test.ts
- FOUND commit 21c432e
- FOUND commit da7e508
