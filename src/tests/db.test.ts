import { describe, it, expect, afterEach } from "vitest";
import { db } from "../db";
import type { Session, HouseVisitItem, SaleItem } from "../db/types";

afterEach(async () => {
  await db.delete();
  await db.open();
});

describe("Dexie database", () => {
  it("opens successfully and has 5 tables", () => {
    const tableNames = db.tables.map((t) => t.name).sort();
    expect(tableNames).toEqual([
      "audio",
      "houseVisitItems",
      "photos",
      "saleItems",
      "sessions",
    ]);
  });

  it("can create and read a Session record", async () => {
    const session: Omit<Session, "id"> = {
      name: "Test House Visit",
      mode: "house",
      status: "active",
      notes: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const id = await db.sessions.add(session as Session);
    const retrieved = await db.sessions.get(id);

    expect(retrieved).toBeDefined();
    expect(retrieved!.name).toBe("Test House Visit");
    expect(retrieved!.mode).toBe("house");
  });

  it("can create and read a HouseVisitItem linked to a session", async () => {
    const sessionId = await db.sessions.add({
      name: "Session 1",
      mode: "house",
      status: "active",
      notes: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Session);

    const item: Omit<HouseVisitItem, "id"> = {
      sessionId: sessionId as number,
      title: "Antique Vase",
      description: "A blue and white porcelain vase",
      condition: "Good",
      estimate: "$200-300",
      category: "Ceramics",
      sortOrder: 1,
      createdAt: new Date(),
    };

    const itemId = await db.houseVisitItems.add(item as HouseVisitItem);
    const retrieved = await db.houseVisitItems.get(itemId);

    expect(retrieved).toBeDefined();
    expect(retrieved!.sessionId).toBe(sessionId);
    expect(retrieved!.title).toBe("Antique Vase");
  });

  it("can create and read a SaleItem linked to a session", async () => {
    const sessionId = await db.sessions.add({
      name: "Sale Session",
      mode: "sale",
      status: "active",
      notes: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Session);

    const item: Omit<SaleItem, "id"> = {
      sessionId: sessionId as number,
      receiptNumber: "12345-1",
      title: "OAK DINING TABLE",
      description: "the rectangular oak dining table with turned legs",
      sortOrder: 1,
      createdAt: new Date(),
    };

    const itemId = await db.saleItems.add(item as SaleItem);
    const retrieved = await db.saleItems.get(itemId);

    expect(retrieved).toBeDefined();
    expect(retrieved!.sessionId).toBe(sessionId);
    expect(retrieved!.receiptNumber).toBe("12345-1");
    expect(retrieved!.title).toBe("OAK DINING TABLE");
  });
});
