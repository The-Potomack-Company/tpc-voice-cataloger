import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";

export function useActiveSessions() {
  return useLiveQuery(
    () =>
      db.sessions
        .where("status")
        .equals("active")
        .filter((s) => !s.deletedAt)
        .reverse()
        .sortBy("updatedAt"),
    [],
    [],
  );
}

export function useCompletedSessions() {
  return useLiveQuery(
    () =>
      db.sessions
        .where("status")
        .equals("completed")
        .filter((s) => !s.deletedAt)
        .reverse()
        .sortBy("updatedAt"),
    [],
    [],
  );
}

export function useDeletedSessions() {
  return useLiveQuery(
    () =>
      db.sessions
        .filter((s) => s.deletedAt !== undefined)
        .reverse()
        .sortBy("deletedAt"),
    [],
    [],
  );
}

export function useSession(id: number) {
  return useLiveQuery(() => db.sessions.get(id), [id]);
}

export function useSessionItemCount(sessionId: number) {
  return useLiveQuery(
    async () => {
      const session = await db.sessions.get(sessionId);
      if (!session) return 0;
      if (session.mode === "house") {
        return db.houseVisitItems.where("sessionId").equals(sessionId).count();
      }
      return db.saleItems.where("sessionId").equals(sessionId).count();
    },
    [sessionId],
    0,
  );
}
