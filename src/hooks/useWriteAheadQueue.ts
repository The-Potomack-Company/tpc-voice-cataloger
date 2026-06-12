import { useEffect } from "react";
import { db } from "../db";
import { supabase } from "../lib/supabase";
import { useUIStore } from "../stores/uiStore";
import { notifyDrainComplete } from "../stores/drainSignalStore";
import { preconditionUpdate } from "../db/optimisticUpdate";
import type { WriteAheadEntry } from "../db/types";

let processing = false;

// WR-05: the write-ahead queue has NO persisted attempt counter — by design,
// since FIFO inserts/updates must replay in order and a per-entry counter would
// complicate that invariant. Instead, a transient failure self-reschedules a
// single delayed re-drain (mirroring the photo-queue setTimeout(drain, backoff)
// pattern), so a transient write-ahead failure recovers without waiting for an
// unrelated `online`/`enqueue`/mount event. We hold at most one pending timer so
// repeated transient failures can't pile up timers.
const TRANSIENT_REDRAIN_MS = 5_000;
let redrainTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleTransientRedrain(): void {
  if (redrainTimer !== null) return; // already one pending — don't pile up
  redrainTimer = setTimeout(() => {
    redrainTimer = null;
    if (navigator.onLine) processWriteAheadQueue().catch(() => {});
  }, TRANSIENT_REDRAIN_MS);
}

function toError(raw: unknown): Error {
  if (raw instanceof Error) return raw;
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const base = typeof r.message === "string" ? r.message : String(raw);
    const status = typeof r.status === "number" ? r.status : undefined;
    return new Error(status ? `${base} (HTTP ${status})` : base);
  }
  return new Error(String(raw));
}

function httpStatusFromError(error: Error): number | null {
  const match = error.message.match(/(?:Proxy returned HTTP (\d{3})|\(HTTP (\d{3})\)$)/);
  if (!match) return null;
  const status = Number(match[1] ?? match[2]);
  return Number.isFinite(status) ? status : null;
}

export function isPermanentWriteAheadError(error: unknown): boolean {
  if (!navigator.onLine) return false;
  const normalized = toError(error);
  const status = httpStatusFromError(normalized);
  return status === 400 || status === 404 || status === 406 || status === 410;
}

export async function enqueueWrite(
  entry: Omit<WriteAheadEntry, "id" | "createdAt">,
): Promise<void> {
  await db.writeAheadQueue.add({
    ...entry,
    createdAt: new Date(),
  });
  // Trigger a drain immediately when online. The `processing` mutex below
  // dedupes concurrent calls, so background nav traffic can't pile up.
  // Without this, events only drain on app mount or on offline->online flips.
  if (navigator.onLine) {
    processWriteAheadQueue().catch(() => {});
  }
}

