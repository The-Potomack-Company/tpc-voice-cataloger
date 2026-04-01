---
phase: quick
plan: 260401-n6a
subsystem: ai-pipeline
tags: [gemini, spoken-punctuation, post-processing, quotes]
dependency_graph:
  requires: []
  provides: [spoken-quote-conversion]
  affects: [gemini-pipeline, catalog-fields]
tech_stack:
  added: []
  patterns: [regex-post-processor, safety-net-pattern]
key_files:
  created:
    - src/utils/spokenPunctuation.ts
    - src/tests/spoken-punctuation.test.ts
  modified:
    - src/services/gemini.ts
decisions:
  - "Used iterative find-and-replace strategy instead of global regex to handle nested/adjacent pairs correctly"
  - "Unpaired 'quote' left unconverted to protect noun usage (e.g. 'get a quote')"
  - "Applied post-processor only to text fields (title, description, condition, transcript), not structured fields (estimate, category, measurements)"
metrics:
  duration: 2m 12s
  completed: "2026-04-01"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 10
  files_changed: 3
---

# Quick Task 260401-n6a: Spoken Quote Markers to Actual Quotes Summary

Client-side post-processor converts paired spoken quote markers ("quote X unquote", "open quote X close quote") into ASCII double-quote characters, with improved Gemini system prompt as primary defense and regex safety net as fallback.

## What Was Done

### Task 1: Create spoken-punctuation post-processor with tests (TDD)
- **Commit:** ac90cdd
- Created `src/utils/spokenPunctuation.ts` exporting `applySpokenQuotes(text: string): string`
- Handles opening markers: "quote", "open quote" (case-insensitive)
- Handles closing markers: "unquote", "close quote", "end quote" (case-insensitive)
- Iterative pair-matching strategy: finds opening marker, then next closing marker, replaces both with `"` (0x22)
- Unpaired opening markers left as-is (noun protection)
- 10 test cases covering: basic conversion, open/close variants, end quote variant, no-quotes passthrough, case-insensitivity, surrounding text preservation, multiple pairs, unpaired noun usage, empty string, mixed marker styles

### Task 2: Improve system prompt and wire post-processor into pipeline
- **Commit:** 0d07914
- Updated system prompt quote instructions from vague "opening quotation mark" to explicit `" (ASCII double-quote character, 0x22)` with a concrete example
- Imported and wired `applySpokenQuotes` into `processAudioWithAi()` after Zod validation, before Supabase write
- Applied to text fields only: title, description, condition, transcript
- Not applied to: estimate, category, measurements (structured fields)
- All 23 tests pass (13 pipeline + 10 spoken-punctuation)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Verification Results

- `npx vitest run src/tests/spoken-punctuation.test.ts` -- 10/10 pass
- `npx vitest run src/tests/gemini-pipeline.test.ts` -- 13/13 pass (no regressions)
- System prompt contains explicit ASCII double-quote instruction with example
- Post-processor wired between Zod validation and Supabase write

## Self-Check: PASSED

All 4 files verified on disk. Both commit hashes (ac90cdd, 0d07914) found in git log.
