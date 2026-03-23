import { db } from "../db";
import { supabase } from "../lib/supabase";
import type { PhotoUploadEntry } from "../db/types";

const CONCURRENCY = 2;
const MAX_RETRIES = 3;
const BACKOFF_BASE = 1000; // delay = 4^retryCount * 1000 => 1s, 4s, 16s

let draining = false;

/**
 * Add a photo to the upload queue with pending status.
 * Storage paths follow: photos/{sessionId}/{itemId}/full-{sortOrder}.jpg
 */
export async function enqueuePhotoUpload(params: {
  dexiePhotoId: number;
  itemId: string;
  sessionId: string;
  sortOrder: number;
}): Promise<void> {
  const { dexiePhotoId, itemId, sessionId, sortOrder } = params;
  await db.photoUploadQueue.add({
    dexiePhotoId,
    itemId,
    sessionId,
    sortOrder,
    storagePath: `photos/${sessionId}/${itemId}/full-${sortOrder}.jpg`,
    thumbnailPath: `photos/${sessionId}/${itemId}/thumb-${sortOrder}.jpg`,
    status: "pending",
    retryCount: 0,
    createdAt: new Date(),
  });
}

// Alias for backward compat with test stubs
export { enqueuePhotoUpload as enqueue };

/**
 * Process a single photo upload entry:
 * 1. Mark as uploading
 * 2. Read blob from Dexie photos table
 * 3. Upload full blob + thumbnail to Supabase Storage
 * 4. Insert metadata row in Supabase photos table
 * 5. Mark as uploaded (or handle failure with retry)
 */
export async function processOneUpload(entry: PhotoUploadEntry): Promise<void> {
  const entryId = entry.id!;

  // Mark as uploading
  await db.photoUploadQueue.update(entryId, {
    status: "uploading",
    lastAttemptAt: new Date(),
  });

  // Read blob from Dexie photos table
  const photo = await db.photos.get(entry.dexiePhotoId);
  if (!photo) {
    await db.photoUploadQueue.update(entryId, { status: "failed" });
    return;
  }

  try {
    // Upload full-size blob
    const { error: fullError } = await supabase.storage
      .from("photos")
      .upload(entry.storagePath, photo.blob, {
        contentType: "image/jpeg",
        cacheControl: "31536000",
        upsert: false,
      });
    if (fullError) throw fullError;

    // Upload thumbnail
    const { error: thumbError } = await supabase.storage
      .from("photos")
      .upload(entry.thumbnailPath, photo.thumbnail!, {
        contentType: "image/jpeg",
        cacheControl: "31536000",
        upsert: false,
      });
    if (thumbError) throw thumbError;

    // Insert metadata row in Supabase photos table
    const { error: insertError } = await supabase.from("photos").insert({
      item_id: entry.itemId,
      storage_path: entry.storagePath,
      thumbnail_path: entry.thumbnailPath,
      sort_order: entry.sortOrder,
      upload_status: "uploaded",
    });
    if (insertError) throw insertError;

    // Mark queue entry as uploaded
    await db.photoUploadQueue.update(entryId, { status: "uploaded" });
  } catch {
    // Increment retry count
    const newRetryCount = entry.retryCount + 1;
    if (newRetryCount >= MAX_RETRIES) {
      await db.photoUploadQueue.update(entryId, {
        status: "failed",
        retryCount: newRetryCount,
      });
    } else {
      await db.photoUploadQueue.update(entryId, {
        status: "pending",
        retryCount: newRetryCount,
      });
      // Schedule retry with exponential backoff
      const delay = Math.pow(4, newRetryCount) * BACKOFF_BASE;
      setTimeout(() => drainPhotoQueue(), delay);
    }
  }
}

/**
 * Drain the photo upload queue by processing all pending entries
 * with bounded concurrency (2). Mutex prevents concurrent drains.
 * Stops if connectivity drops mid-drain.
 */
export async function drainPhotoQueue(): Promise<void> {
  if (draining) return;
  draining = true;

  try {
    const items = await db.photoUploadQueue
      .where("status")
      .equals("pending")
      .sortBy("createdAt");

    for (let i = 0; i < items.length; i += CONCURRENCY) {
      if (!navigator.onLine) break;
      const batch = items.slice(i, i + CONCURRENCY);
      await Promise.allSettled(batch.map(processOneUpload));
    }
  } finally {
    draining = false;
  }
}

/**
 * Reset all failed entries to pending and trigger a drain.
 */
export async function retryFailedUploads(): Promise<void> {
  const failed = await db.photoUploadQueue
    .where("status")
    .equals("failed")
    .toArray();

  await Promise.all(
    failed.map((entry) =>
      db.photoUploadQueue.update(entry.id!, {
        status: "pending" as const,
        retryCount: 0,
      })
    )
  );

  // Fire-and-forget drain
  drainPhotoQueue();
}

// Export for testing
export function _resetDraining(): void {
  draining = false;
}
