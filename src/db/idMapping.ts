import { db } from "./index";

/**
 * Look up the legacy Dexie integer ID for an item given its Supabase UUID.
 * Used for blob lookups in the photos/audio tables during migration.
 */
export async function getDexieItemId(
  supabaseItemId: string,
): Promise<number | null> {
  const mapping = await db.idMapping
    .where({ newId: supabaseItemId, type: "item" })
    .first();
  return mapping?.oldId ?? null;
}

/**
 * Look up the legacy Dexie integer ID for a session given its Supabase UUID.
 * Used for blob lookups in the photos/audio tables during migration.
 */
export async function getDexieSessionId(
  supabaseSessionId: string,
): Promise<number | null> {
  const mapping = await db.idMapping
    .where({ newId: supabaseSessionId, type: "session" })
    .first();
  return mapping?.oldId ?? null;
}

/**
 * Reverse lookup: the Supabase UUID for a legacy Dexie integer ID. Used by the
 * idempotent migration guard (D-04) to skip re-inserting a row that already
 * reached Supabase on a prior (partial) run. The [oldId+type] index (v12)
 * makes this an indexed lookup, mirroring getDexieItemId/getDexieSessionId.
 */
export async function getNewIdByOldId(
  oldId: number,
  type: "session" | "item",
): Promise<string | null> {
  const mapping = await db.idMapping.where({ oldId, type }).first();
  return mapping?.newId ?? null;
}

/**
 * Add a mapping between a legacy Dexie integer ID and a new Supabase UUID.
 */
export async function addIdMapping(mapping: {
  oldId: number;
  newId: string;
  type: "session" | "item";
}): Promise<void> {
  await db.idMapping.add(mapping);
}