export async function processWriteAheadQueue(): Promise<void> {
  if (processing) return;
  processing = true;
  // A drain is now underway; any pending self-rescheduled re-drain (WR-05) is
  // superseded — cancel it so this pass owns the outcome and re-schedules only
  // if it too hits a transient failure.
  if (redrainTimer !== null) {
    clearTimeout(redrainTimer);
    redrainTimer = null;
  }

  try {
    const entries = await db.writeAheadQueue.orderBy("createdAt").toArray();

    for (const entry of entries) {
      // A prior iteration's permanent-failure cascade (D-09 same-item drop) may have
      // already removed this entry from the queue; skip the stale in-memory copy so we
      // don't re-issue its write (and, for the precondition path, re-read a row we no
      // longer intend to touch).
      if (entry.id !== undefined && !(await db.writeAheadQueue.get(entry.id))) {
        continue;
      }
      try {
        if (entry.operation === "insert") {
          const { error } = await supabase
            .from(entry.table)
            .insert(entry.payload as never);
          if (error) throw error;
        } else if (entry.operation === "update") {
          const { id, updated_at, ...rest } = entry.payload as {
            id: string;
            updated_at?: string;
            [key: string]: unknown;
          };
          // Phase 39 (D-04): offline writes carry the user's intent across a
          // reconnect; honor the same optimistic precondition as online writes so a
          // server-side change that landed while we were offline isn't clobbered.
          // `updated_at` is a snapshot WHERE-token, never a SET column (the trigger
          // owns the bump) — destructure it out of the written patch.
          // Pitfall 6 (legacy entry with no snapshot, `updated_at === undefined`) is
          // handled inside preconditionUpdate: a missing token forces a re-read rather
          // than a dropped filter / unconditional clobber (CR-01).
          const result = await preconditionUpdate({
            table: entry.table,
            id,
            prevUpdatedAt: updated_at,
            patch: rest,
          });
          // Pitfall 5: a persistent precondition miss (exhausted) must NOT delete the
          // entry — that would silently lose the offline edit. Retain it for a later
          // retry; only resolved (applied/noop) entries are removed below.
          if (result.status === "exhausted") {
            continue;
          }
        } else if (entry.operation === "delete") {
          const { id } = entry.payload as { id: string };
          const { error } = await supabase
            .from(entry.table)
            .delete()
            .eq("id", id);
          if (error) throw error;
        }
        await db.writeAheadQueue.delete(entry.id!);
      } catch (err) {
        console.error(
          "Write-ahead queue processing failed for entry:",
          entry.id,
          err,
        );
        // Intentionally do NOT emit an analytics event here: trackEvent re-enqueues into this
        // same queue, which would grow the queue on every failed drain. Drain failures surface
        // via console + the global app.error handler on unhandled rejections.
        if (isPermanentWriteAheadError(err)) {
          // D-09: a permanent failure from the configured WAL status set won't
          // succeed on replay. Auth/rate-limit/server cases remain retryable.
          // Drop the failing entry AND every queued entry for the same item (matched
          // by payload.id / tempId, reusing the hasPendingForItem idiom) so dependent
          // updates don't 404 forever (RESEARCH Pitfall 5), then CONTINUE the drain so
          // one bad write can't strand every later write (head-of-line block, T-33-06).
          const itemId = (entry.payload as Record<string, unknown>).id;
          const itemTempId = entry.tempId;
          const dropped = await db.writeAheadQueue
            .filter((e) => {
              if (e.id === entry.id) return true;
              const p = e.payload as Record<string, unknown>;
              if (itemId !== undefined && p.id === itemId) return true;
              if (itemTempId !== undefined && e.tempId === itemTempId) return true;
              return false;
            })
            .delete();
          useUIStore.getState().addDroppedWriteAheadCount(dropped);
          console.warn("Dropping non-retryable write-ahead queue entries:", {
            entryId: entry.id,
            table: entry.table,
            operation: entry.operation,
            dropped,
            error: toError(err).message,
          });
          continue;
        }
        // Transient (offline / timeout / 429 / 5xx): halt-and-backoff. Preserve FIFO —
        // later updates depend on earlier inserts that have not yet landed.
        // WR-05: self-reschedule a single delayed re-drain so the queue is not
        // stranded until an unrelated online/enqueue/mount event fires.
        scheduleTransientRedrain();
        break;
      }
    }
  } finally {
    processing = false;
    // WR-04: a permanent write-ahead drop transitions blocked work while online;
    // signal completion so the BlockedQueueBadge re-fetches.
    notifyDrainComplete();
  }
}

export async function getPendingCount(): Promise<number> {
  return db.writeAheadQueue.count();
}

export async function hasPendingForItem(itemId: string): Promise<boolean> {
  const entries = await db.writeAheadQueue
    .filter((e) => (e.payload as Record<string, unknown>).id === itemId)
    .count();
  return entries > 0;
}

export function useWriteAheadQueue(): void {
  const isOnline = useUIStore((s) => s.isOnline);

  useEffect(() => {
    if (!isOnline) return;
    processWriteAheadQueue();
  }, [isOnline]);
}
