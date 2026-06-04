# Urgent AI Pending-Stranding Fix

## Files Changed

- `src/components/RecordButton.tsx`
- `src/services/gemini.ts`
- `src/services/offlineQueue.ts`
- `src/pages/ItemEntry.tsx`
- `src/components/AiFailureBanner.tsx`
- `src/tests/record-button.test.tsx`
- `src/tests/gemini-pipeline.test.ts`
- `src/tests/offline-queue.test.ts`
- `src/tests/item-entry-waiting.test.tsx`
- `src/tests/gemini-confab-guard.test.ts`
- `src/tests/gemini-determinism.test.ts`
- `src/tests/gemini-no-clobber.test.ts`

## Implemented

1. Durable queued anchor: online record-stop now writes `ai_status='queued'` before the fire-and-forget AI call.
2. Atomic inline claim: `processAudioWithAi` now conditionally claims `queued` or `failed` rows into `processing`, bailing without Gemini work when another worker already owns the row.
3. Orphan pending reclaim: `drainQueue` now flips `pending` items with uploaded Supabase audio to `queued`; pending items without audio stay pending because there is no runnable audio.
4. Detail-view indicator: `ItemEntry` now shows the waiting message for `pending` and `queued` items.

## Deviations

- Existing Gemini tests were updated to model the new claim chain and `claimed_at` stamp. No production behavior was changed for those test-only adjustments.

## Verification

- `npm test`: 92 files passed, 4 skipped; 696 tests passed, 49 todo.
- `npm run build`: passed. Vite emitted the existing large-chunk warning.

## Out Of Scope

- Existing 34 stranded prod items were not recovered because they have no audio rows.
- Audio-upload reliability audit is intentionally out of scope and was not touched.
