import { db } from "./index";
import { getDexieItemId } from "./idMapping";
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
  if (legacyId == null) return byUuid;
  const byLegacy = await db.audio.where("itemId").equals(legacyId).toArray();
  const seen = new Set(byUuid.map((a) => a.id));
  return [...byUuid, ...byLegacy.filter((a) => !seen.has(a.id))];
}
