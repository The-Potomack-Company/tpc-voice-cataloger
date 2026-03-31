---
phase: 21-more-granularity-with-description-and-transcription
plan: 02
subsystem: ai-pipeline
tags: [gemini, merge, context-injection, re-recording, transcript]
dependency_graph:
  requires:
    - phase: 21-01
      provides: string-measurements-schema
  provides: [smart-field-merge, existing-value-context-injection, merge-rules-prompt]
  affects: [gemini.ts, gemini-pipeline.test.ts]
tech_stack:
  added: []
  patterns: [existing-field-read-before-ai-call, context-aware-text-part, ai-side-merge]
key_files:
  created: []
  modified:
    - src/services/gemini.ts
    - src/tests/gemini-pipeline.test.ts
key_decisions:
  - "AI handles all merge logic -- no app-side merge or diff needed"
  - "Existing field values read from Supabase before Gemini call, passed as context text"
  - "Transcript append moved from app-side concatenation to AI-side merge"
  - "First recordings use simple extraction prompt; re-recordings use merge prompt with EXISTING VALUES"
patterns_established:
  - "Context-aware AI call: read existing state, inject as text context, let AI return final merged result"
requirements_completed: [GRAN-06, GRAN-07, GRAN-08, GRAN-09]
metrics:
  duration: 4min
  completed: "2026-03-31T13:31:18Z"
  tasks: 2
  files: 2
---

# Phase 21 Plan 02: Smart Field Merge Summary

Smart field merging for re-recordings -- AI receives existing field values as context and returns merged results, with MERGE RULES in the system prompt for additive-by-default behavior.

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-31T13:27:11Z
- **Completed:** 2026-03-31T13:31:18Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Existing field values read from Supabase before Gemini API call
- Context-aware text part injects existing values for re-recordings
- MERGE RULES added to SYSTEM_PROMPT (default additive, explicit overwrite only)
- App-side transcript concatenation replaced with direct AI-merged write
- 3 new tests covering merge context injection, simple extraction, and direct transcript write

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add existing-field read and context injection to Gemini pipeline | 59e3f76 | gemini.ts |
| 2 | Update pipeline tests for smart merge behavior | 2761eb5 | gemini-pipeline.test.ts |

## Files Created/Modified
- `src/services/gemini.ts` - Added existing-field read before Gemini call, context-aware text part, MERGE RULES in SYSTEM_PROMPT, simplified transcript write
- `src/tests/gemini-pipeline.test.ts` - Added createMockFrom helper, 3 new merge tests, updated all existing tests to use helper

## Decisions Made
- AI handles all merge logic (no app-side merge or diff needed) -- per D-03
- Existing fields read once early in pipeline, reused for context injection and null-bail
- Transcript append responsibility moved entirely to AI via merge rules
- createMockFrom helper introduced to reduce test mock duplication

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Smart merge infrastructure complete, ready for Plan 03 (spoken punctuation parsing)
- All 18 tests passing across gemini-pipeline and gemini-schema test files
