# Phase 43 — Deferred Items

## WR-01 (deferred 2026-06-04): legacy `itemTable`-less idMapping rows miss the scoped photo lookup

**Source:** 43-REVIEW.md (WARNING).

**What:** `getNewIdByOldId(oldId, "item", itemTable)` filters `m.itemTable === itemTable`
([src/db/idMapping.ts:51-56](../../../src/db/idMapping.ts)). A mapping row written
before Phase 38 (no `itemTable`) is rejected, so `migrateExistingPhotos` falls back to
`String(photo.itemId)` and the Supabase items lookup misses.

**Why deferred (not permanent loss, self-healing):**
- `migrateExistingPhotos` is fire-and-forget on every AppLayout mount
  ([src/layouts/AppLayout.tsx:74](../../../src/layouts/AppLayout.tsx)). A miss →
  bare-int string → no Supabase item → photo **skipped that pass, retried next mount**
  (DAT-6 leaves the flag unset on skip).
- `migrateToSupabase.needsMigration` uses the **same scoped lookup**
  ([src/db/migration.ts:17-21](../../../src/db/migration.ts)), so legacy `itemTable`-less
  items trigger re-migration that **backfills `itemTable`**. Once that runs, the next photo
  pass resolves correctly. Phase 38's design already depends on this re-migration.

**Why not fixed in 43:** The correct fix is design-level (a safe *unambiguous-legacy*
fallback: retry unscoped only when the `[oldId,type]` candidate set is a single row) and
must live in `idMapping.ts` + mirror into `migration.ts` — both **out of phase 43's scope
fence**. The reviewer's naive "retry unscoped on miss" would reintroduce the house/sale
collision this phase fixed.

**Guard rail in place:** WR-02 fallback-branch tests added to
`src/tests/photo-migration-collision.test.ts` pin the `newId ?? String(photo.itemId)`
path and the skip-not-strand behavior, so a future WR-01 fix can't silently regress them.

**Suggested home:** fold into a future migration-hardening phase alongside the `ItemAudio`
sibling check (43-REVIEW INFO-01 — verify the audio migration path carries the same
`itemTable` discriminator).
