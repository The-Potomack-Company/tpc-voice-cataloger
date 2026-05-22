import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionState = vi.hoisted(() => ({
  sessions: [{ id: "session-1", mode: "sale" }],
  itemsBySession: {
    "session-1": [
      {
        id: "item-1",
        session_id: "session-1",
        mode: "sale",
        sort_order: 0,
        receipt_number: null,
      },
    ],
  } as Record<string, Array<Record<string, unknown>>>,
  createItem: vi.fn(async (sessionId: string, mode: string, receiptNumber?: string) => {
    const item = {
      id: "item-2",
      session_id: sessionId,
      mode,
      sort_order: 1,
      receipt_number: receiptNumber ?? null,
    };
    sessionState.itemsBySession[sessionId] = [
      ...(sessionState.itemsBySession[sessionId] ?? []),
      item,
    ];
    return item.id;
  }),
  updateItemField: vi.fn(async () => {}),
  deleteItem: vi.fn(async (itemId: string, sessionId: string) => {
    sessionState.itemsBySession[sessionId] = (sessionState.itemsBySession[sessionId] ?? []).filter(
      (item) => item.id !== itemId,
    );
  }),
}));

vi.mock("../stores/sessionStore", () => ({
  useSessionStore: {
    getState: () => sessionState,
  },
}));

describe("continuousModeStore", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    sessionStorage.clear();
    sessionState.itemsBySession["session-1"] = [
      {
        id: "item-1",
        session_id: "session-1",
        mode: "sale",
        sort_order: 0,
        receipt_number: null,
      },
    ];
    const { useContinuousModeStore } = await import("../stores/continuousModeStore");
    useContinuousModeStore.setState({
      active: false,
      sessionId: null,
      currentItemId: null,
      chunkIndex: 0,
      chunkBuffer: [],
      liveTranscript: "",
      pendingChunks: new Set(),
      failedChunks: new Set(),
      lastAdvance: null,
    });
  });

  it("transitions enter -> advance -> exit", async () => {
    const { useContinuousModeStore } = await import("../stores/continuousModeStore");

    useContinuousModeStore.getState().enterMode("session-1");
    expect(useContinuousModeStore.getState()).toMatchObject({
      active: true,
      sessionId: "session-1",
      currentItemId: "item-1",
    });

    await useContinuousModeStore.getState().advanceItem("12345-2");
    expect(sessionState.createItem).toHaveBeenCalledWith("session-1", "sale", "12345-2");
    expect(useContinuousModeStore.getState().currentItemId).toBe("item-2");
    expect(useContinuousModeStore.getState().chunkIndex).toBe(1);

    useContinuousModeStore.getState().exitMode();
    expect(useContinuousModeStore.getState().active).toBe(false);
    expect(useContinuousModeStore.getState().sessionId).toBeNull();
  });

  it("undoes a new empty item after advancement", async () => {
    const { useContinuousModeStore } = await import("../stores/continuousModeStore");

    useContinuousModeStore.getState().enterMode("session-1");
    await useContinuousModeStore.getState().advanceItem("12345-2");

    await expect(useContinuousModeStore.getState().mergeChunksBackToPrevious()).resolves.toBe(true);
    expect(sessionState.deleteItem).toHaveBeenCalledWith("item-2", "session-1");
    expect(useContinuousModeStore.getState().currentItemId).toBe("item-1");
  });

  it("tracks failed chunks and retry state", async () => {
    const { useContinuousModeStore } = await import("../stores/continuousModeStore");

    useContinuousModeStore.getState().markChunkPending(3);
    expect(useContinuousModeStore.getState().pendingChunks.has(3)).toBe(true);

    useContinuousModeStore.getState().markChunkFailed(3);
    expect(useContinuousModeStore.getState().pendingChunks.has(3)).toBe(false);
    expect(useContinuousModeStore.getState().failedChunks.has(3)).toBe(true);

    useContinuousModeStore.getState().retryChunk(3);
    expect(useContinuousModeStore.getState().pendingChunks.has(3)).toBe(true);
    expect(useContinuousModeStore.getState().failedChunks.has(3)).toBe(false);
  });
});
