---
phase: 39-optimistic-locking
plan: 01
wave: 0
status: complete
tasks_completed: 3
tasks_total: 3
requirements: [DAT-3]
commits:
  - 0a932ba
  - fafe63e
  - 8881693
---

# Plan 39-01 Summary — schema foundation + Wave-0 RED tests

## What was built

Landed the optimistic-locking version token and the failing specs the implementation waves turn GREEN.

1. **Migration** `supabase/migrations/20260603000000_add_items_updated_at_trigger.sql` — adds `public.items.updated_at timestamptz not null default now()`, backfills `coalesce(created_at, now())`, and attaches the `items_updated_at` BEFORE UPDATE trigger reusing `public.set_updated_at()` (D-01: not moddatetime). RLS untouched; `set_updated_at()` reused not redefined.
2. **Applied to prod** via supabase MCP `apply_migration` (Claude-owned, D-046 — the gsd-executor lacks the supabase MCP, so Wave 0 ran inline in the orchestrator). Verified live: column present, trigger present, 0 null rows. Remote migration history version reconciled `20260602173217 → 20260603000000` so the repo file is the single source of truth and `supabase db push` is a no-op.
3. **Types regenerated** `npm run db:types` from the live project → `items` Row/Insert/Update expose `updated_at: string` (3-line diff, no other drift).
4. **Cross-app schema docs** (`../_workspace/Schema/schema.md`, `migrations.md`) updated; fixed the stale "updated_at trigger set on sessions" claim (it is attached only to `crm_threads` and now `items` — verified against live `pg_trigger`).
5. **Four RED test files** encode the conflict/reconcile contract (8 RED tests).

## Key files

### Created
- `supabase/migrations/20260603000000_add_items_updated_at_trigger.sql`
- `src/tests/optimistic-update.test.ts` — `preconditionUpdate` helper contract (Plan 02 target)
- `src/tests/continuous-merge-no-clobber.test.ts` — HEADLINE D-06 compare-and-skip (Plan 03 target)

### Modified
- `src/db/database.types.ts` — regenerated with `items.updated_at: string`
- `src/tests/write-ahead-queue.test.ts` — extended: flush precondition + Pitfall 5 retain + Pitfall 6 legacy fallback
- `src/tests/supabase-types.test.ts` — assert `items.Row.updated_at` is string; fixed items Row literal (new required field)

### Out-of-repo (vault, not git-tracked here)
- `../_workspace/Schema/schema.md`, `../_workspace/Schema/migrations.md`

## Contract handed to Plans 02/03

`src/db/optimisticUpdate.ts` must export `preconditionUpdate({ table, id, prevUpdatedAt, patch, reconcile?, maxAttempts? })` returning `{status:"applied",row} | {status:"noop"} | {status:"exhausted"}`:
- write idiom `update(patch).eq("id",id).eq("updated_at",prev).select()`; `data.length===0` (error null) = conflict.
- conflict → re-read `select("*").eq("id",id).maybeSingle()`; null → `noop` (no loop); else refresh `prev = fresh.updated_at`, `patch = reconcile(fresh, patch)` and retry; `maxAttempts` default 3.
- exhaustion → `notifyError(message, retryFn)` and return `exhausted`.
- default `reconcile` = re-apply intended patch verbatim (user-intent-preserving). AI merge (Plan 03) passes a reconcile that drops every field whose `fresh[field] !== valueAtRead[field]` (D-06).

## Decisions / deviations

- **Wave 0 ran inline (orchestrator), not via gsd-executor subagent.** The migration apply + type regen are Claude-owned (D-046) and require the supabase MCP, which the executor agent does not have; `supabase db push` inside a subagent also risks an interactive password hang. Inline keeps Task 2 coherent. Implementation Waves 1–2 (pure client TS) delegate to subagents as normal.
- **Migration history reconciled** (MCP auto-assigned a wall-clock version; updated to the file's `20260603000000`).
- RED-import idiom: `optimistic-update.test.ts` uses a computed specifier + `@vite-ignore` so the absent module loads cleanly as a call-site failure (clean RED), and resolves unchanged to the real module once Plan 02 creates it.

## Self-Check: PASSED

- Migration grep verify: OK (trigger + set_updated_at + coalesce present, no RLS line).
- Types verify: `updated_at: string` present; cross-app docs reference `20260603000000`.
- Full build (tsc + vite): clean — the new required column broke no existing literals.
- Full test suite: **8 RED** (the designed Wave-0 contract: 4 optimistic-update + 1 continuous-merge + 3 write-ahead-queue), **700 passed**, no regressions.
- Live DB: column + trigger present, 0 null `updated_at`, history reconciled.
