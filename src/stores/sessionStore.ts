import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "../lib/supabase";
import { enqueueWrite } from "../hooks/useWriteAheadQueue";
import { trackEvent } from "../services/analytics";
import { useNotificationStore } from "./notificationStore";
import type { Tables } from "../db/database.types";

function isNetworkError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const msg = String((err as { message?: string }).message ?? "");
  return msg.includes("Failed to fetch") || msg.includes("ERR_INTERNET_DISCONNECTED") || msg.includes("NetworkError") || msg.includes("network");
}

// Debounce item.field_edited analytics events: coalesce rapid edits to the same field
// into a single event emitted 2s after the last change.
const fieldEditTimers = new Map<string, ReturnType<typeof setTimeout>>();
function scheduleFieldEditEvent(itemId: string, sessionId: string, field: string): void {
  const key = `${itemId}:${field}`;
  const existing = fieldEditTimers.get(key);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    fieldEditTimers.delete(key);
    trackEvent({
      event_type: "item.field_edited",
      session_id: sessionId,
      items_content: { item_id: itemId, field },
    });
  }, 2000);
  fieldEditTimers.set(key, t);
}

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
    data: { name: string; mode: string; notes?: string; assigned_to?: string },
    userId: string,
  ) => Promise<string>;
  updateSession: (
    id: string,
    changes: Partial<SupabaseSession>,
  ) => Promise<void>;
  deleteSession: (id: string) => Promise<boolean>;
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
          assigned_to: data.assigned_to ?? null,
          review_notes: null,
        };

        set((state) => ({
          sessions: [tempSession, ...state.sessions],
        }));

        try {
          const { data: newSession, error } = await supabase
            .from("sessions")
            .insert({
              id: tempId,
              name: data.name,
              mode: data.mode,
              notes: data.notes ?? "",
              created_by: userId,
              assigned_to: data.assigned_to ?? null,
            })
            .select()
            .single();

          if (error) throw error;
          if (!newSession) throw new Error("Failed to create session");

          // Replace temp entry with server data
          set((state) => ({
            sessions: state.sessions.map((s) =>
              s.id === tempId ? newSession : s,
            ),
          }));

          trackEvent({
            event_type: "session.created",
            session_id: newSession.id,
            items_content: { mode: data.mode, assigned: !!data.assigned_to },
          });
          return newSession.id;
        } catch (err) {
          if (isNetworkError(err)) {
            // Keep optimistic session, queue for sync
            await enqueueWrite({
              table: "sessions",
              operation: "insert",
              payload: {
                id: tempId,
                name: data.name,
                mode: data.mode,
                notes: data.notes ?? "",
                created_by: userId,
                assigned_to: data.assigned_to ?? null,
              },
            });
            trackEvent({
              event_type: "session.created",
              session_id: tempId,
              items_content: { mode: data.mode, assigned: !!data.assigned_to, offline: true },
            });
            return tempId;
          }
          // Non-network error — revert optimistic add
          set((state) => ({
            sessions: state.sessions.filter((s) => s.id !== tempId),
          }));
          trackEvent({
            event_type: "session.created.failed",
            error_message: err instanceof Error ? err.message : String(err),
            error_count: 1,
          });
          throw err;
        }
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

        try {
          const { error } = await supabase
            .from("sessions")
            .update({ ...changes, updated_at: updatedAt })
            .eq("id", id);

          if (error) throw error;

          if (changes.status && changes.status !== original.status) {
            trackEvent({
              event_type: "session.status_changed",
              session_id: id,
              items_content: { from: original.status, to: changes.status },
            });
          } else {
            trackEvent({
              event_type: "session.updated",
              session_id: id,
              items_content: { fields: Object.keys(changes) },
            });
          }
        } catch (err) {
          if (isNetworkError(err)) {
            await enqueueWrite({
              table: "sessions",
              operation: "update",
              payload: { id, ...changes, updated_at: updatedAt },
            });
            return;
          }
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

        const { data: deleted, error } = await supabase
          .from("sessions")
          .delete()
          .eq("id", id)
          .select("id");

        if (error || !deleted || deleted.length === 0) {
          // Revert
          set({
            sessions: originalSessions,
            itemsBySession: {
              ...get().itemsBySession,
              ...(originalItems !== undefined ? { [id]: originalItems } : {}),
            },
          });
          if (!error) {
            console.error("Delete blocked by RLS policy — session not deleted");
          }
          trackEvent({
            event_type: "session.deleted.failed",
            session_id: id,
            error_message: error?.message ?? "blocked_by_rls",
            error_count: 1,
          });
          return false;
        }
        trackEvent({ event_type: "session.deleted", session_id: id });
        return true;
      },

      createItem: async (sessionId, mode, receiptNumber?) => {
        const { itemsBySession } = get();
        const existingItems = itemsBySession[sessionId] ?? [];
        const nextSortOrder = existingItems.length > 0
          ? Math.max(...existingItems.map((i) => i.sort_order)) + 1
          : 0;

        const tempId = crypto.randomUUID();
        const now = new Date().toISOString();

        const tempItem = {
          id: tempId,
          session_id: sessionId,
          mode,
          sort_order: nextSortOrder,
          receipt_number: receiptNumber ?? null,
          title: null,
          description: null,
          condition: null,
          estimate: null,
          measurements: null,
          category: null,
          transcript: null,
          ai_status: "pending",
          created_at: now,
        } as SupabaseItem;

        // Optimistic add
        set((state) => ({
          itemsBySession: {
            ...state.itemsBySession,
            [sessionId]: [...(state.itemsBySession[sessionId] ?? []), tempItem],
          },
        }));

        try {
          const { data: newItem, error } = await supabase
            .from("items")
            .insert({
              id: tempId,
              session_id: sessionId,
              mode,
              sort_order: nextSortOrder,
              receipt_number: receiptNumber ?? null,
            })
            .select()
            .single();

          if (error) throw error;
          if (!newItem) throw new Error("Failed to create item");

          // Replace temp with server data
          set((state) => ({
            itemsBySession: {
              ...state.itemsBySession,
              [sessionId]: (state.itemsBySession[sessionId] ?? []).map((i) =>
                i.id === tempId ? newItem : i,
              ),
            },
          }));

          trackEvent({
            event_type: "item.created",
            session_id: sessionId,
            items_content: { item_id: newItem.id, mode, sort_order: nextSortOrder },
          });
          return newItem.id;
        } catch (err) {
          if (isNetworkError(err)) {
            // Keep optimistic item, queue for sync
            await enqueueWrite({
              table: "items",
              operation: "insert",
              payload: {
                id: tempId,
                session_id: sessionId,
                mode,
                sort_order: nextSortOrder,
                receipt_number: receiptNumber ?? null,
              },
            });
            trackEvent({
              event_type: "item.created",
              session_id: sessionId,
              items_content: { item_id: tempId, mode, sort_order: nextSortOrder, offline: true },
            });
            return tempId;
          }
          // Non-network error — revert
          set((state) => ({
            itemsBySession: {
              ...state.itemsBySession,
              [sessionId]: (state.itemsBySession[sessionId] ?? []).filter(
                (i) => i.id !== tempId,
              ),
            },
          }));
          trackEvent({
            event_type: "item.created.failed",
            session_id: sessionId,
            error_message: err instanceof Error ? err.message : String(err),
            error_count: 1,
          });
          throw err;
        }
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

        try {
          const { error } = await supabase
            .from("items")
            .update({ [field]: value })
            .eq("id", itemId);

          if (error) throw error;
          scheduleFieldEditEvent(itemId, sessionId, field);
        } catch (err) {
          if (isNetworkError(err)) {
            await enqueueWrite({
              table: "items",
              operation: "update",
              payload: { id: itemId, [field]: value },
            });
            scheduleFieldEditEvent(itemId, sessionId, field);
            return;
          }
          // Revert
          set((state) => ({
            itemsBySession: {
              ...state.itemsBySession,
              [sessionId]: (state.itemsBySession[sessionId] ?? []).map((i) =>
                i.id === itemId ? originalItem : i,
              ),
            },
          }));
          // DAT-4: surface the failed save instead of silently dropping it. Skip internal
          // status writes (ai_status) — those aren't user edits and shouldn't toast.
          if (field !== "ai_status") {
            // DAT-8 follow-up: receipt-number uniqueness violations are deterministic —
            // retrying with the same value will hit the same constraint. Show a specific
            // message and omit the Retry callback so the user knows to enter a different
            // number instead of looping. Constraint key matches items_receipt_unique.
            const pgErr = err as { code?: string; message?: string };
            const isReceiptDup =
              field === "receipt_number" &&
              (pgErr?.code === "23505" ||
                pgErr?.message?.includes("items_receipt_unique") ||
                pgErr?.message?.includes("duplicate key value"));
            if (isReceiptDup) {
              useNotificationStore.getState().notifyError(
                `Receipt number "${value as string}" is already used. Each receipt number must be unique across all sessions.`,
              );
            } else {
              useNotificationStore.getState().notifyError(
                `Couldn't save ${field}. Tap Retry to try again.`,
                () => {
                  // DAT-4: guard against clobbering a newer edit — only retry if the field is
                  // still at the reverted value left by the failed save. If the user changed it
                  // since, drop the stale retry instead of overwriting.
                  const latest = get().itemsBySession[sessionId]?.find((i) => i.id === itemId);
                  const revertedValue = (originalItem as Record<string, unknown>)[field];
                  if (latest && (latest as Record<string, unknown>)[field] === revertedValue) {
                    void get().updateItemField(itemId, sessionId, field, value);
                  } else {
                    useNotificationStore.getState().dismiss();
                  }
                },
              );
            }
          }
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

        // D-04: the FK ON DELETE CASCADE only drops the public.audio metadata row;
        // the Storage binary must be explicitly removed or it orphans (the exact
        // photo leak this phase closes for audio). First storage.remove() in the
        // codebase. A remove() failure is non-fatal — the pg_cron purge-audio
        // reaper is the orphan backstop, so we log + continue rather than abort
        // the item delete.
        const { data: audioRows } = await supabase
          .from("audio")
          .select("storage_path")
          .eq("item_id", itemId);
        if (audioRows?.length) {
          const paths = audioRows.map((r) => r.storage_path);
          try {
            const { error: removeError } = await supabase.storage
              .from("audio")
              .remove(paths);
            if (removeError) {
              console.error(
                "Audio Storage cleanup failed (pg_cron reaper will backstop):",
                removeError.message,
              );
            }
          } catch (removeErr) {
            console.error(
              "Audio Storage cleanup threw (pg_cron reaper will backstop):",
              removeErr,
            );
          }
        }

        const { data: deleted, error } = await supabase
          .from("items")
          .delete()
          .eq("id", itemId)
          .select("id");

        if (error || !deleted || deleted.length === 0) {
          // Revert
          set((state) => ({
            itemsBySession: {
              ...state.itemsBySession,
              [sessionId]: originalItems,
            },
          }));
          if (!error) {
            console.error("Delete blocked by RLS policy — item not deleted");
          }
          trackEvent({
            event_type: "item.deleted.failed",
            session_id: sessionId,
            error_message: error?.message ?? "blocked_by_rls",
            error_count: 1,
            items_content: { item_id: itemId },
          });
          return;
        }
        trackEvent({
          event_type: "item.deleted",
          session_id: sessionId,
          items_content: { item_id: itemId },
        });
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
