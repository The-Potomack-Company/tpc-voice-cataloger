---
phase: 43-photomigration-itemid-collision
reviewed: 2026-06-04T15:40:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/services/photoMigration.ts
  - src/tests/photo-migration-collision.test.ts
  - src/tests/photo-migration.test.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 43: Code Review Report

**Reviewed:** 2026-06-04T15:40:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed the keyspace-collision fix in `photoMigration.ts` plus its two test
files. The core fix is **correct**: `migrateExistingPhotos` now resolves the
Dexie `itemId` through `getNewIdByOldId(photo.itemId, "item", photo.itemType)`,
passing `photo.itemType` as the `itemTable` discriminator. This faithfully
mirrors the production `migrateToSupabase` write path
(`src/db/migration.ts:155,187,206,238`), where every item mapping is stored with
a matching `itemTable` (`"house"`/`"sale"`). The types line up: `ItemPhoto.itemType`
is exactly `"house" | "sale"` (`src/db/types.ts:58`), which is the helper's third
parameter type — no coercion, no `any`. The collision test asserts both the
distinct-UUID outcome AND the discriminator wiring (`toHaveBeenCalledWith(1, "item", "house"/"sale")`),
so it genuinely pins the fix rather than the result alone.

Both test files pass (10 tests green). The mocks reflect production: the helper
is mocked at `../db/idMapping` (the real import path), and the legacy `db.idMapping`
query chain is correctly noted as unused by the fixed path.

No BLOCKER-tier defects found. Two WARNINGs concern the **fallback path** and a
**test-fidelity gap** that lets a future regression slip through. Two INFO items
note minor robustness/consistency issues.

## Warnings

### WR-01: Fallback path re-opens the collision the fix closes, with no item-type scoping

**File:** `src/services/photoMigration.ts:55-65`
**Issue:** When `getNewIdByOldId` returns `null` (no mapping), the code falls back
to treating the legacy integer `itemId` as a Supabase UUID:
`const supabaseItemId = newId ?? String(photo.itemId);`. It then queries
`items.id == supabaseItemId`. For a genuinely-migrated item the mapping exists, so
this is moot. But the fallback fires precisely when the mapping is **missing** —
e.g. a photo whose item was migrated on a build *before* `itemTable` was recorded,
or whose mapping row predates the v12 schema. In that state the discriminator the
fix relies on does not exist, so `getNewIdByOldId` with an `itemTable` arg returns
`null` (the `.filter((m) => m.itemTable === itemTable)` rejects rows where
`itemTable` is `undefined`), and the code silently falls back to
`String(photo.itemId)` — a bare integer like `"1"`. The Supabase `items.id` column
is a UUID, so `.eq("id", "1")` returns no row, the photo is skipped, and (per DAT-6)
the migration flag is never set — the photo is retried forever with no progress.

This is not a regression introduced by this phase (the fallback predates it), but
the fix's reliance on `itemTable` being present in the mapping makes the
legacy-mapping case strictly worse than before: pre-fix the unscoped lookup would
have *found* such a row (possibly the wrong one — the very collision being fixed),
post-fix it finds nothing and strands the photo.

**Fix:** Either (a) when the `itemTable`-scoped lookup misses, retry once without
the discriminator and log a warning so legacy mappings still resolve:
```ts
let newId = await getNewIdByOldId(photo.itemId, "item", photo.itemType);
if (newId === null) {
  // legacy mapping written before itemTable was recorded (pre-v12)
  newId = await getNewIdByOldId(photo.itemId, "item");
}
```
or (b) confirm via a backfill/migration that every existing `idMapping` row of
`type: "item"` has `itemTable` set, making the fallback unreachable, and document
that invariant at the call site. Without one of these, photos tied to legacy
mappings are permanently un-uploadable.

### WR-02: Tests never exercise the `newId == null` fallback branch — the riskiest path is untested

**File:** `src/tests/photo-migration.test.ts:126-300`, `src/tests/photo-migration-collision.test.ts:97-107`
**Issue:** Every test stubs `getNewIdByOldId` to return a UUID for the relevant id
and `null` only for ids whose item is "not in Supabase yet." There is **no test**
where `getNewIdByOldId` returns `null` for an id whose item *does* exist in
Supabase — i.e. the `supabaseItemId = String(photo.itemId)` fallback branch
(`photoMigration.ts:58`). That branch (the subject of WR-01) is the one most likely
to misbehave, and it has zero coverage. The DAT-6 test (`photo-migration.test.ts:241`)
looks like it covers a miss, but it conflates two different misses: the helper
returns a UUID and the *Supabase lookup* returns null — it never drives the
`newId ?? String(...)` coalesce.

**Fix:** Add a test where `mockGetNewIdByOldId` resolves `null` for a photo and
assert the documented behavior of the fallback (whatever WR-01 resolves it to) —
e.g. that the photo is skipped and the flag stays unset, or that the unscoped
retry path is taken. This locks the behavior so a future change to the coalesce
can't silently strand photos.

## Info

### IN-01: Inline-comment claim "matching migrateToSupabase" is true but undertested for the audio sibling

**File:** `src/services/photoMigration.ts:50-54`
**Issue:** The comment asserts parity with `migrateToSupabase`. Verified accurate
for items. Note `ItemAudio` (`src/db/types.ts:68`) has the identical
`itemType: "house" | "sale"` shape and presumably the same collision risk in its
own migration path; if an audio-migration equivalent exists it should carry the
same fix. Out of scope for this phase's files, flagged for follow-up tracking.
**Fix:** Confirm the audio migration path applies the same `itemTable` scoping; if
not, open a sibling phase.

### IN-02: Collision test's Supabase mock builds a fresh `eq` mock per call — fine, but diverges subtly from the shared helper

**File:** `src/tests/photo-migration-collision.test.ts:72-83`
**Issue:** `setupSupabaseItemLookup` is duplicated nearly verbatim across both test
files. Minor maintenance hazard: a future change to the production query shape
(e.g. adding `.limit()`) must be mirrored in two places or one test silently keeps
passing against a stale shape.
**Fix:** Extract the shared `setupSupabaseItemLookup` / mock-wiring into a small
test helper imported by both files.

---

_Reviewed: 2026-06-04T15:40:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
