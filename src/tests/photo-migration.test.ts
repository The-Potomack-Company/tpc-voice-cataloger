import { describe, it, expect, beforeEach, vi } from "vitest";

// --- Mocks ---
const { mockPhotoUploadQueue, mockPhotos, mockIdMapping } = vi.hoisted(() => {
  const mockPhotoUploadQueue = {
    where: vi.fn(),
    toArray: vi.fn(),
    add: vi.fn(),
    bulkAdd: vi.fn(),
  };
  const mockPhotos = {
    toArray: vi.fn(),
    where: vi.fn(),
  };
  const mockIdMapping = {
    where: vi.fn(),
  };
  return { mockPhotoUploadQueue, mockPhotos, mockIdMapping };
});

vi.mock("../db", () => ({
  db: {
    photoUploadQueue: mockPhotoUploadQueue,
    photos: mockPhotos,
    idMapping: mockIdMapping,
  },
}));

// migrateExistingPhotos now resolves itemId via the getNewIdByOldId helper
// (itemTable-scoped, Phase 43) rather than the raw db.idMapping query chain.
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
  const mockSupabaseFrom = vi.fn();
  return { mockSupabaseFrom };
});

vi.mock("../lib/supabase", () => ({
  supabase: {
    from: mockSupabaseFrom,
  },
}));

