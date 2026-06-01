// Wave-0 RED scaffold (Phase 32 plan 01). References processAudioWithAi's Storage
// fallback, which plan 05 wires — EXPECTED to fail/not-resolve at this commit.
// Contract: when the local Dexie blob is gone (db.audio.get -> undefined), the AI
// processor falls back to downloading the blob from Supabase Storage, resolving the
// audio row by item_id (UUID), NOT by the integer dexie audio id.
import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  mockStorageDownload,
  mockStorageFrom,
  mockSupabaseEq,
  mockSupabaseSelect,
  mockSupabaseFrom,
} = vi.hoisted(() => {
  const mockStorageDownload = vi.fn();
  const mockStorageFrom = vi.fn(() => ({ download: mockStorageDownload }));
  const mockSupabaseEq = vi.fn();
  const mockSupabaseSelect = vi.fn(() => ({ eq: mockSupabaseEq }));
  const mockSupabaseFrom = vi.fn(() => ({ select: mockSupabaseSelect }));
  return {
    mockStorageDownload,
    mockStorageFrom,
    mockSupabaseEq,
    mockSupabaseSelect,
    mockSupabaseFrom,
  };
});

vi.mock("../lib/supabase", () => ({
  supabase: {
    storage: { from: mockStorageFrom },
    from: mockSupabaseFrom,
  },
}));

const { mockAudioGet } = vi.hoisted(() => ({ mockAudioGet: vi.fn() }));

vi.mock("../db", () => ({
  db: {
    audio: { get: mockAudioGet },
  },
}));

describe("processAudioWithAi storage fallback (D-01)", () => {
  const ITEM_UUID = "item-uuid-1";

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("downloads from Storage when the Dexie blob is missing, resolving by item_id UUID", async () => {
    // Local blob gone.
    mockAudioGet.mockResolvedValue(undefined);
    // Metadata row resolved by item_id (UUID), not the integer id.
    mockSupabaseEq.mockResolvedValue({
      data: [{ storage_path: "audio/session-uuid-1/item-uuid-1/10.webm" }],
      error: null,
    });
    mockStorageDownload.mockResolvedValue({
      data: new Blob(["downloaded-audio"]),
      error: null,
    });

    const { processAudioWithAi } = await import("../services/processAudioWithAi");
    await processAudioWithAi({ itemId: ITEM_UUID, dexieAudioId: 10 });

    expect(mockSupabaseFrom).toHaveBeenCalledWith("audio");
    expect(mockSupabaseEq).toHaveBeenCalledWith("item_id", ITEM_UUID);
    expect(mockStorageFrom).toHaveBeenCalledWith("audio");
    expect(mockStorageDownload).toHaveBeenCalledWith(
      "audio/session-uuid-1/item-uuid-1/10.webm"
    );
  });

  it("uses the local Dexie blob and does NOT hit Storage when present", async () => {
    mockAudioGet.mockResolvedValue({ id: 10, blob: new Blob(["local-audio"]) });

    const { processAudioWithAi } = await import("../services/processAudioWithAi");
    await processAudioWithAi({ itemId: ITEM_UUID, dexieAudioId: 10 });

    expect(mockStorageDownload).not.toHaveBeenCalled();
  });
});
