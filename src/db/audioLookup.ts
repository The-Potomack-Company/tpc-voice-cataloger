import { db } from "./index";
import { getDexieItemId } from "./idMapping";
import { supabase } from "../lib/supabase";
import type { ItemAudio } from "./types";

/**
 * DAT-7: db.audio.itemId is stored inconsistently — UUID strings for recordings
 * made after the Supabase migration, legacy integer Dexie ids for older rows.
 * Query BOTH forms (UUID + the mapped legacy int) and union, deduped by id, so a
 * single-form lookup can't miss an item's audio (which previously made good items
 * look failed and disabled retry). Root normalization to a single UUID form is a
 * separate follow-up phase.
 */
export async function audioRecordsForItem(itemId: string): Promise<ItemAudio[]> {
  const byUuid = await db.audio.where("itemId").equals(itemId as unknown as number).toArray();
  const legacyId = await getDexieItemId(itemId);
  const byLegacy =
    legacyId == null
      ? []
      : await db.audio.where("itemId").equals(legacyId).toArray();
  const seen = new Set(byUuid.map((a) => a.id));
  const dexieRows = [...byUuid, ...byLegacy.filter((a) => !seen.has(a.id))];

  // W-3 rule (a) — Dexie-authoritative for latestAudioId. Union Supabase audio
  // rows so cross-device audio (recorded on another device, no local Dexie row)
  // is VISIBLE to ItemCard by count. We only contribute a Supabase row when NO
  // Dexie row exists for the item, and we leave its `id` undefined so it raises
  // `.length` (count) WITHOUT participating in the integer-keyed latestAudioId
  // reduce or the useAudioUploadStatus pill (no Dexie integer id to drive it).
  // KNOWN LIMITATION: on a pure cross-device session the audio count shows but
  // the upload-status pill is silent. Accepted for Phase 32 — no type widening.
  if (dexieRows.length > 0) return dexieRows;

  // Best-effort cross-device union: a Supabase failure (offline, RLS, network)
  // must NEVER break the Dexie-authoritative lookup. Degrade to dexieRows.
  let remote: Array<{
    id: string;
    item_id: string;
    mime_type: string | null;
    storage_path: string;
    upload_status: string | null;
    created_at: string | null;
  }> | null = null;
  try {
    const res = await supabase
      .from("audio")
      .select("id, item_id, mime_type, storage_path, upload_status, created_at")
      .eq("item_id", itemId);
    remote = res.data;
  } catch {
    return dexieRows;
  }

  if (!remote || remote.length === 0) return dexieRows;

  const remoteRows: ItemAudio[] = remote.map((r) => ({
    // id intentionally undefined — Supabase id is a UUID, not the Dexie int.
    itemId: itemId as unknown as number,
    itemType: "house",
    blob: new Blob([]), // placeholder: cross-device row has no local blob
    mimeType: r.mime_type ?? "audio/webm",
    createdAt: r.created_at ? new Date(r.created_at) : new Date(),
  }));

  return [...dexieRows, ...remoteRows];
}
