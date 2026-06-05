---
phase: 32-audio-blob-supabase-persistence
verified: 2026-06-01T11:15:00Z
status: passed
score: 20/20 must-haves verified
overrides_applied: 0
re_verification: null
gaps: []
deferred: []
human_verification: []
---

# Phase 32: audio-blob-supabase-persistence Verification Report

**Phase Goal:** Durable audio persistence in Supabase Storage — replace Dexie-only audio (lost on device wipe / cache clear, no cross-device retry, local-only AI-failure recovery) with a private `audio` Storage bucket (RLS scoped to session owner, column-scope fix baked in), background upload on db.audio.add recording storage_path + upload status, cross-device retry, AI Storage-download fallback, D-04 orphan cleanup, D-07 retention baseline (items.completed_at), and D-08 scheduled purge.
**Verified:** 2026-06-01T11:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Private `audio` Storage bucket exists with session-owner-scoped RLS using column-qualified `storage.foldername(storage.objects.name)` form | ✓ VERIFIED | Migration `20260601000000_create_audio.sql` — 7 qualified refs, 0 bare `name` in RLS expressions; prod 10/10 existence check in 32-02-SUMMARY |
| 2 | `public.audio` metadata table exists with FK item_id ON DELETE CASCADE, unique index on storage_path, and upload_status CHECK constraint | ✓ VERIFIED | Migration contains `create table if not exists public.audio` with all 3 constraints; 32-02-SUMMARY confirms live on prod |
| 3 | `items.completed_at timestamptz` nullable column exists (D-07 retention baseline) | ✓ VERIFIED | `alter table public.items add column if not exists completed_at timestamptz` in migration; present in `src/db/database.types.ts:347` |
| 4 | pg_cron + pg_net enabled; scheduled purge job invokes purge-audio edge function | ✓ VERIFIED | Migration has `create extension if not exists pg_cron/pg_net` + `cron.schedule('purge-old-audio', '0 3 * * *', ...)` using `net.http_post`; 32-02-SUMMARY confirms live on prod |
| 5 | Service-role purge-audio edge function performs storage.remove() for expired/orphaned audio; NOT invocable by unauthenticated/cross-user callers | ✓ VERIFIED | `supabase/functions/purge-audio/index.ts` gates on `x-purge-secret` vs `PURGE_AUDIO_SECRET`; uses `supabaseAdmin.storage.from('audio').remove(paths)`; computes paths internally from DB query (no caller-supplied paths) |
| 6 | Migration passes Codex adversarial review with no unresolved high-severity findings (D-046) | ✓ VERIFIED | 32-02-SUMMARY: 7 PASS / 1 medium (idempotency, fixed by Claude); 0 high findings; verdict recorded |
| 7 | Migration applied to prod (wgrknodfxdjtddsirldw) in isolation; dry-run shows only create_audio pending | ✓ VERIFIED | 32-02-SUMMARY: `--dry-run` output shows only `20260601000000_create_audio.sql`; applied with `--yes`; prod existence 10/10 pass |
| 8 | Cross-user RLS denies specialist reading another session's audio blob (T-32-01 proven live) | ✓ VERIFIED | 32-02-SUMMARY T-32-01 probe: FOREIGN user `6761f591` saw 0 audio rows + 0 storage objects for session owned by `8c125602`; ROLLBACK used (no test data persists) |
| 9 | Session owner CAN read their own audio objects — Phase-31 self-deny failure did not recur (T-32-08 proven live) | ✓ VERIFIED | 32-02-SUMMARY T-32-08 probe: OWNER `8c125602` saw 1 audio row + 1 storage object |
| 10 | `database.types.ts` regenerated with `audio` table + items.completed_at | ✓ VERIFIED | `src/db/database.types.ts:149` has `audio:` table type; lines 347/369/391 have `completed_at`; commit `d92dd8e` |
| 11 | Dexie v10 `audioUploadQueue` table exists; v9 store set carried forward | ✓ VERIFIED | `src/db/index.ts:134-146`: `db.version(10).stores({...})` with `audioUploadQueue: "++id, status, dexieAudioId, itemId, createdAt"`; EntityTable registered at line 27 |
| 12 | `enqueueAudioUpload` writes pending queue row with path `audio/{sessionId}/{itemId}/{audioId}.{ext}` using mime-derived ext and UUID itemId | ✓ VERIFIED | `src/services/audioUploadQueue.ts`: CONCURRENCY=2, MAX_RETRIES=3, ext from `extFromMime`; `src/tests/audio-upload-queue.test.ts` 7/7 GREEN |
| 13 | `drainAudioQueue` processes with concurrency 2, 4^retryCount*1000 backoff, max 3 retries, offline-pause | ✓ VERIFIED | `src/services/audioUploadQueue.ts:7-8,136,146,148` — constants + batching; test 7/7 GREEN |
| 14 | `useAudioUploadStatus` returns pending/uploading/uploaded/failed/none reactively — Dexie query runs INSIDE useLiveQuery callback (critical fix applied) | ✓ VERIFIED | `src/hooks/useAudioUploadStatus.ts:14-22` — query at lines 16-20 is inside the `useLiveQuery` callback; the broken pre-review version (promise outside callback) is corrected; `src/tests/audio-upload-status.test.ts` 6/6 GREEN |
| 15 | On stopRecording, audio row carries sessionId; upload enqueued+drained fire-and-forget without blocking AI processing | ✓ VERIFIED | `src/hooks/useAudioRecorder.ts:194` — `sessionId: sessionIdRef.current`; lines 208-212: `enqueueAudioUpload({...}).then(() => drainAudioQueue()).catch(() => {})`; itemIdRef.current used as UUID string for upload |
| 16 | `processAudioWithAi` falls back to Storage download when Dexie blob missing, resolved by item_id UUID (not the legacy int) | ✓ VERIFIED | `src/services/processAudioWithAi.ts` — Dexie-first, falls back via `.eq('item_id', itemId)` array query; `src/tests/audio-storage-fallback.test.ts` 2/2 GREEN |
| 17 | When item reaches ai_status 'done', `items.completed_at` is set (D-07 retention clock) | ✓ VERIFIED | `src/services/gemini.ts:320` — `completed_at: new Date().toISOString()` in the `supabaseUpdate` object alongside `ai_status: "done"` |
| 18 | `audioRecordsForItem` unions Supabase audio rows for cross-device visibility | ✓ VERIFIED | `src/db/audioLookup.ts:44-65` — best-effort Supabase query with try/catch degradation; `src/tests/audio-lookup.test.ts` 7/7 GREEN |
| 19 | On item hard-delete, audio Storage blobs are removed via `supabase.storage.from('audio').remove(paths)` — the photo orphan leak is closed for audio (D-04) | ✓ VERIFIED | `src/stores/sessionStore.ts:512-519` — selects `storage_path` by item_id, calls `supabase.storage.from('audio').remove(paths)` guarded by `audioRows?.length`; `src/tests/sessionStore-audio-delete.test.ts` 3/3 GREEN |
| 20 | Audio upload queue drained on app mount and `online` reconnect — critical fix applied | ✓ VERIFIED | `src/layouts/AppLayout.tsx:8,63,68,73` — `drainAudioQueue` imported and called inside `handleReconnect` (both mount and `online` event); commit `85bed5d` |

