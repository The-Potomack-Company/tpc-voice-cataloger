---
phase: 32-audio-blob-supabase-persistence
plan: 01
subsystem: database
tags: [supabase, storage, rls, pg_cron, pg_net, edge-function, deno, audio, retention, vitest, tdd-red]

# Dependency graph
requires:
  - phase: 31-sec-profiles-self-update-hardening
    provides: "column-qualified storage.objects RLS fix (storage.foldername(storage.objects.name)) baked into the new audio bucket from line one"
provides:
  - "public.audio metadata table (FK item_id cascade, unique storage_path, upload_status CHECK) — authored, not yet applied"
  - "private 'audio' Storage bucket + 4 table RLS policies + 5 column-scoped storage.objects policies"
  - "items.completed_at (D-07 retention baseline) column"
  - "pg_cron + pg_net extensions + cron.schedule('purge-old-audio') daily sweep"
  - "service-role secret-gated purge-audio edge function (retention + orphan path computation, storage.remove deletion)"
  - "five RED Wave-0 client test scaffolds encoding the upload/status/fallback/pill/delete contracts for plans 03-05"
  - "../_workspace/Schema/schema.md updated with audio table + bucket + items.completed_at + pg_cron note"
affects: [32-02-apply-migration-codex-review, 32-03-audio-upload-queue, 32-04-upload-status-hook, 32-05-storage-fallback-and-delete]

# Tech tracking
tech-stack:
  added: [pg_cron, pg_net]
  patterns:
    - "Column-qualified storage RLS from line one — storage.foldername(storage.objects.name)[2]=sessionId; never bare name"
    - "Server-to-server edge function gated on a shared cron secret (PURGE_AUDIO_SECRET), not verifyAdmin"
    - "Reaper computes its own deletion set from the DB — never trusts caller-supplied paths"
    - "Blob deletion via storage.from(bucket).remove() — never DELETE FROM storage.objects (orphans the S3 binary)"
    - "DAT-5 idempotent metadata upsert keyed on unique storage_path (onConflict:'storage_path', ignoreDuplicates:true)"

key-files:
  created:
    - supabase/migrations/20260601000000_create_audio.sql
    - supabase/functions/purge-audio/index.ts
    - src/tests/audio-upload-queue.test.ts
    - src/tests/audio-upload-status.test.ts
    - src/tests/audio-storage-fallback.test.ts
    - src/tests/item-card-audio-status.test.tsx
    - src/tests/sessionStore-audio-delete.test.ts
  modified:
    - ../_workspace/Schema/schema.md

key-decisions:
  - "Daily 03:00 UTC cron cadence for the audio retention sweep (off-peak; 30-day clock makes once-daily ample)"
  - "Cron body passes the edge fn URL + secret via current_setting('app.settings.*') placeholders, replaced at prod-push time — no secret committed to the repo"
  - "Orphan scan recurses the bucket tree (audio/{sessionId}/{itemId}/) paginated at 1000, since storage.list returns one level at a time"

patterns-established:
  - "Audio surface mirrors photos minus thumbnail/sort_order, plus mime_type; RLS is item->session ownership"
  - "Wave-0 RED scaffolds clone the photo-upload-queue vi.hoisted mock harness, swapping photoUploadQueue/photos -> audioUploadQueue/audio"

requirements-completed: []

# Metrics
duration: 18min
completed: 2026-06-01
---

# Phase 32 Plan 01: Audio Server-Side Surface Summary

**Authored (not pushed) the consolidated `audio` Supabase migration — metadata table + private bucket + column-scoped storage RLS + items.completed_at + pg_cron/pg_net retention sweep — plus a secret-gated service-role purge-audio reaper and five RED Wave-0 client scaffolds.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-01T10:21Z (approx)
- **Completed:** 2026-06-01
- **Tasks:** 3
- **Files modified:** 8 (7 in-repo created, 1 shared-vault schema.md updated)

## Accomplishments
- One consolidated `create_audio` migration: `public.audio` table (FK item_id ON DELETE CASCADE, unique `audio_storage_path_key`, `upload_status` CHECK), private `audio` bucket, 4 table RLS policies, 5 `storage.objects` policies (admin-all + specialist select/insert/update/delete) — every specialist predicate using the column-qualified `storage.foldername(storage.objects.name)[2]=sessionId` form from line one (Phase 31 fix baked in).
- `items.completed_at timestamptz` nullable retention baseline (D-07).
- `pg_cron` + `pg_net` enabled; `cron.schedule('purge-old-audio', '0 3 * * *', …)` POSTs the purge-audio edge function via `net.http_post` (NOT a raw `DELETE FROM storage.objects`).
- Service-role `purge-audio` edge function: secret-gated on `x-purge-secret` vs `PURGE_AUDIO_SECRET` (T-32-04), computes its own deletion set (retention: items `ai_status='done'` AND `completed_at < now()-30d` (D-03); orphan backstop (D-04)), deletes via `storage.from('audio').remove()` then metadata rows.
- Five RED Wave-0 scaffolds committed (vitest collects all five; all five files fail as designed).
- `../_workspace/Schema/schema.md` (shared SoT) updated: audio table, audio bucket, `items.completed_at`, FK-graph edge, and a new "Scheduled jobs (pg_cron / pg_net)" section.

