import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "../lib/supabase";
import type { Tables } from "../db/database.types";

type SupabaseSession = Tables<"sessions">;
type SupabaseItem = Tables<"items">;

interface SessionState {
  sessions: SupabaseSession[];
  itemsBySession: Record<string, SupabaseItem[]>;
  loading: boolean;
  lastFetched: number | null;

  fetchSessions: () => Promise<void>;
  fetchItems: (sessionId: string) => Promise<void>;
  createSession: (
    data: { name: string; mode: string; notes?: string },
    userId: string,
  ) => Promise<string>;
  updateSession: (
    id: string,
    changes: Partial<SupabaseSession>,
  ) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  createItem: (
    sessionId: string,
    mode: string,
    receiptNumber?: string,
  ) => Promise<string>;
  updateItemField: (
    itemId: string,
    sessionId: string,
    field: string,
    value: string | null,
  ) => Promise<void>;
  deleteItem: (itemId: string, sessionId: string) => Promise<void>;
  appendToItemField: (
    itemId: string,
    sessionId: string,
    field: string,
    newContent: string,
  ) => Promise<void>;

  _setItems: (sessionId: string, items: SupabaseItem[]) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessions: [],
      itemsBySession: {},
      loading: false,
      lastFetched: null,

      fetchSessions: async () => {
        set({ loading: true });
        const { data, error } = await supabase
          .from("sessions")
          .select("*")
          .order("updated_at", { ascending: false });

        if (error) {
          set({ loading: false });
          return;
        }

        set({
          sessions: data ?? [],
          loading: false,
          lastFetched: Date.now(),
        });
      },

      fetchItems: async (sessionId: string) => {
        const { data, error } = await supabase
          .from("items")
          .select("*")
          .eq("session_id", sessionId)
          .order("sort_order", { ascending: true });

        if (error) return;

        set((state) => ({
          itemsBySession: {
            ...state.itemsBySession,
            [sessionId]: data ?? [],
          },
        }));
      },

