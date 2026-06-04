---
phase: 42-audio-upload-reliability
plan: 02
subsystem: ui
tags: [audio, banner, cross-device, retry, react, dexie, supabase, reliability]

# Dependency graph
requires:
  - phase: 42-audio-upload-reliability (plan 01)
    provides: durable failed-upload resweep + audio<->item reconcile edge (SC-1) — server-side audio now reliably lands, which is the precondition this plan's recovery UI surfaces
provides:
  - hasServerAudio-gated AiFailureBanner that renders + retries for failed items whose audio exists only server-side (cross-device / Dexie-cleared)
  - hasServerAudio slice threaded through the PERF-3 ItemList aggregate -> ItemCard -> banner, and a parallel derivation on the ItemEntry detail page
  - cross-device regression test pinning SC-2/SC-3 (item present, audio only in Supabase -> banner shows Retry -> retry resolves via Storage-by-item_id)
affects: [audio-upload-reliability, ai-failure-recovery, cross-device-sync]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-side existence boolean (hasServerAudio) drives recovery UI instead of the device-local Dexie integer (SHARED-3)"
    - "Boolean meta slice threaded through the existing PERF-3 aggregate-subscription (no per-banner network round-trip)"

key-files:
  created:
    - src/tests/audio-cross-device-recovery.test.tsx
  modified:
    - src/components/AiFailureBanner.tsx
    - src/components/ItemList.tsx
    - src/components/ItemCard.tsx
    - src/pages/ItemEntry.tsx
    - src/tests/item-card-ai-failure.test.tsx

key-decisions:
  - "Banner gates on `!hasServerAudio && latestAudioId == null` — renders when EITHER a server-side audio row exists OR a real local Dexie integer is present; `== null` (not `=== null`) covers the intentional id:undefined of Supabase-union rows (Pitfall 2)."
  - "Server-only retry passes a sentinel audioId of 0 through the existing gemini.ts orchestrator (isRetry=true); resolveAudioForAi ignores the integer when the Dexie blob is absent and resolves the blob by item_id (gemini.ts:241)."
  - "hasServerAudio is computed as `audios.some((a) => a.id == null)` — any returned row with an absent id is a Supabase-union (remote) row, the precise cross-device signal — reusing the already-fetched audios array rather than adding a second query (Open-Q3)."

patterns-established:
  - "Recovery UI keyed on server-side existence, never the device-local integer (the F2/GAP-5 root fix)."
  - "New required boolean meta slice added to ItemMeta + React.memo comparator updated so a hasServerAudio change re-renders only the affected card."

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-06-04
---

# Phase 42 Plan 02: AiFailureBanner cross-device recovery Summary

**Fixed UAT finding F2: failed items whose audio exists only in Supabase Storage now render a working Retry, gated on a `hasServerAudio` server-side boolean (not the device-local Dexie integer), with the retry resolving the blob by item_id through the existing gemini orchestrator.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-04T19:19:13Z
- **Completed:** 2026-06-04T19:22:10Z
- **Tasks:** 3
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- `AiFailureBanner` no longer returns `null` for cross-device / Dexie-cleared failed items: it gates on `!hasServerAudio && latestAudioId == null`, so a failure with recoverable server-side audio shows the alert + Retry (GAP-5/F2 closed).
- Retry for a server-only item routes through the gemini.ts orchestrator (`processAudioWithAi`, import unchanged) with `isRetry=true` and a sentinel `audioId` of `0`; `resolveAudioForAi` resolves the blob via Storage-by-`item_id`, so no local integer is required.
- `hasServerAudio` is computed once in the existing PERF-3 `ItemList` aggregate (`audios.some((a) => a.id == null)`) and threaded through `ItemCard` to the banner; `ItemEntry` derives the same boolean in its banner meta hook. No second network round-trip per banner.
- Added `src/tests/audio-cross-device-recovery.test.tsx` (Wave-0 RED gate): server-only render, retry-keyed-on-item_id, audio-less-stays-null, and local-blob-unregressed cases. RED before Task 1, GREEN after.

## Task Commits

Each task was committed atomically:

1. **Task 0 (Wave 0): cross-device recovery test scaffold (RED)** - `b9c5116` (test)
2. **Task 1: Gate AiFailureBanner + Retry on hasServerAudio (GREEN)** - `efd1783` (feat)
3. **Task 2: Thread hasServerAudio through ItemList aggregate, ItemCard, ItemEntry** - `9a1c611` (feat)

_TDD gate: RED `b9c5116` (test) precedes GREEN `efd1783` (feat). No refactor commit needed._

## Files Created/Modified
- `src/tests/audio-cross-device-recovery.test.tsx` - Wave-0 RED gate for SC-2/SC-3; renders the banner directly, mocks the gemini orchestrator, asserts server-only render + Retry, retry-keyed-on-item_id, negative, and local-blob cases.
- `src/components/AiFailureBanner.tsx` - Added `hasServerAudio: boolean` prop; replaced the `latestAudioId == null` gate with `!hasServerAudio && latestAudioId == null`; retry passes `latestAudioId ?? 0` (sentinel) through the unchanged gemini orchestrator import.
- `src/components/ItemList.tsx` - Added `hasServerAudio` to `ItemMeta`, computed it in the existing `audioRecordsForItem` loop (`audios.some((a) => a.id == null)`), threaded it into `<ItemCard>`.
- `src/components/ItemCard.tsx` - Added `hasServerAudio` to `ItemCardProps`, destructured it, passed it to `<AiFailureBanner>`, and added it to the `React.memo` comparator.
- `src/pages/ItemEntry.tsx` - Extended the banner meta `useLiveQuery` to return `{ latestAudioId, hasServerAudio }` and passed `hasServerAudio` to the detail banner.
- `src/tests/item-card-ai-failure.test.tsx` - Added `hasServerAudio={false}` to `renderCard` for the now-required prop (local-blob path, still green).

## Decisions Made
- **Sentinel audioId `0` for server-only retry** rather than widening the orchestrator's first param to `number | null`: lowest-blast-radius, keeps the existing forward-compatible `processAudioWithAiRetry` cast shape, and is safe because `resolveAudioForAi` resolves by `item_id` and `db.audio.get(0)` returns undefined (falls through to the RLS-scoped Storage path, per threat T-42-09).
- **`audios.some((a) => a.id == null)`** as the existence signal (over `audios.length > 0 && latestAudioId == null`): directly tests for a Supabase-union row, the precise cross-device condition, and stays correct even if a local + remote row coexist.

## Deviations from Plan

None - plan executed exactly as written. The plan's `<files_modified>` listed `item-card-ai-failure.test.tsx`; updating it for the now-required prop was anticipated and stayed within scope (no behavior change to that test).

## Issues Encountered
None. RED was confirmed (exit 1, server-only cases failing), GREEN confirmed after the banner change, full suite green at 709 passed / 0 failed.

## Known Stubs
None. No placeholder data, no hardcoded empty values flowing to UI. `hasServerAudio` is wired end-to-end from `audioRecordsForItem`.

## User Setup Required
None - no external service configuration required. Zero schema changes, zero new npm dependencies.

## Next Phase Readiness
- SC-2 and SC-3 satisfied: cross-device failure recovery works on both list card and detail page; regression test pins it.
- The one genuine multi-device + live-RLS leg remains a manual UAT (deferred to v1.3 milestone-end batch per MEMORY.md) — add to `42-HUMAN-UAT.md` at phase close: record on device A (airplane mode), reconnect, confirm audio row lands; open same item on device B, confirm the failure banner Retry resolves via Storage.
- Phase 42 (both plans) complete. Branch `gsd/v1.3-maturation` unpushed (push deferred to milestone end).

## Self-Check: PASSED

- `src/tests/audio-cross-device-recovery.test.tsx` — FOUND
- Commit `b9c5116` (RED test) — FOUND
- Commit `efd1783` (GREEN banner) — FOUND
- Commit `9a1c611` (prop threading) — FOUND
- Full suite: 709 passed, 0 failed
- No schema/migration/database.types changes; no new deps

---
*Phase: 42-audio-upload-reliability*
*Completed: 2026-06-04*
