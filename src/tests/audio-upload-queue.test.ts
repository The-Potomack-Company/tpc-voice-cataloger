// Wave-0 RED scaffold (Phase 32 plan 01). References ../services/audioUploadQueue,
// which plan 03 builds — this suite is EXPECTED to fail/not-resolve at this commit.
// Cloned from photo-upload-queue.test.ts:1-75 (vi.hoisted harness, setupWhereChain),
// swapping photoUploadQueue/photos -> audioUploadQueue/audio.
//
// Threading contracts the later plans must satisfy (PATTERNS.md):
//   * storagePath = audio/{sessionId}/{itemId}/{dexieAudioId}.{ext}
//   * ext is derived from the blob mime (NOT hardcoded .opus)
//   * itemId stays a UUID string (NOT coerced to int)
//   * metadata upsert uses onConflict:'storage_path', ignoreDuplicates:true (DAT-5)
//   * drain concurrency 2; backoff 4^retryCount * 1000; MAX_RETRIES 3 then failed
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

const {
  mockStorageFrom,
  mockStorageUpload,
  mockSupabaseFrom,
  mockSupabaseUpsert,
} = vi.hoisted(() => {
  const mockStorageUpload = vi.fn();
  const mockStorageFrom = vi.fn(() => ({
    upload: mockStorageUpload,
  }));
  const mockSupabaseUpsert = vi.fn();
  const mockSupabaseFrom = vi.fn(() => ({
    upsert: mockSupabaseUpsert,
  }));
  return { mockStorageFrom, mockStorageUpload, mockSupabaseFrom, mockSupabaseUpsert };
});

vi.mock("../lib/supabase", () => ({
  supabase: {
    storage: { from: mockStorageFrom },
    from: mockSupabaseFrom,
  },
}));

const { mockAudioUploadQueue, mockAudio } = vi.hoisted(() => {
  const mockAudioUploadQueue = {
    add: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    where: vi.fn(),
    toArray: vi.fn(),
    update: vi.fn(),
  };
  const mockAudio = {
    get: vi.fn(),
    where: vi.fn(),
    toArray: vi.fn(),
  };
  return { mockAudioUploadQueue, mockAudio };
});

vi.mock("../db", () => ({
  db: {
    audioUploadQueue: mockAudioUploadQueue,
    audio: mockAudio,
  },
}));

function setupWhereChain(entries: unknown[]) {
  const chain = {
    equals: vi.fn().mockReturnValue({
      sortBy: vi.fn().mockResolvedValue(entries),
      toArray: vi.fn().mockResolvedValue(entries),
    }),
  };
  mockAudioUploadQueue.where.mockReturnValue(chain);
  return chain;
}

// AudioUploadEntry is defined by plan 03 in db/types; describe its expected shape
// here so the scaffold compiles against the contract, not the (not-yet-built) type.
interface AudioUploadEntry {
  id?: number;
  dexieAudioId: number;
  itemId: string;
  sessionId: string;
  storagePath: string;
  mimeType: string;
  status: "pending" | "uploading" | "uploaded" | "failed";
  retryCount: number;
  createdAt: Date;
  lastAttemptAt?: Date;
}

