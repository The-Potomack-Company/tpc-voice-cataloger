import { useMemo, useState, useEffect } from "react";
import { useSessionStore } from "../stores/sessionStore";
import { useAuthStore } from "../stores/authStore";
import { listAccounts } from "../services/adminApi";
import { filterDevSessions } from "../constants/devUsers";
import type { Tables } from "../db/database.types";

/**
 * Returns the sessions list with dev-user (Josh) cross-user data filtered
 * out. The viewer still sees their OWN sessions even if the viewer is a
 * dev user. Behavior change: only sessions owned/assigned to a dev user
 * OTHER than the current viewer are excluded.
 */
function useScopedSessions(): Tables<"sessions">[] {
  const sessions = useSessionStore((s) => s.sessions);
  const viewerId = useAuthStore((s) => s.user?.id ?? null);
  return useMemo(
    () => filterDevSessions(sessions, viewerId),
    [sessions, viewerId],
  );
}

export function useActiveSessions() {
  const sessions = useScopedSessions();
  return useMemo(
    () => sessions.filter((sess) => sess.status === "active"),
    [sessions],
  );
}

export function useSubmittedSessions() {
  const sessions = useScopedSessions();
  return useMemo(
    () => sessions.filter((sess) => sess.status === "submitted"),
    [sessions],
  );
}

export function useReturnedSessions() {
  const sessions = useScopedSessions();
  return useMemo(
    () => sessions.filter((sess) => sess.status === "returned"),
    [sessions],
  );
}

export function useExportedSessions() {
  const sessions = useScopedSessions();
  return useMemo(
    () => sessions.filter((sess) => sess.status === "exported"),
    [sessions],
  );
}

export function useDeletedSessions() {
  // No soft-delete in Supabase schema -- return empty array
  // Postgres hard-deletes sessions; no recovery
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

export function useNameMap() {
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    listAccounts()
      .then((accounts) => {
        setNameMap(new Map(accounts.map((a) => [a.id, a.display_name])));
      })
      .catch(() => {
        /* silent fail -- UUIDs shown instead of names */
      });
  }, []);
  return nameMap;
}
