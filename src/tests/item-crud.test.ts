import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../db";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("updateItemField", () => {
  it("updates a house item field", async () => {
    const { updateItemField } = await import("../db/items");
    const id = (await db.houseVisitItems.add({
      sessionId: 1,
      title: "Old Title",
      sortOrder: 0,
      createdAt: new Date(),
    })) as number;

    await updateItemField(id, "house", "title", "NEW TITLE");

    const item = await db.houseVisitItems.get(id);
    expect(item!.title).toBe("NEW TITLE");
  });

  it("updates a sale item field", async () => {
    const { updateItemField } = await import("../db/items");
    const id = (await db.saleItems.add({
      sessionId: 1,
      title: "Old",
      description: "old desc",
      sortOrder: 0,
      createdAt: new Date(),
    })) as number;

    await updateItemField(id, "sale", "description", "new description");

    const item = await db.saleItems.get(id);
    expect(item!.description).toBe("new description");
  });
});

describe("deleteItem", () => {
  it("deletes a house item with associated photos and audio", async () => {
    const { deleteItem } = await import("../db/items");
    const itemId = (await db.houseVisitItems.add({
      sessionId: 1,
      title: "To Delete",
      sortOrder: 0,
      createdAt: new Date(),
    })) as number;

    await db.photos.add({
      itemId,
      itemType: "house",
      blob: new Blob(["photo"]),
      sortOrder: 0,
      createdAt: new Date(),
    });
    await db.audio.add({
      itemId,
      itemType: "house",
      blob: new Blob(["audio"]),
      mimeType: "audio/webm",
      createdAt: new Date(),
    });

    await deleteItem(itemId, "house");

    expect(await db.houseVisitItems.get(itemId)).toBeUndefined();
    expect(await db.photos.where("itemId").equals(itemId).count()).toBe(0);
    expect(await db.audio.where("itemId").equals(itemId).count()).toBe(0);
  });

  it("deletes a sale item with associated photos and audio", async () => {
    const { deleteItem } = await import("../db/items");
    const itemId = (await db.saleItems.add({
      sessionId: 1,
      title: "Sale Item",
      sortOrder: 0,
      createdAt: new Date(),
    })) as number;

    await db.photos.add({
      itemId,
      itemType: "sale",
      blob: new Blob(["photo"]),
      sortOrder: 0,
      createdAt: new Date(),
    });

    await deleteItem(itemId, "sale");

    expect(await db.saleItems.get(itemId)).toBeUndefined();
    expect(await db.photos.where("itemId").equals(itemId).count()).toBe(0);
  });
});

describe("createBlankItem", () => {
  it("creates a blank house item with correct sortOrder", async () => {
    const { createBlankItem } = await import("../db/items");

    // Add 2 existing items
    await db.houseVisitItems.add({
      sessionId: 1,
      title: "Item 1",
      sortOrder: 0,
      createdAt: new Date(),
    });
    await db.houseVisitItems.add({
      sessionId: 1,
      title: "Item 2",
      sortOrder: 1,
      createdAt: new Date(),
    });

    const newId = await createBlankItem(1, "house");

    const item = await db.houseVisitItems.get(newId);
    expect(item).toBeDefined();
    expect(item!.sortOrder).toBe(2);
    expect(item!.sessionId).toBe(1);
    expect(item!.createdAt).toBeInstanceOf(Date);
  });

  it("assigns sortOrder after max existing sortOrder when items have been deleted", async () => {
    const { createBlankItem } = await import("../db/items");

    // Create 3 items with sortOrders 0, 1, 2
    await db.houseVisitItems.add({
      sessionId: 1,
      title: "Item 0",
      sortOrder: 0,
      createdAt: new Date(),
    });
    const middleId = (await db.houseVisitItems.add({
      sessionId: 1,
      title: "Item 1",
      sortOrder: 1,
      createdAt: new Date(),
    })) as number;
    await db.houseVisitItems.add({
      sessionId: 1,
      title: "Item 2",
      sortOrder: 2,
      createdAt: new Date(),
    });

    // Delete the middle item (sortOrder 1)
    await db.houseVisitItems.delete(middleId);

    // Add a new item — should get sortOrder 3 (max of [0,2] + 1)
    const newId = await createBlankItem(1, "house");
    const item = await db.houseVisitItems.get(newId);
    expect(item).toBeDefined();
    expect(item!.sortOrder).toBe(3);
  });

  it("assigns sortOrder 0 when all items deleted", async () => {
    const { createBlankItem } = await import("../db/items");

    // Create and delete an item
    const id = (await db.houseVisitItems.add({
      sessionId: 1,
      title: "Temp",
      sortOrder: 0,
      createdAt: new Date(),
    })) as number;
    await db.houseVisitItems.delete(id);

    // Add a new item — should get sortOrder 0
    const newId = await createBlankItem(1, "house");
    const item = await db.houseVisitItems.get(newId);
    expect(item).toBeDefined();
    expect(item!.sortOrder).toBe(0);
  });

  it("creates a blank sale item with empty receiptNumber", async () => {
    const { createBlankItem } = await import("../db/items");

    const newId = await createBlankItem(5, "sale");

    const item = await db.saleItems.get(newId);
    expect(item).toBeDefined();
    expect(item!.sortOrder).toBe(0);
    expect(item!.sessionId).toBe(5);
    expect(item!.receiptNumber).toBe("");
  });
});

describe("appendToItemField", () => {
  it("appends to existing value with newline separator", async () => {
    const { appendToItemField } = await import("../db/items");
    const id = (await db.houseVisitItems.add({
      sessionId: 1,
      title: "Existing",
      sortOrder: 0,
      createdAt: new Date(),
    })) as number;

    await appendToItemField(id, "house", "title", "NEW");

    const item = await db.houseVisitItems.get(id);
    expect(item!.title).toBe("Existing\nNEW");
  });

  it("sets value directly when field is empty", async () => {
    const { appendToItemField } = await import("../db/items");
    const id = (await db.houseVisitItems.add({
      sessionId: 1,
      sortOrder: 0,
      createdAt: new Date(),
    })) as number;

    await appendToItemField(id, "house", "title", "First Value");

    const item = await db.houseVisitItems.get(id);
    expect(item!.title).toBe("First Value");
  });

  it("sets value directly when field is undefined", async () => {
    const { appendToItemField } = await import("../db/items");
    const id = (await db.saleItems.add({
      sessionId: 1,
      sortOrder: 0,
      createdAt: new Date(),
    })) as number;

    await appendToItemField(id, "sale", "description", "Hello");

    const item = await db.saleItems.get(id);
    expect(item!.description).toBe("Hello");
  });
});
