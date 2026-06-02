import { db } from "./index";
import { addIdMapping, getNewIdByOldId } from "./idMapping";
import { supabase } from "../lib/supabase";

// D-01/D-02: per-row predicate. True while ANY non-deleted session OR item lacks
// an idMapping row — so a preserved DAT-1 partial set is no longer falsely
// reported "already migrated" by a coarse count short-circuit. Sessions filter
// on deletedAt (Session has the field); house/sale items have no deletedAt
// (types.ts) so they are queried unconditionally.
export async function needsMigration(): Promise<boolean> {
  const sessions = await db.sessions.filter((s) => !s.deletedAt).toArray();
  for (const s of sessions) {
    if (!(await getNewIdByOldId(s.id!, "session"))) return true;
  }
  const houseItems = await db.houseVisitItems.toArray();
  for (const i of houseItems) {
    if (!(await getNewIdByOldId(i.id!, "item", "house"))) return true;
  }
  const saleItems = await db.saleItems.toArray();
  for (const i of saleItems) {
    if (!(await getNewIdByOldId(i.id!, "item", "sale"))) return true;
  }
  return false;
}

export async function migrateToSupabase(
  userId: string,
  onProgress: (current: number, total: number) => void,
): Promise<{
  migrated: number;
  alreadyMigrated: number;
  failed: number;
  partial: boolean;
}> {
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

  // WR-04: cross-store non-atomicity. Each row is `insert`ed to Supabase and
  // then `addIdMapping` writes the local mapping as two independent awaits. The
  // mapping is always awaited immediately after the insert (before the next
  // loop iteration), so the window is as small as it can be WITHOUT a real
  // transaction. But a residual window remains: if the tab closes (or
  // addIdMapping itself throws) AFTER the Supabase insert resolves but BEFORE
  // the mapping is durable, the row exists in Supabase with no local mapping →
  // the next run's getNewIdByOldId returns null → re-insert → duplicate. Closing
  // this fully needs a Supabase-side natural key + upsert (or a pre-insert lookup
  // by natural key), which is a schema change deliberately out of Phase 38 scope.
  // Tracked as a follow-up; flagged for HUMAN-UAT. Mitigated for now by the
  // single-threaded run (CR-01 guard) which removes the concurrent-retry vector.
  let migrated = 0;
  // D-10: split the old single `skipped` counter. `failed` is an insert error
  // (sets partial, triggers the banner); `alreadyMigrated` is an idempotent
  // skip (row already reached Supabase on a prior run) and must NEVER set
  // partial or block exportHistory cleanup.
  let failed = 0;
  let alreadyMigrated = 0;

  // DAT-1: track which Dexie rows actually reached Supabase so the cleanup
  // below deletes ONLY those. Failed rows stay in Dexie as the recovery set.
  const migratedHouseItemIds: number[] = [];
  const migratedSaleItemIds: number[] = [];
  const fullyMigratedSessionIds: number[] = [];

  for (const dexieSession of dexieSessions) {
    let sessionHadFailure = false;

    // D-05: the session insert is the dangerous duplicate path. A preserved
    // partial session already carries a `session` mapping from run 1, so reuse
    // its newId rather than re-inserting (which would duplicate the Supabase
    // session and re-parent its survivors).
    let newSessionId = await getNewIdByOldId(dexieSession.id!, "session");
    if (!newSessionId) {
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
        // WR-02: the session insert failed, but a prior interrupted run may have
        // already migrated+mapped some of these items (crashed between the item
        // mapping and the session mapping). Those items ARE in Supabase, so count
        // them alreadyMigrated and push them into the delete lists for cleanup —
        // counting them `failed` would inflate the banner "N" and leak their dead
        // recovery rows forever. Only genuinely-unmapped items are failures.
        const hItems = await db.houseVisitItems
          .where("sessionId")
          .equals(dexieSession.id!)
          .toArray();
        const sItems = await db.saleItems
          .where("sessionId")
          .equals(dexieSession.id!)
          .toArray();
        for (const it of hItems) {
          if (await getNewIdByOldId(it.id!, "item", "house")) {
            alreadyMigrated++;
            migratedHouseItemIds.push(it.id!);
          } else {
            failed++;
          }
        }
        for (const it of sItems) {
          if (await getNewIdByOldId(it.id!, "item", "sale")) {
            alreadyMigrated++;
            migratedSaleItemIds.push(it.id!);
          } else {
            failed++;
          }
        }
        onProgress(migrated + failed + alreadyMigrated, totalItems);
        continue;
      }

      newSessionId = newSession.id;
      await addIdMapping({
        oldId: dexieSession.id!,
        newId: newSessionId,
        type: "session",
      });
    }
    // else: session already mapped — reuse newSessionId, no insert, not a failure.

    // Migrate house visit items
    const houseItems = await db.houseVisitItems
      .where("sessionId")
      .equals(dexieSession.id!)
      .toArray();
    for (const item of houseItems) {
      // D-05 guard: skip the insert if this item already reached Supabase.
      // Push its dead recovery row into the bulkDelete list so a clean retry
      // finally clears it (SC4). itemTable scopes the lookup so a house item
      // id never matches an already-migrated sale item with the same ++id.
      const existingItemId = await getNewIdByOldId(item.id!, "item", "house");
      if (existingItemId) {
        alreadyMigrated++;
        migratedHouseItemIds.push(item.id!);
        onProgress(migrated + failed + alreadyMigrated, totalItems);
        continue;
      }

      const { data: newItem, error: itemError } = await supabase
        .from("items")
        .insert({
          session_id: newSessionId,
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
          itemTable: "house",
        });
        migratedHouseItemIds.push(item.id!);
        migrated++;
      } else {
        failed++;
        sessionHadFailure = true;
      }
      onProgress(migrated + failed + alreadyMigrated, totalItems);
    }

    // Migrate sale items
    const saleItems = await db.saleItems
      .where("sessionId")
      .equals(dexieSession.id!)
      .toArray();
    for (const item of saleItems) {
      // D-05 guard: skip already-migrated sale items (same as house loop),
      // scoped to the sale table so a sale id never matches a house mapping.
      const existingItemId = await getNewIdByOldId(item.id!, "item", "sale");
      if (existingItemId) {
        alreadyMigrated++;
        migratedSaleItemIds.push(item.id!);
        onProgress(migrated + failed + alreadyMigrated, totalItems);
        continue;
      }

      const { data: newItem, error: itemError } = await supabase
        .from("items")
        .insert({
          session_id: newSessionId,
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
          itemTable: "sale",
        });
        migratedSaleItemIds.push(item.id!);
        migrated++;
      } else {
        failed++;
        sessionHadFailure = true;
      }
      onProgress(migrated + failed + alreadyMigrated, totalItems);
    }

    // Only drop the session row once every item under it migrated; otherwise keep
    // it so the surviving failed items retain their parent context for recovery.
    if (!sessionHadFailure) {
      fullyMigratedSessionIds.push(dexieSession.id!);
    }
  }

  // DAT-1: delete only successfully-migrated rows; preserve any failure in Dexie.
  await db.houseVisitItems.bulkDelete(migratedHouseItemIds);
  await db.saleItems.bulkDelete(migratedSaleItemIds);
  await db.sessions.bulkDelete(fullyMigratedSessionIds);
  // D-09: exportHistory references old session ids; clear it on POST-RUN ground
  // truth (no row left unmapped), not on a counter. A clean idempotent retry
  // that only skips already-migrated rows must still clear it.
  if (!(await needsMigration())) {
    await db.exportHistory.clear();
  }

  return { migrated, alreadyMigrated, failed, partial: failed > 0 };
}
