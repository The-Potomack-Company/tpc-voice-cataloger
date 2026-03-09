import { db } from "../db";
import { processAudioWithAi } from "./gemini";

const CONCURRENCY = 4;
const MAX_RETRIES = 2;

let draining = false;

export interface QueuedItem {
  id: number;
  itemType: "house" | "sale";
  createdAt: Date;
}

/**
 * Query all items with aiStatus="queued" from both houseVisitItems and saleItems,
 * merged and sorted by createdAt ascending (FIFO).
 */
export async function getQueuedItems(): Promise<QueuedItem[]> {
  const houseItems = await db.houseVisitItems
    .where("aiStatus")
    .equals("queued")
    .toArray();
  const saleItems = await db.saleItems
    .where("aiStatus")
    .equals("queued")
    .toArray();

  const all: QueuedItem[] = [
    ...houseItems.map((i) => ({
      id: i.id!,
      itemType: "house" as const,
      createdAt: i.createdAt,
    })),
    ...saleItems.map((i) => ({
      id: i.id!,
      itemType: "sale" as const,
      createdAt: i.createdAt,
    })),
  ];

  return all.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

/**
 * Find the most recent audio record for a given item.
 * Returns the audio ID or null if no audio exists.
 */
async function findAudioForItem(itemId: number): Promise<number | null> {
  const audios = await db.audio.where("itemId").equals(itemId).toArray();
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
    // No audio found -- mark as failed
    const table =
      item.itemType === "house" ? db.houseVisitItems : db.saleItems;
    await table.update(item.id, { aiStatus: "failed" });
    return;
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (!navigator.onLine) return; // Pause if offline
    try {
      await processAudioWithAi(audioId, item.id, item.itemType);
      return; // Success
    } catch {
      if (attempt < MAX_RETRIES) {
        // Reset status to queued before retrying (processAudioWithAi sets "failed" on error)
        const table =
          item.itemType === "house" ? db.houseVisitItems : db.saleItems;
        await table.update(item.id, { aiStatus: "queued" });
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
