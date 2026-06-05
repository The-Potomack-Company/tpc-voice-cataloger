import { describe, it, expect, vi, beforeEach } from "vitest";

// SC4 / T-36-07: a silent read failure in getQueuedItems must surface a toast
// (informational, no retry) while STILL returning [] (empty-return contract is
// intentional — visibility only, never fabricate data).

const { mockFrom, mockNotifyError } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockNotifyError: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({
  supabase: { from: mockFrom },
}));

vi.mock("../services/gemini", () => ({
  processAudioWithAi: vi.fn(),
}));

vi.mock("../db/idMapping", () => ({
  getDexieItemId: vi.fn(),
}));

vi.mock("../stores/notificationStore", () => ({
  useNotificationStore: {
    getState: () => ({ notifyError: mockNotifyError }),
  },
}));

function setupReadResponse(data: unknown, error: unknown) {
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data, error }),
      }),
    }),
  });
}

describe("getQueuedItems read-failure surfacing (SC4, T-36-07)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns [] AND calls notifyError (informational, no retry) on read error", async () => {
    setupReadResponse(null, { message: "read failed" });

    const { getQueuedItems } = await import("../services/offlineQueue");
    const items = await getQueuedItems();

    // Empty-return contract preserved.
    expect(items).toEqual([]);
    // Surfaced — informational toast (no retry arg → auto-dismiss).
    expect(mockNotifyError).toHaveBeenCalledTimes(1);
    expect(mockNotifyError.mock.calls[0][1]).toBeUndefined();
  });

  it("returns rows and does NOT notify on success", async () => {
    setupReadResponse(
      [
        {
          id: "uuid-1",
          mode: "house",
          session_id: "sess-1",
          created_at: "2026-01-01T10:00:00Z",
          claimed_at: null,
          ai_attempts: 0,
        },
      ],
      null,
    );

    const { getQueuedItems } = await import("../services/offlineQueue");
    const items = await getQueuedItems();

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("uuid-1");
    expect(mockNotifyError).not.toHaveBeenCalled();
  });
});
