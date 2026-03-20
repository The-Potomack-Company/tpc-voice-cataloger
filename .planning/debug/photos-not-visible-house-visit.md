---
status: diagnosed
trigger: "photo upload for items not visible in house visit mode"
created: 2026-03-20T00:00:00Z
updated: 2026-03-20T00:00:00Z
---

## Current Focus

hypothesis: PhotoCapture saves photos using Supabase UUID but ItemEntry queries photos with mode gate that blocks display; additionally there is a dual-query inconsistency between ItemEntry and PhotoCapture
test: Compare photo query in ItemEntry vs PhotoCapture
expecting: Mismatch in how photos are queried
next_action: Report root cause

## Symptoms

expected: Photos taken in house visit mode should appear as thumbnails in ItemEntry
actual: Photos uploaded but not visible in house visit mode
errors: none reported
reproduction: Open house visit session, navigate to item, take photo, photo not displayed
started: After Phase 14 migration

## Eliminated

(none)

## Evidence

- timestamp: 2026-03-20
  checked: ItemEntry.tsx photo query (lines 78-85)
  found: ItemEntry has DUAL photo queries - one at component level (lines 78-85) AND PhotoCapture has its own internal query (lines 56-63). The ItemEntry query is ONLY used for the lightbox (line 253). PhotoCapture independently queries and displays photos.
  implication: The ItemEntry-level query is not the display path - PhotoCapture handles its own display.

- timestamp: 2026-03-20
  checked: PhotoCapture.tsx save logic (lines 80-98)
  found: On save, PhotoCapture uses `dexieItemId ?? itemId` as the storeId. For NEW items (created post-migration), getDexieItemId returns null, so dexieItemId stays null, so storeId = itemId (the Supabase UUID string).
  implication: Photos for new items are saved with a string UUID as itemId.

- timestamp: 2026-03-20
  checked: PhotoCapture.tsx query logic (lines 56-63)
  found: Query uses `dexieItemId` which is null for new items (no mapping exists). When dexieItemId is null, the query returns empty array `[] as ItemPhoto[]`.
  implication: ROOT CAUSE FOUND - For new items, dexieItemId is never set to the itemId fallback in the QUERY path, only in the SAVE path.

- timestamp: 2026-03-20
  checked: Comparison of save vs query paths
  found: SAVE path (line 90): `const storeId = dexieItemId ?? itemId` - correctly falls back to itemId. QUERY path (line 57-58): `if (dexieItemId == null) return []` - returns empty, never falls back to itemId.
  implication: This is the exact bug. Save uses fallback, query does not.

## Resolution

root_cause: In PhotoCapture.tsx, the photo query (line 57-58) returns an empty array when dexieItemId is null, but the save path (line 90) falls back to itemId when dexieItemId is null. For NEW items created post-migration, there is no ID mapping entry, so getDexieItemId returns null. Photos are saved under the Supabase UUID (via the fallback), but the query never looks them up because it bails out when dexieItemId is null. The same bug exists in ItemEntry.tsx lines 78-85 (affecting lightbox).
fix: Change the query in both PhotoCapture and ItemEntry to fall back to itemId when dexieItemId is null, matching the save behavior.
verification:
files_changed: []
