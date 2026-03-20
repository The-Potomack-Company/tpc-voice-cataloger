---
phase: 14-data-migration
plan: 05
subsystem: ui, api, database
tags: [react, supabase, dexie, photos, gemini, migration]

# Dependency graph
requires:
  - phase: 14-data-migration
    provides: Dexie-to-Supabase migration, ID mapping, session/item stores
provides:
  - ItemCard "Photos & Details" navigation for house-mode items
  - Race-condition-free photo queries using dexieItemId ?? itemId fallback
  - Graceful AI processing when items are deleted mid-flight
  - Sessions table accepts 'completed' status
affects: [14-UAT]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "dexieItemId ?? itemId fallback for photo queries (eliminates async race condition)"
    - ".maybeSingle() + null bail-out for defensive Supabase queries"

key-files:
  created:
    - supabase/migrations/20260320000000_add_completed_status.sql
  modified:
    - src/components/ItemCard.tsx
    - src/components/PhotoCapture.tsx
    - src/pages/ItemEntry.tsx
    - src/services/gemini.ts

key-decisions:
  - "Use dexieItemId ?? itemId fallback in photo queries to eliminate race condition"
  - "Use .maybeSingle() instead of .single() for defensive item lookups during AI processing"

patterns-established:
  - "Photo query fallback: always use dexieItemId ?? itemId to avoid async resolution race"

requirements-completed: [INFRA-03]

# Metrics
duration: 4min
completed: 2026-03-20
---

# Phase 14 Plan 05: UAT Gap Closure Summary

**Fixed 4 UAT gaps: ItemCard photo navigation, photo query race condition, delete-during-AI 406 error, and session complete 400 error**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T14:56:04Z
- **Completed:** 2026-03-20T15:00:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added "Photos & Details" navigation button in ItemCard for house-mode items
- Fixed photo query race condition in both PhotoCapture.tsx and ItemEntry.tsx using dexieItemId ?? itemId fallback
- Fixed 406 error when deleting items during AI processing by switching to .maybeSingle()
- Added 'completed' to sessions status CHECK constraint and pushed migration to Supabase

## Task Commits

Each task was committed atomically:

1. **Task 1: Add navigation to ItemEntry from ItemCard + fix photo race condition** - `5a1ac5d` (feat)
2. **Task 2: Fix 406 on delete and 400 on session complete** - `7055d97` (fix)

## Files Created/Modified
- `src/components/ItemCard.tsx` - Added useNavigate import and "Photos & Details" button for house-mode items
- `src/components/PhotoCapture.tsx` - Fixed useLiveQuery to use dexieItemId ?? itemId fallback
- `src/pages/ItemEntry.tsx` - Fixed useLiveQuery to use same fallback pattern
- `src/services/gemini.ts` - Changed .single() to .maybeSingle() with null bail-out
- `supabase/migrations/20260320000000_add_completed_status.sql` - ALTER TABLE adding completed to sessions status CHECK

## Decisions Made
- Use `dexieItemId ?? itemId` fallback in photo queries so photos display immediately before async getDexieItemId resolves
- Use `.maybeSingle()` instead of `.single()` for item lookups during AI processing to gracefully handle deleted items

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 UAT gaps from Phase 14 testing are now closed
- Phase 14 can be marked complete pending UAT re-verification

## Self-Check: PASSED

All 5 files verified on disk. Both task commits (5a1ac5d, 7055d97) verified in git log.

---
*Phase: 14-data-migration*
*Completed: 2026-03-20*
