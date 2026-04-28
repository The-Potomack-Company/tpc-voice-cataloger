import { useEffect } from "react";
import { db } from "../db";
import { supabase } from "../lib/supabase";
import { useUIStore } from "../stores/uiStore";
import type { WriteAheadEntry } from "../db/types";

let processing = false;

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
        break; // Stop on first failure to maintain FIFO ordering
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
