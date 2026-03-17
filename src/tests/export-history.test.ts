import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "../db";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("Export history recording", () => {
  it("exportSession creates a history record in db.exportHistory", async () => {
    const { exportSession } = await import("../utils/export");
    const sessionId = (await db.sessions.add({
      name: "History Test",
      mode: "house" as const,
      status: "active" as const,
      notes: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as number;

    // Mock anchor click to prevent actual download
    const fakeAnchor = { href: "", download: "", click: vi.fn(), style: {}, setAttribute: vi.fn() } as unknown as HTMLAnchorElement;
    const spy = vi.spyOn(document, "createElement").mockReturnValue(fakeAnchor);

    await exportSession(sessionId);
    spy.mockRestore();

    const records = await db.exportHistory.where("sessionId").equals(sessionId).toArray();
    expect(records).toHaveLength(1);
    expect(records[0].sessionName).toBe("History Test");
    expect(records[0].sessionMode).toBe("house");
    expect(records[0].exportedAt).toBeInstanceOf(Date);
  });

  it("re-export increments version in filename (second export gets -v2)", async () => {
    const { exportSession } = await import("../utils/export");
    const sessionId = (await db.sessions.add({
      name: "Version Test",
      mode: "house" as const,
      status: "active" as const,
      notes: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as number;

    const downloads: string[] = [];
    const fakeAnchor = { href: "", download: "", click: vi.fn(), style: {}, setAttribute: vi.fn() };
    const spy = vi.spyOn(document, "createElement").mockReturnValue(fakeAnchor as unknown as HTMLAnchorElement);

    // First export
    await exportSession(sessionId);
    downloads.push(fakeAnchor.download);

    // Second export (re-export)
    await exportSession(sessionId);
    downloads.push(fakeAnchor.download);

    spy.mockRestore();

    expect(downloads[0]).toBe("Version Test.json");
    expect(downloads[1]).toBe("Version Test-v2.json");
  });
});
