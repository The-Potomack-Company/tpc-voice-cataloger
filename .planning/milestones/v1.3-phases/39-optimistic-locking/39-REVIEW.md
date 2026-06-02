---
phase: 39-optimistic-locking
reviewed: 2026-06-02T00:00:00Z
depth: deep
files_reviewed: 6
files_reviewed_list:
  - src/db/optimisticUpdate.ts
  - src/stores/sessionStore.ts
  - src/services/geminiContinuous.ts
  - src/hooks/useWriteAheadQueue.ts
  - src/db/types.ts
  - supabase/migrations/20260603000000_add_items_updated_at_trigger.sql
findings:
  critical: 1
  warning: 5
  info: 4
  total: 10
status: issues_found
---

# Phase 39: Code Review Report — optimistic-locking

**Reviewed:** 2026-06-02
**Depth:** deep (cross-file: store → helper → migration; merge → helper; queue → helper)
**Files Reviewed:** 6
**Status:** issues_found

## Summary

The core lost-write mechanic is **largely correct**. The single most important adversarial question — "is a 0-row precondition miss (`data:[]`, `error:null`) treated as a conflict and not as a silent success?" — is answered correctly: `optimisticUpdate.ts:54-58` throws only on a real `error`, branches `data.length > 0` to applied, and falls through to re-read on 0-row. The queue flush correctly **retains** the entry on `exhausted` (no silent delete, Pitfall 5), and the D-06 compare-and-skip reconciles against **value-at-read** (not the AI's new value), so the AI yields to the user as designed. Token refresh between retries is correct (`prev = freshRow.updated_at`). The migration is additive, reuses `set_updated_at()`, backfills, and leaves RLS undisturbed.

However, there is **one Critical lost-write hole** in the legacy/deleted-row path of the helper, plus several Warnings around the conflated `noop` status, the unbumped local `updated_at` token, and an offline-enqueue staleness window. None of the Warnings silently drop a *user* edit in the common path, but two of them widen the window where an AI write can win against a stale token or where a queue entry is dropped on an ambiguous result.

---

## Critical Issues

### CR-01: `prev === undefined` precondition write can silently clobber (legacy + deleted-snapshot paths)

**File:** `src/db/optimisticUpdate.ts:47-52`; reached from `src/services/geminiContinuous.ts:300` and `src/hooks/useWriteAheadQueue.ts:106-125`

**Issue:** The helper does `.eq("updated_at", prev as never)` with no guard against `prev` being `undefined`/`null`. Three call paths can deliver `undefined`:

1. **AI merge** (`geminiContinuous.ts:268-300`): if the value-at-read snapshot read returns `null` (row briefly missing / RLS flicker), `snapshotRow = ({} as ...)` and `prevUpdatedAt: snapshotRow.updated_at` is `undefined`.
2. **`updateItemField`** (`sessionStore.ts:436`): local optimistic items created via `createItem` (`sessionStore.ts:315-330`) have **no `updated_at` field at all** (the temp item literal omits it). A user edit to a just-created, not-yet-refetched item passes `prevUpdatedAt: undefined`.
3. **Legacy queue fallback** (`useWriteAheadQueue.ts:107-119`): if the re-read also returns no row, `prev` stays `undefined`.

PostgREST serializes `.eq("updated_at", undefined)` by **dropping the filter** (supabase-js omits `undefined` query params), collapsing the precondition to `.update(patch).eq("id", id)` — i.e. an **unconditional last-writer-wins write**. That is exactly the silent clobber this phase exists to prevent: a stale AI merge or a stale queued edit overwrites a concurrent change with no 0-row, no conflict, no toast. The unit tests never exercise `prev === undefined` (every test passes `"T0"`), so this is uncovered.

Note the legacy-fallback comment at `useWriteAheadQueue.ts:108-110` explicitly claims it avoids "an unconditional last-writer-wins write" — but when the re-read yields nothing it does precisely that.

**Fix:** Treat a missing token as a forced conflict instead of a dropped filter. In `preconditionUpdate`, before the write:
```typescript
if (prev === undefined || prev === null) {
  // No version token → cannot precondition safely. Re-read to obtain one
  // rather than letting supabase-js drop the .eq filter (unconditional clobber).
  const { data: fresh } = await supabase
    .from(table as never).select("*").eq("id", id).maybeSingle();
  if (!fresh) return { status: "noop" };          // row gone — don't write
  prev = (fresh as Record<string, unknown>).updated_at as string;
  nextPatch = reconcile(fresh as Record<string, unknown>, nextPatch) ?? nextPatch;
  if (Object.keys(nextPatch).length === 0) return { status: "noop" };
}
```
Then the legacy-fallback block in `useWriteAheadQueue.ts:107-119` can be deleted (the helper owns it), and the AI/createItem `undefined` cases become safe by construction.

---

## Warnings

### WR-01: `noop` conflates "row gone" with "all fields skipped" — queue flush deletes the entry in both cases

**File:** `src/db/optimisticUpdate.ts:69` and `:74-76`; consumed at `src/hooks/useWriteAheadQueue.ts:120-131,140`

**Issue:** `preconditionUpdate` returns the identical `{status:"noop"}` for (a) re-read returned null (deleted/RLS-deny) and (b) the reconcile dropped every field. The queue flush retains only `exhausted`; both `applied` and `noop` fall through to `db.writeAheadQueue.delete(entry.id!)`. For the default (user-edit) reconcile a `noop` only happens via case (a), which is fine to drop. But the helper is table/reconcile-generic — any future caller (or a queued entry whose reconcile legitimately skips everything) would have its entry silently deleted on a `noop`, which for an RLS *flicker* (transient deny) means a dropped offline edit with no toast. The boundary between "permanently gone, safe to drop" and "transiently invisible, should retain" is collapsed.

**Fix:** Split the status: return `{status:"gone"}` (re-read null) vs `{status:"skipped"}` (empty reconcile). In the queue flush, treat `gone` as droppable but consider routing a re-read that returns `error != null` (vs `data:null`) to a transient retain. At minimum, document that `noop` is only safe to delete because RLS denies are non-transient in this app.

### WR-02: local `updated_at` token is never refreshed after a successful write → every subsequent same-item edit starts with a stale token

**File:** `src/stores/sessionStore.ts:419-441` (optimistic `set` writes `{...i,[field]:value}`, never the bumped `updated_at`); `preconditionUpdate` returns the fresh `row` but `updateItemField` ignores it.

**Issue:** After a successful `preconditionUpdate`, the trigger has bumped `updated_at`, and the helper returns `{status:"applied", row}` with the fresh token — but `updateItemField` discards it and leaves local `itemsBySession[...]` carrying the **old** `updated_at` (or none). The next edit to the same item therefore passes a stale `prevUpdatedAt`, guaranteeing a first-attempt 0-row, an extra re-read round-trip, and (more importantly) widening the reconcile window on every edit. Combined with CR-01 case 2, freshly-created items have *no* token until a `fetchItems` runs. This is the "stale token = wrong write / wasted attempts" failure mode flagged in the brief.

**Fix:** On `applied`, merge the returned row's `updated_at` back into local state:
```typescript
const res = await preconditionUpdate({ ... });
if (res.status === "applied") {
  set((state) => ({ itemsBySession: { ...state.itemsBySession,
    [sessionId]: (state.itemsBySession[sessionId] ?? []).map((i) =>
      i.id === itemId ? { ...i, updated_at: (res.row as { updated_at?: string }).updated_at } : i) }}));
}
```

### WR-03: offline enqueue captures the token from `originalItem`, which may already be stale, and the `field` write races the snapshot

**File:** `src/stores/sessionStore.ts:444-455`

**Issue:** On a network error the entry is enqueued with `updated_at: originalItem.updated_at`. `originalItem` is the *pre-edit* local copy (`sessionStore.ts:415`), whose token is stale for the reasons in WR-02 (never bumped after prior writes). On reconnect the flush preconditions against a token that may be several edits old; that 0-rows and reconciles (default re-apply), so the edit is not lost — but if the same field was edited offline twice, the FIFO replay of the first entry bumps the server token, and the second entry's even-staler snapshot 0-rows and re-reads. It converges, but the snapshot is providing little value. More concerning: if `originalItem.updated_at` is `undefined` (created offline), this feeds CR-01 case 3.

**Fix:** Resolve WR-02 first (so local tokens are fresh), and ensure the enqueued snapshot falls back to a re-read-on-flush when absent (covered by CR-01 fix). Low severity once CR-01 + WR-02 land.

### WR-04: AI-merge `fresh[field] !== valueAtRead[field]` uses reference/strict inequality on values that may not be primitives

**File:** `src/services/geminiContinuous.ts:290`

**Issue:** The compare-and-skip basis is correct (fresh-server vs value-at-read), but `!==` is a strict/reference compare. For the current `MERGE_FIELDS` (all text/`null` scalar columns) this is fine. However `valueAtRead[field]` is read via `select("*")` (`geminiContinuous.ts:268`) and `fresh[field]` via the helper's `select("*")` (`optimisticUpdate.ts:65`) — two independent reads. If either ever returns a non-primitive (e.g. a future jsonb field, or a numeric `estimate` vs string coercion mismatch), `!==` would report "changed" for equal values and **drop the AI field unnecessarily** (safe direction — AI yields) OR report "unchanged" for a normalized difference and **re-apply over a user change** (unsafe). Today all fields are `text`, so this is latent, not live — but the guard is the load-bearing D-06 mechanism and deserves an explicit primitive-only contract.

**Fix:** Add a comment pinning `MERGE_FIELDS` to scalar text columns, and if any non-text field is ever added, switch that field to a normalized compare. Optionally `String(fresh[field] ?? "") !== String(valueAtRead[field] ?? "")` for defensiveness.

### WR-05: exhaustion retry closure re-invokes with the original (now doubly-stale) `args`, and can stack toasts

**File:** `src/db/optimisticUpdate.ts:80-85`

**Issue:** The `notifyError` retry callback is `() => { void preconditionUpdate(args); }`. `args` closes over the *original* `prevUpdatedAt` and original `patch`. On retry the first write 0-rows and the helper re-reads/refreshes, so it self-corrects (not a clobber). But: (1) the retry's result is discarded (`void`) — a second exhaustion fires *another* toast with *another* retry closure, and under sustained contention these can stack; (2) for the AI-merge caller, `args.reconcile` closes over the original `valueAtRead`, so a retry minutes later compares fresh-server against a now-ancient read and will skip nearly everything (AI silently yields all fields) — acceptable per D-08 but effectively a no-op masquerading as a retry. The user-edit retry is the meaningful one and works.

**Fix:** Have the retry await and re-toast only on repeated failure, or dedupe toasts in `notificationStore`. For the AI path, exhaustion arguably shouldn't offer a Retry at all (the merge is dormant, D-050) — consider passing `maxAttempts`/retry intent per caller.

---

## Info

### IN-01: `appendToItemField` read-modify-write is not itself preconditioned

**File:** `src/stores/sessionStore.ts:583-597`

**Issue:** `appendToItemField` reads `existingValue` from **local** state, concatenates, then calls `updateItemField` with the combined string. The precondition protects the final write, but the *read* (`existingValue`) is local and may be stale — on a conflict the default reconcile re-applies the locally-combined string verbatim, overwriting any server-side append that landed between. This is within D-08 ("last human intent wins for that field") so it's in-scope-acceptable, but the append semantics mean a concurrent append is lost (not merged). Worth a note for the transcript-append use case.

### IN-02: migration lacks an explicit transaction wrapper for column-add + backfill

**File:** `supabase/migrations/20260603000000_add_items_updated_at_trigger.sql:5-13`

**Issue:** The `alter table ... add column ... not null default now()` + `update ... backfill` + `create trigger` run as separate statements. Supabase applies each migration file in a transaction by default, so this is fine in practice. The `not null default now()` already guarantees no null window, making the backfill `update` (line 8-9) effectively redundant for correctness (it only normalizes existing rows from `now()` to `coalesce(created_at, now())` for display fidelity). Not a bug; noting that the backfill is cosmetic given the default.

### IN-03: `select("*")` re-read in helper pulls every column on every conflict

**File:** `src/db/optimisticUpdate.ts:63-67`

**Issue:** The re-read uses `select("*")`. The reconcile only needs `updated_at` (default path) or `updated_at` + `MERGE_FIELDS` (AI path). `select("*")` on `items` pulls transcript/description blobs on every conflict retry. Out of v1 scope (performance), but the AI reconcile depends on specific columns being present, so `select("*")` is the safe generic choice — leave as-is unless profiled.

### IN-04: `updateItemField` never reverts the optimistic UI on `exhausted`

**File:** `src/stores/sessionStore.ts:432-442`

**Issue:** When `preconditionUpdate` returns `exhausted`, it surfaces its own toast (`optimisticUpdate.ts:80`) but does not throw, so `updateItemField`'s catch never runs and the optimistic local value is left in place. Per D-08 (show last human intent + offer Retry) this is the intended UX, but it means the UI shows a value that did not persist with only a toast to indicate it. Acceptable by decision; flagging so it isn't mistaken for a missing revert.

---

_Reviewed: 2026-06-02_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
