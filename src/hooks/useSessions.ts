import { useMemo } from "react";
import { useSessionStore } from "../stores/sessionStore";
import type { Tables } from "../db/database.types";

export function useActiveSessions() {
  const sessions = useSessionStore((s) => s.sessions);
  return useMemo(
    () => sessions.filter((sess) => sess.status === "active"),
    [sessions],
  );
}

export function useCompletedSessions() {
  const sessions = useSessionStore((s) => s.sessions);
  return useMemo(
    () =>
      sessions.filter(
        (sess) =>
          sess.status === "completed" ||
          sess.status === "submitted" ||
          sess.status === "returned" ||
          sess.status === "exported",
      ),
    [sessions],
  );
}

export function useDeletedSessions() {
  // No soft-delete in Supabase schema -- return empty array
  // Postgres hard-deletes sessions; no recovery
  return [] as Tables<"sessions">[];
}

export function useArchivedSessions() {
  // No archive concept in Supabase schema -- return empty array
  return [] as Tables<"sessions">[];
}

export function useSession(id: string) {
  return useSessionStore((s) => s.sessions.find((sess) => sess.id === id));
}

const EMPTY_ITEMS: Tables<"items">[] = [];

export function useSessionItems(sessionId: string) {
  return useSessionStore(
    (s) => s.itemsBySession[sessionId] ?? EMPTY_ITEMS,
  );
}

export function useSessionItemCount(sessionId: string) {
  return useSessionStore(
    (s) => (s.itemsBySession[sessionId] ?? EMPTY_ITEMS).length,
  );
}
