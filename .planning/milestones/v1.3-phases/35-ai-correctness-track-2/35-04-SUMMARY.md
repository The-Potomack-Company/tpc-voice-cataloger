---
phase: 35-ai-correctness-track-2
plan: 04
subsystem: ai-extraction-pipeline
tags: [confab-guard, no-clobber, provenance, dexie, gemini, tdd]
requires:
  - "35-01: v11 userEditedFields Dexie store + RED tests (gemini-confab-guard, gemini-no-clobber)"
  - "35-02: temperature:0 on both AI paths"
  - "35-03: AiFailureBanner forward-compat isRetry cast"
provides:
  - "ConfabRejectedError + transcript-emptiness guard (single-shot only)"
  - "no-clobber retry skip filter reading db.userEditedFields"
  - "explicit isRetry param on processAudioWithAi + clear-on-fresh"
  - "userEditedFields provenance write in updateItemField wrapper"
affects:
  - "src/services/gemini.ts"
  - "src/db/items.ts"
  - "src/components/ItemCard.tsx"
  - "src/components/ItemList.tsx"
tech-stack:
  added: []
  patterns:
    - "post-Zod output-trust guard reusing the terminal-failure catch via a tagged error"
    - "client-local Dexie per-field provenance, hard skip-on-flag (not prompt-merge)"
    - "explicit isRetry oracle for fresh-vs-retry (replaces hasExistingData proxy)"
key-files:
  created: []
  modified:
    - "src/db/items.ts — CATALOG_FIELDS allowlist + userEditedFields.put on user edit"
    - "src/services/gemini.ts — ConfabRejectedError, isTranscriptEmpty, guard, flagged-skip filter, isRetry param, clear-on-fresh"
    - "src/components/ItemCard.tsx — handleRetryAi passes isRetry=true"
    - "src/components/ItemList.tsx — retry-all passes isRetry=true"
decisions:
  - "D-03/D-04: confab guard is a post-Zod output-trust check; single-shot only (NOT continuous — Pitfall 5)"
  - "O-1: explicit isRetry 4th param drives clear-on-fresh, not the hasExistingData proxy"
  - "O-2: catch branches on instanceof ConfabRejectedError ahead of the transient check"
  - "ItemList retry-all is a retry path → passes isRetry=true to honor no-clobber"
metrics:
  tasks-completed: 3
  files-modified: 4
  completed-date: 2026-06-01
---

# Phase 35 Plan 04: Confab Guard + Retry No-Clobber Summary

Two single-shot pipeline correctness fixes — a transcript-emptiness confab guard (refuses to persist invented catalog fields on empty audio, SC-2) and a client-local Dexie no-clobber filter that keeps AI retries from overwriting deliberate user edits (SC-3) — landed with zero schema change and no new deps.

## What Was Built

**Task 1 — provenance write (D-05):** `src/db/items.ts:updateItemField` now flags a field in `db.userEditedFields` after a successful user edit, gated by a `CATALOG_FIELDS` allowlist (the 8 catalog fields). `ai_status` and other control writes are excluded; `appendToItemField` is untouched. AI-internal merges call the store action directly (not this wrapper), so they never self-flag (Pitfall 3).

**Task 2 — confab guard (D-03/D-04):** Added `ConfabRejectedError extends Error` and `isTranscriptEmpty()` to `gemini.ts`. The guard fires immediately after `const fields = result.data;` and before any DB write (Pitfall 2). It throws the tagged error, which the existing catch maps to `ai_status:"failed"` (reusing the single failure-write site + firing `ai.processing_failed` for free). The catch branches on `instanceof ConfabRejectedError` AHEAD of `isTransientNetworkError` (O-2), guaranteeing `failed` not `queued`. Single-shot only — `geminiContinuous.ts` is untouched (verified 0 references).

**Task 3 — no-clobber + isRetry (D-05/D-06/O-1):** `processAudioWithAi` gained a 4th `isRetry = false` param. Before building `supabaseUpdate`, it reads the flagged set from `db.userEditedFields`; each of the 8 conditional appends now carries `&& !flagged.has("<field>")` (operators unchanged: `!== null` ×7, `!= null` for `receipt_number`). After a successful write, flags are cleared only when `!isRetry`. Retry call sites (ItemCard `handleRetryAi`, ItemList retry-all, AiFailureBanner) pass `isRetry=true`; fresh record-stop sites keep the default.

## How to Verify

- `npx vitest --run src/tests/gemini-*.test.ts src/tests/item-card-*.test.tsx` — 39 passed (SC-1, SC-2, SC-3, SC-4 all green).
- `grep -c "ConfabRejectedError\|isTranscriptEmpty\|userEditedFields" src/services/geminiContinuous.ts` → 0 (continuous path untouched).
- `grep -c "updated_at\|seed:" src/services/gemini.ts` → 0 (Phase 39 lane not crossed).
- `git status --short src/db/database.types.ts` → empty (no db:types regen).
- `grep -c "function sanitizeForDataBlock" src/services/gemini.ts` → 1 (SEC-5 intact).

## Deviations from Plan

None — plan executed as written for all three tasks.

One scope decision beyond the literal plan text: ItemList `handleRetryAll` (retry-all on stuck/failed items) also now passes `isRetry=true`. It is a retry path by definition (filters `ai_status` processing/failed), so it must honor no-clobber alongside the explicitly-named ItemCard/AiFailureBanner sites. RecordButton (fresh record-stop) keeps the default `false`.

## Deferred Issues

`src/tests/db.test.ts` has 2 failing assertions (`"...has 11 tables"`) — the live schema is now 12 tables since Plan 35-01 added the v11 `userEditedFields` store. **Pre-existing at the wave base `e908af8`** (the store exists there; the test was never updated) and in a file Plan 35-04 does not touch — out of scope per the SCOPE BOUNDARY rule. Logged to `deferred-items.md`; fix is a 11→12 count bump owned by Plan 35-01 / phase-level cleanup.

## Known Stubs

None.

## Self-Check: PASSED

- `src/db/items.ts` — FOUND (CATALOG_FIELDS + userEditedFields.put)
- `src/services/gemini.ts` — FOUND (ConfabRejectedError, isTranscriptEmpty, flagged filter, isRetry)
- Commit `0d62add` (Task 1) — FOUND
- Commit `da4326f` (Task 2) — FOUND
- Commit `44d776d` (Task 3) — FOUND
- SC-2 + SC-3 tests GREEN; continuous path 0 refs; no schema change / no db:types / no new deps — VERIFIED
