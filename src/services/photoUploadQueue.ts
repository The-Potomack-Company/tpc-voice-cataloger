import { db } from "../db";
import { supabase } from "../lib/supabase";
import { isFirebaseAuthBackend } from "../lib/authBackend";
import { uploadFirebaseStorageObject } from "../lib/firebaseStorage";
import { trackEvent } from "./analytics";
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
  const startedAt = performance.now();
  console.log("[photoUploadQueue] Processing entry", entryId, "dexiePhotoId:", entry.dexiePhotoId, "path:", entry.storagePath);

  // Mark as uploading
  await db.photoUploadQueue.update(entryId, {
    status: "uploading",
    lastAttemptAt: new Date(),
  });

  // Read blob from Dexie photos table
  const photo = await db.photos.get(entry.dexiePhotoId);
  if (!photo) {
    console.error("[photoUploadQueue] Dexie photo not found for id:", entry.dexiePhotoId);
    await db.photoUploadQueue.update(entryId, { status: "failed" });
    return;
  }

  try {
    if (isFirebaseAuthBackend()) {
      await uploadFirebaseStorageObject(entry.storagePath, photo.blob, {
        contentType: "image/jpeg",
        cacheControl: "31536000",
      });
      await uploadFirebaseStorageObject(entry.thumbnailPath, photo.thumbnail!, {
        contentType: "image/jpeg",
        cacheControl: "31536000",
      });
    } else {
      // Upload full-size blob
      const { error: fullError } = await supabase.storage
        .from("photos")
        .upload(entry.storagePath, photo.blob, {
          contentType: "image/jpeg",
          cacheControl: "31536000",
          upsert: true,
        });
      if (fullError) throw fullError;

      // Upload thumbnail
      const { error: thumbError } = await supabase.storage
        .from("photos")
        .upload(entry.thumbnailPath, photo.thumbnail!, {
          contentType: "image/jpeg",
          cacheControl: "31536000",
          upsert: true,
        });
      if (thumbError) throw thumbError;
    }

    // Insert metadata row in Supabase photos table
    // DAT-5: upsert (ON CONFLICT DO NOTHING) so a retry can't create a duplicate photos row.
    const { error: insertError } = await supabase.from("photos").upsert(
      {
        item_id: entry.itemId,
        storage_path: entry.storagePath,
        thumbnail_path: entry.thumbnailPath,
        sort_order: entry.sortOrder,
        upload_status: "uploaded",
      },
      { onConflict: "storage_path", ignoreDuplicates: true }
    );
    if (insertError) throw insertError;

    // Mark queue entry as uploaded
    await db.photoUploadQueue.update(entryId, { status: "uploaded" });

    trackEvent({
      event_type: "photo.uploaded",
      session_id: entry.sessionId,
      execution_time_ms: Math.round(performance.now() - startedAt),
      photo_count: 1,
      items_content: { item_id: entry.itemId, retry_count: entry.retryCount },
    });
  } catch (err) {
    console.error("[photoUploadQueue] Upload failed for entry", entryId, err);
    // Increment retry count
    const newRetryCount = entry.retryCount + 1;
    if (newRetryCount >= MAX_RETRIES) {
      await db.photoUploadQueue.update(entryId, {
        status: "failed",
        retryCount: newRetryCount,
      });
      trackEvent({
        event_type: "photo.upload_failed",
        session_id: entry.sessionId,
        execution_time_ms: Math.round(performance.now() - startedAt),
        error_message: err instanceof Error ? err.message : String(err),
        error_count: newRetryCount,
        items_content: { item_id: entry.itemId, storage_path: entry.storagePath },
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
