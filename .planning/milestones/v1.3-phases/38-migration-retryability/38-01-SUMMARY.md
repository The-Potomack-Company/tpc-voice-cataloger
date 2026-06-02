---
phase: 38-migration-retryability
plan: 01
subsystem: data-migration
tags: [dexie, supabase, idempotency, migration, tdd]
requires: []
provides:
  - "needsMigration() per-row predicate (D-01/D-02)"
  - "getNewIdByOldId(oldId, type, itemTable?) reverse helper (D-04)"
  - "migrateToSupabase return shape { migrated, alreadyMigrated, failed, partial } (D-10)"
  - "idMapping [oldId+type] index + additive itemTable discriminator (D-03)"
affects:
  - "src/hooks/useDataMigration.ts (return-shape consumer; full plumbing is Plan 02)"
  - "Plan 02 (banner) consumes failed/alreadyMigrated + partial"
tech-stack:
  added: []
  patterns:
    - "lookup-before-insert idempotency guard (reverse idMapping)"
    - "ground-truth cleanup gate (post-run needsMigration())"
    - "additive unindexed Dexie field (no schema migration) for house/sale disambiguation"
key-files:
  created:
    - src/tests/migration-idempotency.test.ts
  modified:
    - src/db/index.ts
    - src/db/idMapping.ts
    - src/db/migration.ts
    - src/db/types.ts
    - src/hooks/useDataMigration.ts
    - src/tests/data-migration.test.ts
    - src/tests/migration-partial.test.tsx
decisions:
  - "house/sale ++id collision: added itemTable discriminator rather than changing the locked type='session'|'item' contract or the Supabase schema"
metrics:
  duration: ~9m
  completed: 2026-06-02
  tasks: 2
  files: 8
---

# Phase 38 Plan 01: Idempotent Migration Data Layer Summary

Made the Dexie→Supabase migration idempotent and partial-aware at the data layer: a per-row `needsMigration()` predicate, an `[oldId+type]` reverse index + `getNewIdByOldId` guard on the session insert and both item loops, a `failed`/`alreadyMigrated` counter split (`partial = failed > 0`), and an `exportHistory` cleanup gated on a post-run ground-truth `needsMigration()` call. A retry over a preserved DAT-1 partial set now creates 0 duplicate Supabase sessions and 0 duplicate items.

## What Was Built

- **Dexie v12** (`src/db/index.ts`): copied the v11 store block verbatim, appended `[oldId+type]` to the `idMapping` index. Pure index add, no `.upgrade()`; existing idMapping rows survive (verified — Dexie opens clean across the whole suite).
- **`getNewIdByOldId(oldId, type, itemTable?)`** (`src/db/idMapping.ts`): reverse helper mirroring `getDexieItemId`. `itemTable` disambiguates house vs sale items (see Deviations).
- **`needsMigration()`** (`src/db/migration.ts`): per-row predicate — true while any non-deleted session OR any house/sale item lacks a mapping. Sessions filter `!s.deletedAt`; items queried unconditionally (no `deletedAt` field per `types.ts`).
- **`migrateToSupabase`**: lookup-before-insert guard on the session insert (the dangerous duplicate path — a preserved partial session already carries a `session` mapping) and both item loops. Already-mapped items increment `alreadyMigrated` and are pushed into the bulkDelete list so a clean retry clears the dead recovery rows (SC4). Insert errors increment `failed`. Return shape is now `{ migrated, alreadyMigrated, failed, partial: failed > 0 }`. Cleanup gated on `!(await needsMigration())`.

## Verification

- `npx vitest run src/tests/data-migration.test.ts src/tests/migration-idempotency.test.ts` — green (15 + 3).
- `npx vitest run` full suite — 690 passed, 0 failed, 49 todo, 4 skipped.
- `npx tsc --noEmit` and `npx tsc --noEmit -p tsconfig.app.json` — clean.
- SC1: flipped `needsMigration` test (session mapped, item unmapped → true) passes GREEN; fully-mapped → false.
- SC2: `migration-idempotency.test.ts` asserts run-2 `from("sessions")` insert call count = 0 over a preserved partial; total inserts across both runs = total rows; run-2 `failed: 0`, `partial: false`; post-retry `sessions`/item/`exportHistory` counts all 0.

