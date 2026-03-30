import { useSessionStore } from "../stores/sessionStore";
import { useAuthStore } from "../stores/authStore";
import type { Tables } from "./database.types";

type SupabaseSession = Tables<"sessions">;

export async function createSession(
  name: string,
  mode: "house" | "sale",
  notes?: string,
  assignedTo?: string,
): Promise<string> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) throw new Error("Not authenticated");
  const effectiveAssignedTo = assignedTo ?? userId;
  return useSessionStore
    .getState()
    .createSession({ name, mode, notes, assigned_to: effectiveAssignedTo }, userId);
}

export async function updateSession(
  id: string,
  changes: Partial<Pick<SupabaseSession, "name" | "notes" | "status">>,
): Promise<void> {
  await useSessionStore.getState().updateSession(id, changes);
}

export async function deleteSession(id: string): Promise<void> {
  await useSessionStore.getState().deleteSession(id);
}

export function getSessionById(
  id: string,
): SupabaseSession | undefined {
  return useSessionStore.getState().sessions.find((s) => s.id === id);
}
