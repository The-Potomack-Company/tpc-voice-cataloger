---
phase: quick-11
plan: 1
subsystem: export
tags: [filename, sanitization, export, download]

requires:
  - phase: 06-export
    provides: exportSession and buildExportData functions
provides:
  - Session-title-based export filenames with filesystem sanitization
affects: [export, chrome-extension-import]

tech-stack:
  added: []
  patterns: [sanitizeFilename helper for safe filenames]

key-files:
  created: []
  modified:
    - src/utils/export.ts
    - src/tests/export.test.ts

key-decisions:
  - "sanitizeFilename replaces /\\:*?\"<>| with dashes, trims dots/spaces, collapses consecutive dashes"
  - "Empty/whitespace session names fall back to tpc-session-{id}.json"

patterns-established:
  - "sanitizeFilename: reusable helper for any filename derivation from user input"

requirements-completed: []

duration: 1min
completed: 2026-03-16
---

# Quick Task 11: Session Title Export Filename Summary

**Export filename uses session title (sanitized for filesystem safety) instead of numeric ID, with fallback for empty names**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-16T20:51:41Z
- **Completed:** 2026-03-16T20:52:44Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments
- Added `sanitizeFilename` helper that replaces unsafe filesystem characters with dashes
- Export filename now uses session name (e.g., "Smith Estate Sale.json") instead of "tpc-session-1.json"
- Falls back to ID-based filename for empty or whitespace-only session names
- 6 new tests added (3 for sanitizeFilename, 3 for exportSession filename behavior), all 18 pass

## Task Commits

Each task was committed atomically (TDD):

1. **Task 1 RED: Failing tests for title-based filename** - `4ba54f5` (test)
2. **Task 1 GREEN: Implement sanitizeFilename + use in exportSession** - `375e9b5` (feat)

## Files Created/Modified
- `src/utils/export.ts` - Added sanitizeFilename helper; updated exportSession to use session title
- `src/tests/export.test.ts` - 6 new tests for filename sanitization and title-based naming

## Decisions Made
- sanitizeFilename replaces `/\:*?"<>|` with dashes, collapses consecutive dashes, trims leading/trailing dots and spaces
- Empty/whitespace-only names fall back to the old `tpc-session-{id}.json` pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Export filenames now human-readable for easier identification during upload
- Chrome extension import unaffected (reads file content, not filename)

---
*Quick Task: 11*
*Completed: 2026-03-16*
