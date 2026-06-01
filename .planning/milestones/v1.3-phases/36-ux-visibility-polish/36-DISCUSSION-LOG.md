# Phase 36: ux-visibility-polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-01
**Phase:** 36-ux-visibility-polish
**Areas discussed:** Transaction strategy, Toast concurrency, Migration copy timing, Retry + copy mapping

> User pre-approved the recommended defaults ("seems like this is all — you
> surface recs and I'll probably go with them" → "Lock all 4"). Each area below
> records the alternatives weighed and the recommended call that was locked.

---

## Transaction strategy (new session / import)

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side rollback | Orchestrate inserts client-side, compensating-delete on failure; covers Dexie + Supabase; no schema change | ✓ |
| Supabase RPC | Single transactional Postgres function; DB-level atomicity but Supabase-only (can't unwind Dexie) + schema event, Claude-owned | |

**User's choice:** Client-side rollback.
**Notes:** RPC only wraps the Supabase side; new session/import touch Dexie too. Keeps phase schema-free → low risk. RPC deferred to a phase already doing schema work.

---

## Toast concurrency / lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Single-slot, latest-wins + dedupe, retryable sticky | Keep one-message store; don't re-show identical msg; drop 6s auto-dismiss only when retry attached | ✓ |
| Multi-toast queue/stack | Upgrade store to a queue so concurrent distinct errors stack | |

**User's choice:** Single-slot, latest-wins + dedupe, retryable toasts sticky.
**Notes:** One-operator cataloger; concurrent distinct errors rare. Queue deferred until it's a real problem.

---

## Migration copy timing

| Option | Description | Selected |
|--------|-------------|----------|
| Fix copy now, decoupled from Phase 38 | Make banner honest about `partial` (DAT-1 flag) immediately; correctness bug | ✓ |
| Defer to Phase 38's banner | Wait for 38's retry banner to replace copy | |

**User's choice:** Fix now, standalone.
**Notes:** #2 is a false-success lie, not cosmetic. 38 later upgrades the banner to add retry; 36 just stops claiming success on partial.

---

## Retry semantics + error-copy mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Wholesale re-run + central `toUserMessage(err)` helper | Retry re-invokes same op (export idempotent, fetch refetches); one mapper for friendly copy, generic fallback, no raw JSON to users | ✓ |
| Per-site ad-hoc copy + targeted retry | Each call site crafts its own message and partial-retry logic | |

**User's choice:** Wholesale re-run + central mapper.
**Notes:** Centralizing friendly copy keeps all touchpoints (login #21, fetch #27/#28, admin #16–20, export) consistent and prevents raw Supabase JSON leaking to users.

---

## Claude's Discretion

- Exact friendly-copy wording per error class.
- Location of `toUserMessage` helper (`src/services/` vs `src/lib/`).
- Exact admin/fetch call sites routed through the notify path.

## Deferred Ideas

- Transactional RPC for session/import (revisit when schema work happens).
- Multi-toast queue/stacking (only if concurrent distinct errors become real).
- Phase 38 migration retry banner ("N items not yet synced — Retry").
