import { supabase } from "../lib/supabase";
import { useNotificationStore } from "../stores/notificationStore";

// Phase 39 (DAT-3): shared optimistic-concurrency primitive. A write carries the
// caller's `updated_at` snapshot as a second `.eq()` precondition; a 0-row result
// means someone else wrote since our read (the items_updated_at trigger bumped the
// token). On conflict we re-read, re-derive the intent against the FRESH token, and
// retry — bounded to maxAttempts (D-07) to prevent livelock. Mirrors the proven
// Phase-33 CAS in offlineQueue.ts:119-132 (.eq().eq().select() + 0-row detection);
// do NOT fork a divergent precondition implementation (O-1 cross-phase flag).

export type ReconcileFn = (
  freshRow: Record<string, unknown>,
  intendedPatch: Record<string, unknown>,
) => Record<string, unknown> | null;

export type PreconditionResult =
  | { status: "applied"; row: Record<string, unknown> }
  | { status: "noop" }
  | { status: "exhausted" };

export async function preconditionUpdate(args: {
  table: string;
  id: string;
  prevUpdatedAt: string | null | undefined;
  patch: Record<string, unknown>;
  reconcile?: ReconcileFn;
  maxAttempts?: number;
}): Promise<PreconditionResult> {
  const { table, id, prevUpdatedAt, patch } = args;
  // Default reconcile = re-apply the user's intended patch verbatim against the
  // fresh row (last human intent wins, D-08). The AI-merge path (Plan 03) passes a
  // per-field compare-and-skip reconcile instead (D-06).
  const reconcile: ReconcileFn = args.reconcile ?? ((_fresh, intended) => intended);
  const maxAttempts = args.maxAttempts ?? 3;

  let prev = prevUpdatedAt;
  let nextPatch = patch;

  // CR-01: a missing version token must never reach `.eq("updated_at", undefined)` —
  // supabase-js DROPS an undefined filter, collapsing the precondition to a bare
  // `.eq("id")`, i.e. an unconditional last-writer-wins clobber (the exact silent lost
  // write this helper exists to prevent). Sources of a missing token: an item created
  // locally before its first fetch, an AI snapshot read that returned null, a legacy
  // offline entry with no snapshot. Re-read to obtain a real token first; if the row is
  // gone (deleted / RLS-deny), do not write.
  if (prev === undefined || prev === null) {
    const { data: fresh, error: readError } = await supabase
      .from(table as never)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    // CR-02: a transient read error must NOT collapse to noop. The write-ahead
    // flush deletes the queued edit on noop (useWriteAheadQueue.ts), so swallowing
    // a network blip here silently drops the offline write — the exact lost write
    // this primitive exists to prevent. Throw so the caller keeps the entry for
    // retry; only a SUCCESSFUL read returning no row is a genuine gone/RLS-deny noop.
    if (readError) throw readError;
    if (!fresh) return { status: "noop" };
    const freshRow = fresh as Record<string, unknown>;
    prev = freshRow.updated_at as string;
    const reconciled = reconcile(freshRow, nextPatch);
    if (!reconciled || Object.keys(reconciled).length === 0) {
      return { status: "noop" };
    }
    nextPatch = reconciled;
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // The trigger owns the updated_at bump (Pitfall 2) — never put updated_at in the
    // patch, that would fight the trigger.
    // WHY .select(): PostgREST .update().eq() returns data:null WITHOUT an explicit
    // .select(), so a 0-row precondition miss would be undetectable (Pitfall 1).
    // The helper is table-generic; the supabase client is strongly typed per table,
    // so cast at the boundary (same idiom as useWriteAheadQueue.ts `payload as never`).
    const { data, error } = await supabase
      .from(table as never)
      .update(nextPatch as never)
      .eq("id", id)
      .eq("updated_at", prev as never)
      .select();

    if (error) throw error; // genuine failure (network/permanent) → caller handles

    if (data && data.length > 0) {
      return { status: "applied", row: data[0] as Record<string, unknown> };
    }

    // 0-row: conflict, RLS-deny, or deleted — all share this shape. Re-read to
    // disambiguate: a row back = real conflict (reconcile + retry); nothing back =
    // gone (deleted / RLS-deny) → stop, do NOT loop.
    const { data: fresh, error: readError } = await supabase
      .from(table as never)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    // CR-02: as above — a transient re-read error must throw, not become noop,
    // or the caller silently deletes the queued offline edit.
    if (readError) throw readError;
    if (!fresh) return { status: "noop" };

    const freshRow = fresh as Record<string, unknown>;
    prev = freshRow.updated_at as string; // Pitfall 4: refresh the token, never reuse stale prev
    const reconciled = reconcile(freshRow, nextPatch);
    if (!reconciled || Object.keys(reconciled).length === 0) {
      return { status: "noop" }; // nothing left to write (e.g. all fields user-touched, D-06)
    }
    nextPatch = reconciled;
  }

  useNotificationStore
    .getState()
    .notifyError("Couldn't save your change — it kept colliding with another update. Tap Retry.", () => {
      void preconditionUpdate(args);
    });
  return { status: "exhausted" };
}
