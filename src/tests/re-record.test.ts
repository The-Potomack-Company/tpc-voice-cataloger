import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../db";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("appendToItemField (re-record)", () => {
  it("appends to existing value with newline separator", async () => {
    const { appendToItemField } = await import("../db/items");
    const id = (await db.houseVisitItems.add({
      sessionId: 1,
      description: "Original description",
      sortOrder: 0,
      createdAt: new Date(),
    })) as number;

    await appendToItemField(id, "house", "description", "Re-recorded addition");

    const item = await db.houseVisitItems.get(id);
    expect(item!.description).toBe("Original description\nRe-recorded addition");
  });

  it("sets value directly when field is empty/undefined", async () => {
    const { appendToItemField } = await import("../db/items");
    const id = (await db.houseVisitItems.add({
      sessionId: 1,
      sortOrder: 0,
      createdAt: new Date(),
    })) as number;

    await appendToItemField(id, "house", "description", "First recording");

    const item = await db.houseVisitItems.get(id);
    expect(item!.description).toBe("First recording");
  });
});