function makeEntry(overrides: Partial<AudioUploadEntry> = {}): AudioUploadEntry {
  return {
    id: 1,
    dexieAudioId: 10,
    itemId: "item-uuid-1",
    sessionId: "session-uuid-1",
    storagePath: "audio/session-uuid-1/item-uuid-1/10.webm",
    mimeType: "audio/webm",
    status: "pending",
    retryCount: 0,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("audioUploadQueue", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.stubGlobal("navigator", { onLine: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("enqueueAudioUpload", () => {
    it("adds entry with status pending and retryCount 0", async () => {
      const { enqueueAudioUpload } = await import("../services/audioUploadQueue");
      mockAudioUploadQueue.add.mockResolvedValue(1);

      await enqueueAudioUpload({
        dexieAudioId: 10,
        itemId: "item-uuid-1",
        sessionId: "session-uuid-1",
        mimeType: "audio/webm",
      });

      expect(mockAudioUploadQueue.add).toHaveBeenCalledOnce();
      const arg = mockAudioUploadQueue.add.mock.calls[0][0];
      expect(arg.status).toBe("pending");
      expect(arg.retryCount).toBe(0);
    });

    it("derives storagePath ext from the blob mime, keeps itemId as a UUID string", async () => {
      const { enqueueAudioUpload } = await import("../services/audioUploadQueue");
      mockAudioUploadQueue.add.mockResolvedValue(1);

      await enqueueAudioUpload({
        dexieAudioId: 10,
        itemId: "item-uuid-1",
        sessionId: "session-uuid-1",
        mimeType: "audio/webm",
      });

      const arg = mockAudioUploadQueue.add.mock.calls[0][0];
      // ext mapped from mime (webm), NOT hardcoded .opus; itemId is the UUID string.
      expect(arg.storagePath).toBe("audio/session-uuid-1/item-uuid-1/10.webm");
      expect(arg.itemId).toBe("item-uuid-1");
      expect(typeof arg.itemId).toBe("string");
    });

    it("uses the mp4 ext for an audio/mp4 blob", async () => {
      const { enqueueAudioUpload } = await import("../services/audioUploadQueue");
      mockAudioUploadQueue.add.mockResolvedValue(1);

      await enqueueAudioUpload({
        dexieAudioId: 11,
        itemId: "item-uuid-1",
        sessionId: "session-uuid-1",
        mimeType: "audio/mp4",
      });

      const arg = mockAudioUploadQueue.add.mock.calls[0][0];
      expect(arg.storagePath).toBe("audio/session-uuid-1/item-uuid-1/11.mp4");
    });
  });

  describe("drainAudioQueue", () => {
    it("queries pending entries and respects bounded concurrency of 2", async () => {
      const { drainAudioQueue, _resetDraining } = await import(
        "../services/audioUploadQueue"
      );
      _resetDraining();

      const entries = Array.from({ length: 5 }, (_, i) =>
        makeEntry({ id: i + 1, dexieAudioId: i + 10 })
      );
      setupWhereChain(entries);

      mockAudio.get.mockResolvedValue({ id: 10, blob: new Blob(["audio"]) });
      mockStorageUpload.mockResolvedValue({ error: null });
      mockSupabaseUpsert.mockResolvedValue({ error: null });
      mockAudioUploadQueue.update.mockResolvedValue(1);

      await drainAudioQueue();

      expect(mockAudioUploadQueue.where).toHaveBeenCalledWith("status");
      // 5 entries across batches of 2 => at least 2 updates per entry.
      expect(mockAudioUploadQueue.update.mock.calls.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe("processOneAudioUpload", () => {
    it("uploads the blob to the mime-derived path and upserts metadata (DAT-5)", async () => {
      const { processOneAudioUpload } = await import(
        "../services/audioUploadQueue"
      );

      const entry = makeEntry();
      mockAudioUploadQueue.update.mockResolvedValue(1);
      mockAudio.get.mockResolvedValue({ id: 10, blob: new Blob(["audio-data"]) });
      mockStorageUpload.mockResolvedValue({ error: null });
      mockSupabaseUpsert.mockResolvedValue({ error: null });

      await processOneAudioUpload(entry);

      expect(mockStorageFrom).toHaveBeenCalledWith("audio");
      expect(mockStorageUpload.mock.calls[0][0]).toBe(
        "audio/session-uuid-1/item-uuid-1/10.webm"
      );
      expect(mockSupabaseFrom).toHaveBeenCalledWith("audio");
      expect(mockSupabaseUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          item_id: "item-uuid-1",
          storage_path: "audio/session-uuid-1/item-uuid-1/10.webm",
          mime_type: "audio/webm",
          upload_status: "uploaded",
        }),
        { onConflict: "storage_path", ignoreDuplicates: true }
      );
    });

    it("retries with 4^retryCount*1000 backoff and stays pending on first failure", async () => {
      const { processOneAudioUpload } = await import(
        "../services/audioUploadQueue"
      );

      const entry = makeEntry({ retryCount: 0 });
      mockAudioUploadQueue.update.mockResolvedValue(1);
      mockAudio.get.mockResolvedValue({ id: 10, blob: new Blob(["audio-data"]) });
      mockStorageUpload.mockResolvedValue({ error: new Error("Network error") });

      await processOneAudioUpload(entry);

      const retryCall = mockAudioUploadQueue.update.mock.calls.find(
        (c: unknown[]) => (c[1] as Record<string, unknown>).retryCount === 1
      );
      expect(retryCall).toBeDefined();
      expect((retryCall![1] as Record<string, unknown>).status).toBe("pending");
    });

    it("marks failed after MAX_RETRIES (3) attempts", async () => {
      const { processOneAudioUpload } = await import(
        "../services/audioUploadQueue"
      );

      const entry = makeEntry({ retryCount: 2 }); // 3rd attempt
      mockAudioUploadQueue.update.mockResolvedValue(1);
      mockAudio.get.mockResolvedValue({ id: 10, blob: new Blob(["audio-data"]) });
      mockStorageUpload.mockResolvedValue({ error: new Error("Network error") });

      await processOneAudioUpload(entry);

      const failCall = mockAudioUploadQueue.update.mock.calls.find(
        (c: unknown[]) =>
          (c[1] as Record<string, unknown>).status === "failed" &&
          (c[1] as Record<string, unknown>).retryCount === 3
      );
      expect(failCall).toBeDefined();
    });
  });

  describe("resweepFailedUploads (bounded failed->pending self-heal)", () => {
    // Routes db.audioUploadQueue.where("status").equals(<x>) to different
    // backing arrays: 'failed' feeds the resweep toArray(), 'pending' feeds the
    // subsequent drain sortBy(). Lets one test exercise failed->pending->uploaded.
    function setupStatusChains(byStatus: {
      failed?: unknown[];
      pending?: unknown[];
      uploading?: unknown[];
    }) {
      mockAudioUploadQueue.where.mockReturnValue({
        equals: vi.fn((status: string) => ({
          toArray: vi.fn().mockResolvedValue(
            (byStatus[status as "failed" | "pending" | "uploading"] ?? []) as unknown[],
          ),
          sortBy: vi.fn().mockResolvedValue(
            (byStatus[status as "failed" | "pending" | "uploading"] ?? []) as unknown[],
          ),
        })),
      });
    }

    it("resets a below-cap failed entry to pending WITHOUT zeroing retryCount", async () => {
      const { resweepFailedUploads, _resetDraining } = await import(
        "../services/audioUploadQueue"
      );
      _resetDraining();

      const failed = makeEntry({ id: 7, status: "failed", retryCount: 3 });
      setupStatusChains({ failed: [failed], pending: [] });
      mockAudioUploadQueue.update.mockResolvedValue(1);

      await resweepFailedUploads();

      const resetCall = mockAudioUploadQueue.update.mock.calls.find(
        (c: unknown[]) => c[0] === 7,
      );
      expect(resetCall).toBeDefined();
      const patch = resetCall![1] as Record<string, unknown>;
      expect(patch.status).toBe("pending");
      // Bounded self-heal: retryCount preserved so the entry ages out (no re-arm storm).
      expect(patch.retryCount).toBeUndefined();
    });

    it("reclaims a STALE `uploading` entry (crash mid-upload) back to pending", async () => {
      const { resweepFailedUploads, _resetDraining } = await import(
        "../services/audioUploadQueue"
      );
      _resetDraining();

      // lastAttemptAt well past the staleness threshold → crashed claim.
      const stale = makeEntry({
        id: 11,
        status: "uploading",
        retryCount: 0,
        lastAttemptAt: new Date(Date.now() - 10 * 60 * 1000),
      });
      setupStatusChains({ failed: [], pending: [], uploading: [stale] });
      mockAudioUploadQueue.update.mockResolvedValue(1);

      await resweepFailedUploads();

      const resetCall = mockAudioUploadQueue.update.mock.calls.find(
        (c: unknown[]) =>
          c[0] === 11 && (c[1] as Record<string, unknown>).status === "pending",
      );
      expect(resetCall).toBeDefined();
      // retryCount preserved (ages out under cap, no re-arm storm).
      expect((resetCall![1] as Record<string, unknown>).retryCount).toBeUndefined();
    });

    it("does NOT reset a FRESH `uploading` entry (live in-flight upload)", async () => {
      const { resweepFailedUploads, _resetDraining } = await import(
        "../services/audioUploadQueue"
      );
      _resetDraining();

      // Claimed seconds ago → a genuinely in-flight upload, must be left alone.
      const live = makeEntry({
        id: 12,
        status: "uploading",
        retryCount: 0,
        lastAttemptAt: new Date(Date.now() - 5 * 1000),
      });
      setupStatusChains({ failed: [], pending: [], uploading: [live] });
      mockAudioUploadQueue.update.mockResolvedValue(1);

      await resweepFailedUploads();

      const resetCall = mockAudioUploadQueue.update.mock.calls.find(
        (c: unknown[]) =>
          c[0] === 12 && (c[1] as Record<string, unknown>).status === "pending",
      );
      expect(resetCall).toBeUndefined();
    });

    it("leaves an at/over-cap failed entry terminal (no re-arm)", async () => {
      const { resweepFailedUploads, _resetDraining } = await import(
        "../services/audioUploadQueue"
      );
      _resetDraining();

      const stuck = makeEntry({ id: 9, status: "failed", retryCount: 99 });
      setupStatusChains({ failed: [stuck], pending: [] });
      mockAudioUploadQueue.update.mockResolvedValue(1);

      await resweepFailedUploads();

      const resetCall = mockAudioUploadQueue.update.mock.calls.find(
        (c: unknown[]) =>
          c[0] === 9 && (c[1] as Record<string, unknown>).status === "pending",
      );
      expect(resetCall).toBeUndefined();
    });

    it("failed -> pending -> uploaded: a below-cap entry with a live blob lands the audio row", async () => {
      const { resweepFailedUploads, _resetDraining } = await import(
        "../services/audioUploadQueue"
      );
      _resetDraining();

      const failed = makeEntry({ id: 5, dexieAudioId: 50, status: "failed", retryCount: 1 });
      // After resweep flips it to pending, the drain reads it from the pending chain.
      const pendingVersion = makeEntry({ id: 5, dexieAudioId: 50, status: "pending", retryCount: 1 });
      setupStatusChains({ failed: [failed], pending: [pendingVersion] });

      mockAudio.get.mockResolvedValue({ id: 50, blob: new Blob(["audio"]) });
      mockStorageUpload.mockResolvedValue({ error: null });
      mockSupabaseUpsert.mockResolvedValue({ error: null });
      mockAudioUploadQueue.update.mockResolvedValue(1);

      await resweepFailedUploads();
      // resweep fires drain fire-and-forget; flush microtasks/timers.
      await vi.runOnlyPendingTimersAsync();

      // The drain reuses the idempotent upsert path (DAT-5).
      expect(mockSupabaseUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ upload_status: "uploaded" }),
        { onConflict: "storage_path", ignoreDuplicates: true },
      );
      const uploadedCall = mockAudioUploadQueue.update.mock.calls.find(
        (c: unknown[]) => (c[1] as Record<string, unknown>).status === "uploaded",
      );
      expect(uploadedCall).toBeDefined();
    });

    it("is idempotent: a second resweep does not re-reset an entry already moved to pending", async () => {
      const { resweepFailedUploads, _resetDraining } = await import(
        "../services/audioUploadQueue"
      );
      _resetDraining();

      // First sweep sees the failed entry; after it flips to pending there are
      // no more 'failed' rows, so the second sweep finds nothing to reset.
      const failed = makeEntry({ id: 3, status: "failed", retryCount: 0 });
      setupStatusChains({ failed: [failed], pending: [] });
      mockAudioUploadQueue.update.mockResolvedValue(1);

      await resweepFailedUploads();
      const firstResetCount = mockAudioUploadQueue.update.mock.calls.filter(
        (c: unknown[]) =>
          c[0] === 3 && (c[1] as Record<string, unknown>).status === "pending",
      ).length;
      expect(firstResetCount).toBe(1);

      // Second sweep: no failed rows remain.
      setupStatusChains({ failed: [], pending: [] });
      await resweepFailedUploads();
      const totalResetCount = mockAudioUploadQueue.update.mock.calls.filter(
        (c: unknown[]) =>
          c[0] === 3 && (c[1] as Record<string, unknown>).status === "pending",
      ).length;
      expect(totalResetCount).toBe(1);
    });
  });
});
