import { useEffect } from "react";
import { db } from "../db";
import { supabase } from "../lib/supabase";
import { useUIStore } from "../stores/uiStore";
import { classifyAiError } from "../utils/aiErrorClass";
import type { WriteAheadEntry } from "../db/types";

let processing = false;

// Supabase returns errors as plain PostgrestError-shaped objects ({ message, code, ... }),
// not Error instances. classifyAiError only reads `.message` off real Error instances
// (instanceof check), so normalize to an Error carrying the message + status before
// classifying — otherwise every supabase failure stringifies to "[object Object]" and
// silently classifies as transient. Mirrors aiErrorClass's "Proxy returned HTTP <status>"
// idiom so 4xx/5xx codes flow through the same regex.
function toError(raw: unknown): Error {
  if (raw instanceof Error) return raw;
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const base = typeof r.message === "string" ? r.message : String(raw);
    const status =
      typeof r.status === "number"
        ? r.status
        : typeof r.code === "string" && /^\d{3}$/.test(r.code)
          ? Number(r.code)
          : undefined;
    return new Error(status ? `${base} (HTTP ${status})` : base);
  }
  return new Error(String(raw));
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

  try {
    const entries = await db.writeAheadQueue.orderBy("createdAt").toArray();

    for (const entry of entries) {
      try {
        if (entry.operation === "insert") {
          const { error } = await supabase
            .from(entry.table)
            .insert(entry.payload as never);
          if (error) throw error;
        } else if (entry.operation === "update") {
          const { id, ...rest } = entry.payload as {
            id: string;
            [key: string]: unknown;
          };
          const { error } = await supabase
            .from(entry.table)
            .update(rest)
            .eq("id", id);
          if (error) throw error;
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
        const kind = classifyAiError(toError(err));
        if (kind === "permanent") {
          // D-09: a permanent failure (4xx / validation) won't succeed on replay.
          // Drop the failing entry AND every queued entry for the same item (matched
          // by payload.id / tempId, reusing the hasPendingForItem idiom) so dependent
          // updates don't 404 forever (RESEARCH Pitfall 5), then CONTINUE the drain so
          // one bad write can't strand every later write (head-of-line block, T-33-06).
          const itemId = (entry.payload as Record<string, unknown>).id;
          const itemTempId = entry.tempId;
          await db.writeAheadQueue
            .filter((e) => {
              if (e.id === entry.id) return true;
              const p = e.payload as Record<string, unknown>;
              if (itemId !== undefined && p.id === itemId) return true;
              if (itemTempId !== undefined && e.tempId === itemTempId) return true;
              return false;
            })
            .delete();
          continue;
        }
        // Transient (offline / timeout / 429 / 5xx): halt-and-backoff. Preserve FIFO —
        // later updates depend on earlier inserts that have not yet landed.
        break;
      }
    }
  } finally {
    processing = false;
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
