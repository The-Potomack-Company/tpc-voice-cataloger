import { db } from "./index";
import type { Session } from "./types";

export async function createSession(
  name: string,
  mode: "house" | "sale",
  notes?: string,
): Promise<number> {
  const now = new Date();
  const id = await db.sessions.add({
    name,
    mode,
    status: "active",
    notes: notes ?? "",
    createdAt: now,
    updatedAt: now,
  } as Session);
  return id as number;
}

export async function updateSession(
  id: number,
  changes: Partial<Pick<Session, "name" | "notes" | "status">>,
): Promise<void> {
  await db.sessions.update(id, {
    ...changes,
    updatedAt: new Date(),
  });
}

export async function softDeleteSession(id: number): Promise<void> {
  await db.sessions.update(id, {
    deletedAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function restoreSession(id: number): Promise<void> {
  await db.sessions.where("id").equals(id).modify((session) => {
    delete session.deletedAt;
    session.updatedAt = new Date();
  });
}

export async function permanentlyDeleteSession(id: number): Promise<void> {
  await db.transaction(
    "rw",
    [db.sessions, db.houseVisitItems, db.saleItems, db.photos, db.audio],
    async () => {
      // Get all item IDs for this session from both tables
      const houseItems = await db.houseVisitItems
        .where("sessionId")
        .equals(id)
        .toArray();
      const saleItems = await db.saleItems
        .where("sessionId")
        .equals(id)
        .toArray();

      const allItemIds = [
        ...houseItems.map((i) => i.id!),
        ...saleItems.map((i) => i.id!),
      ];

      // Delete photos and audio for all items
      for (const itemId of allItemIds) {
        await db.photos.where("itemId").equals(itemId).delete();
        await db.audio.where("itemId").equals(itemId).delete();
      }

      // Delete items
      await db.houseVisitItems.where("sessionId").equals(id).delete();
      await db.saleItems.where("sessionId").equals(id).delete();

      // Delete session
      await db.sessions.delete(id);
    },
  );
}

export async function getSessionById(
  id: number,
): Promise<Session | undefined> {
  return db.sessions.get(id);
}