      createSession: async (data, userId) => {
        const tempId = crypto.randomUUID();
        const now = new Date().toISOString();

        // Optimistic add
        const tempSession: SupabaseSession = {
          id: tempId,
          name: data.name,
          mode: data.mode,
          notes: data.notes ?? "",
          status: "active",
          created_by: userId,
          created_at: now,
          updated_at: now,
          assigned_to: null,
          review_notes: null,
        };

        set((state) => ({
          sessions: [tempSession, ...state.sessions],
        }));

        const { data: newSession, error } = await supabase
          .from("sessions")
          .insert({
            name: data.name,
            mode: data.mode,
            notes: data.notes ?? "",
            created_by: userId,
          })
          .select()
          .single();

        if (error || !newSession) {
          // Revert optimistic add
          set((state) => ({
            sessions: state.sessions.filter((s) => s.id !== tempId),
          }));
          throw error ?? new Error("Failed to create session");
        }

        // Replace temp entry with real data
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === tempId ? newSession : s,
          ),
        }));

        return newSession.id;
      },

      updateSession: async (id, changes) => {
        const { sessions } = get();
        const original = sessions.find((s) => s.id === id);
        if (!original) return;

        const updatedAt = new Date().toISOString();

        // Optimistic update
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, ...changes, updated_at: updatedAt } : s,
          ),
        }));

        const { error } = await supabase
          .from("sessions")
          .update({ ...changes, updated_at: updatedAt })
          .eq("id", id);

        if (error) {
          // Revert to original
          set((state) => ({
            sessions: state.sessions.map((s) =>
              s.id === id ? original : s,
            ),
          }));
        }
      },

      deleteSession: async (id) => {
        const { sessions, itemsBySession } = get();
        const originalSessions = sessions;
        const originalItems = itemsBySession[id];

        // Optimistic delete
        set((state) => {
          const newItemsBySession = { ...state.itemsBySession };
          delete newItemsBySession[id];
          return {
            sessions: state.sessions.filter((s) => s.id !== id),
            itemsBySession: newItemsBySession,
          };
        });

        const { error } = await supabase
          .from("sessions")
          .delete()
          .eq("id", id);

        if (error) {
          // Revert
          set({
            sessions: originalSessions,
            itemsBySession: {
              ...get().itemsBySession,
              ...(originalItems !== undefined ? { [id]: originalItems } : {}),
            },
          });
        }
      },

      createItem: async (sessionId, mode, receiptNumber?) => {
        const { itemsBySession } = get();
        const existingItems = itemsBySession[sessionId] ?? [];
        const nextSortOrder = existingItems.length > 0
          ? Math.max(...existingItems.map((i) => i.sort_order)) + 1
          : 0;

        const { data: newItem, error } = await supabase
          .from("items")
          .insert({
            session_id: sessionId,
            mode,
            sort_order: nextSortOrder,
            receipt_number: receiptNumber ?? null,
          })
          .select()
          .single();

        if (error || !newItem) {
          throw error ?? new Error("Failed to create item");
        }

        set((state) => ({
          itemsBySession: {
            ...state.itemsBySession,
            [sessionId]: [...(state.itemsBySession[sessionId] ?? []), newItem],
          },
        }));

        return newItem.id;
      },

      updateItemField: async (itemId, sessionId, field, value) => {
        const { itemsBySession } = get();
        const items = itemsBySession[sessionId] ?? [];
        const originalItem = items.find((i) => i.id === itemId);
        if (!originalItem) return;

        // Optimistic update
        set((state) => ({
          itemsBySession: {
            ...state.itemsBySession,
            [sessionId]: (state.itemsBySession[sessionId] ?? []).map((i) =>
              i.id === itemId ? { ...i, [field]: value } : i,
            ),
          },
        }));

        const { error } = await supabase
          .from("items")
          .update({ [field]: value })
          .eq("id", itemId);

        if (error) {
          // Revert
          set((state) => ({
            itemsBySession: {
              ...state.itemsBySession,
              [sessionId]: (state.itemsBySession[sessionId] ?? []).map((i) =>
                i.id === itemId ? originalItem : i,
              ),
            },
          }));
        }
      },

      deleteItem: async (itemId, sessionId) => {
        const { itemsBySession } = get();
        const originalItems = itemsBySession[sessionId] ?? [];

        // Optimistic delete
        set((state) => ({
          itemsBySession: {
            ...state.itemsBySession,
            [sessionId]: (state.itemsBySession[sessionId] ?? []).filter(
              (i) => i.id !== itemId,
            ),
          },
        }));

        const { error } = await supabase
          .from("items")
          .delete()
          .eq("id", itemId);

        if (error) {
          // Revert
          set((state) => ({
            itemsBySession: {
              ...state.itemsBySession,
              [sessionId]: originalItems,
            },
          }));
        }
      },

      appendToItemField: async (itemId, sessionId, field, newContent) => {
        const { itemsBySession } = get();
        const items = itemsBySession[sessionId] ?? [];
        const item = items.find((i) => i.id === itemId);
        if (!item) return;

        const existingValue = item[field as keyof SupabaseItem] as
          | string
          | null;
        const combined = existingValue
          ? existingValue + "\n" + newContent
          : newContent;

        await get().updateItemField(itemId, sessionId, field, combined);
      },

      _setItems: (sessionId, items) => {
        set((state) => ({
          itemsBySession: {
            ...state.itemsBySession,
            [sessionId]: items,
          },
        }));
      },
    }),
    {
      name: "tpc-sessions",
      partialize: (state) => ({
        sessions: state.sessions,
        itemsBySession: state.itemsBySession,
        lastFetched: state.lastFetched,
      }),
    },
  ),
);

/**
 * Scope the sessionStore persist key to a specific user.
 * Call this after login to isolate data per user.
 */
export function scopeSessionStore(userId: string) {
  useSessionStore.persist.setOptions({ name: `tpc-sessions-${userId}` });
  useSessionStore.persist.rehydrate();
}
