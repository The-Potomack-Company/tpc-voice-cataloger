import { db } from "../db";
import { supabase } from "../lib/supabase";
import { isFirebaseAuthBackend } from "../lib/authBackend";
import { uploadFirebaseStorageObject } from "../lib/firebaseStorage";
import { trackEvent } from "./analytics";
import { extFromMime } from "../utils/audio";
import type { AudioUploadEntry } from "../db/types";

const CONCURRENCY = 2;
const MAX_RETRIES = 3;
const BACKOFF_BASE = 1000; // delay = 4^retryCount * 1000 => 1s, 4s, 16s

// Bound on how many times a `failed` entry may be automatically resurfaced by
// the boot/online resweep before it is left terminal. WHY a cap > MAX_RETRIES:
// each resweep cycle that re-fails bumps retryCount by one (processOneAudioUpload
// re-fails at MAX_RETRIES and persists newRetryCount), so RESWEEP_CAP measured
// against the persisted retryCount ages a permanently-failing entry out instead
// of re-arming it on every `online` event — the Phase-33/41 retry-storm bug we
// must NOT reintroduce. retryCount is preserved on resweep (never reset to 0);
// the unbounded reset-to-0 lives only in the manual retryFailedUploads one-shot.
const RESWEEP_CAP = 6;

// An entry welds to `uploading` only inside processOneAudioUpload, which always
// resolves it to `uploaded`/`failed` within the same call. So a persisted
// `uploading` entry can only survive a crash/tab-close mid-upload — neither the
// drain (`pending`) nor the resweep (`failed`) would ever pick it up again,
// stranding the audio forever. Reclaim it on boot/online once its claim is
// demonstrably stale. The threshold is generous (single opus blob uploads finish
// in seconds) so a genuinely in-flight upload — even over a slow link — is never
// reset out from under itself; the idempotent upsert (DAT-5) makes a redundant
// re-upload harmless regardless.
const STALE_UPLOADING_MS = 2 * 60 * 1000;

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
    if (isFirebaseAuthBackend()) {
      await uploadFirebaseStorageObject(entry.storagePath, audio.blob, {
        contentType: entry.mimeType,
        cacheControl: "31536000",
      });
    } else {
      // Upload the single audio blob with its runtime content-type
      const { error: uploadError } = await supabase.storage
        .from("audio")
        .upload(entry.storagePath, audio.blob, {
          contentType: entry.mimeType,
          cacheControl: "31536000",
          upsert: true,
        });
      if (uploadError) throw uploadError;
    }

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

/**
 * Boot/online self-heal: bounded resweep of `failed` entries back to `pending`.
 *
 * Unlike retryFailedUploads (the manual ItemCard one-shot, which resets
 * retryCount:0 unconditionally), this is safe to fire on every app boot and
 * every `online` event: an entry is only resurfaced while its persisted
 * retryCount is below RESWEEP_CAP, and retryCount is PRESERVED (never zeroed),
 * so a permanently-failing entry ages out instead of re-arming forever (the
 * retry-storm anti-pattern, RESEARCH Pitfall 3 / SHARED-1). The drain reuses the
 * existing idempotent upsert (DAT-5), so a resurfaced upload cannot duplicate a
 * Storage object or audio row. An entry whose Dexie blob is gone re-fails
 * terminally (self-limiting) and ages out via the same cap.
 */
export async function resweepFailedUploads(): Promise<void> {
  const failed = await db.audioUploadQueue
    .where("status")
    .equals("failed")
    .toArray();

  let reset = 0;
  await Promise.all(
    failed.map((entry) => {
      if (entry.retryCount >= RESWEEP_CAP) return undefined; // terminal — never re-arm
      reset += 1;
      // Preserve retryCount: only flip status so the entry ages out under the cap.
      return db.audioUploadQueue.update(entry.id!, { status: "pending" as const });
    })
  );

  // Reclaim entries stranded in `uploading` by a crash/tab-close mid-upload.
  // Only those whose claim is older than STALE_UPLOADING_MS (or carry no
  // lastAttemptAt) — never a live in-flight upload. retryCount preserved so a
  // repeatedly-crashing entry still ages out under RESWEEP_CAP.
  const stuck = await db.audioUploadQueue
    .where("status")
    .equals("uploading")
    .toArray();
  const now = Date.now();
  await Promise.all(
    stuck.map((entry) => {
      const startedAt = entry.lastAttemptAt?.getTime();
      const isStale = startedAt === undefined || now - startedAt > STALE_UPLOADING_MS;
      if (!isStale || entry.retryCount >= RESWEEP_CAP) return undefined;
      reset += 1;
      return db.audioUploadQueue.update(entry.id!, { status: "pending" as const });
    })
  );

  // Fire-and-forget drain only when something was actually resurfaced.
  if (reset > 0) drainAudioQueue();
}

// Export for testing
export function _resetDraining(): void {
  draining = false;
}
