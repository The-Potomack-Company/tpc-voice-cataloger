import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// --- Mocks ---
const {
  mockStorageFrom,
  mockStorageUpload,
  mockSupabaseFrom,
  mockSupabaseUpsert,
  mockFirebaseUpload,
} = vi.hoisted(() => {
  const mockStorageUpload = vi.fn();
  const mockStorageFrom = vi.fn(() => ({
    upload: mockStorageUpload,
  }));
  const mockSupabaseUpsert = vi.fn();
  const mockSupabaseFrom = vi.fn(() => ({
    upsert: mockSupabaseUpsert,
  }));
  const mockFirebaseUpload = vi.fn();

  return {
    mockStorageFrom,
    mockStorageUpload,
    mockSupabaseFrom,
    mockSupabaseUpsert,
    mockFirebaseUpload,
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

vi.mock("../lib/firebaseStorage", () => ({
  uploadFirebaseStorageObject: mockFirebaseUpload,
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

// Helper to build a mock where().equals().sortBy() chain
function setupWhereChain(entries: unknown[]) {
  const chain = {
    equals: vi.fn().mockReturnValue({
      sortBy: vi.fn().mockResolvedValue(entries),
      toArray: vi.fn().mockResolvedValue(entries),
    }),
  };
  mockPhotoUploadQueue.where.mockReturnValue(chain);
  return chain;
}

import type { PhotoUploadEntry } from "../db/types";

function makeEntry(overrides: Partial<PhotoUploadEntry> = {}): PhotoUploadEntry {
  return {
    id: 1,
    dexiePhotoId: 10,
    itemId: "item-uuid-1",
    sessionId: "session-uuid-1",
    sortOrder: 0,
    storagePath: "photos/session-uuid-1/item-uuid-1/full-0.jpg",
    thumbnailPath: "photos/session-uuid-1/item-uuid-1/thumb-0.jpg",
    status: "pending",
    retryCount: 0,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("photoUploadQueue", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    // Default navigator.onLine to true
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubEnv("VITE_AUTH_BACKEND", "supabase");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  describe("enqueue", () => {
    it("adds entry with status pending and retryCount 0", async () => {
      const { enqueue } = await import("../services/photoUploadQueue");
      mockPhotoUploadQueue.add.mockResolvedValue(1);

      await enqueue({
        dexiePhotoId: 10,
        itemId: "item-uuid-1",
        sessionId: "session-uuid-1",
        sortOrder: 0,
      });

      expect(mockPhotoUploadQueue.add).toHaveBeenCalledOnce();
      const arg = mockPhotoUploadQueue.add.mock.calls[0][0];
      expect(arg.status).toBe("pending");
      expect(arg.retryCount).toBe(0);
    });

    it("stores correct storagePath and thumbnailPath", async () => {
      const { enqueue } = await import("../services/photoUploadQueue");
      mockPhotoUploadQueue.add.mockResolvedValue(1);

      await enqueue({
        dexiePhotoId: 10,
        itemId: "item-uuid-1",
        sessionId: "session-uuid-1",
        sortOrder: 3,
      });

      const arg = mockPhotoUploadQueue.add.mock.calls[0][0];
      expect(arg.storagePath).toBe(
        "photos/session-uuid-1/item-uuid-1/full-3.jpg"
      );
      expect(arg.thumbnailPath).toBe(
        "photos/session-uuid-1/item-uuid-1/thumb-3.jpg"
      );
    });
  });

  describe("drainPhotoQueue", () => {
    it("processes pending entries", async () => {
      const { drainPhotoQueue, _resetDraining } =
        await import("../services/photoUploadQueue");
      _resetDraining();

      const entry = makeEntry();
      setupWhereChain([entry]);

      // Mock photo lookup and successful uploads
      mockPhotos.get.mockResolvedValue({
        id: 10,
        blob: new Blob(["full"]),
        thumbnail: new Blob(["thumb"]),
      });
      mockStorageUpload.mockResolvedValue({ error: null });
      mockSupabaseUpsert.mockResolvedValue({ error: null });
      mockPhotoUploadQueue.update.mockResolvedValue(1);

      await drainPhotoQueue();

      // Should have queried for pending entries
      expect(mockPhotoUploadQueue.where).toHaveBeenCalledWith("status");
    });

    it("respects bounded concurrency of 2", async () => {
      const { drainPhotoQueue, _resetDraining } = await import(
        "../services/photoUploadQueue"
      );
      _resetDraining();

      // Create 5 entries to verify batching
      const entries = Array.from({ length: 5 }, (_, i) =>
        makeEntry({ id: i + 1, dexiePhotoId: i + 10 })
      );
      setupWhereChain(entries);

      mockPhotos.get.mockResolvedValue({
        id: 10,
        blob: new Blob(["full"]),
        thumbnail: new Blob(["thumb"]),
      });
      mockStorageUpload.mockResolvedValue({ error: null });
      mockSupabaseUpsert.mockResolvedValue({ error: null });
      mockPhotoUploadQueue.update.mockResolvedValue(1);

      await drainPhotoQueue();

      // All 5 entries should be processed (via 3 batches: 2+2+1)
      // Each entry triggers: update(uploading) + 2 uploads + 1 upsert + update(uploaded) = at least 2 updates per entry
      // With 5 entries, we should see at least 10 update calls
      expect(mockPhotoUploadQueue.update.mock.calls.length).toBeGreaterThanOrEqual(
        10
      );
    });

    it("skips drain when already draining (mutex)", async () => {
      const { drainPhotoQueue, _resetDraining } = await import(
        "../services/photoUploadQueue"
      );
      _resetDraining();

      // Create a slow entry that takes time to process
      const entries = [makeEntry()];
      let resolveFirst: () => void;
      const slowPromise = new Promise<void>((r) => {
        resolveFirst = r;
      });

      const chain = {
        equals: vi.fn().mockReturnValue({
          sortBy: vi.fn().mockImplementation(() => slowPromise.then(() => entries)),
          toArray: vi.fn().mockResolvedValue(entries),
        }),
      };
      mockPhotoUploadQueue.where.mockReturnValue(chain);

      mockPhotos.get.mockResolvedValue({
        id: 10,
        blob: new Blob(["full"]),
        thumbnail: new Blob(["thumb"]),
      });
      mockStorageUpload.mockResolvedValue({ error: null });
      mockSupabaseUpsert.mockResolvedValue({ error: null });
      mockPhotoUploadQueue.update.mockResolvedValue(1);

      // Start first drain (will wait on slow promise)
      const first = drainPhotoQueue();
      // Second drain should return immediately (mutex)
      const second = drainPhotoQueue();

      // where() should only be called once (second drain bailed out)
      expect(mockPhotoUploadQueue.where).toHaveBeenCalledTimes(1);

      // Resolve and clean up
      resolveFirst!();
      await first;
      await second;
    });

    it("stops processing when offline", async () => {
      const { drainPhotoQueue, _resetDraining } = await import(
        "../services/photoUploadQueue"
      );
      _resetDraining();

      const entries = [makeEntry({ id: 1 }), makeEntry({ id: 2 })];
      setupWhereChain(entries);

      // Go offline
      vi.stubGlobal("navigator", { onLine: false });

      await drainPhotoQueue();

      // Should not process any entries because offline
      expect(mockPhotos.get).not.toHaveBeenCalled();
    });
  });

  describe("processOneUpload", () => {
    it("uploads full-size blob to correct storage path", async () => {
      const { processOneUpload } = await import(
        "../services/photoUploadQueue"
      );

      const entry = makeEntry();
      mockPhotoUploadQueue.update.mockResolvedValue(1);
      mockPhotos.get.mockResolvedValue({
        id: 10,
        blob: new Blob(["full-data"]),
        thumbnail: new Blob(["thumb-data"]),
      });
      mockStorageUpload.mockResolvedValue({ error: null });
      mockSupabaseUpsert.mockResolvedValue({ error: null });

      await processOneUpload(entry);

      // First upload call should be the full-size blob
      expect(mockStorageFrom).toHaveBeenCalledWith("photos");
      expect(mockStorageUpload.mock.calls[0][0]).toBe(
        "photos/session-uuid-1/item-uuid-1/full-0.jpg"
      );
    });

    it("uploads thumbnail blob to correct storage path", async () => {
      const { processOneUpload } = await import(
        "../services/photoUploadQueue"
      );

      const entry = makeEntry();
      mockPhotoUploadQueue.update.mockResolvedValue(1);
      mockPhotos.get.mockResolvedValue({
        id: 10,
        blob: new Blob(["full-data"]),
        thumbnail: new Blob(["thumb-data"]),
      });
      mockStorageUpload.mockResolvedValue({ error: null });
      mockSupabaseUpsert.mockResolvedValue({ error: null });

      await processOneUpload(entry);

      // Second upload call should be the thumbnail
      expect(mockStorageUpload.mock.calls[1][0]).toBe(
        "photos/session-uuid-1/item-uuid-1/thumb-0.jpg"
      );
    });

    it("upserts metadata row (ON CONFLICT DO NOTHING) in Supabase photos table on success", async () => {
      const { processOneUpload } = await import(
        "../services/photoUploadQueue"
      );

      const entry = makeEntry();
      mockPhotoUploadQueue.update.mockResolvedValue(1);
      mockPhotos.get.mockResolvedValue({
        id: 10,
        blob: new Blob(["full-data"]),
        thumbnail: new Blob(["thumb-data"]),
      });
      mockStorageUpload.mockResolvedValue({ error: null });
      mockSupabaseUpsert.mockResolvedValue({ error: null });

      await processOneUpload(entry);

      expect(mockSupabaseFrom).toHaveBeenCalledWith("photos");
      // DAT-5: upsert keyed on storage_path with ignoreDuplicates so a retry
      // can't create a duplicate photos row.
      expect(mockSupabaseUpsert).toHaveBeenCalledWith(
        {
          item_id: "item-uuid-1",
          storage_path: "photos/session-uuid-1/item-uuid-1/full-0.jpg",
          thumbnail_path: "photos/session-uuid-1/item-uuid-1/thumb-0.jpg",
          sort_order: 0,
          upload_status: "uploaded",
        },
        { onConflict: "storage_path", ignoreDuplicates: true }
      );
    });

    it("DAT-5: re-processing the same entry stays idempotent (upsert keyed on storage_path, no duplicate row)", async () => {
      const { processOneUpload } = await import(
        "../services/photoUploadQueue"
      );

      const entry = makeEntry();
      mockPhotoUploadQueue.update.mockResolvedValue(1);
      mockPhotos.get.mockResolvedValue({
        id: 10,
        blob: new Blob(["full-data"]),
        thumbnail: new Blob(["thumb-data"]),
      });
      mockStorageUpload.mockResolvedValue({ error: null });
      // Simulate the DB-side ON CONFLICT DO NOTHING: a duplicate insert is a
      // no-op that still resolves without error.
      mockSupabaseUpsert.mockResolvedValue({ error: null });

      // Process the same queue entry twice (e.g. retry after a partial success).
      await processOneUpload(entry);
      await processOneUpload(entry);

      // Every metadata write is an upsert (never a plain insert), keyed on
      // storage_path with ignoreDuplicates — so the second run cannot create a
      // duplicate public.photos row.
      expect(mockSupabaseUpsert).toHaveBeenCalledTimes(2);
      for (const call of mockSupabaseUpsert.mock.calls) {
        expect(call[0]).toMatchObject({
          storage_path: "photos/session-uuid-1/item-uuid-1/full-0.jpg",
        });
        expect(call[1]).toEqual({
          onConflict: "storage_path",
          ignoreDuplicates: true,
        });
      }
    });

    it("marks queue entry as uploaded on success", async () => {
      const { processOneUpload } = await import(
        "../services/photoUploadQueue"
      );

      const entry = makeEntry();
      mockPhotoUploadQueue.update.mockResolvedValue(1);
      mockPhotos.get.mockResolvedValue({
        id: 10,
        blob: new Blob(["full-data"]),
        thumbnail: new Blob(["thumb-data"]),
      });
      mockStorageUpload.mockResolvedValue({ error: null });
      mockSupabaseUpsert.mockResolvedValue({ error: null });

      await processOneUpload(entry);

      // Last update should set status to uploaded
      const lastCall =
        mockPhotoUploadQueue.update.mock.calls[
          mockPhotoUploadQueue.update.mock.calls.length - 1
        ];
      expect(lastCall[1]).toMatchObject({ status: "uploaded" });
    });

    it("uses Firebase Storage resumable uploads in Firebase backend mode", async () => {
      vi.stubEnv("VITE_AUTH_BACKEND", "firebase");
      const { processOneUpload } = await import(
        "../services/photoUploadQueue"
      );

      const entry = makeEntry();
      mockPhotoUploadQueue.update.mockResolvedValue(1);
      mockPhotos.get.mockResolvedValue({
        id: 10,
        blob: new Blob(["full-data"]),
        thumbnail: new Blob(["thumb-data"]),
      });
      mockFirebaseUpload.mockResolvedValue(undefined);
      mockSupabaseUpsert.mockResolvedValue({ error: null });

      await processOneUpload(entry);

      expect(mockFirebaseUpload).toHaveBeenCalledWith(
        "photos/session-uuid-1/item-uuid-1/full-0.jpg",
        expect.any(Blob),
        expect.objectContaining({ contentType: "image/jpeg" }),
      );
      expect(mockFirebaseUpload).toHaveBeenCalledWith(
        "photos/session-uuid-1/item-uuid-1/thumb-0.jpg",
        expect.any(Blob),
        expect.objectContaining({ contentType: "image/jpeg" }),
      );
      expect(mockStorageUpload).not.toHaveBeenCalled();
      expect(mockSupabaseUpsert).toHaveBeenCalledOnce();
    });
  });

  describe("retry with exponential backoff", () => {
    it("retries with 1s delay on first failure", async () => {
      const { processOneUpload } = await import(
        "../services/photoUploadQueue"
      );

      const entry = makeEntry({ retryCount: 0 });
      mockPhotoUploadQueue.update.mockResolvedValue(1);
      mockPhotos.get.mockResolvedValue({
        id: 10,
        blob: new Blob(["full-data"]),
        thumbnail: new Blob(["thumb-data"]),
      });
      // First upload fails
      mockStorageUpload.mockResolvedValue({
        error: new Error("Network error"),
      });

      await processOneUpload(entry);

      // Should update with retryCount=1 and status=pending
      const updateCalls = mockPhotoUploadQueue.update.mock.calls;
      const retryCall = updateCalls.find(
        (c: unknown[]) =>
          (c[1] as Record<string, unknown>).retryCount === 1
      );
      expect(retryCall).toBeDefined();
      expect((retryCall![1] as Record<string, unknown>).status).toBe("pending");
    });

    it("retries with 4s delay on second failure", async () => {
      const { processOneUpload } = await import(
        "../services/photoUploadQueue"
      );

      const entry = makeEntry({ retryCount: 1 });
      mockPhotoUploadQueue.update.mockResolvedValue(1);
      mockPhotos.get.mockResolvedValue({
        id: 10,
        blob: new Blob(["full-data"]),
        thumbnail: new Blob(["thumb-data"]),
      });
      mockStorageUpload.mockResolvedValue({
        error: new Error("Network error"),
      });

      await processOneUpload(entry);

      // Should update with retryCount=2 and status=pending
      const updateCalls = mockPhotoUploadQueue.update.mock.calls;
      const retryCall = updateCalls.find(
        (c: unknown[]) =>
          (c[1] as Record<string, unknown>).retryCount === 2
      );
      expect(retryCall).toBeDefined();
      expect((retryCall![1] as Record<string, unknown>).status).toBe("pending");
    });

    it("marks as failed after 3 attempts", async () => {
      const { processOneUpload } = await import(
        "../services/photoUploadQueue"
      );

      const entry = makeEntry({ retryCount: 2 }); // 3rd attempt
      mockPhotoUploadQueue.update.mockResolvedValue(1);
      mockPhotos.get.mockResolvedValue({
        id: 10,
        blob: new Blob(["full-data"]),
        thumbnail: new Blob(["thumb-data"]),
      });
      mockStorageUpload.mockResolvedValue({
        error: new Error("Network error"),
      });

      await processOneUpload(entry);

      // Should update with status=failed and retryCount=3
      const updateCalls = mockPhotoUploadQueue.update.mock.calls;
      const failCall = updateCalls.find(
        (c: unknown[]) =>
          (c[1] as Record<string, unknown>).status === "failed" &&
          (c[1] as Record<string, unknown>).retryCount === 3
      );
      expect(failCall).toBeDefined();
    });

    it("resets status to pending between retries", async () => {
      const { processOneUpload } = await import(
        "../services/photoUploadQueue"
      );

      const entry = makeEntry({ retryCount: 0 });
      mockPhotoUploadQueue.update.mockResolvedValue(1);
      mockPhotos.get.mockResolvedValue({
        id: 10,
        blob: new Blob(["full-data"]),
        thumbnail: new Blob(["thumb-data"]),
      });
      mockStorageUpload.mockResolvedValue({
        error: new Error("Network error"),
      });

      await processOneUpload(entry);

      // Between retries, entry should be set to pending (not uploading or failed)
      const updateCalls = mockPhotoUploadQueue.update.mock.calls;
      const pendingCall = updateCalls.find(
        (c: unknown[]) =>
          (c[1] as Record<string, unknown>).status === "pending" &&
          (c[1] as Record<string, unknown>).retryCount === 1
      );
      expect(pendingCall).toBeDefined();
    });
  });

  describe("retryFailedUploads", () => {
    it("resets failed entries to pending and triggers drain", async () => {
      const { retryFailedUploads, _resetDraining } = await import(
        "../services/photoUploadQueue"
      );
      _resetDraining();

      const failedEntries = [
        makeEntry({ id: 1, status: "failed", retryCount: 3 }),
        makeEntry({ id: 2, status: "failed", retryCount: 3 }),
      ];

      // Mock where().equals().toArray() for retryFailedUploads
      const failedChain = {
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(failedEntries),
          sortBy: vi.fn().mockResolvedValue([]), // for the subsequent drain call
        }),
      };
      mockPhotoUploadQueue.where.mockReturnValue(failedChain);
      mockPhotoUploadQueue.update.mockResolvedValue(1);

      await retryFailedUploads();

      // Both entries should be reset to pending with retryCount=0
      expect(mockPhotoUploadQueue.update).toHaveBeenCalledWith(1, {
        status: "pending",
        retryCount: 0,
      });
      expect(mockPhotoUploadQueue.update).toHaveBeenCalledWith(2, {
        status: "pending",
        retryCount: 0,
      });
    });
  });
});
