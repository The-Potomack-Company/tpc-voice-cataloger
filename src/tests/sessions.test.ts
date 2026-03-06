import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../db";
import type { Session } from "../db/types";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("Session CRUD operations", () => {
  it("createSession returns numeric ID and session has correct defaults", async () => {
    const { createSession } = await import("../db/sessions");
    const id = await createSession("House Visit 1", "house");

    expect(typeof id).toBe("number");
    const session = await db.sessions.get(id);
    expect(session).toBeDefined();
    expect(session!.name).toBe("House Visit 1");
    expect(session!.mode).toBe("house");
    expect(session!.status).toBe("active");
    expect(session!.notes).toBe("");
    expect(session!.deletedAt).toBeUndefined();
    expect(session!.createdAt).toBeInstanceOf(Date);
    expect(session!.updatedAt).toBeInstanceOf(Date);
  });

  it("createSession accepts optional notes", async () => {
    const { createSession } = await import("../db/sessions");
    const id = await createSession("Sale 1", "sale", "Some notes");

    const session = await db.sessions.get(id);
    expect(session!.notes).toBe("Some notes");
  });

  it("updateSession changes name and bumps updatedAt", async () => {
    const { createSession, updateSession } = await import("../db/sessions");
    const id = await createSession("Original", "house");
    const original = await db.sessions.get(id);
    const originalUpdatedAt = original!.updatedAt.getTime();

    // Small delay to ensure updatedAt differs
    await new Promise((r) => setTimeout(r, 10));
    await updateSession(id, { name: "Renamed" });

    const updated = await db.sessions.get(id);
    expect(updated!.name).toBe("Renamed");
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt);
  });

  it("softDeleteSession sets deletedAt to a Date", async () => {
    const { createSession, softDeleteSession } = await import("../db/sessions");
    const id = await createSession("To Delete", "house");
    await softDeleteSession(id);

    const session = await db.sessions.get(id);
    expect(session!.deletedAt).toBeInstanceOf(Date);
  });

  it("softDeleteSession excludes session from active queries", async () => {
    const { createSession, softDeleteSession } = await import("../db/sessions");
    const id1 = await createSession("Keep", "house");
    const id2 = await createSession("Delete", "house");
    await softDeleteSession(id2);

    // Query active sessions (status=active, no deletedAt)
    const active = await db.sessions
      .where("status")
      .equals("active")
      .filter((s) => !s.deletedAt)
      .toArray();

    expect(active.length).toBe(1);
    expect(active[0].id).toBe(id1);
  });

  it("restoreSession clears deletedAt and session reappears", async () => {
    const { createSession, softDeleteSession, restoreSession } = await import("../db/sessions");
    const id = await createSession("Restore Me", "sale");
    await softDeleteSession(id);

    let session = await db.sessions.get(id);
    expect(session!.deletedAt).toBeInstanceOf(Date);

    await restoreSession(id);
    session = await db.sessions.get(id);
    expect(session!.deletedAt).toBeUndefined();

    // Should appear in active queries again
    const active = await db.sessions
      .where("status")
      .equals("active")
      .filter((s) => !s.deletedAt)
      .toArray();
    expect(active.some((s) => s.id === id)).toBe(true);
  });

  it("permanentlyDeleteSession removes session and cascades to related items/audio/photos", async () => {
    const { createSession, permanentlyDeleteSession } = await import("../db/sessions");
    const id = await createSession("Permanent Delete", "house");

    // Add related items
    await db.houseVisitItems.add({
      sessionId: id,
      title: "Item 1",
      sortOrder: 1,
      createdAt: new Date(),
    });
    const itemId = await db.houseVisitItems.add({
      sessionId: id,
      title: "Item 2",
      sortOrder: 2,
      createdAt: new Date(),
    });

    // Add photo and audio linked to item
    await db.photos.add({
      itemId: itemId as number,
      itemType: "house",
      blob: new Blob(["photo"]),
      sortOrder: 1,
      createdAt: new Date(),
    });
    await db.audio.add({
      itemId: itemId as number,
      itemType: "house",
      blob: new Blob(["audio"]),
      mimeType: "audio/webm",
      createdAt: new Date(),
    });

    await permanentlyDeleteSession(id);

    expect(await db.sessions.get(id)).toBeUndefined();
    expect(await db.houseVisitItems.where("sessionId").equals(id).count()).toBe(0);
    expect(await db.photos.where("itemId").equals(itemId as number).count()).toBe(0);
    expect(await db.audio.where("itemId").equals(itemId as number).count()).toBe(0);
  });
});

describe("Schema v2 migration", () => {
  it("v2 migration sets status=active and notes='' on existing records", async () => {
    // Insert a v1-style record directly (missing status and notes)
    const id = await db.sessions.add({
      name: "Legacy Session",
      mode: "house",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Session);

    const session = await db.sessions.get(id);
    // After migration, existing records should have defaults
    // Since we're on v2 already, the upgrade function should have applied
    expect(session!.status).toBe("active");
    expect(session!.notes).toBe("");
  });
});

describe("useActiveSessions hook filtering", () => {
  it("excludes soft-deleted and completed sessions from active query", async () => {
    const { createSession, softDeleteSession, updateSession } = await import("../db/sessions");

    const activeId = await createSession("Active", "house");
    const deletedId = await createSession("Deleted", "house");
    const completedId = await createSession("Completed", "sale");

    await softDeleteSession(deletedId);
    await updateSession(completedId, { status: "completed" });

    // Simulate what useActiveSessions would query
    const active = await db.sessions
      .where("status")
      .equals("active")
      .filter((s) => !s.deletedAt)
      .toArray();

    expect(active.length).toBe(1);
    expect(active[0].id).toBe(activeId);
  });
});