## TDD Gate Compliance

- RED: `test(38-01)` commit `fc607fc` — Dexie v12 + helper + flipped needsMigration test failing red.
- GREEN: `feat(38-01)` commit `b8d5d14` — predicate + guards + counter split makes it pass.
- No separate REFACTOR commit needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] house/sale item `++id` collision in the reverse guard**
- **Found during:** Task 2 (existing `data-migration.test.ts` "inserts house+sale items" went to 1 insert instead of 2).
- **Issue:** `houseVisitItems` and `saleItems` are separate Dexie tables with independent `++id` keyspaces, so a house item and a sale item routinely share the same integer `oldId`. The D-05 item guard stores both under `type: "item"`, so `getNewIdByOldId(id, "item")` for a sale item would match an already-migrated house item with the same id → the sale item is wrongly skipped (silent data loss on migration). Not anticipated by the plan/RESEARCH (forward `getDexieItemId` looks up by globally-unique `newId`, so the collision only bites the new reverse direction).
- **Fix:** Added an additive **unindexed** `itemTable?: "house" | "sale"` field on item idMapping rows (no schema migration — Dexie stores arbitrary props; `type` stays `"session"|"item"` per the locked contract; forward consumers and `photoMigration` `type==="item"` filter unaffected). `getNewIdByOldId` and the `needsMigration` item loops pass `itemTable` to scope the reverse lookup.
- **Files modified:** `src/db/idMapping.ts`, `src/db/types.ts`, `src/db/migration.ts`.
- **Commit:** `b8d5d14`.
- **Test:** new `migration-idempotency.test.ts` case "house and sale items with colliding ++id are not confused by the reverse guard" (asserts both insert when ids collide).

**2. [Rule 3 - Blocking] `useDataMigration` referenced the removed `skipped` field**
- **Found during:** Task 2 (`tsc -p tsconfig.app.json` error TS2339 on `result.skipped`).
- **Issue:** The return-shape change dropped `skipped`; the hook still read it. Plan 02 owns the full hook rewrite, but the build was broken now.
- **Fix:** Mapped the hook's existing `skipped` field to `result.failed` (closest semantic — `skipped` drove `partial`) with a WHY-comment pointing to Plan 02 for the full `failed`/`alreadyMigrated` plumbing. ProtectedRoute's `migration.skipped` consumer compiles unchanged.
- **Files modified:** `src/hooks/useDataMigration.ts`.
- **Commit:** `b8d5d14`.

**3. [Rule 3 - Blocking] test mocks/assertions pinned to the old `skipped` return shape**
- **Found during:** Task 2 (4 assertions in `data-migration.test.ts`, 2 mock shapes in `migration-partial.test.tsx`).
- **Issue:** Renaming `skipped`→`failed` broke existing assertions; the `vi.mock("../db/idMapping")` factory in `data-migration.test.ts` also had to expose the real `getNewIdByOldId` (and route `addIdMapping` to real Dexie) so the new ground-truth cleanup gate is observable in that file.
- **Fix:** Updated `.skipped`→`.failed` assertions and the `toEqual` return-shape; reworked the idMapping mock to a real-writing spy (cloning the arg so Dexie's auto-`id` mutation doesn't pollute `toHaveBeenCalledWith`); updated `migration-partial.test.tsx` mock returns to the new shape.
- **Files modified:** `src/tests/data-migration.test.ts`, `src/tests/migration-partial.test.tsx`.
- **Commit:** `b8d5d14` (test mocks), `fc607fc` (idMapping mock rework).

## Notes for Plan 02

- New return shape `{ migrated, alreadyMigrated, failed, partial }` is exported and tsc-clean. The hook currently collapses `failed` into its legacy `skipped` field — Plan 02 should surface `failed` + `alreadyMigrated` properly and wire the `MigrationRetryBanner`.
- `itemTable` is now part of the `IdMapping` shape (optional, only on item mappings written by Phase 38+). Pre-existing item mappings have no `itemTable`; the scoped lookup treats them as non-matching, which is safe (a missing mapping → re-migrate, idempotent).

## Self-Check: PASSED

All created/modified files exist on disk; both task commits (fc607fc RED, b8d5d14 GREEN) are in the git log.
