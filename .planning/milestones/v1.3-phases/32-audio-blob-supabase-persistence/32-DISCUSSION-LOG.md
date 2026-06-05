# Phase 32: audio-blob-supabase-persistence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 32-audio-blob-supabase-persistence
**Areas discussed:** Status home + table shape, Cleanup + orphan policy, Upload vs AI-processing order, UI surface + failed affordance

---

## Status home + table shape

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror photos fully | New Supabase `audio` table (storage_path, upload_status, FK→items cascade) + new `audioUploadQueue` Dexie table reusing the drain/retry engine | ✓ |
| Minimal Dexie columns | Add storage_path + upload_status to existing ItemAudio row, no queue table, inline upload | |
| Supabase table, no Dexie queue | New Supabase `audio` table only; drive uploads from a hook watching unsynced rows | |

**User's choice:** Mirror photos fully
**Notes:** Keeps audio infra uniform with photo infra; reuses proven `drainPhotoQueue` mechanics + gives a Supabase audit row for cross-device retry.

---

## Cleanup + orphan policy

| Option | Description | Selected |
|--------|-------------|----------|
| 30d + pg_cron + fix orphans | 30-day retention after item `done`, pg_cron sweep, AND delete Storage blob on hard-delete (closes the photo orphan leak) | ✓ |
| Purge on hard-delete only | No N-day expiry; blobs live until hard-delete, pg_cron sweeps orphans only | |
| 7d + Edge function | 7-day retention via cron-triggered Edge function | |

**User's choice:** 30d + pg_cron + fix orphans
**Notes:** Audio must not repeat the photo storage-orphan leak; photos' own backfill deferred.

---

## Upload vs AI-processing order

| Option | Description | Selected |
|--------|-------------|----------|
| AI immediate, upload parallel | AI processes from local Dexie blob immediately; upload runs in background in parallel; photo retry defaults | ✓ |
| Block AI until uploaded | Wait for Storage upload before processAudioWithAi | |
| AI immediate, beefier audio retry | AI immediate, but bump audio retry budget (max 5, longer backoff) | |

**User's choice:** AI immediate, upload parallel
**Notes:** Storage is fallback-only on the recording device; don't couple AI latency to network.

---

## UI surface + failed affordance

| Option | Description | Selected |
|--------|-------------|----------|
| ItemCard pill + retry | Reuse photo usePhotoUploadStatus pattern on ItemCard, manual retry button on failed | ✓ |
| Per-recording chip | Status only on the recording/playback row in item detail | |
| Both list + detail | ItemCard pill AND per-recording chip | |

**User's choice:** ItemCard pill + retry
**Notes:** Consistent with photos, discoverable in the list view.

---

## Claude's Discretion

- Exact Supabase `audio` table column set, migration filename/timestamp.
- Whether orphan blob deletion on hard-delete is a DB trigger, Edge function, or folded into the pg_cron sweep.
- Dexie schema version bump + `audioUploadQueue` index (follow photo queue v8 precedent).
- Storage-fallback hydration detail in `processAudioWithAi` (re-cache into Dexie after fetch?).
- pg_cron schedule cadence.

## Deferred Ideas

- Continuous / session master-blob persistence (`sessionAudio`) — gated off via D-050.
- Backfilling the photo storage-orphan cleanup — audio-only this phase.
- PERF-1 / PERF-2 (base64 memory, continuous-blob streaming) — separate phases.
- REL-4 `stopRecording` settle-on-reject hang — Phase 33.
