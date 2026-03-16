import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "../db";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("blobToBase64", () => {
  it("converts a Blob to a data URL string", async () => {
    const { blobToBase64 } = await import("../utils/export");
    const blob = new Blob(["hello"], { type: "text/plain" });
    const result = await blobToBase64(blob);
    expect(result).toMatch(/^data:text\/plain;base64,/);
  });
});

describe("buildExportData", () => {
  it("returns valid ExportSchema with version=1", async () => {
    const { buildExportData } = await import("../utils/export");
    const sessionId = (await db.sessions.add({
      name: "Test Session",
      mode: "house" as const,
      status: "active" as const,
      notes: "Some notes",
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as number;

    const data = await buildExportData(sessionId);
    expect(data.version).toBe(1);
    expect(data.exportedAt).toBeTruthy();
    expect(new Date(data.exportedAt).toISOString()).toBe(data.exportedAt);
  });

  it("includes session data without id field", async () => {
    const { buildExportData } = await import("../utils/export");
    const sessionId = (await db.sessions.add({
      name: "Export Test",
      mode: "house" as const,
      status: "completed" as const,
      notes: "Notes here",
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as number;

    const data = await buildExportData(sessionId);
    expect(data.session.name).toBe("Export Test");
    expect(data.session.mode).toBe("house");
    expect(data.session.notes).toBe("Notes here");
    expect((data.session as Record<string, unknown>).id).toBeUndefined();
  });

  it("excludes deletedAt from session", async () => {
    const { buildExportData } = await import("../utils/export");
    const sessionId = (await db.sessions.add({
      name: "Deleted Session",
      mode: "house" as const,
      status: "active" as const,
      notes: "",
      deletedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as number;

    const data = await buildExportData(sessionId);
    expect(
      (data.session as Record<string, unknown>).deletedAt,
    ).toBeUndefined();
  });

  it("includes all items sorted by sortOrder", async () => {
    const { buildExportData } = await import("../utils/export");
    const sessionId = (await db.sessions.add({
      name: "Multi Item",
      mode: "house" as const,
      status: "active" as const,
      notes: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as number;

    await db.houseVisitItems.add({
      sessionId,
      title: "Second",
      sortOrder: 1,
      createdAt: new Date(),
    });
    await db.houseVisitItems.add({
      sessionId,
      title: "First",
      sortOrder: 0,
      createdAt: new Date(),
    });

    const data = await buildExportData(sessionId);
    expect(data.items).toHaveLength(2);
    expect(data.items[0].title).toBe("First");
    expect(data.items[1].title).toBe("Second");
  });

  it("includes photos converted to base64 for each item", async () => {
    const { buildExportData } = await import("../utils/export");
    const sessionId = (await db.sessions.add({
      name: "Photo Test",
      mode: "house" as const,
      status: "active" as const,
      notes: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as number;

    const itemId = (await db.houseVisitItems.add({
      sessionId,
      title: "With Photo",
      sortOrder: 0,
      createdAt: new Date(),
    })) as number;

    await db.photos.add({
      itemId,
      itemType: "house",
      blob: new Blob(["photo-data"], { type: "image/jpeg" }),
      sortOrder: 0,
      createdAt: new Date(),
    });

    const data = await buildExportData(sessionId);
    expect(data.items[0].photos).toHaveLength(1);
    expect(data.items[0].photos[0].blob).toMatch(/^data:/);
    expect(data.items[0].photos[0].sortOrder).toBe(0);
  });

  it("includes audio converted to base64 with mimeType and durationMs", async () => {
    const { buildExportData } = await import("../utils/export");
    const sessionId = (await db.sessions.add({
      name: "Audio Test",
      mode: "sale" as const,
      status: "active" as const,
      notes: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as number;

    const itemId = (await db.saleItems.add({
      sessionId,
      title: "With Audio",
      sortOrder: 0,
      createdAt: new Date(),
    })) as number;

    await db.audio.add({
      itemId,
      itemType: "sale",
      blob: new Blob(["audio-data"], { type: "audio/webm" }),
      mimeType: "audio/webm",
      durationMs: 5000,
      createdAt: new Date(),
    });

    const data = await buildExportData(sessionId);
    expect(data.items[0].audio).toHaveLength(1);
    expect(data.items[0].audio[0].blob).toMatch(/^data:/);
    expect(data.items[0].audio[0].mimeType).toBe("audio/webm");
    expect(data.items[0].audio[0].durationMs).toBe(5000);
  });

  it("includes receiptNumber for sale items", async () => {
    const { buildExportData } = await import("../utils/export");
    const sessionId = (await db.sessions.add({
      name: "Sale Export",
      mode: "sale" as const,
      status: "active" as const,
      notes: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as number;

    await db.saleItems.add({
      sessionId,
      title: "Sale Item",
      receiptNumber: "R-001",
      sortOrder: 0,
      createdAt: new Date(),
    });

    const data = await buildExportData(sessionId);
    expect(data.items[0].receiptNumber).toBe("R-001");
  });

  it("handles session with zero items", async () => {
    const { buildExportData } = await import("../utils/export");
    const sessionId = (await db.sessions.add({
      name: "Empty Session",
      mode: "house" as const,
      status: "active" as const,
      notes: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as number;

    const data = await buildExportData(sessionId);
    expect(data.items).toEqual([]);
  });

  it("throws when session not found", async () => {
    const { buildExportData } = await import("../utils/export");
    await expect(buildExportData(9999)).rejects.toThrow();
  });
});

describe("exportSession", () => {
  it("downloads JSON file via anchor click", async () => {
    const { exportSession } = await import("../utils/export");
    const sessionId = (await db.sessions.add({
      name: "Download Test",
      mode: "house" as const,
      status: "active" as const,
      notes: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as number;

    const clickMock = vi.fn();
    const fakeAnchor = {
      href: "",
      download: "",
      click: clickMock,
      style: {},
      setAttribute: vi.fn(),
    } as unknown as HTMLAnchorElement;

    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValue(fakeAnchor);

    await exportSession(sessionId);

    expect(createElementSpy).toHaveBeenCalledWith("a");
    expect(clickMock).toHaveBeenCalled();
    expect((fakeAnchor as unknown as Record<string, string>).download).toBe(
      `tpc-session-${sessionId}.json`,
    );

    createElementSpy.mockRestore();
  });
});
