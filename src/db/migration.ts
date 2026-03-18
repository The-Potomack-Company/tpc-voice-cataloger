import { db } from "./index";
import { addIdMapping } from "./idMapping";
import { supabase } from "../lib/supabase";

export async function needsMigration(): Promise<boolean> {
  const mappingCount = await db.idMapping.count();
  if (mappingCount > 0) return false; // Already migrated
  const sessionCount = await db.sessions.count();
  return sessionCount > 0;
}

export async function migrateToSupabase(
  userId: string,
  onProgress: (current: number, total: number) => void,
): Promise<{ migrated: number; skipped: number }> {
  // 1. Read all non-deleted Dexie sessions
  const dexieSessions = await db.sessions
    .filter((s) => !s.deletedAt)
    .toArray();

  // Count total items across all sessions
  let totalItems = 0;
  for (const sess of dexieSessions) {
    const houseCount = await db.houseVisitItems
      .where("sessionId")
      .equals(sess.id!)
      .count();
    const saleCount = await db.saleItems
      .where("sessionId")
      .equals(sess.id!)
      .count();
    totalItems += houseCount + saleCount;
  }

  let migrated = 0;
  let skipped = 0;

  for (const dexieSession of dexieSessions) {
    // Insert session to Supabase
    const { data: newSession, error: sessError } = await supabase
      .from("sessions")
      .insert({
        name: dexieSession.name,
        mode: dexieSession.mode,
        status: "active",
        notes: dexieSession.notes || "",
        created_by: userId,
      })
      .select()
      .single();

    if (sessError || !newSession) {
      // Count all items in this session as skipped
      const hItems = await db.houseVisitItems
        .where("sessionId")
        .equals(dexieSession.id!)
        .toArray();
      const sItems = await db.saleItems
        .where("sessionId")
        .equals(dexieSession.id!)
        .toArray();
      skipped += hItems.length + sItems.length;
      onProgress(migrated + skipped, totalItems);
      continue;
    }

    // Create session ID mapping
    await addIdMapping({
      oldId: dexieSession.id!,
      newId: newSession.id,
      type: "session",
    });

    // Migrate house visit items
    const houseItems = await db.houseVisitItems
      .where("sessionId")
      .equals(dexieSession.id!)
      .toArray();
    for (const item of houseItems) {
      const { data: newItem, error: itemError } = await supabase
        .from("items")
        .insert({
          session_id: newSession.id,
          mode: "house",
          title: item.title ?? null,
          description: item.description ?? null,
          condition: item.condition ?? null,
          estimate: item.estimate ?? null,
          measurements: item.measurements ?? null,
          category: item.category ?? null,
          transcript: item.transcript ?? null,
          ai_status: item.aiStatus ?? "pending",
          sort_order: item.sortOrder,
          receipt_number: null,
        })
        .select()
        .single();

      if (!itemError && newItem) {
        await addIdMapping({
          oldId: item.id!,
          newId: newItem.id,
          type: "item",
        });
        migrated++;
      } else {
        skipped++;
      }
      onProgress(migrated + skipped, totalItems);
    }

    // Migrate sale items
    const saleItems = await db.saleItems
      .where("sessionId")
      .equals(dexieSession.id!)
      .toArray();
    for (const item of saleItems) {
      const { data: newItem, error: itemError } = await supabase
        .from("items")
        .insert({
          session_id: newSession.id,
          mode: "sale",
          title: item.title ?? null,
          description: item.description ?? null,
          condition: item.condition ?? null,
          estimate: item.estimate ?? null,
          measurements: item.measurements ?? null,
          category: item.category ?? null,
          transcript: item.transcript ?? null,
          ai_status: item.aiStatus ?? "pending",
          sort_order: item.sortOrder,
          receipt_number: item.receiptNumber ?? null,
        })
        .select()
        .single();

      if (!itemError && newItem) {
        await addIdMapping({
          oldId: item.id!,
          newId: newItem.id,
          type: "item",
        });
        migrated++;
      } else {
        skipped++;
      }
      onProgress(migrated + skipped, totalItems);
    }
  }

  // Clear migrated metadata from Dexie (keep photos, audio, idMapping)
  await db.sessions.clear();
  await db.houseVisitItems.clear();
  await db.saleItems.clear();
  await db.exportHistory.clear();

  return { migrated, skipped };
}
