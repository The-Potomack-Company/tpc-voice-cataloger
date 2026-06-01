import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { db } from "../db";
import { addIdMapping } from "../db/idMapping";
import { audioRecordsForItem } from "../db/audioLookup";
import type { ItemAudio } from "../db/types";

// Supabase audio rows the lookup unions for cross-device visibility.
// Default: no remote rows (Dexie-only behavior unaffected).
const { mockSupabaseEq } = vi.hoisted(() => ({
  mockSupabaseEq: vi.fn(async () => ({ data: [], error: null })),
}));

vi.mock("../lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: mockSupabaseEq })),
    })),
  },
}));

beforeEach(() => {
  mockSupabaseEq.mockResolvedValue({ data: [], error: null });
});

afterEach(async () => {
  await db.delete();
  await db.open();
});

function makeAudio(itemId: number | string, durationMs: number): Omit<ItemAudio, "id"> {
  return {
    itemId: itemId as unknown as number,
    itemType: "house",
    blob: new Blob(["audio"], { type: "audio/webm" }),
    mimeType: "audio/webm",
    durationMs,
    createdAt: new Date(),
  };
}

describe("audioRecordsForItem (DAT-7)", () => {
  const UUID = "uuid-item-1";

  it("finds rows stored under the UUID string", async () => {
    const id = await db.audio.add(makeAudio(UUID, 100));

    const result = await audioRecordsForItem(UUID);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(id);
    expect(result[0].durationMs).toBe(100);
  });

  it("finds rows stored under the legacy integer id when an idMapping exists", async () => {
    await addIdMapping({ oldId: 42, newId: UUID, type: "item" });
    const id = await db.audio.add(makeAudio(42, 200));

    const result = await audioRecordsForItem(UUID);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(id);
    expect(result[0].durationMs).toBe(200);
  });

  it("unions both forms, deduped by id, when audio exists under UUID and legacy id", async () => {
    await addIdMapping({ oldId: 42, newId: UUID, type: "item" });
    const uuidId = await db.audio.add(makeAudio(UUID, 100));
    const legacyId = await db.audio.add(makeAudio(42, 200));

    const result = await audioRecordsForItem(UUID);

    expect(result).toHaveLength(2);
    const ids = result.map((a) => a.id).sort((a, b) => a! - b!);
    expect(ids).toEqual([uuidId, legacyId].sort((a, b) => a - b));
    // No duplicate ids
    expect(new Set(ids).size).toBe(2);
  });

  it("returns only UUID rows when no idMapping exists", async () => {
    const uuidId = await db.audio.add(makeAudio(UUID, 100));
    // A legacy-int row that is NOT mapped to this UUID must not be returned.
    await db.audio.add(makeAudio(42, 999));

    const result = await audioRecordsForItem(UUID);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(uuidId);
  });

  it("Dexie-only union is unchanged when there are no Supabase rows", async () => {
    await addIdMapping({ oldId: 42, newId: UUID, type: "item" });
    const uuidId = await db.audio.add(makeAudio(UUID, 100));
    const legacyId = await db.audio.add(makeAudio(42, 200));

    const result = await audioRecordsForItem(UUID);

    expect(result).toHaveLength(2);
    expect(new Set(result.map((a) => a.id)).size).toBe(2);
    expect(result.map((a) => a.id).sort((a, b) => a! - b!)).toEqual(
      [uuidId, legacyId].sort((a, b) => a - b),
    );
  });

  it("surfaces cross-device Supabase audio (count > 0) when no Dexie row exists", async () => {
    mockSupabaseEq.mockResolvedValue({
      data: [
        {
          id: "remote-uuid-1",
          item_id: UUID,
          mime_type: "audio/webm",
          storage_path: `audio/sess/${UUID}/10.webm`,
          upload_status: "uploaded",
          created_at: new Date().toISOString(),
        },
      ],
      error: null,
    });

    const result = await audioRecordsForItem(UUID);

    expect(result.length).toBeGreaterThan(0);
    // Cross-device row contributes count but no Dexie integer id (pill silent).
    expect(result[0].id).toBeUndefined();
  });

  it("does NOT double-count when a Dexie row and a Supabase row describe the same item", async () => {
    const uuidId = await db.audio.add(makeAudio(UUID, 100));
    // A Supabase row exists for the same item, but Dexie is authoritative.
    mockSupabaseEq.mockResolvedValue({
      data: [
        {
          id: "remote-uuid-1",
          item_id: UUID,
          mime_type: "audio/webm",
          storage_path: `audio/sess/${UUID}/10.webm`,
          upload_status: "uploaded",
          created_at: new Date().toISOString(),
        },
      ],
      error: null,
    });

    const result = await audioRecordsForItem(UUID);

    // Dexie row wins; the Supabase row is NOT appended (no double-count).
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(uuidId);
  });
});
