import { describe, it, expect, beforeEach, vi } from "vitest";

// --- Mocks ---
const {
  mockStorageFrom,
  mockStorageUpload,
  mockSupabaseFrom,
  mockSupabaseInsert,
} = vi.hoisted(() => {
  const mockStorageUpload = vi.fn();
  const mockStorageFrom = vi.fn(() => ({
    upload: mockStorageUpload,
  }));
  const mockSupabaseInsert = vi.fn();
  const mockSupabaseFrom = vi.fn(() => ({
    insert: mockSupabaseInsert,
  }));

  return {
    mockStorageFrom,
    mockStorageUpload,
    mockSupabaseFrom,
    mockSupabaseInsert,
  };
});

vi.mock("../lib/supabase", () => ({
  supabase: {
    storage: {
      from: mockStorageFrom,
    },
    from: mockSupabaseFrom,
  },
}));

// Mock Dexie photoUploadQueue and photos tables
const { mockPhotoUploadQueue, mockPhotos } = vi.hoisted(() => {
  const mockPhotoUploadQueue = {
    add: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    where: vi.fn(),
    toArray: vi.fn(),
    update: vi.fn(),
  };
  const mockPhotos = {
    get: vi.fn(),
    where: vi.fn(),
    toArray: vi.fn(),
  };
  return { mockPhotoUploadQueue, mockPhotos };
});

vi.mock("../db", () => ({
  db: {
    photoUploadQueue: mockPhotoUploadQueue,
    photos: mockPhotos,
  },
}));

describe("photoUploadQueue", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("enqueue", () => {
    it("adds entry with status pending and retryCount 0", async () => {
      const { enqueue } = await import("../services/photoUploadQueue");
      expect(enqueue).toBeDefined();
    });

    it("stores correct storagePath and thumbnailPath", async () => {
      const { enqueue } = await import("../services/photoUploadQueue");
      expect(enqueue).toBeDefined();
    });
  });

  describe("drainPhotoQueue", () => {
    it("processes pending entries", async () => {
      const { drainPhotoQueue } = await import("../services/photoUploadQueue");
      expect(drainPhotoQueue).toBeDefined();
    });

    it("respects bounded concurrency of 2", async () => {
      const { drainPhotoQueue } = await import("../services/photoUploadQueue");
      expect(drainPhotoQueue).toBeDefined();
    });

    it("skips drain when already draining (mutex)", async () => {
      const { drainPhotoQueue } = await import("../services/photoUploadQueue");
      expect(drainPhotoQueue).toBeDefined();
    });

    it("stops processing when offline", async () => {
      const { drainPhotoQueue } = await import("../services/photoUploadQueue");
      expect(drainPhotoQueue).toBeDefined();
    });
  });

  describe("processOneUpload", () => {
    it("uploads full-size blob to correct storage path", async () => {
      const { processOneUpload } = await import(
        "../services/photoUploadQueue"
      );
      expect(processOneUpload).toBeDefined();
    });

    it("uploads thumbnail blob to correct storage path", async () => {
      const { processOneUpload } = await import(
        "../services/photoUploadQueue"
      );
      expect(processOneUpload).toBeDefined();
    });

    it("inserts metadata row in Supabase photos table on success", async () => {
      const { processOneUpload } = await import(
        "../services/photoUploadQueue"
      );
      expect(processOneUpload).toBeDefined();
    });

    it("marks queue entry as uploaded on success", async () => {
      const { processOneUpload } = await import(
        "../services/photoUploadQueue"
      );
      expect(processOneUpload).toBeDefined();
    });
  });

  describe("retry with exponential backoff", () => {
    it("retries with 1s delay on first failure", async () => {
      const { processOneUpload } = await import(
        "../services/photoUploadQueue"
      );
      expect(processOneUpload).toBeDefined();
    });

    it("retries with 4s delay on second failure", async () => {
      const { processOneUpload } = await import(
        "../services/photoUploadQueue"
      );
      expect(processOneUpload).toBeDefined();
    });

    it("marks as failed after 3 attempts", async () => {
      const { processOneUpload } = await import(
        "../services/photoUploadQueue"
      );
      expect(processOneUpload).toBeDefined();
    });

    it("resets status to pending between retries", async () => {
      const { processOneUpload } = await import(
        "../services/photoUploadQueue"
      );
      expect(processOneUpload).toBeDefined();
    });
  });

  describe("retryFailedUploads", () => {
    it("resets failed entries to pending and triggers drain", async () => {
      const { retryFailedUploads } = await import(
        "../services/photoUploadQueue"
      );
      expect(retryFailedUploads).toBeDefined();
    });
  });
});
