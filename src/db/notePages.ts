import { db } from "./index";
import type { NotePage } from "./types";

/**
 * Client-only (Dexie) data access for v1.4 Photo Notes capture pages (Phase 46).
 * No Supabase writes — durable storage is the Phase 47 / R-4 decision.
 */

export async function getNotePages(sessionId: string): Promise<NotePage[]> {
  return db.notePages.where("sessionId").equals(sessionId).sortBy("sortOrder");
}

export async function countNotePages(sessionId: string): Promise<number> {
  return db.notePages.where("sessionId").equals(sessionId).count();
}

export async function addNotePage(input: {
  sessionId: string;
  blob: Blob;
  thumbnail: Blob;
}): Promise<number> {
  const contentHash = await notePageContentHash(input.blob);
  // Allocate max(sortOrder)+1, not count: a middle delete leaves gaps, so count
  // could collide with an existing sortOrder and make processing order ambiguous.
  // Read-allocate-write in one transaction to avoid a concurrent-capture race.
  return db.transaction("rw", db.notePages, async () => {
    const existing = await db.notePages
      .where("sessionId")
      .equals(input.sessionId)
      .toArray();
    const sortOrder = existing.reduce((max, p) => Math.max(max, p.sortOrder + 1), 0);
    const id = await db.notePages.add({
      pageUid: crypto.randomUUID(),
      sessionId: input.sessionId,
      blob: input.blob,
      thumbnail: input.thumbnail,
      contentHash,
      sortOrder,
      status: "captured",
      createdAt: new Date().toISOString(),
    });
    return id as number;
  });
}

/** Replace the image of a page in place — pageUid, sessionId and sortOrder unchanged. */
export async function retakeNotePage(
  id: number,
  input: { blob: Blob; thumbnail: Blob },
): Promise<void> {
  const [existing, contentHash] = await Promise.all([
    db.notePages.get(id),
    notePageContentHash(input.blob),
  ]);
  const alreadyProcessed = existing?.processedContentHash === contentHash;
  await db.notePages.update(id, {
    blob: input.blob,
    thumbnail: input.thumbnail,
    contentHash,
    processedContentHash: alreadyProcessed ? contentHash : undefined,
    processedAt: alreadyProcessed ? existing?.processedAt : undefined,
    status: alreadyProcessed ? "processed" : "captured",
  });
}

export async function deleteNotePage(id: number): Promise<void> {
  await db.notePages.delete(id);
}

/** Rewrite sortOrder to match the given id order (0..N-1) atomically. */
export async function reorderNotePages(orderedIds: number[]): Promise<void> {
  await db.transaction("rw", db.notePages, async () => {
    await Promise.all(
      orderedIds.map((id, index) => db.notePages.update(id, { sortOrder: index })),
    );
  });
}

/** Sweep all pages for a deleted session; leaves other sessions' pages intact. */
export async function deleteNotePagesForSession(sessionId: string): Promise<void> {
  await db.notePages.where("sessionId").equals(sessionId).delete();
}

export async function markNotePagesStatus(
  ids: number[],
  status: NotePage["status"],
): Promise<void> {
  await db.transaction("rw", db.notePages, async () => {
    await Promise.all(ids.map((id) => db.notePages.update(id, { status })));
  });
}

export async function notePageContentHash(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function notePageContentKey(hash: string): string {
  return `sha256:${hash}`;
}

export function isNotePageProcessed(page: NotePage): boolean {
  return (
    page.status === "processed" &&
    page.contentHash !== undefined &&
    page.processedContentHash === page.contentHash
  );
}

export async function ensureNotePageContentHashes(pages: NotePage[]): Promise<NotePage[]> {
  return Promise.all(
    pages.map(async (page) => {
      if (page.contentHash) return page;
      const contentHash = await notePageContentHash(page.blob);
      if (page.id !== undefined) {
        await db.notePages.update(page.id, { contentHash });
      }
      return { ...page, contentHash };
    }),
  );
}

export async function markNotePageProcessed(id: number, contentHash: string): Promise<void> {
  await db.notePages.update(id, {
    status: "processed",
    processedContentHash: contentHash,
    processedAt: new Date().toISOString(),
  });
}
