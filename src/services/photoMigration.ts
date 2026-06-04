import { db } from "../db";
import { getNewIdByOldId } from "../db/idMapping";
import { supabase } from "../lib/supabase";
import { enqueuePhotoUpload, drainPhotoQueue } from "./photoUploadQueue";

const MIGRATION_FLAG = "photo_migration_v1_complete";

export interface MigrationResult {
  total: number;
  queued: number;
  skipped: number;
}

/**
 * Count Dexie photos that have no corresponding photoUploadQueue entry.
 * Any queue entry (pending/uploading/uploaded/failed) counts as "handled".
 */
export async function detectUnuploadedPhotos(): Promise<number> {
  const allPhotos = await db.photos.toArray();
  const handledIds = new Set(
    (await db.photoUploadQueue.toArray()).map((e) => e.dexiePhotoId),
  );
  return allPhotos.filter((p) => !handledIds.has(p.id!)).length;
}

/**
 * Queue all un-uploaded Dexie photos for upload to Supabase Storage.
 * Uses idMapping to resolve Dexie itemId -> Supabase UUID.
 * Sets localStorage flag when complete to prevent re-running.
 */
export async function migrateExistingPhotos(): Promise<MigrationResult> {
  if (localStorage.getItem(MIGRATION_FLAG) === "true") {
    return { total: 0, queued: 0, skipped: 0 };
  }

  const allPhotos = await db.photos.toArray();
  const handledIds = new Set(
    (await db.photoUploadQueue.toArray()).map((e) => e.dexiePhotoId),
  );
  const unhandled = allPhotos.filter((p) => !handledIds.has(p.id!));

  if (unhandled.length === 0) {
    localStorage.setItem(MIGRATION_FLAG, "true");
    return { total: 0, queued: 0, skipped: 0 };
  }

  let queued = 0;
  let skipped = 0;
  for (const photo of unhandled) {
    // Resolve Dexie itemId (oldId) to Supabase UUID (newId) via idMapping,
    // scoped by the photo's source table (itemType). houseVisitItems and
    // saleItems have INDEPENDENT ++id keyspaces, so passing photo.itemType as
    // the itemTable discriminator stops a sale photo from resolving to a
    // colliding house item's UUID (UAT 38-3), matching migrateToSupabase.
    const newId = await getNewIdByOldId(photo.itemId, "item", photo.itemType);

    // Use mapping newId if found, otherwise treat itemId as already a Supabase UUID string
    const supabaseItemId = newId ?? String(photo.itemId);

    // Look up sessionId from Supabase items table
    const { data: item } = await supabase
      .from("items")
      .select("session_id")
      .eq("id", supabaseItemId)
      .maybeSingle();

    if (!item) { skipped++; continue; } // item not in Supabase yet — retry on a later run

    await enqueuePhotoUpload({
      dexiePhotoId: photo.id!,
      itemId: supabaseItemId,
      sessionId: item.session_id,
      sortOrder: photo.sortOrder,
    });
    queued++;
  }

  // DAT-6: only mark the migration complete when every photo was queued. If any
  // were skipped (their item isn't in Supabase yet), leave the flag unset so the
  // next run retries them instead of stranding them permanently.
  if (skipped === 0) {
    localStorage.setItem(MIGRATION_FLAG, "true");
  }
  drainPhotoQueue(); // Fire-and-forget
  return { total: unhandled.length, queued, skipped };
}
