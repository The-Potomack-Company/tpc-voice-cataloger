import { describe, it, expect, afterEach } from "vitest";
import { db } from "../db";
import {
  addNotePage,
  getNotePages,
  countNotePages,
  reorderNotePages,
  retakeNotePage,
  deleteNotePage,
  deleteNotePagesForSession,
} from "../db/notePages";

afterEach(async () => {
  await db.delete();
  await db.open();
});

function jpeg(tag: string): Blob {
  return new Blob([tag], { type: "image/jpeg" });
}

async function capture(sessionId: string, tag: string): Promise<number> {
  return addNotePage({ sessionId, blob: jpeg(`full-${tag}`), thumbnail: jpeg(`thumb-${tag}`) });
}

describe("notePages table (v13)", () => {
  it("opens with the notePages table and its indexes", () => {
    expect(db.tables.map((t) => t.name)).toContain("notePages");
    const indexes = db.table("notePages").schema.indexes.map((i) => i.name);
    expect(indexes).toContain("pageUid");
    expect(indexes).toContain("sessionId");
    expect(indexes).toContain("sortOrder");
  });
});

describe("notePages CRUD + ordering", () => {
  it("captures pages in order with sortOrder 0,1,2 and unique pageUids (UAT-2)", async () => {
    await capture("S1", "a");
    await capture("S1", "b");
    await capture("S1", "c");

    const pages = await getNotePages("S1");
    expect(pages.map((p) => p.sortOrder)).toEqual([0, 1, 2]);
    expect(pages.every((p) => p.status === "captured")).toBe(true);
    const uids = new Set(pages.map((p) => p.pageUid));
    expect(uids.size).toBe(3);
    expect(await countNotePages("S1")).toBe(3);
  });

  it("reorders and persists the new order across a re-read (UAT-3)", async () => {
    const id0 = await capture("S1", "a");
    const id1 = await capture("S1", "b");
    const id2 = await capture("S1", "c");

    // Move page 3 (id2) to the front: [id2, id0, id1]
    await reorderNotePages([id2, id0, id1]);

    const pages = await getNotePages("S1");
    expect(pages.map((p) => p.id)).toEqual([id2, id0, id1]);
    expect(pages.map((p) => p.sortOrder)).toEqual([0, 1, 2]);

    // Re-read proves it is durable, not a view-only sort.
    const again = await getNotePages("S1");
    expect(again.map((p) => p.id)).toEqual([id2, id0, id1]);
  });

  it("retake replaces the image in place, keeping pageUid and sortOrder (UAT-4)", async () => {
    const id = await capture("S1", "a");
    await capture("S1", "b");
    const before = (await db.notePages.get(id))!;

    await retakeNotePage(id, {
      blob: jpeg("retaken-full"),
      thumbnail: jpeg("retaken-thumb"),
    });

    // Retake is in place: identity + position invariants hold and no row is appended.
    const after = (await db.notePages.get(id))!;
    expect(after.pageUid).toBe(before.pageUid);
    expect(after.sortOrder).toBe(before.sortOrder);
    expect(after.blob).toBeDefined();
    expect(await countNotePages("S1")).toBe(2);
    expect((await getNotePages("S1")).map((p) => p.id)).toEqual([id, expect.any(Number)]);
  });

  it("deleteNotePage removes exactly one row (UAT-4)", async () => {
    const id0 = await capture("S1", "a");
    const id1 = await capture("S1", "b");

    await deleteNotePage(id0);

    const pages = await getNotePages("S1");
    expect(pages.map((p) => p.id)).toEqual([id1]);
  });
});

describe("deleteNotePagesForSession (cleanup sweep)", () => {
  it("sweeps only the target session's pages (SPEC Cleanup)", async () => {
    await capture("A", "a1");
    await capture("A", "a2");
    await capture("B", "b1");

    await deleteNotePagesForSession("A");

    expect(await countNotePages("A")).toBe(0);
    expect((await getNotePages("B")).map((p) => p.sortOrder)).toEqual([0]);
  });
});
