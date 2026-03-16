import { db } from "./index";

function getTable(mode: "house" | "sale") {
  return mode === "house" ? db.houseVisitItems : db.saleItems;
}

export async function updateItemField(
  id: number,
  mode: "house" | "sale",
  field: string,
  value: string,
): Promise<void> {
  const table = getTable(mode);
  await table.update(id, { [field]: value });
}

export async function deleteItem(
  id: number,
  mode: "house" | "sale",
): Promise<void> {
  const table = getTable(mode);
  await db.transaction("rw", [table, db.photos, db.audio], async () => {
    await db.photos.where("itemId").equals(id).delete();
    await db.audio.where("itemId").equals(id).delete();
    await table.delete(id);
  });
}

export async function createBlankItem(
  sessionId: number,
  mode: "house" | "sale",
): Promise<number> {
  const table = getTable(mode);
  const items = await table.where("sessionId").equals(sessionId).sortBy("sortOrder");
  const maxSort = items.length > 0 ? items[items.length - 1].sortOrder : -1;
  const sortOrder = maxSort + 1;
  const now = new Date();

  if (mode === "sale") {
    return (await db.saleItems.add({
      sessionId,
      receiptNumber: "",
      sortOrder,
      createdAt: now,
    })) as number;
  }

  return (await db.houseVisitItems.add({
    sessionId,
    sortOrder,
    createdAt: now,
  })) as number;
}

export async function appendToItemField(
  id: number,
  mode: "house" | "sale",
  field: string,
  newContent: string,
): Promise<void> {
  const table = getTable(mode);
  await table
    .where("id")
    .equals(id)
    .modify((item: Record<string, unknown>) => {
      const existing = item[field] as string | undefined;
      if (existing) {
        item[field] = existing + "\n" + newContent;
      } else {
        item[field] = newContent;
      }
    });
}
