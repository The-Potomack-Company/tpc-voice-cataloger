import { useLiveQuery } from "dexie-react-hooks";
import { getNotePages, countNotePages } from "../db/notePages";
import type { NotePage } from "../db/types";

/** Ordered note pages for a session (live). Empty array until loaded. */
export function useNotePages(sessionId: string | undefined): NotePage[] {
  return useLiveQuery(
    () => (sessionId ? getNotePages(sessionId) : Promise.resolve([])),
    [sessionId],
    [] as NotePage[],
  );
}

/** Captured-but-unprocessed page count for the session badge. 0 until loaded. */
export function useNotePageCount(sessionId: string | undefined): number {
  return useLiveQuery(
    () => (sessionId ? countNotePages(sessionId) : Promise.resolve(0)),
    [sessionId],
    0,
  );
}
