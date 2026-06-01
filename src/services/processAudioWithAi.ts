import { db } from "../db";
import { supabase } from "../lib/supabase";

/**
 * Resolve an item's audio blob for AI processing, Dexie-first with a
 * cross-device Storage fallback.
 *
 * Read path (D-05): the local Dexie blob is the primary source. When it is
 * absent (e.g. the recording was made on another device, or IndexedDB was
 * cleared), fall back to downloading from the Supabase `audio` Storage bucket.
 *
 * Pitfall 4: the fallback resolves the audio metadata row by `item_id` (the
 * Supabase UUID) — NEVER by the local integer `dexieAudioId`, which is only
 * meaningful on the device that recorded it. Resolving by the integer would
 * miss/leak the wrong row cross-device (T-32-12).
 *
 * Returns the blob plus the mime type to use for the AI request. Throws a
 * clear error when neither Dexie nor Storage has the audio (never silently
 * no-ops).
 */
export async function processAudioWithAi(params: {
  itemId: string;
  dexieAudioId: number;
}): Promise<{ blob: Blob; mimeType?: string }> {
  const { itemId, dexieAudioId } = params;

  const audioRecord = await db.audio.get(dexieAudioId);
  if (audioRecord?.blob) {
    return { blob: audioRecord.blob, mimeType: audioRecord.mimeType };
  }

  // Cross-device fallback — resolve by item_id (UUID), not the integer id.
  const { data: rows } = await supabase
    .from("audio")
    .select("storage_path, mime_type")
    .eq("item_id", itemId);

  const row = rows?.[0];
  if (!row) {
    throw new Error(`Audio for ${itemId} not in Dexie or Storage`);
  }

  const { data: dl } = await supabase.storage
    .from("audio")
    .download(row.storage_path);
  if (!dl) {
    throw new Error(`Storage blob missing for ${row.storage_path}`);
  }

  return { blob: dl, mimeType: row.mime_type ?? undefined };
}
