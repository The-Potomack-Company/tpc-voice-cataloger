import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db } from "../db";

// --- Mocks ---
const { mockFrom, mockSupabaseSelect, mockSupabaseEq, mockSupabaseOrder, mockSupabaseUpdate } =
  vi.hoisted(() => {
    const mockSupabaseUpdate = vi.fn();
    const mockSupabaseOrder = vi.fn();
    const mockSupabaseEq = vi.fn();
    const mockSupabaseSelect = vi.fn();
    const mockFrom = vi.fn();

    return {
      mockFrom,
      mockSupabaseSelect,
      mockSupabaseEq,
      mockSupabaseOrder,
      mockSupabaseUpdate,
    };
  });

vi.mock("../lib/supabase", () => ({
  supabase: {
    from: mockFrom,
  },
}));

// Mock processAudioWithAi before importing offlineQueue
vi.mock("../services/gemini", () => ({
  processAudioWithAi: vi.fn(),
}));

// Mock getDexieItemId
const { mockGetDexieItemId } = vi.hoisted(() => {
  return { mockGetDexieItemId: vi.fn() };
});

vi.mock("../db/idMapping", () => ({
  getDexieItemId: mockGetDexieItemId,
}));

describe("offlineQueue service (Supabase-backed)", () => {
  let originalOnLine: boolean;

  beforeEach(async () => {
    originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      configurable: true,
      value: true,
    });

    // Clear audio table (still Dexie for blobs)
    await db.audio.clear();

    // Reset mocks
    const { processAudioWithAi } = await import("../services/gemini");
    vi.mocked(processAudioWithAi).mockReset();
    mockFrom.mockReset();
    mockSupabaseSelect.mockReset();
    mockSupabaseEq.mockReset();
    mockSupabaseOrder.mockReset();
    mockSupabaseUpdate.mockReset();
    mockGetDexieItemId.mockReset();

    // Default: processAudioWithAi succeeds (no Dexie write needed, just resolves)
    vi.mocked(processAudioWithAi).mockResolvedValue(undefined);
  });

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      configurable: true,
      value: originalOnLine,
    });
  });

  // Helper: set up Supabase mock to return queued items
  function setupQueuedItemsResponse(
    items: Array<{
      id: string;
      mode: string;
      session_id: string;
      created_at: string;
    }>,
  ) {
    mockFrom.mockImplementation((table: string) => {
      if (table === "items") {
        return {
          select: mockSupabaseSelect.mockReturnValue({
            eq: mockSupabaseEq.mockReturnValue({
              order: mockSupabaseOrder.mockResolvedValue({
                data: items,
                error: null,
              }),
            }),
          }),
          update: mockSupabaseUpdate.mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      return {};
    });
  }

  async function createAudio(
    itemId: number,
    itemType: "house" | "sale",
  ): Promise<number> {
    return (await db.audio.add({
      itemId,
      itemType,
      blob: new Blob(["audio-data"], { type: "audio/webm" }),
      mimeType: "audio/webm",
      createdAt: new Date(),
    })) as number;
  }

  describe("getQueuedItems", () => {
    it("queries Supabase items where ai_status='queued'", async () => {
      setupQueuedItemsResponse([
        {
          id: "uuid-1",
          mode: "house",
          session_id: "sess-uuid-1",
          created_at: "2026-01-01T10:00:00Z",
        },
        {
          id: "uuid-2",
          mode: "sale",
          session_id: "sess-uuid-2",
          created_at: "2026-01-01T10:01:00Z",
        },
      ]);

      const { getQueuedItems } = await import("../services/offlineQueue");
      const items = await getQueuedItems();

      expect(items).toHaveLength(2);
      expect(items[0].id).toBe("uuid-1");
      expect(typeof items[0].id).toBe("string");
      expect(items[0].itemType).toBe("house");
      expect(items[0].sessionId).toBe("sess-uuid-1");
      expect(items[1].id).toBe("uuid-2");
      expect(items[1].itemType).toBe("sale");
      expect(items[1].sessionId).toBe("sess-uuid-2");
    });
  });

  describe("findAudioForItem", () => {
    it("queries Dexie db.audio by itemId using getDexieItemId for UUID-to-integer bridge", async () => {
      // Create audio with legacy integer itemId
      const audioId = await createAudio(42, "house");

      // Mock getDexieItemId to return the legacy integer
      mockGetDexieItemId.mockResolvedValue(42);

      // Need to test findAudioForItem indirectly through drainQueue
      // since findAudioForItem is not exported.
      // Set up a single queued item
      setupQueuedItemsResponse([
        {
          id: "uuid-item-1",
          mode: "house",
          session_id: "sess-uuid-1",
          created_at: "2026-01-01T10:00:00Z",
        },
      ]);

      const { processAudioWithAi } = await import("../services/gemini");
      const { drainQueue } = await import("../services/offlineQueue");
      await drainQueue();

      // processAudioWithAi should have been called with the audio ID
      expect(processAudioWithAi).toHaveBeenCalledWith(
        audioId,
        "uuid-item-1",
        "sess-uuid-1",
      );
    });
  });

  describe("drainQueue", () => {
    it("calls processAudioWithAi with (audioId, itemId as string UUID, sessionId as string UUID)", async () => {
      // Create audio with legacy integer itemId
      mockGetDexieItemId.mockResolvedValue(42);
      const audioId = await createAudio(42, "house");

      setupQueuedItemsResponse([
        {
          id: "uuid-item-1",
          mode: "house",
          session_id: "sess-uuid-1",
          created_at: "2026-01-01T10:00:00Z",
        },
      ]);

      const { processAudioWithAi } = await import("../services/gemini");
      const { drainQueue } = await import("../services/offlineQueue");
      await drainQueue();

      expect(processAudioWithAi).toHaveBeenCalledWith(
        audioId,
        "uuid-item-1",
        "sess-uuid-1",
      );
    });

    it("handles items with no audio by marking them as failed via supabase", async () => {
      mockGetDexieItemId.mockResolvedValue(null);

      // Set up response that handles both select and update
      mockFrom.mockImplementation((table: string) => {
        if (table === "items") {
          return {
            select: mockSupabaseSelect.mockReturnValue({
              eq: mockSupabaseEq.mockReturnValue({
                order: mockSupabaseOrder.mockResolvedValue({
                  data: [
                    {
                      id: "uuid-no-audio",
                      mode: "house",
                      session_id: "sess-uuid-1",
                      created_at: "2026-01-01T10:00:00Z",
                    },
                  ],
                  error: null,
                }),
              }),
            }),
            update: mockSupabaseUpdate.mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return {};
      });

      const { drainQueue } = await import("../services/offlineQueue");
      await drainQueue();

      // Should have called supabase update with ai_status: 'failed'
      expect(mockSupabaseUpdate).toHaveBeenCalledWith({
        ai_status: "failed",
      });
    });
  });
});
