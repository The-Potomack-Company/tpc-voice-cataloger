import { useSessionStore } from "../stores/sessionStore";
import type { Tables } from "../db/database.types";

export function useActiveSessions() {
  return useSessionStore((s) =>
    s.sessions.filter((sess) => sess.status === "active"),
  );
}

export function useCompletedSessions() {
  return useSessionStore((s) =>
    s.sessions.filter(
      (sess) =>
        sess.status === "completed" ||
        sess.status === "submitted" ||
        sess.status === "returned" ||
        sess.status === "exported",
    ),
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

export function useSessionItemCount(sessionId: string) {
  return useSessionStore(
    (s) => (s.itemsBySession[sessionId] ?? []).length,
  );
}
