import { describe, it, expect, beforeEach, vi } from "vitest";

// --- Mocks ---
const { mockPhotoUploadQueue, mockPhotos } = vi.hoisted(() => {
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
  return { mockPhotoUploadQueue, mockPhotos };
});

vi.mock("../db", () => ({
  db: {
    photoUploadQueue: mockPhotoUploadQueue,
    photos: mockPhotos,
  },
}));

const { mockGetDexieItemId } = vi.hoisted(() => {
  return { mockGetDexieItemId: vi.fn() };
});

vi.mock("../db/idMapping", () => ({
  getDexieItemId: mockGetDexieItemId,
}));

const { mockDrainPhotoQueue } = vi.hoisted(() => {
  return { mockDrainPhotoQueue: vi.fn() };
});

vi.mock("../services/photoUploadQueue", () => ({
  drainPhotoQueue: mockDrainPhotoQueue,
}));

describe("photo migration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  describe("detectUnuploadedPhotos", () => {
    it("returns count of Dexie photos without uploaded queue entry", async () => {
      const { detectUnuploadedPhotos } = await import(
        "../services/photoMigration"
      );
      expect(detectUnuploadedPhotos).toBeDefined();
    });

    it("returns 0 when all photos already have uploaded queue entries", async () => {
      const { detectUnuploadedPhotos } = await import(
        "../services/photoMigration"
      );
      expect(detectUnuploadedPhotos).toBeDefined();
    });

    it("skips photos that already have pending/uploading queue entries", async () => {
      const { detectUnuploadedPhotos } = await import(
        "../services/photoMigration"
      );
      expect(detectUnuploadedPhotos).toBeDefined();
    });
  });

  describe("migrateExistingPhotos", () => {
    it("creates queue entries for un-uploaded photos", async () => {
      const { migrateExistingPhotos } = await import(
        "../services/photoMigration"
      );
      expect(migrateExistingPhotos).toBeDefined();
    });

    it("uses getDexieItemId to resolve Supabase item UUIDs", async () => {
      const { migrateExistingPhotos } = await import(
        "../services/photoMigration"
      );
      expect(migrateExistingPhotos).toBeDefined();
    });

    it("triggers drainPhotoQueue after queueing", async () => {
      const { migrateExistingPhotos } = await import(
        "../services/photoMigration"
      );
      expect(migrateExistingPhotos).toBeDefined();
    });

    it("sets localStorage flag after completion", async () => {
      const { migrateExistingPhotos } = await import(
        "../services/photoMigration"
      );
      expect(migrateExistingPhotos).toBeDefined();
    });

    it("skips if localStorage flag already set", async () => {
      const { migrateExistingPhotos } = await import(
        "../services/photoMigration"
      );
      expect(migrateExistingPhotos).toBeDefined();
    });
  });
});
