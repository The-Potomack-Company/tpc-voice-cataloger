---
phase: 02-audio-capture
plan: 02
subsystem: ui
tags: [react, tailwind, recording-ui, mediarecorder, zustand, dexie, vitest]

# Dependency graph
requires:
  - phase: 02-audio-capture
    provides: useAudioRecorder hook, useRecordingStore, formatDuration utility
provides:
  - RecordButton component with idle/requesting/recording/error states
  - RecordingIndicator component with MM:SS timer and red viewport border
  - RecordingToast component with duration display and inline audio playback
  - NewSession page with integrated recording flow
affects: [03-session-management]

# Tech tracking
tech-stack:
  added: []
  patterns: [component-state-from-hook, fixed-overlay-indicators, auto-dismiss-toast, TDD-red-green-for-components]

key-files:
  created:
    - src/components/RecordButton.tsx
    - src/components/RecordingIndicator.tsx
    - src/components/RecordingToast.tsx
    - src/tests/record-button.test.tsx
  modified:
    - src/pages/NewSession.tsx
    - src/index.css

key-decisions:
  - "Demo recording uses orphan HouseVisitItem (sessionId=0) for Phase 2; Phase 3 will restructure into proper session flow"
  - "Recording indicator uses fixed-position overlay with pointer-events-none for full-viewport red border"
  - "Toast auto-dismisses after 4 seconds and revokes object URL for memory cleanup"

patterns-established:
  - "Recording UI pattern: hook-driven component states (idle/requesting/recording/error) with Zustand for cross-component sync"
  - "Toast pattern: fixed-position above tab bar, auto-dismiss with cleanup, z-50 layering"
  - "Overlay pattern: fixed inset-0 pointer-events-none for non-blocking visual indicators"

requirements-completed: [VOICE-01, VOICE-02, VOICE-03, VOICE-04]

# Metrics
duration: 5min
completed: 2026-03-06
---

# Phase 2 Plan 02: Recording UI Components Summary

**Recording button with circle/square morph, MM:SS timer with red viewport border, and auto-dismissing toast with inline playback -- TDD with 8 component tests**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-06T19:34:40Z
- **Completed:** 2026-03-06T19:35:00Z
- **Tasks:** 2 (1 implementation + 1 human verification)
- **Files modified:** 6

## Accomplishments
- RecordButton toggles between red circle (microphone) and red square (stop) with proper aria-labels and minimum 72px touch target
- RecordingIndicator shows live MM:SS timer and pulsing red border around viewport during recording
- RecordingToast displays "Recording saved" with formatted duration and working inline audio playback
- All components integrated into NewSession page with "Quick Record" section below mode cards
- Human-verified end-to-end: button morph, timer counting, red border, toast with audio playback, IndexedDB persistence

## Task Commits

Each task was committed atomically:

1. **Task 1: Recording UI components + page integration**
   - `853a5f5` (test) - RED: failing tests for RecordButton, RecordingIndicator, RecordingToast
   - `7002ad1` (feat) - GREEN: implement all three components and NewSession integration
2. **Task 2: Verify recording flow on device** - Human checkpoint approved (no commit needed)

## Files Created/Modified
- `src/components/RecordButton.tsx` - Large red circle/square toggle button with microphone/stop icons
- `src/components/RecordingIndicator.tsx` - Fixed overlay with MM:SS timer and pulsing red viewport border
- `src/components/RecordingToast.tsx` - Auto-dismissing toast with duration display and inline audio playback
- `src/pages/NewSession.tsx` - Integrated Quick Record section with RecordButton, RecordingIndicator, RecordingToast
- `src/tests/record-button.test.tsx` - 8 component tests covering all UI states
- `src/index.css` - Custom pulse animation for recording border glow

## Decisions Made
- Demo recording creates an orphan HouseVisitItem with sessionId=0 to maintain Dexie schema contract; Phase 3 session management will restructure this into proper session flow
- Recording indicator uses fixed-position overlay with pointer-events-none so it covers the full viewport without blocking interaction
- Toast auto-dismisses after 4 seconds and revokes the object URL to prevent memory leaks

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Complete recording UI verified and working end-to-end on desktop browser
- Phase 2 (Audio Capture) fully complete: infrastructure (Plan 01) + UI (Plan 02)
- Ready for Phase 3 (Session Management) to restructure orphan recordings into proper session flow
- All audio hooks, stores, and components available for reuse in future phases

## Self-Check: PASSED

All 7 files verified present. Both task commits (853a5f5, 7002ad1) confirmed in git history.

---
*Phase: 02-audio-capture*
*Completed: 2026-03-06*
