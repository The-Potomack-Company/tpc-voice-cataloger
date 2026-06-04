import { describe, it, expect, beforeEach, vi } from "vitest";

// --- Mocks ---
// Mirrors the hoisted-mock + dynamic-import structure of photo-migration.test.ts.
// Difference: idMapping resolution flows through the mocked ../db/idMapping
// helper (getNewIdByOldId), NOT the raw db.idMapping query chain — this is the
// path the FIXED photoMigration.ts must take. The old inline-query code never
// calls getNewIdByOldId with the itemTable discriminator, so the mock-call and
// distinct-UUID assertions below fail until Task 2 lands (RED -> GREEN).
const { mockPhotoUploadQueue, mockPhotos } = vi.hoisted(() => {
  return {
    mockPhotoUploadQueue: {
      where: vi.fn(),
      toArray: vi.fn(),
      add: vi.fn(),
      bulkAdd: vi.fn(),
    },
    mockPhotos: {
      toArray: vi.fn(),
      where: vi.fn(),
    },
  };
});

vi.mock("../db", () => ({
  db: {
    photoUploadQueue: mockPhotoUploadQueue,
    photos: mockPhotos,
    // idMapping is present but unused by the fixed path; the resolution now
    // goes through the mocked ../db/idMapping helper below.
    idMapping: { where: vi.fn() },
  },
}));

const { mockGetNewIdByOldId } = vi.hoisted(() => {
  return { mockGetNewIdByOldId: vi.fn() };
});

vi.mock("../db/idMapping", () => ({
  getNewIdByOldId: mockGetNewIdByOldId,
}));

const { mockEnqueuePhotoUpload, mockDrainPhotoQueue } = vi.hoisted(() => {
  return {
    mockEnqueuePhotoUpload: vi.fn().mockResolvedValue(undefined),
    mockDrainPhotoQueue: vi.fn(),
  };
});

vi.mock("../services/photoUploadQueue", () => ({
  enqueuePhotoUpload: mockEnqueuePhotoUpload,
  drainPhotoQueue: mockDrainPhotoQueue,
}));

const { mockSupabaseFrom } = vi.hoisted(() => {
  return { mockSupabaseFrom: vi.fn() };
});

vi.mock("../lib/supabase", () => ({
  supabase: {
    from: mockSupabaseFrom,
  },
}));

describe("photo migration — house/sale ++id collision (UAT 38-3)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    vi.resetModules();
  });

  function setupSupabaseItemLookup(items: Record<string, string>) {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation((_col: string, id: string) => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: items[id] ? { session_id: items[id] } : null,
            error: null,
          }),
        })),
      }),
    });
  }

  it("resolves colliding house/sale itemIds to DISTINCT Supabase UUIDs via the itemTable discriminator", async () => {
    // Two un-uploaded photos with the SAME legacy integer itemId (1) but
    // different source tables — house vs sale. houseVisitItems and saleItems
    // have independent ++id keyspaces, so this collision is routine.
    mockPhotos.toArray.mockResolvedValue([
      { id: 100, itemId: 1, itemType: "house", sortOrder: 0 },
      { id: 101, itemId: 1, itemType: "sale", sortOrder: 0 },
    ]);
    mockPhotoUploadQueue.toArray.mockResolvedValue([]);

    // The fixed helper must be called with the itemTable arg; the dispatcher
    // keys the resolved UUID on BOTH oldId AND itemTable.
    mockGetNewIdByOldId.mockImplementation(
      async (
        _oldId: number,
        _type: "session" | "item",
        itemTable?: "house" | "sale",
      ) => {
        if (itemTable === "house") return "uuid-house-1";
        if (itemTable === "sale") return "uuid-sale-1";
        return null;
      },
    );

    // Both UUIDs exist in Supabase so neither photo is skipped.
    setupSupabaseItemLookup({
      "uuid-house-1": "uuid-session-house",
      "uuid-sale-1": "uuid-session-sale",
    });

    const { migrateExistingPhotos } = await import(
      "../services/photoMigration"
    );
    await migrateExistingPhotos();

    // Each photo resolves to its OWN table's UUID — never the other's.
    expect(mockEnqueuePhotoUpload).toHaveBeenCalledWith(
      expect.objectContaining({ dexiePhotoId: 100, itemId: "uuid-house-1" }),
    );
    expect(mockEnqueuePhotoUpload).toHaveBeenCalledWith(
      expect.objectContaining({ dexiePhotoId: 101, itemId: "uuid-sale-1" }),
    );

    // Pin the discriminator wiring, not just the result: the fixed code must
    // pass photo.itemType through as the itemTable argument.
    expect(mockGetNewIdByOldId).toHaveBeenCalledWith(1, "item", "house");
    expect(mockGetNewIdByOldId).toHaveBeenCalledWith(1, "item", "sale");
  });
});
