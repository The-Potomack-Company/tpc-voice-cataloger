import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks (vi.hoisted ensures these are available when vi.mock factory runs) ---
const { mockFrom, mockStorageRemove, mockStorageFrom } = vi.hoisted(() => {
  const mockFrom = vi.fn();
  const mockStorageRemove = vi.fn().mockResolvedValue({ data: [], error: null });
  const mockStorageFrom = vi.fn(() => ({ remove: mockStorageRemove }));

  return {
    mockFrom,
    mockStorageRemove,
    mockStorageFrom,
  };
});

vi.mock("../lib/supabase", () => ({
  supabase: {
    from: mockFrom,
    storage: { from: mockStorageFrom },
  },
}));

// Mock zustand persist to use a no-op storage (avoids jsdom localStorage issues with zustand 5)
vi.mock("zustand/middleware", async () => {
  const actual = await vi.importActual<typeof import("zustand/middleware")>("zustand/middleware");
  return {
    ...actual,
    persist: (fn: unknown) => fn,
  };
});


import { useSessionStore } from "../stores/sessionStore";

// Helper to set up the chain for a query (fetchSessions pattern: from().select().order())
function setupSelectChain(data: unknown[], error: unknown = null) {
  const result = { data, error };
  const chain = {
    select: vi.fn(),
    order: vi.fn(),
    eq: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.order.mockResolvedValue(result);
  chain.eq.mockReturnValue(chain);
  mockFrom.mockReturnValue(chain);
  return chain;
}

function setupSelectWithEqChain(data: unknown[], error: unknown = null) {
  const result = { data, error };
  const chain = {
    select: vi.fn(),
    order: vi.fn(),
    eq: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.order.mockResolvedValue(result);
  mockFrom.mockReturnValue(chain);
  return chain;
}

function setupInsertChain(
  data: unknown = null,
  error: unknown = null,
) {
  const chain = {
    insert: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
  };
  chain.insert.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  chain.single.mockResolvedValue({ data, error });
  mockFrom.mockReturnValue(chain);
  return chain;
}

// Supports BOTH write shapes off one chain:
//   updateSession:   .update({...}).eq("id", x)                         -> awaited
//   updateItemField: .update({...}).eq("id").eq("updated_at").select()  -> Phase 39 precondition
// `.eq()` returns a thenable chain so `await update().eq()` resolves to {error},
// while further `.eq().select()` chaining still works for the precondition path.
function setupUpdateChain(error: unknown = null) {
  const result = error
    ? { data: null, error }
    : { data: [{ id: "item-1", updated_at: "T1" }], error: null };
  const chain: Record<string, unknown> = {
    update: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    then: (resolve: (v: unknown) => unknown) => resolve(result),
  };
  (chain.update as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.eq as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.select as ReturnType<typeof vi.fn>).mockResolvedValue(result);
  mockFrom.mockReturnValue(chain);
  return chain;
}

function setupDeleteChain(error: unknown = null, data: unknown[] | null = null) {
  // items: delete().eq().select() -> { data, error }
  const itemsChain = {
    delete: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
  };
  itemsChain.delete.mockReturnValue(itemsChain);
  itemsChain.eq.mockReturnValue(itemsChain);
  itemsChain.select.mockResolvedValue({ data, error });

  // audio (D-04 cleanup): select('storage_path').eq('item_id', id) -> { data }
  // Default: no audio rows so the storage.remove() guard is skipped and these
  // item-state assertions stay isolated from the cleanup path.
  const audioChain = {
    select: vi.fn(),
    eq: vi.fn(),
  };
  audioChain.select.mockReturnValue(audioChain);
  audioChain.eq.mockResolvedValue({ data: [], error: null });

  mockFrom.mockImplementation((table: string) =>
    table === "audio" ? audioChain : itemsChain,
  );
  return itemsChain;
}

describe("sessionStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state between tests
    useSessionStore.setState({
      sessions: [],
      itemsBySession: {},
      loading: false,
      lastFetched: null,
    });
  });

  describe("initial state", () => {
    it("has sessions=[], itemsBySession={}, loading=false, lastFetched=null", () => {
      const state = useSessionStore.getState();
      expect(state.sessions).toEqual([]);
      expect(state.itemsBySession).toEqual({});
      expect(state.loading).toBe(false);
      expect(state.lastFetched).toBeNull();
    });
  });

  describe("fetchSessions", () => {
    it("calls supabase.from('sessions').select('*').order('updated_at', {ascending: false}) and sets sessions + lastFetched", async () => {
      const mockSessions = [
        {
          id: "uuid-1",
          name: "Session 1",
          mode: "house",
          status: "active",
          notes: "",
          created_by: "user-1",
          created_at: "2026-01-01",
          updated_at: "2026-01-02",
          assigned_to: null,
          review_notes: null,
        },
      ];

      setupSelectChain(mockSessions);

      await useSessionStore.getState().fetchSessions();

      expect(mockFrom).toHaveBeenCalledWith("sessions");
      const state = useSessionStore.getState();
      expect(state.sessions).toEqual(mockSessions);
      expect(state.loading).toBe(false);
      expect(state.lastFetched).toBeGreaterThan(0);
    });
  });

  describe("fetchItems", () => {
    it("calls supabase.from('items').select('*').eq('session_id', sessionId).order('sort_order', {ascending: true}) and updates itemsBySession", async () => {
      const mockItems = [
        {
          id: "item-1",
          session_id: "session-1",
          mode: "house",
          sort_order: 0,
          title: "Vase",
          description: null,
          condition: null,
          estimate: null,
          measurements: null,
          category: null,
          transcript: null,
          receipt_number: null,
          ai_status: "pending",
          created_at: "2026-01-01",
        },
      ];

      setupSelectWithEqChain(mockItems);

      await useSessionStore.getState().fetchItems("session-1");

      expect(mockFrom).toHaveBeenCalledWith("items");
      const state = useSessionStore.getState();
      expect(state.itemsBySession["session-1"]).toEqual(mockItems);
    });
  });

  describe("createSession", () => {
    it("inserts to supabase with created_by=userId and returns new session id", async () => {
      const newSession = {
        id: "new-uuid",
        name: "New Session",
        mode: "house",
        status: "active",
        notes: "test notes",
        created_by: "user-123",
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
        assigned_to: null,
        review_notes: null,
      };

      setupInsertChain(newSession);

      const id = await useSessionStore
        .getState()
        .createSession(
          { name: "New Session", mode: "house", notes: "test notes" },
          "user-123",
        );

      expect(mockFrom).toHaveBeenCalledWith("sessions");
      expect(id).toBe("new-uuid");
      const state = useSessionStore.getState();
      expect(state.sessions.some((s) => s.id === "new-uuid")).toBe(true);
    });
  });

  describe("updateSession", () => {
    it("does optimistic update then supabase call", async () => {
      const originalSession = {
        id: "uuid-1",
        name: "Original",
        mode: "house",
        status: "active",
        notes: "",
        created_by: "user-1",
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
        assigned_to: null,
        review_notes: null,
      };

      useSessionStore.setState({ sessions: [originalSession] });
      setupUpdateChain(null);

      await useSessionStore
        .getState()
        .updateSession("uuid-1", { name: "Updated" });

      expect(mockFrom).toHaveBeenCalledWith("sessions");
      const state = useSessionStore.getState();
      const updated = state.sessions.find((s) => s.id === "uuid-1");
      expect(updated?.name).toBe("Updated");
    });

    it("on error reverts to original", async () => {
      const originalSession = {
        id: "uuid-1",
        name: "Original",
        mode: "house",
        status: "active",
        notes: "",
        created_by: "user-1",
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
        assigned_to: null,
        review_notes: null,
      };

      useSessionStore.setState({ sessions: [originalSession] });
      setupUpdateChain(new Error("Network error"));

      await useSessionStore
        .getState()
        .updateSession("uuid-1", { name: "Updated" });

      const state = useSessionStore.getState();
      const reverted = state.sessions.find((s) => s.id === "uuid-1");
      expect(reverted?.name).toBe("Original");
    });
  });

  describe("deleteSession", () => {
    it("removes from sessions array and calls supabase delete", async () => {
      const session = {
        id: "uuid-1",
        name: "To Delete",
        mode: "house",
        status: "active",
        notes: "",
        created_by: "user-1",
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
        assigned_to: null,
        review_notes: null,
      };

      useSessionStore.setState({
        sessions: [session],
        itemsBySession: { "uuid-1": [] },
      });
      setupDeleteChain(null, [{ id: "uuid-1" }]);

      await useSessionStore.getState().deleteSession("uuid-1");

      expect(mockFrom).toHaveBeenCalledWith("sessions");
      const state = useSessionStore.getState();
      expect(state.sessions).toHaveLength(0);
      expect(state.itemsBySession["uuid-1"]).toBeUndefined();
    });

    it("reverts optimistic delete when RLS silently blocks (0 rows returned)", async () => {
      const session = {
        id: "uuid-1",
        name: "Protected",
        mode: "house",
        status: "active",
        notes: "",
        created_by: "admin-1",
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
        assigned_to: null,
        review_notes: null,
      };

      useSessionStore.setState({
        sessions: [session],
        itemsBySession: { "uuid-1": [] },
      });
      setupDeleteChain(null, []);

      const success = await useSessionStore.getState().deleteSession("uuid-1");

      expect(success).toBe(false);
      const state = useSessionStore.getState();
      expect(state.sessions).toHaveLength(1);
      expect(state.sessions[0].id).toBe("uuid-1");
    });

    it("returns true on successful delete", async () => {
      const session = {
        id: "uuid-1",
        name: "To Delete",
        mode: "house",
        status: "active",
        notes: "",
        created_by: "user-1",
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
        assigned_to: null,
        review_notes: null,
      };

      useSessionStore.setState({
        sessions: [session],
        itemsBySession: { "uuid-1": [] },
      });
      setupDeleteChain(null, [{ id: "uuid-1" }]);

      const success = await useSessionStore.getState().deleteSession("uuid-1");

      expect(success).toBe(true);
      expect(useSessionStore.getState().sessions).toHaveLength(0);
    });

    it("returns false when supabase returns an error", async () => {
      const session = {
        id: "uuid-1",
        name: "Error Case",
        mode: "house",
        status: "active",
        notes: "",
        created_by: "user-1",
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
        assigned_to: null,
        review_notes: null,
      };

      useSessionStore.setState({
        sessions: [session],
        itemsBySession: {},
      });
      setupDeleteChain(new Error("DB error"), null);

      const success = await useSessionStore.getState().deleteSession("uuid-1");

      expect(success).toBe(false);
      expect(useSessionStore.getState().sessions).toHaveLength(1);
    });
  });

  describe("createItem", () => {
    it("inserts to supabase items table with correct sort_order", async () => {
      const existingItems = [
        {
          id: "item-1",
          session_id: "session-1",
          mode: "house",
          sort_order: 0,
          title: null,
          description: null,
          condition: null,
          estimate: null,
          measurements: null,
          category: null,
          transcript: null,
          receipt_number: null,
          ai_status: "pending",
          created_at: "2026-01-01",
        },
      ];

      useSessionStore.setState({
        itemsBySession: { "session-1": existingItems },
      });

      const newItem = {
        id: "item-2",
        session_id: "session-1",
        mode: "house",
        sort_order: 1,
        title: null,
        description: null,
        condition: null,
        estimate: null,
        measurements: null,
        category: null,
        transcript: null,
        receipt_number: null,
        ai_status: "pending",
        created_at: "2026-01-01",
      };

      setupInsertChain(newItem);

      const id = await useSessionStore
        .getState()
        .createItem("session-1", "house");

      expect(mockFrom).toHaveBeenCalledWith("items");
      expect(id).toBe("item-2");
      const state = useSessionStore.getState();
      expect(state.itemsBySession["session-1"]).toHaveLength(2);
    });
  });

  describe("updateItemField", () => {
    it("optimistically updates item in itemsBySession then calls supabase", async () => {
      const items = [
        {
          id: "item-1",
          session_id: "session-1",
          mode: "house",
          sort_order: 0,
          title: "Old Title",
          description: null,
          condition: null,
          estimate: null,
          measurements: null,
          category: null,
          transcript: null,
          receipt_number: null,
          ai_status: "pending",
          created_at: "2026-01-01",
        },
      ];

      useSessionStore.setState({
        itemsBySession: { "session-1": items },
      });
      setupUpdateChain(null);

      await useSessionStore
        .getState()
        .updateItemField("item-1", "session-1", "title", "New Title");

      expect(mockFrom).toHaveBeenCalledWith("items");
      const state = useSessionStore.getState();
      expect(state.itemsBySession["session-1"][0].title).toBe("New Title");
    });
  });

  describe("deleteItem", () => {
    it("removes from itemsBySession[sessionId] and calls supabase delete", async () => {
      const items = [
        {
          id: "item-1",
          session_id: "session-1",
          mode: "house",
          sort_order: 0,
          title: null,
          description: null,
          condition: null,
          estimate: null,
          measurements: null,
          category: null,
          transcript: null,
          receipt_number: null,
          ai_status: "pending",
          created_at: "2026-01-01",
        },
        {
          id: "item-2",
          session_id: "session-1",
          mode: "house",
          sort_order: 1,
          title: null,
          description: null,
          condition: null,
          estimate: null,
          measurements: null,
          category: null,
          transcript: null,
          receipt_number: null,
          ai_status: "pending",
          created_at: "2026-01-01",
        },
      ];

      useSessionStore.setState({
        itemsBySession: { "session-1": items },
      });
      setupDeleteChain(null, [{ id: "item-1" }]);

      await useSessionStore
        .getState()
        .deleteItem("item-1", "session-1");

      expect(mockFrom).toHaveBeenCalledWith("items");
      const state = useSessionStore.getState();
      expect(state.itemsBySession["session-1"]).toHaveLength(1);
      expect(state.itemsBySession["session-1"][0].id).toBe("item-2");
    });

    it("reverts optimistic delete when RLS silently blocks (0 rows returned)", async () => {
      const items = [
        {
          id: "item-1",
          session_id: "session-1",
          mode: "house",
          sort_order: 0,
          title: "Protected Item",
          description: null,
          condition: null,
          estimate: null,
          measurements: null,
          category: null,
          transcript: null,
          receipt_number: null,
          ai_status: "pending",
          created_at: "2026-01-01",
        },
      ];

      useSessionStore.setState({
        itemsBySession: { "session-1": items },
      });
      setupDeleteChain(null, []);

      await useSessionStore
        .getState()
        .deleteItem("item-1", "session-1");

      // Item should revert back since RLS blocked the delete
      const state = useSessionStore.getState();
      expect(state.itemsBySession["session-1"]).toHaveLength(1);
      expect(state.itemsBySession["session-1"][0].id).toBe("item-1");
    });

    it("keeps item removed when delete returns deleted row data", async () => {
      const items = [
        {
          id: "item-1",
          session_id: "session-1",
          mode: "house",
          sort_order: 0,
          title: "Deletable Item",
          description: null,
          condition: null,
          estimate: null,
          measurements: null,
          category: null,
          transcript: null,
          receipt_number: null,
          ai_status: "pending",
          created_at: "2026-01-01",
        },
      ];

      useSessionStore.setState({
        itemsBySession: { "session-1": items },
      });
      setupDeleteChain(null, [{ id: "item-1" }]);

      await useSessionStore
        .getState()
        .deleteItem("item-1", "session-1");

      // Item should stay removed since delete succeeded
      const state = useSessionStore.getState();
      expect(state.itemsBySession["session-1"]).toHaveLength(0);
    });
  });

  describe("appendToItemField", () => {
    it("appends new content to an existing field value", async () => {
      const items = [
        {
          id: "item-1",
          session_id: "session-1",
          mode: "house",
          sort_order: 0,
          title: null,
          description: null,
          condition: null,
          estimate: null,
          measurements: null,
          category: null,
          transcript: "existing text",
          receipt_number: null,
          ai_status: "pending",
          created_at: "2026-01-01",
        },
      ];

      useSessionStore.setState({
        itemsBySession: { "session-1": items },
      });
      setupUpdateChain(null);

      await useSessionStore
        .getState()
        .appendToItemField("item-1", "session-1", "transcript", "new text");

      const state = useSessionStore.getState();
      expect(state.itemsBySession["session-1"][0].transcript).toBe(
        "existing text\nnew text",
      );
    });

    it("sets the field to new content when existing value is null", async () => {
      const items = [
        {
          id: "item-1",
          session_id: "session-1",
          mode: "house",
          sort_order: 0,
          title: null,
          description: null,
          condition: null,
          estimate: null,
          measurements: null,
          category: null,
          transcript: null,
          receipt_number: null,
          ai_status: "pending",
          created_at: "2026-01-01",
        },
      ];

      useSessionStore.setState({
        itemsBySession: { "session-1": items },
      });
      setupUpdateChain(null);

      await useSessionStore
        .getState()
        .appendToItemField("item-1", "session-1", "transcript", "first text");

      const state = useSessionStore.getState();
      expect(state.itemsBySession["session-1"][0].transcript).toBe("first text");
    });
  });
});
