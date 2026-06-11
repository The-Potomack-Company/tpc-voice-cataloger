import { describe, it, expect, afterEach } from "vitest";
import { db } from "../db";
import type { Session, HouseVisitItem, SaleItem, SessionAudio } from "../db/types";

afterEach(async () => {
  await db.delete();
  await db.open();
});

describe("Dexie database", () => {
  it("opens successfully and has 13 tables", () => {
    const tableNames = db.tables.map((t) => t.name).sort();
    expect(tableNames).toEqual([
      "audio",
      "audioUploadQueue",
      "exportHistory",
      "houseVisitItems",
      "idMapping",
      "notePages",
      "photoUploadQueue",
      "photos",
      "saleItems",
      "sessionAudio",
      "sessions",
      "userEditedFields",
      "writeAheadQueue",
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

  it("has aiStatus index on houseVisitItems after v3 migration", () => {
    const table = db.table("houseVisitItems");
    const indexNames = table.schema.indexes.map((idx) => idx.name);
    expect(indexNames).toContain("aiStatus");
  });

  it("has aiStatus index on saleItems after v3 migration", () => {
    const table = db.table("saleItems");
    const indexNames = table.schema.indexes.map((idx) => idx.name);
    expect(indexNames).toContain("aiStatus");
  });

  it("existing items have aiStatus undefined (no forced default)", async () => {
    const sessionId = await db.sessions.add({
      name: "Migration Test",
      mode: "house",
      status: "active",
      notes: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Session);

    const itemId = await db.houseVisitItems.add({
      sessionId: sessionId as number,
      title: "Pre-AI Item",
      sortOrder: 1,
      createdAt: new Date(),
    } as HouseVisitItem);

    const retrieved = await db.houseVisitItems.get(itemId);
    expect(retrieved).toBeDefined();
    expect(retrieved!.aiStatus).toBeUndefined();
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

describe("Dexie v6 migration", () => {
  it("has 13 tables including notePages after v13 migration", () => {
    const tableNames = db.tables.map((t) => t.name).sort();
    expect(tableNames).toContain("exportHistory");
    expect(tableNames).toContain("idMapping");
    expect(tableNames).toContain("writeAheadQueue");
    expect(tableNames).toContain("photoUploadQueue");
    expect(tableNames).toContain("sessionAudio");
    expect(tableNames).toContain("audioUploadQueue");
    expect(tableNames).toContain("userEditedFields");
    expect(tableNames).toContain("notePages");
    expect(tableNames).toHaveLength(13);
  });

  it("notePages has pageUid, sessionId, sortOrder indexes (v13)", () => {
    const indexNames = db.table("notePages").schema.indexes.map((idx) => idx.name);
    expect(indexNames).toContain("pageUid");
    expect(indexNames).toContain("sessionId");
    expect(indexNames).toContain("sortOrder");
  });

  it("v13 preserves existing session + item data alongside the new table", async () => {
    const sessionId = await db.sessions.add({
      name: "Pre-v13 Session",
      mode: "house",
      status: "active",
      notes: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Session);
    await db.houseVisitItems.add({
      sessionId: sessionId as number,
      title: "Pre-v13 Item",
      sortOrder: 1,
      createdAt: new Date(),
    } as HouseVisitItem);

    expect((await db.sessions.get(sessionId))!.name).toBe("Pre-v13 Session");
    expect(await db.houseVisitItems.where("sessionId").equals(sessionId).count()).toBe(1);
    expect(await db.notePages.count()).toBe(0);
  });

  it("exportHistory table has sessionId and exportedAt indexes", () => {
    const table = db.table("exportHistory");
    const indexNames = table.schema.indexes.map((idx) => idx.name);
    expect(indexNames).toContain("sessionId");
    expect(indexNames).toContain("exportedAt");
  });

  it("can create and read an ExportHistoryRecord", async () => {
    const id = await db.exportHistory.add({
      sessionId: 1,
      sessionName: "Test Session",
      sessionMode: "house",
      itemCount: 5,
      exportedAt: new Date(),
    });
    const record = await db.exportHistory.get(id);
    expect(record).toBeDefined();
    expect(record!.sessionName).toBe("Test Session");
    expect(record!.itemCount).toBe(5);
  });

  it("can create and read a SessionAudio master blob", async () => {
    const now = new Date();
    const record: SessionAudio = {
      sessionId: "session-uuid-1",
      blob: new Blob(["audio"], { type: "audio/webm" }),
      mimeType: "audio/webm",
      durationMs: 15000,
      createdAt: now,
      updatedAt: now,
    };

    await db.sessionAudio.put(record);
    const retrieved = await db.sessionAudio.get(record.sessionId);

    expect(retrieved).toBeDefined();
    expect(retrieved!.sessionId).toBe(record.sessionId);
    expect(retrieved!.durationMs).toBe(15000);
    expect(retrieved!.mimeType).toBe("audio/webm");
  });

  it("Session records have archivedAt as optional (undefined by default)", async () => {
    const sessionId = await db.sessions.add({
      name: "Archive Test",
      mode: "house",
      status: "active",
      notes: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Session);
    const session = await db.sessions.get(sessionId);
    expect(session).toBeDefined();
    expect(session!.archivedAt).toBeUndefined();
  });
});
