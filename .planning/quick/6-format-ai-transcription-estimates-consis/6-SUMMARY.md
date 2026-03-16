---
phase: quick-6
plan: 01
subsystem: ai-pipeline
tags: [estimate-formatting, gemini, post-processing, tdd]
dependency_graph:
  requires: [gemini-pipeline, gemini-schema]
  provides: [formatEstimate-utility]
  affects: [ai-processing, catalog-export]
tech_stack:
  added: []
  patterns: [post-processing-utility, tdd-red-green]
key_files:
  created:
    - src/utils/formatEstimate.ts
    - src/tests/formatEstimate.test.ts
  modified:
    - src/services/gemini.ts
    - src/services/geminiSchema.ts
    - src/tests/gemini-pipeline.test.ts
decisions:
  - "+/-20% spread with rounding to nearest 100 for single numbers >= 100"
  - "Non-numeric text passes through unchanged (safety for unexpected Gemini output)"
  - "Multi-number input uses min/max (handles '200 to 300 to 400' edge case)"
metrics:
  duration: 2min
  completed: 2026-03-16
  tasks_completed: 2
  tasks_total: 2
  files_changed: 5
  tests_added: 11
  tests_total: 167
---

# Quick Task 6: Format AI Transcription Estimates Consistently

formatEstimate utility with +/-20% range spread, Gemini prompt updated to request numeric output, post-processing wired into pipeline before DB write.

## What Was Done

### Task 1: Create formatEstimate utility with tests (TDD)
- **Commit:** 7b93a01
- **RED:** Created 11 failing tests covering null, empty, single number, ranges, dollar signs, sorting, non-numeric passthrough, and multi-number edge cases
- **GREEN:** Implemented `formatEstimate()` in `src/utils/formatEstimate.ts`
- Logic: null/empty returns null; strip `$` and `,`; extract numbers via regex; single number gets +/-20% spread with rounding >= 100; 2+ numbers use min-max; no numbers = passthrough

### Task 2: Update Gemini prompt and wire formatEstimate into pipeline
- **Commit:** 8b076cb
- Updated `geminiSchema.ts` estimate field description to guide Gemini toward numeric output
- Updated `SYSTEM_PROMPT` in `gemini.ts` with explicit numeric estimate instructions
- Imported and applied `formatEstimate()` to `fields.estimate` before DB write
- Updated pipeline test mocks: estimate "500" expects "400 - 600", estimate "300 to 500" passes through as "300 - 500"

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- All 11 formatEstimate unit tests pass
- All 16 gemini-pipeline tests pass (updated expectations)
- All 5 gemini-schema tests pass (unchanged)
- Full suite: 167 tests pass, 0 failures, 0 regressions