**Score:** 20/20 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260601000000_create_audio.sql` | audio table + bucket + 5 column-scoped storage policies + 4 table policies + items.completed_at + pg_cron/pg_net + cron.schedule | ✓ VERIFIED | Exists; 7 column-qualified RLS refs, 0 bare-name; 9 policies (grep -c CREATE POLICY = 9); all required clauses present |
| `supabase/functions/purge-audio/index.ts` | service-role storage.remove reaper with secret gate | ✓ VERIFIED | Exists; createAdminClient + PURGE_AUDIO_SECRET gate + storage.from('audio').remove; no raw DELETE FROM storage.objects |
| `src/tests/audio-upload-queue.test.ts` | RED scaffold → now GREEN | ✓ VERIFIED | Exists; 7/7 pass |
| `src/tests/audio-upload-status.test.ts` | RED scaffold → now GREEN | ✓ VERIFIED | Exists; 6/6 pass |
| `src/tests/audio-storage-fallback.test.ts` | RED scaffold → now GREEN | ✓ VERIFIED | Exists; 2/2 pass |
| `src/tests/item-card-audio-status.test.tsx` | RED scaffold → now GREEN | ✓ VERIFIED | Exists; 4/4 pass |
| `src/tests/sessionStore-audio-delete.test.ts` | RED scaffold → now GREEN | ✓ VERIFIED | Exists; 3/3 pass |
| `src/db/database.types.ts` | Regenerated with audio table + items.completed_at | ✓ VERIFIED | `Tables<"audio">` at line 149; completed_at at lines 347/369/391 |
| `src/services/audioUploadQueue.ts` | enqueueAudioUpload/drainAudioQueue/retryFailedUploads clone | ✓ VERIFIED | Exists; 120+ lines; all exports confirmed |
| `src/hooks/useAudioUploadStatus.ts` | Reactive upload-status hook; query inside useLiveQuery callback | ✓ VERIFIED | Exists; fixed form confirmed at lines 14-22 |
| `src/db/index.ts` | Dexie v10 with audioUploadQueue | ✓ VERIFIED | `db.version(10)` at line 135; audioUploadQueue at line 146 |
| `src/db/types.ts` | AudioUploadEntry + ItemAudio.sessionId | ✓ VERIFIED | AudioUploadEntry at line 115; sessionId?: string at line 72 |
| `src/services/processAudioWithAi.ts` | Standalone Dexie-first/Storage-fallback resolver | ✓ VERIFIED | Exists; fallback by item_id UUID confirmed |
| `src/hooks/useAudioRecorder.ts` | sessionId on row + fire-and-forget enqueue | ✓ VERIFIED | sessionId at line 194; enqueueAudioUpload at lines 208-212 |
| `src/services/gemini.ts` | delegates to resolver + completed_at on done | ✓ VERIFIED | resolveAudioForAi at line 193; completed_at at line 320 |
| `src/db/audioLookup.ts` | audioRecordsForItem unions Supabase audio | ✓ VERIFIED | Best-effort Supabase union at lines 44-65 with try/catch guard |
| `src/stores/sessionStore.ts` | deleteItem removes audio Storage blobs | ✓ VERIFIED | storage.from("audio").remove at line 519 |
| `src/components/ItemCard.tsx` | useAudioUploadStatus pill + failed-retry | ✓ VERIFIED | useAudioUploadStatus at line 66; retryFailedUploads at lines 16, 206; audio-upload-pill data-testid present |
| `src/layouts/AppLayout.tsx` | drainAudioQueue wired into handleReconnect | ✓ VERIFIED | drainAudioQueue imported line 8; called at line 63 inside handleReconnect |
| `src/utils/audio.ts` | extFromMime helper | ✓ VERIFIED | extFromMime at line 31 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| storage.objects RLS policies | public.sessions | `storage.foldername(storage.objects.name)[2]` = sessionId | ✓ WIRED | 7 column-qualified occurrences in migration; 0 bare-name forms |
| cron.schedule purge-old-audio | purge-audio edge function | `net.http_post(...)` in cron body | ✓ WIRED | `net.http_post` confirmed in migration at line 211 |
| src/hooks/useAudioRecorder.ts | enqueueAudioUpload + drainAudioQueue | fire-and-forget after db.audio.add | ✓ WIRED | Lines 208-212; `.catch(() => {})` makes it fire-and-forget |
| src/services/gemini.ts | supabase.storage.from('audio').download | via processAudioWithAi.ts resolver | ✓ WIRED | gemini:193 delegates to resolveAudioForAi; processAudioWithAi.ts performs the download |
| src/stores/sessionStore.ts deleteItem | supabase.storage.from('audio').remove | select storage_path by item_id then remove | ✓ WIRED | Lines 512-519; guarded by audioRows?.length |
| src/components/ItemCard.tsx | useAudioUploadStatus + retryFailedUploads | status pill + failed onClick | ✓ WIRED | useAudioUploadStatus at line 66; retryFailedUploads at line 206 |
| src/layouts/AppLayout.tsx handleReconnect | drainAudioQueue | void drainAudioQueue() after drainPhotoQueue | ✓ WIRED | Line 63 in handleReconnect; also called on mount at line 68 |
| src/db/index.ts | audioUploadQueue EntityTable | db.version(10).stores() | ✓ WIRED | Lines 135-146 |
| purge-audio index.ts | items retention query | `.eq('items.ai_status', 'done').lt('items.completed_at', cutoffIso)` | ✓ WIRED | Lines 58-60 in edge function |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `src/components/ItemCard.tsx` (uploadStatus pill) | `uploadStatus` from `useAudioUploadStatus` | `db.audioUploadQueue.where('dexieAudioId')` Dexie live query | Yes — reactive Dexie read inside useLiveQuery callback (post-critical-fix) | ✓ FLOWING |
| `src/hooks/useAudioRecorder.ts` (upload enqueue) | `dexieAudioId` from `db.audio.add` | Resolves from the actual Dexie audio row add; mimeType from recorder's `detectedMimeTypeRef` | Yes — actual recorded blob ID and mime drive the enqueue | ✓ FLOWING |
| `src/services/gemini.ts` (completed_at) | `completed_at` in supabaseUpdate | `new Date().toISOString()` at the AI-done write-path | Yes — real timestamp written on actual AI completion | ✓ FLOWING |
| `src/stores/sessionStore.ts` deleteItem cleanup | `audioRows` | `supabase.from('audio').select('storage_path').eq('item_id', itemId)` | Yes — live DB query returning actual paths | ✓ FLOWING |
| `supabase/functions/purge-audio/index.ts` | `expiredRows` | `supabaseAdmin.from('audio').select(...).eq('items.ai_status','done').lt('items.completed_at', cutoff)` | Yes — joins items table with 30-day retention filter | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 5 Wave-0 scaffolds + full test suite pass | `npx vitest run` | 544 passed, 0 failed, 66 files | ✓ PASS |
| Migration contains all required elements | `grep -E "create table|completed_at|pg_cron|cron.schedule|storage.buckets" migration` | All present | ✓ PASS |
| Zero unqualified `storage.foldername(name)` in RLS | `grep -E "foldername\(name\)" migration | grep -v "^--"` | No output (0 matches) | ✓ PASS |
| Column-qualified form count ≥ 4 | `grep -c "storage.foldername(storage.objects.name)" migration` | 7 | ✓ PASS |
| purge-audio has no raw storage.objects DELETE | `grep "DELETE FROM storage.objects" index.ts` | Only in a comment (not executable) | ✓ PASS |
| drainAudioQueue wired in AppLayout handleReconnect | `grep -n "drainAudioQueue" AppLayout.tsx` | Lines 8 (import) and 63 (call) | ✓ PASS |
| useAudioUploadStatus query inside useLiveQuery | `grep -n "useLiveQuery\|where" useAudioUploadStatus.ts` | Lines 14-22 show query inside callback | ✓ PASS |

---

### Probe Execution

No probe scripts (`scripts/*/tests/probe-*.sh`) defined for this phase. Step 7c: SKIPPED (no conventional probe files; verification via the Vitest suite and grep gates above).

---

### Requirements Coverage

No formal REQ-IDs attached (audit-sourced phase). Coverage targets were D-01..D-08 from CONTEXT.md + ROADMAP Phase 32 bullets.

| Decision / Bullet | Status | Evidence |
|-------------------|--------|----------|
| D-01: audio metadata table mirroring photos | ✓ SATISFIED | `public.audio` table with FK cascade + upload_status + unique storage_path |
| D-02: bucket `audio` + path `audio/{sessionId}/{itemId}/{audioId}.{ext}` + column-scoped RLS on path token [2] | ✓ SATISFIED | Migration bucket insert + 5 storage policies + `audioUploadQueue.ts` path construction |
| D-03: 30-day retention via pg_cron keyed on completed_at | ✓ SATISFIED | cron.schedule at 03:00 UTC; purge-audio queries `completed_at < now() - 30 days` AND `ai_status='done'` |
| D-04: hard-delete orphan cleanup — storage.remove on deleteItem + pg_cron backstop | ✓ SATISFIED | `sessionStore.ts:512-519` storage.remove; purge-audio orphan scan as backstop |
| D-05: AI processing immediate; Storage upload parallel/background, not blocking | ✓ SATISFIED | Fire-and-forget `.catch(() => {})` in recorder; RecordButton AI trigger unchanged |
| D-06: upload status pill on ItemCard + manual retry | ✓ SATISFIED | `ItemCard.tsx:66,191-209` — Badge pill + retryFailedUploads on failed |
| D-07: items.completed_at retention baseline | ✓ SATISFIED | Column in migration; `gemini.ts:320` sets it on AI-done |
| D-08: pg_cron + pg_net + service-role edge purge function | ✓ SATISFIED | Extensions in migration; cron.schedule; purge-audio deployed |
| ROADMAP: audio bucket with RLS scoped to session owner | ✓ SATISFIED | 5 storage.objects policies scoped via sessions.created_by/assigned_to |
| ROADMAP: background upload on db.audio.add, records storage_path + upload status | ✓ SATISFIED | recorder enqueue; audioUploadQueue.ts upserts `public.audio` with storage_path + upload_status |
| ROADMAP: processAudioWithAi reads from Storage when Dexie blob missing | ✓ SATISFIED | processAudioWithAi.ts Dexie-first/Storage-fallback by item_id UUID |
| ROADMAP: surface upload state in UI (pending/uploaded/failed) | ✓ SATISFIED | ItemCard pill via useAudioUploadStatus |
| ROADMAP: purge on hard-delete; N-day retention after done | ✓ SATISFIED | D-04 + D-03 above |
| ROADMAP: update audioRecordsForItem to include Supabase audio | ✓ SATISFIED | audioLookup.ts best-effort Supabase union |
| ROADMAP: cross-user RLS denies blob reads (proven live) | ✓ SATISFIED | T-32-01 + T-32-08 probed live in prod (32-02-SUMMARY) |
| D-046: mandatory Codex adversarial review before push | ✓ SATISFIED | Codex VERDICT: PASS (0 high / 1 medium fixed by Claude) |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/services/gemini.ts` | 38-39 | `XXXXX` appears in AI prompt string (`receipt_number: The auction receipt/lot number in XXXXX-N format`) | ℹ Info | NOT a debt marker — a literal example format string inside an LLM prompt; pre-existing, not introduced by Phase 32 |
| `src/db/audioLookup.ts` | 60 | `blob: new Blob([])` placeholder for cross-device rows | ℹ Info | Acknowledged KNOWN LIMITATION per review; any downstream consumer that treats the union as playable audio would get a zero-byte blob — flagged in 32-REVIEW.md as a warning, accepted for Phase 32 |
| `src/services/audioUploadQueue.ts` | 53,103 | `console.log`/`console.error` tracing | ℹ Info | Matches photo path convention; not removed per review recommendation; no behavioral impact |

Zero TBD/FIXME/XXX debt markers in any Phase 32 modified file. Zero blockers.

---

### Human Verification Required

None. The phase's two `checkpoint:human-verify` tasks (Codex review gate + prod apply + RLS proof) were executed during plan 02 and are fully evidenced in 32-02-SUMMARY. The remaining UI-behavioral aspects (pill renders correctly in a running browser, retry flow end-to-end) are covered by the GREEN 4/4 ItemCard test and the full 544/0 suite.

---

### Gaps Summary

No gaps. All 20 must-haves verified. Both critical clone-parity findings from the code review (audio queue never drained on reconnect; broken reactive status hook) were fixed in commit `85bed5d` and are confirmed present in the codebase. The remaining 5 warnings and 4 infos from 32-REVIEW.md are advisory follow-ups — inherited from the photo path, accepted Phase 32 limitations, or improvement candidates for future phases. None block the phase goal.

---

_Verified: 2026-06-01T11:15:00Z_
_Verifier: Claude (gsd-verifier)_
