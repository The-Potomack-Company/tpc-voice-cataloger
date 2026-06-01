# Phase 33: offline-reliability - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-01
**Phase:** 33-offline-reliability
**Areas discussed:** Cross-tab claim (REL-2), Backoff + attempts (REL-1), Error class + blocked UX (REL-3), Recorder settle (REL-4)

---

## REL-2 — Cross-tab claim

| Option | Description | Selected |
|--------|-------------|----------|
| DB-atomic claim + claimed_at | Conditional Supabase update as single source of truth; stale-claim reclaim ~5min; survives multi-tab/process/device. Adds claimed_at column. | ✓ |
| BroadcastChannel leader election | Client-side elected drainer, no schema change; but doesn't survive leader-tab death mid-process, single-device only. | |
| Both (belt + suspenders) | BroadcastChannel to reduce contention + DB claim as hard guarantee. | |

**User's choice:** DB-atomic claim + claimed_at (recommended)
**Notes:** DB claim alone makes duplicate Gemini calls structurally impossible; BroadcastChannel layer rejected as redundant. Stale-claim threshold ~2× max processing time (~5min start). Adds `claimed_at timestamptz`; `claimed_by` deliberately skipped.

---

## REL-1 — Backoff + attempts

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase ai_attempts col | Server-side persisted, consistent cross-tab/device, backoff from claimed_at + base·2^attempts. Adds ai_attempts col (same migration). | ✓ |
| Dexie-local attempt state | No migration, simpler; but counts diverge per device, don't coordinate with cross-tab claim. | |

**User's choice:** Supabase ai_attempts col (recommended)
**Notes:** Backoff base 5s / cap 5min / full jitter (constants finalized in planning). Cap 5 attempts → mark failed → feeds REL-3 badge. Replaces MAX_RETRIES=2 immediate loop. Single migration with REL-2 = 2 columns total.

---

## REL-3 — Error class + blocked UX

| Option | Description | Selected |
|--------|-------------|----------|
| Skip permanent, halt transient | Permanent: drop entry + dependent same-item entries, continue. Transient: halt-and-backoff (FIFO). Header blocked badge. | ✓ |
| Halt on any failure + badge | Keep break-on-first-failure, add classification logging + badge. Single permanent failure still stalls later writes. | |

**User's choice:** Skip permanent, halt transient (recommended)
**Notes:** Permanent = no-audio / 4xx validation-auth / unsupported format. Transient = offline / 5xx / 429 / timeout. Badge next to OfflineIndicator, reuses Badge primitive (tone="err"), click → detail list.

---

## REL-4 — Recorder settle

| Option | Description | Selected |
|--------|-------------|----------|
| Retry 2x, then settle + keep blob | Retry add twice, then always resolve(undefined), set error state, stash blob in recordingStore for re-save. Keeps signature. | ✓ |
| Reject the promise on failure | Surface as rejection; cleaner but forces try/catch on every caller. | |

**User's choice:** Retry 2x, then settle + keep blob (recommended)
**Notes:** Keeps `Promise<number｜undefined>` signature to avoid caller blast radius. Eliminates the hang where onstop catch only console.errors.

---

## Claude's Discretion

- Exact backoff constants (base/cap/jitter shape) + stale-claim threshold value — sensible defaults in planning, surfaced in tests.
- Blocked-items detail view structure + recordingStore retry-buffer shape.
- Whether offline-queue and write-ahead drains share a common backoff/classification helper.

## Deferred Ideas

- `claimed_by` per-instance identifier for debugging — skipped to keep migration lean.
- Photo-upload-queue receiving the same backoff/classification hardening — future reliability pass.
- Shared backoff/error-classification helper module across both queues — future refactor target.
