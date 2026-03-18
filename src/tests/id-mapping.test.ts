import { describe, it, expect, afterEach } from "vitest";
import { db } from "../db";
import type { IdMapping, WriteAheadEntry } from "../db/types";
import {
  getDexieItemId,
  getDexieSessionId,
  addIdMapping,
} from "../db/idMapping";

afterEach(async () => {
  await db.delete();
  await db.open();
});

describe("Dexie v7 schema", () => {
  it("has idMapping table", () => {
    const tableNames = db.tables.map((t) => t.name);
    expect(tableNames).toContain("idMapping");
  });

  it("has writeAheadQueue table", () => {
    const tableNames = db.tables.map((t) => t.name);
    expect(tableNames).toContain("writeAheadQueue");
  });

  it("idMapping table accepts {oldId, newId, type} records", async () => {
    const id = await db.idMapping.add({
      oldId: 1,
      newId: "uuid-abc",
      type: "session",
    });
    const record = await db.idMapping.get(id);
    expect(record).toBeDefined();
    expect(record!.oldId).toBe(1);
    expect(record!.newId).toBe("uuid-abc");
    expect(record!.type).toBe("session");
  });

  it("writeAheadQueue table accepts {table, operation, payload, createdAt} records", async () => {
    const now = new Date();
    const id = await db.writeAheadQueue.add({
      table: "sessions",
      operation: "insert",
      payload: { name: "Test" },
      createdAt: now,
    });
    const record = await db.writeAheadQueue.get(id);
    expect(record).toBeDefined();
    expect(record!.table).toBe("sessions");
    expect(record!.operation).toBe("insert");
    expect(record!.payload).toEqual({ name: "Test" });
  });

  it("idMapping table has indexes on oldId, newId, and type", () => {
    const table = db.table("idMapping");
    const indexNames = table.schema.indexes.map((idx) => idx.name);
    expect(indexNames).toContain("oldId");
    expect(indexNames).toContain("newId");
    expect(indexNames).toContain("type");
  });

  it("writeAheadQueue table has index on createdAt", () => {
    const table = db.table("writeAheadQueue");
    const indexNames = table.schema.indexes.map((idx) => idx.name);
    expect(indexNames).toContain("createdAt");
  });
});

describe("ID mapping utilities", () => {
  it("getDexieItemId returns null when no mapping exists", async () => {
    const result = await getDexieItemId("some-uuid");
    expect(result).toBeNull();
  });

  it("addIdMapping + getDexieItemId returns correct oldId", async () => {
    await addIdMapping({ oldId: 5, newId: "uuid-abc", type: "item" });
    const result = await getDexieItemId("uuid-abc");
    expect(result).toBe(5);
  });

  it("getDexieSessionId returns null when no mapping exists", async () => {
    const result = await getDexieSessionId("session-uuid");
    expect(result).toBeNull();
  });

  it("getDexieSessionId returns oldId when mapping exists", async () => {
    await addIdMapping({ oldId: 10, newId: "session-uuid", type: "session" });
    const result = await getDexieSessionId("session-uuid");
    expect(result).toBe(10);
  });

  it("getDexieItemId does not return session mappings", async () => {
    await addIdMapping({ oldId: 7, newId: "shared-uuid", type: "session" });
    const result = await getDexieItemId("shared-uuid");
    expect(result).toBeNull();
  });

  it("getDexieSessionId does not return item mappings", async () => {
    await addIdMapping({ oldId: 7, newId: "shared-uuid", type: "item" });
    const result = await getDexieSessionId("shared-uuid");
    expect(result).toBeNull();
  });
});
