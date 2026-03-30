---
phase: quick-8
plan: 1
subsystem: ai-pipeline
tags: [formatting, title, all-caps]
dependency_graph:
  requires: []
  provides: [toAllCaps-utility]
  affects: [gemini-pipeline]
tech_stack:
  added: []
  patterns: [toUpperCase]
key_files:
  created:
    - src/utils/toAllCaps.ts
  modified:
    - src/services/gemini.ts
    - src/tests/gemini-pipeline.test.ts
  deleted:
    - src/utils/toTitleCase.ts
decisions:
  - Replaced toTitleCase with toAllCaps using simple str.toUpperCase()
metrics:
  duration: 1min
  completed: 2026-03-16
---

# Quick Task 8: Change Title Autoformatting to ALL CAPS Summary

**One-liner:** Replaced Title Case formatting with ALL CAPS for AI-transcribed auction catalog titles using toUpperCase.

## What Was Done

### Task 1: Change title formatting from Title Case to ALL CAPS
- **Commit:** 1e7d551
- Created `src/utils/toAllCaps.ts` with simple `str.toUpperCase()` implementation
- Updated `src/services/gemini.ts` to import and use `toAllCaps` instead of `toTitleCase`
- Updated all test expectations in `src/tests/gemini-pipeline.test.ts` to expect ALL CAPS output
- Deleted old `src/utils/toTitleCase.ts`

## Verification

- All 16 gemini-pipeline tests pass with ALL CAPS expectations
- Full test suite: 167 tests pass across 20 test files
- Zero references to `toTitleCase` remain in `src/`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated additional test expectations not listed in plan**
- **Found during:** Task 1
- **Issue:** Plan only mentioned line 145 assertion, but lines 122 and 164 also expected Title Case output ("Oak Table")
- **Fix:** Updated all three assertions to expect "OAK TABLE"
- **Files modified:** src/tests/gemini-pipeline.test.ts
- **Commit:** 1e7d551

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | 1e7d551 | feat(quick-8): change title autoformatting from Title Case to ALL CAPS |
