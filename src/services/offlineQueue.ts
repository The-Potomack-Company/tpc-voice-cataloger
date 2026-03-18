import { db } from "../db";
import { supabase } from "../lib/supabase";
import { getDexieItemId } from "../db/idMapping";
import { processAudioWithAi } from "./gemini";

const CONCURRENCY = 4;
const MAX_RETRIES = 2;

let draining = false;

export interface QueuedItem {
  id: string;
  itemType: "house" | "sale";
  sessionId: string;
  createdAt: Date;
}

/**
 * Query all items with ai_status='queued' from Supabase,
 * sorted by created_at ascending (FIFO).
 */
export async function getQueuedItems(): Promise<QueuedItem[]> {
  const { data, error } = await supabase
    .from("items")
    .select("id, mode, session_id, created_at")
    .eq("ai_status", "queued")
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((item) => ({
    id: item.id,
    itemType: item.mode as "house" | "sale",
    sessionId: item.session_id,
    createdAt: new Date(item.created_at),
  }));
}

/**
 * Find the most recent audio record for a given item.
 * Uses getDexieItemId to bridge Supabase UUID to Dexie integer ID.
 * Returns the audio ID or null if no audio exists.
 */
async function findAudioForItem(itemId: string): Promise<number | null> {
  // Try via ID mapping first (migrated items: UUID -> legacy integer)
  const dexieId = await getDexieItemId(itemId);
  let audios;

  if (dexieId !== null) {
    audios = await db.audio.where("itemId").equals(dexieId).toArray();
  }

  // If no results from mapping, try direct UUID lookup (post-migration items)
  if (!audios || audios.length === 0) {
    audios = await db.audio.where("itemId").equals(itemId as unknown as number).toArray();
  }

  if (audios.length === 0) return null;
  // Return the highest id (most recent)
  return audios.reduce((max, a) => (a.id! > max ? a.id! : max), audios[0].id!);
}

/**
 * Process a single queued item with retry logic.
 * Retries up to MAX_RETRIES times on failure. If offline mid-retry, leaves item as queued.
 * Items with no audio are marked as failed immediately.
 */
async function processWithRetry(item: QueuedItem): Promise<void> {
  const audioId = await findAudioForItem(item.id);
  if (audioId === null) {
    // No audio found -- mark as failed via Supabase
    await supabase
      .from("items")
      .update({ ai_status: "failed" })
      .eq("id", item.id);
    return;
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (!navigator.onLine) return; // Pause if offline
    try {
      await processAudioWithAi(audioId, item.id, item.sessionId);
      return; // Success
    } catch {
      if (attempt < MAX_RETRIES) {
        // Reset status to queued before retrying (processAudioWithAi sets "failed" on error)
        await supabase
          .from("items")
          .update({ ai_status: "queued" })
          .eq("id", item.id);
      }
      // On final attempt, processAudioWithAi already set "failed"
    }
  }
}

/**
 * Drain the offline queue by processing all queued items in FIFO order
 * with bounded concurrency. Prevents concurrent drains via mutex flag.
 * Pauses if connectivity drops mid-drain.
 */
export async function drainQueue(): Promise<void> {
  if (draining) return; // Prevent concurrent drains
  draining = true;

  try {
    const items = await getQueuedItems();
    // Process in batches of CONCURRENCY
    for (let i = 0; i < items.length; i += CONCURRENCY) {
      if (!navigator.onLine) break; // Stop if offline
      const batch = items.slice(i, i + CONCURRENCY);
      await Promise.allSettled(batch.map(processWithRetry));
    }
  } finally {
    draining = false;
  }
}
