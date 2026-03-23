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
      mockIdMapping.where.mockReturnValue({
        equals: vi.fn().mockImplementation((oldId: number) => ({
          filter: vi.fn().mockImplementation(() => ({
            first: vi.fn().mockResolvedValue(
              mappings[oldId]
                ? { oldId, newId: mappings[oldId], type: "item" }
                : undefined,
            ),
          })),
        })),
      });
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

      expect(mockIdMapping.where).toHaveBeenCalledWith("oldId");
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
  });
});
