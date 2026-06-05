// Wave-0 RED scaffold (Phase 32 plan 01). The D-04 hard-delete orphan-close: when
// an item is deleted, its audio blobs must be removed from Storage too (the FK
// cascade only drops the public.audio metadata row, leaving the S3 binary orphaned).
// Plan 05 Task 1 wires deleteItem to: select audio storage_paths by item_id, then
// storage.from('audio').remove([...]) those exact paths. This suite asserts that
// contract and is EXPECTED to FAIL until plan 05 lands it.
//
// Cloned supabase mock harness from photo-upload-queue.test.ts:1-75
// (mockSupabaseFrom + a mockStorageRemove spy).
import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  mockStorageRemove,
  mockStorageFrom,
  mockSupabaseFrom,
  mockAudioSelectEq,
  mockItemsDeleteSelect,
} = vi.hoisted(() => {
  const mockStorageRemove = vi.fn();
  const mockStorageFrom = vi.fn(() => ({ remove: mockStorageRemove }));

  // audio: .from('audio').select('storage_path').eq('item_id', itemId) -> { data }
  const mockAudioSelectEq = vi.fn();
  // items: .from('items').delete().eq('id', itemId).select('id') -> { data }
  const mockItemsDeleteSelect = vi.fn();

  const mockSupabaseFrom = vi.fn((table: string) => {
    if (table === "audio") {
      return {
        select: vi.fn(() => ({ eq: mockAudioSelectEq })),
      };
    }
    // items
    return {
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({ select: mockItemsDeleteSelect })),
      })),
    };
  });

  return {
    mockStorageRemove,
    mockStorageFrom,
    mockSupabaseFrom,
    mockAudioSelectEq,
    mockItemsDeleteSelect,
  };
});

vi.mock("../lib/supabase", () => ({
  supabase: {
    from: mockSupabaseFrom,
    storage: { from: mockStorageFrom },
  },
}));

vi.mock("../services/analytics", () => ({ trackEvent: vi.fn() }));

const ITEM_UUID = "item-uuid-1";
const SESSION_UUID = "session-uuid-1";
const PATHS = [
  "audio/session-uuid-1/item-uuid-1/10.webm",
  "audio/session-uuid-1/item-uuid-1/11.webm",
];

async function callDeleteItem() {
  const { useSessionStore } = await import("../stores/sessionStore");
  await useSessionStore.getState().deleteItem(ITEM_UUID, SESSION_UUID);
}

describe("sessionStore.deleteItem audio cleanup (D-04 hard delete)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockItemsDeleteSelect.mockResolvedValue({ data: [{ id: ITEM_UUID }], error: null });
  });

  it("selects audio storage_paths by item_id and removes exactly those paths", async () => {
    mockAudioSelectEq.mockResolvedValue({
      data: PATHS.map((p) => ({ storage_path: p })),
      error: null,
    });
    mockStorageRemove.mockResolvedValue({ data: [], error: null });

    await callDeleteItem();

    expect(mockSupabaseFrom).toHaveBeenCalledWith("audio");
    expect(mockAudioSelectEq).toHaveBeenCalledWith("item_id", ITEM_UUID);
    expect(mockStorageFrom).toHaveBeenCalledWith("audio");
    expect(mockStorageRemove).toHaveBeenCalledWith(PATHS);
  });

  it("does NOT call storage.remove when the item has no audio (rows?.length guard)", async () => {
    mockAudioSelectEq.mockResolvedValue({ data: [], error: null });

    await callDeleteItem();

    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  it("swallows a storage.remove() failure without aborting the items delete", async () => {
    mockAudioSelectEq.mockResolvedValue({
      data: PATHS.map((p) => ({ storage_path: p })),
      error: null,
    });
    mockStorageRemove.mockResolvedValue({
      data: null,
      error: new Error("storage down"),
    });

    await expect(callDeleteItem()).resolves.not.toThrow();

    // The item row delete still ran despite the storage failure.
    expect(mockItemsDeleteSelect).toHaveBeenCalled();
  });
});
