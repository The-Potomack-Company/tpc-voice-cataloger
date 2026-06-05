# Phase 39: optimistic-locking - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-01
**Phase:** 39-optimistic-locking
**Areas discussed:** Offline queue + locking, AI-merge clobber guard, User-edit conflict flow, Cross-tab version check

Mode: advisor / minimal_decisive (NON_TECHNICAL_OWNER=false — backend concurrency task, technical owner). Recommendation + one alternative per area; all four recommendations accepted.

---

## Offline queue + locking (Area A)

| Option | Description | Selected |
|--------|-------------|----------|
| Snapshot ts + reconcile | Capture updated_at at enqueue; precondition on flush; 0-row → same reconcile path (user field-edit re-applies). Offline edits survive. Composes with Phase 33 queue retry. | ✓ |
| Queue stays last-writer-wins | Exempt queued writes from the precondition. Simplest but reintroduces silent-loss for offline edits. | |

**User's choice:** Snapshot ts + reconcile
**Notes:** Dexie write-ahead queue currently stores no timestamp; must add it at enqueue. Flag: sequencing with Phase 33 (queue backoff/attempt-cap/cross-tab-claim, not yet built).

---

## AI-merge clobber guard (Area B)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-field compare-and-skip | On conflict, re-read; skip fields where DB value ≠ value AI saw at read; write the rest with fresh precondition. No extra Gemini call. | ✓ |
| Abort + re-run full merge | On any conflict, discard and re-run the Gemini merge with fresh context, write once. Cleaner concept, costs a round-trip + token spend. | |

**User's choice:** Per-field compare-and-skip
**Notes:** Fits the existing per-field `updateItemField` loop in `mergeFieldsIntoItem`; overlaps the value-at-read the smart-merge already captures.

---

## User-edit conflict flow (Area C)

| Option | Description | Selected |
|--------|-------------|----------|
| 3× reapply, silent, toast on exhaust | Bounded read-modify-reapply (intent-preserving), silent success, ErrorToast+Retry only when retries exhausted. Same bound caps B's loop. | ✓ |
| Toast on every conflict | Surface a toast each time and let the user decide. More noise for an unambiguous single-field intent. | |

**User's choice:** 3× reapply, silent, toast on exhaust
**Notes:** User-vs-user out of scope (small team, no real-time collab). 3× bound also caps the AI-merge reconcile loop to prevent livelock.

---

## Cross-tab version check (Area D)

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to Phase 33 / out of scope | DB precondition already prevents cross-tab silent loss. Proactive broadcast is an optimization Phase 33 owns. Capture as deferred idea. | ✓ |
| Add realtime sub on open item now | Subscribe to the open item's updated_at via Supabase realtime. Net-new infra, overlaps Phase 33. | |

**User's choice:** Defer to Phase 33 / out of scope
**Notes:** Correctness covered by the DB precondition; proactive refresh is UX-only.

## Claude's Discretion

- Trigger mechanism + version token folded as recommendations (not asked): reuse existing `set_updated_at()` fn; use `updated_at` timestamptz as the token (xmin/integer-version as fallback only).
- Migration filename, exhaustion-toast copy, snapshot threading in `mergeFieldsIntoItem`.

## Deferred Ideas

- Proactive cross-tab/device version check → Phase 33.
- Dedicated integer `version` column / `xmin` token → only if µs-collisions on `updated_at` prove real.
