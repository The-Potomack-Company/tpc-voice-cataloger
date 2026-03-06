import { describe, it, expect, beforeEach } from "vitest";
import Dexie from "dexie";
import "fake-indexeddb/auto";
import { db } from "../db";

describe("Item Entry Logic", () => {
  beforeEach(async () => {
    // Clear all tables before each test
    await db.houseVisitItems.clear();
    await db.saleItems.clear();
    await db.photos.clear();
    await db.audio.clear();
    await db.sessions.clear();
  });

  describe("New item creation", () => {
    it("creates a house visit item with incremented sortOrder", async () => {
      const sessionId = (await db.sessions.add({
        name: "Test",
        mode: "house",
        status: "active",
        notes: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      })) as number;

      // Add first item
      await db.houseVisitItems.add({
        sessionId,
        sortOrder: 0,
        createdAt: new Date(),
      });

      // Count existing for next sortOrder
      const count = await db.houseVisitItems
        .where("sessionId")
        .equals(sessionId)
        .count();

      // Add second item
      const newId = await db.houseVisitItems.add({
        sessionId,
        sortOrder: count,
        createdAt: new Date(),
      });

      const newItem = await db.houseVisitItems.get(newId as number);
      expect(newItem?.sortOrder).toBe(1);
    });

    it("creates a sale item with incremented sortOrder", async () => {
      const sessionId = (await db.sessions.add({
        name: "Test Sale",
        mode: "sale",
        status: "active",
        notes: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      })) as number;

      await db.saleItems.add({
        sessionId,
        sortOrder: 0,
        receiptNumber: "12345-1",
        createdAt: new Date(),
      });

      const count = await db.saleItems
        .where("sessionId")
        .equals(sessionId)
        .count();

      const newId = await db.saleItems.add({
        sessionId,
        sortOrder: count,
        receiptNumber: "",
        createdAt: new Date(),
      });

      const newItem = await db.saleItems.get(newId as number);
      expect(newItem?.sortOrder).toBe(1);
    });
  });

  describe("Empty item detection", () => {
    it("detects empty item (no audio, no photos)", async () => {
      const sessionId = (await db.sessions.add({
        name: "Test",
        mode: "house",
        status: "active",
        notes: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      })) as number;

      const itemId = (await db.houseVisitItems.add({
        sessionId,
        sortOrder: 0,
        createdAt: new Date(),
      })) as number;

      const audioCount = await db.audio
        .where("itemId")
        .equals(itemId)
        .count();
      const photoCount = await db.photos
        .where("itemId")
        .equals(itemId)
        .count();

      expect(audioCount).toBe(0);
      expect(photoCount).toBe(0);
      expect(audioCount === 0 && photoCount === 0).toBe(true);
    });

    it("detects non-empty item (has audio)", async () => {
      const sessionId = (await db.sessions.add({
        name: "Test",
        mode: "house",
        status: "active",
        notes: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      })) as number;

      const itemId = (await db.houseVisitItems.add({
        sessionId,
        sortOrder: 0,
        createdAt: new Date(),
      })) as number;

      await db.audio.add({
        itemId,
        itemType: "house",
        blob: new Blob(["audio"]),
        mimeType: "audio/webm",
        durationMs: 5000,
        createdAt: new Date(),
      });

      const audioCount = await db.audio
        .where("itemId")
        .equals(itemId)
        .count();
      expect(audioCount).toBe(1);
    });
  });

  describe("Navigation", () => {
    it("finds previous item by sortOrder", async () => {
      const sessionId = (await db.sessions.add({
        name: "Test",
        mode: "house",
        status: "active",
        notes: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      })) as number;

      const id1 = await db.houseVisitItems.add({
        sessionId,
        sortOrder: 0,
        createdAt: new Date(),
      });

      const id2 = await db.houseVisitItems.add({
        sessionId,
        sortOrder: 1,
        createdAt: new Date(),
      });

      await db.houseVisitItems.add({
        sessionId,
        sortOrder: 2,
        createdAt: new Date(),
      });

      // From item at sortOrder 2, find previous
      const currentSortOrder = 2;
      const items = await db.houseVisitItems
        .where("sessionId")
        .equals(sessionId)
        .filter((i) => i.sortOrder < currentSortOrder)
        .sortBy("sortOrder");

      const previousItem = items[items.length - 1];
      expect(previousItem.id).toBe(id2);
      expect(previousItem.sortOrder).toBe(1);
    });

    it("returns undefined for first item (no previous)", async () => {
      const sessionId = (await db.sessions.add({
        name: "Test",
        mode: "house",
        status: "active",
        notes: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      })) as number;

      await db.houseVisitItems.add({
        sessionId,
        sortOrder: 0,
        createdAt: new Date(),
      });

      const currentSortOrder = 0;
      const items = await db.houseVisitItems
        .where("sessionId")
        .equals(sessionId)
        .filter((i) => i.sortOrder < currentSortOrder)
        .sortBy("sortOrder");

      expect(items.length).toBe(0);
    });
  });
});
