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
 * Add a mapping between a legacy Dexie integer ID and a new Supabase UUID.
 */
export async function addIdMapping(mapping: {
  oldId: number;
  newId: string;
  type: "session" | "item";
}): Promise<void> {
  await db.idMapping.add(mapping);
}
