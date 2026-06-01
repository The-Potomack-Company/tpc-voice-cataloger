import { db } from "../db";
import { supabase } from "../lib/supabase";
import { trackEvent } from "./analytics";
import { extFromMime } from "../utils/audio";
import type { AudioUploadEntry } from "../db/types";

const CONCURRENCY = 2;
const MAX_RETRIES = 3;
const BACKOFF_BASE = 1000; // delay = 4^retryCount * 1000 => 1s, 4s, 16s

let draining = false;

/**
 * Add an audio blob to the upload queue with pending status.
 * Storage paths follow: audio/{sessionId}/{itemId}/{dexieAudioId}.{ext}
 * where ext is derived from the blob mime (NEVER hardcoded .opus).
 * itemId is the Supabase UUID string — never the legacy int.
 */
export async function enqueueAudioUpload(params: {
  dexieAudioId: number;
  itemId: string;
  sessionId: string;
  mimeType: string;
}): Promise<void> {
  const { dexieAudioId, itemId, sessionId, mimeType } = params;
  const ext = extFromMime(mimeType);
  await db.audioUploadQueue.add({
    dexieAudioId,
    itemId,
    sessionId,
    mimeType,
    storagePath: `audio/${sessionId}/${itemId}/${dexieAudioId}.${ext}`,
    status: "pending",
    retryCount: 0,
    createdAt: new Date(),
  });
}

// Alias for backward compat with test stubs
export { enqueueAudioUpload as enqueue };

/**
 * Process a single audio upload entry:
 * 1. Mark as uploading
 * 2. Read blob from Dexie audio table
 * 3. Upload the single blob to Supabase Storage (contentType = audio mimeType)
 * 4. Upsert metadata row in Supabase audio table (DAT-5 idempotent)
 * 5. Mark as uploaded (or handle failure with retry)
 */
export async function processOneAudioUpload(entry: AudioUploadEntry): Promise<void> {
  const entryId = entry.id!;
  const startedAt = performance.now();
  console.log("[audioUploadQueue] Processing entry", entryId, "dexieAudioId:", entry.dexieAudioId, "path:", entry.storagePath);

  // Mark as uploading
  await db.audioUploadQueue.update(entryId, {
    status: "uploading",
    lastAttemptAt: new Date(),
  });

  // Read blob from Dexie audio table
  const audio = await db.audio.get(entry.dexieAudioId);
  if (!audio) {
    console.error("[audioUploadQueue] Dexie audio not found for id:", entry.dexieAudioId);
    await db.audioUploadQueue.update(entryId, { status: "failed" });
    return;
  }

  try {
    // Upload the single audio blob with its runtime content-type
    const { error: uploadError } = await supabase.storage
      .from("audio")
      .upload(entry.storagePath, audio.blob, {
        contentType: entry.mimeType,
        cacheControl: "31536000",
        upsert: true,
      });
    if (uploadError) throw uploadError;

    // Upsert metadata row in Supabase audio table.
    // DAT-5: onConflict storage_path / ignoreDuplicates so a retry can't duplicate.
    const { error: upsertError } = await supabase.from("audio").upsert(
      {
        item_id: entry.itemId,
        storage_path: entry.storagePath,
        mime_type: entry.mimeType,
        upload_status: "uploaded",
      },
      { onConflict: "storage_path", ignoreDuplicates: true }
    );
    if (upsertError) throw upsertError;

    // Mark queue entry as uploaded
    await db.audioUploadQueue.update(entryId, { status: "uploaded" });

    trackEvent({
      event_type: "audio.uploaded",
      session_id: entry.sessionId,
      execution_time_ms: Math.round(performance.now() - startedAt),
      items_content: { item_id: entry.itemId, retry_count: entry.retryCount },
    });
  } catch (err) {
    console.error("[audioUploadQueue] Upload failed for entry", entryId, err);
    // Increment retry count
    const newRetryCount = entry.retryCount + 1;
    if (newRetryCount >= MAX_RETRIES) {
      await db.audioUploadQueue.update(entryId, {
        status: "failed",
        retryCount: newRetryCount,
      });
      trackEvent({
        event_type: "audio.upload_failed",
        session_id: entry.sessionId,
        execution_time_ms: Math.round(performance.now() - startedAt),
        error_message: err instanceof Error ? err.message : String(err),
        error_count: newRetryCount,
        items_content: { item_id: entry.itemId, storage_path: entry.storagePath },
      });
    } else {
      await db.audioUploadQueue.update(entryId, {
        status: "pending",
        retryCount: newRetryCount,
      });
      // Schedule retry with exponential backoff
      const delay = Math.pow(4, newRetryCount) * BACKOFF_BASE;
      setTimeout(() => drainAudioQueue(), delay);
    }
  }
}

/**
 * Drain the audio upload queue by processing all pending entries
 * with bounded concurrency (2). Mutex prevents concurrent drains.
 * Stops if connectivity drops mid-drain.
 */
export async function drainAudioQueue(): Promise<void> {
  if (draining) return;
  draining = true;

  try {
    const items = await db.audioUploadQueue
      .where("status")
      .equals("pending")
      .sortBy("createdAt");

    for (let i = 0; i < items.length; i += CONCURRENCY) {
      if (!navigator.onLine) break;
      const batch = items.slice(i, i + CONCURRENCY);
      await Promise.allSettled(batch.map(processOneAudioUpload));
    }
  } finally {
    draining = false;
  }
}

/**
 * Reset all failed entries to pending and trigger a drain.
 */
export async function retryFailedUploads(): Promise<void> {
  const failed = await db.audioUploadQueue
    .where("status")
    .equals("failed")
    .toArray();

  await Promise.all(
    failed.map((entry) =>
      db.audioUploadQueue.update(entry.id!, {
        status: "pending" as const,
        retryCount: 0,
      })
    )
  );

  // Fire-and-forget drain
  drainAudioQueue();
}

// Export for testing
export function _resetDraining(): void {
  draining = false;
}
