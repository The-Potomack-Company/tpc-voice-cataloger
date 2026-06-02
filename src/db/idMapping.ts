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
 *
 * itemTable disambiguates house vs sale: houseVisitItems and saleItems are
 * separate Dexie tables with INDEPENDENT ++id keyspaces, so a house item and a
 * sale item routinely share the same integer id. The stored `type` is always
 * "item" (forward consumers depend on that), so the reverse lookup MUST further
 * filter on the source table or it would falsely skip a sale item whose id
 * collides with an already-migrated house item — silent data loss on migration.
 */
export async function getNewIdByOldId(
  oldId: number,
  type: "session" | "item",
  itemTable?: "house" | "sale",
): Promise<string | null> {
  if (type === "item" && itemTable) {
    const mapping = await db.idMapping
      .where({ oldId, type })
      .filter((m) => m.itemTable === itemTable)
      .first();
    return mapping?.newId ?? null;
  }
  const mapping = await db.idMapping.where({ oldId, type }).first();
  return mapping?.newId ?? null;
}

/**
 * Add a mapping between a legacy Dexie integer ID and a new Supabase UUID.
 * itemTable is an additive unindexed field (no schema migration) that records
 * which item table the oldId came from, so the reverse lookup can disambiguate
 * the colliding house/sale ++id keyspaces.
 */
export async function addIdMapping(mapping: {
  oldId: number;
  newId: string;
  type: "session" | "item";
  itemTable?: "house" | "sale";
}): Promise<void> {
  await db.idMapping.add(mapping);
}
