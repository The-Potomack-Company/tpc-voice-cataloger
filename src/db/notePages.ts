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
  const sortOrder = await countNotePages(input.sessionId);
  const id = await db.notePages.add({
    pageUid: crypto.randomUUID(),
    sessionId: input.sessionId,
    blob: input.blob,
    thumbnail: input.thumbnail,
    sortOrder,
    status: "captured",
    createdAt: new Date().toISOString(),
  });
  return id as number;
}

/** Replace the image of a page in place — pageUid, sessionId and sortOrder unchanged. */
export async function retakeNotePage(
  id: number,
  input: { blob: Blob; thumbnail: Blob },
): Promise<void> {
  await db.notePages.update(id, { blob: input.blob, thumbnail: input.thumbnail });
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