describe("photo migration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    // Reset module cache so localStorage check re-runs
    vi.resetModules();
  });

  describe("detectUnuploadedPhotos", () => {
    it("returns count of Dexie photos without queue entries", async () => {
      mockPhotos.toArray.mockResolvedValue([
        { id: 1, itemId: 10, sortOrder: 0 },
        { id: 2, itemId: 10, sortOrder: 1 },
        { id: 3, itemId: 20, sortOrder: 0 },
      ]);
      mockPhotoUploadQueue.toArray.mockResolvedValue([
        { dexiePhotoId: 1, status: "uploaded" },
      ]);

      const { detectUnuploadedPhotos } = await import(
        "../services/photoMigration"
      );
      const count = await detectUnuploadedPhotos();
      expect(count).toBe(2);
    });

    it("returns 0 when all photos already have queue entries", async () => {
      mockPhotos.toArray.mockResolvedValue([
        { id: 1, itemId: 10, sortOrder: 0 },
        { id: 2, itemId: 10, sortOrder: 1 },
      ]);
      mockPhotoUploadQueue.toArray.mockResolvedValue([
        { dexiePhotoId: 1, status: "uploaded" },
        { dexiePhotoId: 2, status: "uploaded" },
      ]);

      const { detectUnuploadedPhotos } = await import(
        "../services/photoMigration"
      );
      const count = await detectUnuploadedPhotos();
      expect(count).toBe(0);
    });

    it("skips photos that already have pending/uploading/failed queue entries", async () => {
      mockPhotos.toArray.mockResolvedValue([
        { id: 1, itemId: 10, sortOrder: 0 },
        { id: 2, itemId: 10, sortOrder: 1 },
        { id: 3, itemId: 20, sortOrder: 0 },
      ]);
      mockPhotoUploadQueue.toArray.mockResolvedValue([
        { dexiePhotoId: 1, status: "pending" },
        { dexiePhotoId: 2, status: "uploading" },
        { dexiePhotoId: 3, status: "failed" },
      ]);

      const { detectUnuploadedPhotos } = await import(
        "../services/photoMigration"
      );
      const count = await detectUnuploadedPhotos();
      expect(count).toBe(0); // All handled (regardless of status)
    });
  });

  describe("migrateExistingPhotos", () => {
    function setupIdMappingMock(mappings: Record<number, string>) {
      mockGetNewIdByOldId.mockImplementation(
        async (oldId: number) => mappings[oldId] ?? null,
      );
    }

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

    it("creates queue entries for un-uploaded photos", async () => {
      mockPhotos.toArray.mockResolvedValue([
        { id: 1, itemId: 10, sortOrder: 0 },
        { id: 2, itemId: 10, sortOrder: 1 },
      ]);
      mockPhotoUploadQueue.toArray.mockResolvedValue([]);

      setupIdMappingMock({ 10: "uuid-item-10" });
      setupSupabaseItemLookup({ "uuid-item-10": "uuid-session-1" });

      const { migrateExistingPhotos } = await import(
        "../services/photoMigration"
      );
      const result = await migrateExistingPhotos();

      expect(result.total).toBe(2);
      expect(result.queued).toBe(2);
      expect(mockEnqueuePhotoUpload).toHaveBeenCalledTimes(2);
      expect(mockEnqueuePhotoUpload).toHaveBeenCalledWith({
        dexiePhotoId: 1,
        itemId: "uuid-item-10",
        sessionId: "uuid-session-1",
        sortOrder: 0,
      });
    });

    it("resolves Dexie itemId to Supabase UUID via idMapping", async () => {
      mockPhotos.toArray.mockResolvedValue([
        { id: 5, itemId: 42, sortOrder: 0 },
      ]);
      mockPhotoUploadQueue.toArray.mockResolvedValue([]);

      setupIdMappingMock({ 42: "uuid-item-42" });
      setupSupabaseItemLookup({ "uuid-item-42": "uuid-session-99" });

      const { migrateExistingPhotos } = await import(
        "../services/photoMigration"
      );
      await migrateExistingPhotos();

      expect(mockGetNewIdByOldId).toHaveBeenCalledWith(42, "item", undefined);
      expect(mockEnqueuePhotoUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: "uuid-item-42",
          sessionId: "uuid-session-99",
        }),
      );
    });

    it("triggers drainPhotoQueue after queueing", async () => {
      mockPhotos.toArray.mockResolvedValue([
        { id: 1, itemId: 10, sortOrder: 0 },
      ]);
      mockPhotoUploadQueue.toArray.mockResolvedValue([]);

      setupIdMappingMock({ 10: "uuid-item-10" });
      setupSupabaseItemLookup({ "uuid-item-10": "uuid-session-1" });

      const { migrateExistingPhotos } = await import(
        "../services/photoMigration"
      );
      await migrateExistingPhotos();

      expect(mockDrainPhotoQueue).toHaveBeenCalled();
    });

    it("sets localStorage flag after completion", async () => {
      mockPhotos.toArray.mockResolvedValue([
        { id: 1, itemId: 10, sortOrder: 0 },
      ]);
      mockPhotoUploadQueue.toArray.mockResolvedValue([]);

      setupIdMappingMock({ 10: "uuid-item-10" });
      setupSupabaseItemLookup({ "uuid-item-10": "uuid-session-1" });

      const { migrateExistingPhotos } = await import(
        "../services/photoMigration"
      );
      await migrateExistingPhotos();

      expect(localStorage.getItem("photo_migration_v1_complete")).toBe("true");
    });

    it("skips if localStorage flag already set", async () => {
      localStorage.setItem("photo_migration_v1_complete", "true");

      const { migrateExistingPhotos } = await import(
        "../services/photoMigration"
      );
      const result = await migrateExistingPhotos();

      expect(result.total).toBe(0);
      expect(result.queued).toBe(0);
      expect(mockPhotos.toArray).not.toHaveBeenCalled();
    });

    it("does NOT set the completion flag when a photo's item is not yet in Supabase, and retries it on a later run (DAT-6)", async () => {
      // Two photos: item 10 exists in Supabase, item 20 does not yet.
      mockPhotos.toArray.mockResolvedValue([
        { id: 1, itemId: 10, sortOrder: 0 },
        { id: 2, itemId: 20, sortOrder: 0 },
      ]);
      mockPhotoUploadQueue.toArray.mockResolvedValue([]);

      setupIdMappingMock({ 10: "uuid-item-10", 20: "uuid-item-20" });
      // Only uuid-item-10 resolves; uuid-item-20 returns null (not migrated yet).
      setupSupabaseItemLookup({ "uuid-item-10": "uuid-session-1" });

      const { migrateExistingPhotos } = await import(
        "../services/photoMigration"
      );
      const result = await migrateExistingPhotos();

      // (a) one skipped, the resolved one queued
      expect(result.skipped).toBeGreaterThanOrEqual(1);
      expect(result.queued).toBe(1);
      expect(result.total).toBe(2);
      expect(mockEnqueuePhotoUpload).toHaveBeenCalledTimes(1);

      // (b) flag NOT set — skipped photos must be retried
      expect(localStorage.getItem("photo_migration_v1_complete")).toBe(null);

      // (c) a second run does NOT early-return: it re-enters the loop and
      // re-attempts the skipped photo, which now resolves and gets queued.
      mockEnqueuePhotoUpload.mockClear();
      // Photo 1 is now handled (it was queued last run); only photo 2 remains.
      mockPhotos.toArray.mockResolvedValue([
        { id: 1, itemId: 10, sortOrder: 0 },
        { id: 2, itemId: 20, sortOrder: 0 },
      ]);
      mockPhotoUploadQueue.toArray.mockResolvedValue([
        { dexiePhotoId: 1, status: "pending" },
      ]);
      // Item 20 has now been migrated to Supabase.
      setupSupabaseItemLookup({
        "uuid-item-10": "uuid-session-1",
        "uuid-item-20": "uuid-session-2",
      });

      const result2 = await migrateExistingPhotos();

      expect(mockPhotos.toArray).toHaveBeenCalled(); // did NOT early-return
      expect(result2.total).toBe(1);
      expect(result2.queued).toBe(1);
      expect(result2.skipped).toBe(0);
      expect(mockEnqueuePhotoUpload).toHaveBeenCalledTimes(1);
      expect(mockEnqueuePhotoUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          dexiePhotoId: 2,
          itemId: "uuid-item-20",
          sessionId: "uuid-session-2",
        }),
      );
      // Now that nothing was skipped, the flag IS set.
      expect(localStorage.getItem("photo_migration_v1_complete")).toBe("true");
    });
  });
});
