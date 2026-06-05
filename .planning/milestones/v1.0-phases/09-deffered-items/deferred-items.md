# Deferred Items - Phase 09

## Pre-existing Test Failures

- **gemini-pipeline.test.ts**: 2 tests failing - "category defaults to 'FRN' when Gemini returns null" (both house visit and sale item variants). Category is coming back as `undefined` instead of `"FRN"`. Not caused by Phase 09 changes.
