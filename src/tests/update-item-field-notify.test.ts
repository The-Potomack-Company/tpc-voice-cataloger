import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks (vi.hoisted ensures these are available when vi.mock factory runs) ---
const { mockFrom, mockNotifyError, mockEnqueueWrite, mockDismiss } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockNotifyError: vi.fn(),
  mockEnqueueWrite: vi.fn(),
  mockDismiss: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("../hooks/useWriteAheadQueue", () => ({
  enqueueWrite: mockEnqueueWrite,
}));

vi.mock("../stores/notificationStore", () => ({
  useNotificationStore: {
    getState: () => ({ notifyError: mockNotifyError, dismiss: mockDismiss }),
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

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

// supabase.from('items').update({...}).eq('id', id) → { error }
function setupUpdateChain(error: unknown = null) {
  const chain = {
    update: vi.fn(),
    eq: vi.fn(),
  };
  chain.update.mockReturnValue(chain);
  chain.eq.mockResolvedValue({ error });
  mockFrom.mockReturnValue(chain);
  return chain;
}

describe("updateItemField error notification (DAT-4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.setState({
      sessions: [],
      itemsBySession: {},
      loading: false,
      lastFetched: null,
    });
  });

  it("on a non-network error reverts the optimistic value AND calls notifyError", async () => {
    useSessionStore.setState({ itemsBySession: { "session-1": [makeItem()] } });
    setupUpdateChain(new Error("permission denied"));

    await useSessionStore
      .getState()
      .updateItemField("item-1", "session-1", "title", "New Title");

    const state = useSessionStore.getState();
    expect(state.itemsBySession["session-1"][0].title).toBe("Old Title");
    expect(mockNotifyError).toHaveBeenCalledTimes(1);
    expect(mockNotifyError).toHaveBeenCalledWith(
      "Couldn't save title. Tap Retry to try again.",
      expect.any(Function),
    );
  });

  it("retry callback passed to notifyError re-invokes the update with the same args", async () => {
    useSessionStore.setState({ itemsBySession: { "session-1": [makeItem()] } });
    setupUpdateChain(new Error("permission denied"));

    await useSessionStore
      .getState()
      .updateItemField("item-1", "session-1", "title", "New Title");

    const retry = mockNotifyError.mock.calls[0][1] as () => void;

    // Next attempt succeeds — proves retry re-runs the same update path.
    setupUpdateChain(null);
    const spy = vi.spyOn(useSessionStore.getState(), "updateItemField");
    retry();
    await Promise.resolve();
    await Promise.resolve();

    expect(spy).toHaveBeenCalledWith("item-1", "session-1", "title", "New Title");

    const state = useSessionStore.getState();
    expect(state.itemsBySession["session-1"][0].title).toBe("New Title");
    spy.mockRestore();
  });

  it("retry drops the stale value (and dismisses) when the field was re-edited since the failure", async () => {
    useSessionStore.setState({ itemsBySession: { "session-1": [makeItem()] } });
    setupUpdateChain(new Error("permission denied"));

    await useSessionStore
      .getState()
      .updateItemField("item-1", "session-1", "title", "New Title");

    const retry = mockNotifyError.mock.calls[0][1] as () => void;

    // The failed save reverted title back to "Old Title". Simulate the user
    // re-editing the same field to a newer value before tapping Retry.
    useSessionStore.setState((s) => ({
      itemsBySession: {
        ...s.itemsBySession,
        "session-1": s.itemsBySession["session-1"].map((i) =>
          i.id === "item-1" ? { ...i, title: "Newer Title" } : i,
        ),
      },
    }));

    // Fresh chain so any supabase update triggered by the retry would be observable here.
    const chain = setupUpdateChain(null);
    retry();
    await Promise.resolve();
    await Promise.resolve();

    // The stale retry must be dropped: no supabase update issued, dismiss called instead.
    expect(chain.update).not.toHaveBeenCalled();
    expect(mockDismiss).toHaveBeenCalledTimes(1);

    // The newer edit is left untouched.
    const state = useSessionStore.getState();
    expect(state.itemsBySession["session-1"][0].title).toBe("Newer Title");
  });

  it("does NOT call notifyError when field === 'ai_status'", async () => {
    useSessionStore.setState({ itemsBySession: { "session-1": [makeItem()] } });
    setupUpdateChain(new Error("permission denied"));

    await useSessionStore
      .getState()
      .updateItemField("item-1", "session-1", "ai_status", "failed");

    const state = useSessionStore.getState();
    // still reverted
    expect(state.itemsBySession["session-1"][0].ai_status).toBe("pending");
    expect(mockNotifyError).not.toHaveBeenCalled();
  });

  it("on a network error enqueues the write and does NOT call notifyError", async () => {
    useSessionStore.setState({ itemsBySession: { "session-1": [makeItem()] } });
    setupUpdateChain(new Error("Failed to fetch"));

    await useSessionStore
      .getState()
      .updateItemField("item-1", "session-1", "title", "New Title");

    expect(mockEnqueueWrite).toHaveBeenCalledTimes(1);
    expect(mockEnqueueWrite).toHaveBeenCalledWith({
      table: "items",
      operation: "update",
      payload: { id: "item-1", title: "New Title" },
    });
    expect(mockNotifyError).not.toHaveBeenCalled();

    // Optimistic value is preserved on the network path (queued for later).
    const state = useSessionStore.getState();
    expect(state.itemsBySession["session-1"][0].title).toBe("New Title");
  });
});