## Task Commits

Each task was committed atomically:

1. **Task 1: create_audio migration + items.completed_at + pg_cron purge sweep** — `ac4b4a7` (feat)
2. **Task 2: service-role purge-audio edge function** — `501979f` (feat)
3. **Task 3: RED Wave-0 audio scaffolds** — `da5a8db` (test)

_schema.md is committed only in the parent TPC workspace vault (outside this repo); it was updated in place but not git-added here, per the cross-app contract._

## Files Created/Modified
- `supabase/migrations/20260601000000_create_audio.sql` — audio table + bucket + table RLS + 5 column-scoped storage policies + items.completed_at + pg_cron/pg_net + cron.schedule
- `supabase/functions/purge-audio/index.ts` — secret-gated service-role retention/orphan reaper
- `src/tests/audio-upload-queue.test.ts` — enqueue path/mime-ext/UUID-itemId, drain concurrency 2, 4^n backoff, MAX_RETRIES 3, DAT-5 upsert (RED)
- `src/tests/audio-upload-status.test.ts` — useAudioUploadStatus state mapping (RED)
- `src/tests/audio-storage-fallback.test.ts` — processAudioWithAi Storage fallback by item_id (RED)
- `src/tests/item-card-audio-status.test.tsx` — ItemCard pill render + failed-click re-enqueue (RED)
- `src/tests/sessionStore-audio-delete.test.ts` — deleteItem audio storage_path select + remove + guards (RED, D-04 automated coverage)
- `../_workspace/Schema/schema.md` — audio table/bucket/completed_at/pg_cron (shared vault)

## Decisions Made
- Daily 03:00 UTC cron cadence (off-peak; the 30-day retention clock makes a once-daily sweep ample and keeps pg_net traffic minimal).
- Cron body reads the edge fn URL + cron secret from `current_setting('app.settings.purge_audio_url'/'…_secret', true)` placeholders, substituted at the plan-02 prod push — no secret is committed.
- Orphan scan recurses the bucket directory tree paginated at 1000 entries, because `storage.list` returns a single directory level per call.

## Deviations from Plan

None — plan executed exactly as written. The five named scaffolds match the plan's set, so `32-VALIDATION.md` was left untouched (already authored, `nyquist_compliant: true`).

## Issues Encountered
- The Task 1 verification grep for `cron.schedule('purge-old-audio'…` returned 0 because the call spans multiple lines; re-verified with `grep -c "purge-old-audio"` (1) and `grep -c "net.http_post"` (1). No actual issue.
- The Task 2 grep for a raw `DELETE FROM storage.objects` matched 1 line — a comment documenting the anti-pattern, not executable code. The deletion mechanism is `storage.from('audio').remove()`, confirmed by the gate (6 matches for createAdminClient/remove/secret).

## RED Verification

`npx vitest run` on the five scaffolds: **5 test files failed (5/5)**, the intended Wave-0 RED state. Failures are import-resolution errors for the not-yet-built modules (`audioUploadQueue`, `useAudioUploadStatus`, `processAudioWithAi`) and a behavior assertion against the current `deleteItem` (which lacks the plan-05 audio cleanup). 3 negative-path cases pass within otherwise-failing files — acceptable; the file-level RED contract holds.

## Scope Boundary Honored
- Migration authored only — NOT pushed (`supabase db push` not run). Prod apply is plan 32-02 after Codex adversarial review (D-046).
- Edge function authored only — NOT deployed (`supabase functions deploy` not run).
- `npm run db:types` NOT run (no live table yet) — deferred to plan 02.
- `schema.md` updated in the parent vault but not git-added (outside this repo).

## Next Phase Readiness
- Plan 32-02 can apply the migration + deploy the edge function after Codex review, then regenerate `database.types.ts`.
- Plans 32-03/04/05 have their RED contracts pinned: build `audioUploadQueue` (enqueue/drain/processOne + `retryFailedUploads`), `useAudioUploadStatus`, `processAudioWithAi` Storage fallback, the ItemCard pill, and `deleteItem` audio cleanup to turn each scaffold green.
- **Setup note for plan 02:** `PURGE_AUDIO_SECRET` (edge fn env) and the `app.settings.purge_audio_url` / `app.settings.purge_audio_secret` DB settings must be provisioned before the cron job is functional.

## Self-Check: PASSED

All 8 created files present; schema.md audio section present in the shared vault; all 3 task commits (`ac4b4a7`, `501979f`, `da5a8db`) found in git log.

---
*Phase: 32-audio-blob-supabase-persistence*
*Completed: 2026-06-01*
