import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUIStore } from "../stores/uiStore";
import { db } from "../db";

describe("AiStatus type", () => {
  it("accepts 'queued' as a valid value", () => {
    // Compile-time check: if this compiles, the test passes
    const status: import("../db/types").AiStatus = "queued";
    expect(status).toBe("queued");
  });
});

describe("useOnlineStatus hook", () => {
  let originalOnLine: boolean;

  beforeEach(() => {
    originalOnLine = navigator.onLine;
    // Reset store
    useUIStore.setState({ isOnline: true });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      configurable: true,
      value: originalOnLine,
    });
  });

  it("returns true when navigator.onLine is true", async () => {
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      configurable: true,
      value: true,
    });

    const { useOnlineStatus } = await import("../hooks/useOnlineStatus");
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });

  it("returns false when navigator.onLine is false", async () => {
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      configurable: true,
      value: false,
    });

    const { useOnlineStatus } = await import("../hooks/useOnlineStatus");
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
  });

  it("updates when online event fires on window", async () => {
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      configurable: true,
      value: false,
    });

    const { useOnlineStatus } = await import("../hooks/useOnlineStatus");
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);

    // Simulate going online
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      configurable: true,
      value: true,
    });
    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    expect(result.current).toBe(true);
  });

  it("updates when offline event fires on window", async () => {
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      configurable: true,
      value: true,
    });

    const { useOnlineStatus } = await import("../hooks/useOnlineStatus");
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    // Simulate going offline
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      configurable: true,
      value: false,
    });
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(result.current).toBe(false);
  });
});

// Mock processAudioWithAi before importing offlineQueue
vi.mock("../services/gemini", () => ({
  processAudioWithAi: vi.fn(),
}));

describe("offlineQueue service", () => {
  let originalOnLine: boolean;

  beforeEach(async () => {
    originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      configurable: true,
      value: true,
    });

    // Clear all tables
    await db.houseVisitItems.clear();
    await db.saleItems.clear();
    await db.audio.clear();

    // Reset mocks
    const { processAudioWithAi } = await import("../services/gemini");
    vi.mocked(processAudioWithAi).mockReset();
    // Default: processAudioWithAi succeeds (sets aiStatus to "done")
    vi.mocked(processAudioWithAi).mockImplementation(
      async (_audioId: number, itemId: number, itemType: "house" | "sale") => {
        const table =
          itemType === "house" ? db.houseVisitItems : db.saleItems;
        await table.update(itemId, { aiStatus: "done" });
      },
    );

    // Reset draining mutex by importing fresh module
    // We use resetModules in specific tests that need it
  });

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      configurable: true,
      value: originalOnLine,
    });
  });

  async function createQueuedHouseItem(
    sessionId: number,
    createdAt: Date,
  ): Promise<number> {
    return (await db.houseVisitItems.add({
      sessionId,
      aiStatus: "queued",
      sortOrder: 0,
      createdAt,
    })) as number;
  }

  async function createQueuedSaleItem(
    sessionId: number,
    createdAt: Date,
  ): Promise<number> {
    return (await db.saleItems.add({
      sessionId,
      aiStatus: "queued",
      sortOrder: 0,
      createdAt,
    })) as number;
  }

  async function createAudio(
    itemId: number,
    itemType: "house" | "sale",
  ): Promise<number> {
    return (await db.audio.add({
      itemId,
      itemType,
      blob: new Blob(["audio-data"], { type: "audio/webm" }),
      mimeType: "audio/webm",
      createdAt: new Date(),
    })) as number;
  }

  describe("getQueuedItems", () => {
    it("returns items from both tables where aiStatus=queued, sorted by createdAt FIFO", async () => {
      const { getQueuedItems } = await import("../services/offlineQueue");

      const t1 = new Date("2026-01-01T10:00:00Z");
      const t2 = new Date("2026-01-01T10:01:00Z");
      const t3 = new Date("2026-01-01T10:02:00Z");

      // Create items out of order
      await createQueuedSaleItem(1, t3);
      await createQueuedHouseItem(1, t1);
      await createQueuedHouseItem(1, t2);

      // Also add a non-queued item that should NOT appear
      await db.houseVisitItems.add({
        sessionId: 1,
        aiStatus: "done",
        sortOrder: 0,
        createdAt: new Date("2026-01-01T09:00:00Z"),
      });

      const items = await getQueuedItems();
      expect(items).toHaveLength(3);
      expect(items[0].itemType).toBe("house");
      expect(items[0].createdAt.getTime()).toBe(t1.getTime());
      expect(items[1].itemType).toBe("house");
      expect(items[1].createdAt.getTime()).toBe(t2.getTime());
      expect(items[2].itemType).toBe("sale");
      expect(items[2].createdAt.getTime()).toBe(t3.getTime());
    });
  });

  describe("drainQueue", () => {
    it("calls processAudioWithAi for each queued item using most recent audio", async () => {
      const { drainQueue } = await import("../services/offlineQueue");
      const { processAudioWithAi } = await import("../services/gemini");

      const itemId = await createQueuedHouseItem(
        1,
        new Date("2026-01-01T10:00:00Z"),
      );
      // Add two audio records -- should use the one with highest id
      await createAudio(itemId, "house");
      const latestAudioId = await createAudio(itemId, "house");

      await drainQueue();

      expect(processAudioWithAi).toHaveBeenCalledWith(
        latestAudioId,
        itemId,
        "house",
      );
    });

    it("processes max 4 items concurrently (concurrency limit)", async () => {
      const { processAudioWithAi } = await import("../services/gemini");

      let currentConcurrent = 0;
      let maxConcurrent = 0;

      vi.mocked(processAudioWithAi).mockImplementation(
        async (
          _audioId: number,
          itemId: number,
          itemType: "house" | "sale",
        ) => {
          currentConcurrent++;
          maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
          // Simulate async work
          await new Promise((r) => setTimeout(r, 50));
          const table =
            itemType === "house" ? db.houseVisitItems : db.saleItems;
          await table.update(itemId, { aiStatus: "done" });
          currentConcurrent--;
        },
      );

      // Create 8 items (should process in 2 batches of 4)
      for (let i = 0; i < 8; i++) {
        const id = await createQueuedHouseItem(
          1,
          new Date(Date.now() + i * 1000),
        );
        await createAudio(id, "house");
      }

      // Need fresh import to reset mutex
      const offlineQueue = await import("../services/offlineQueue");
      await offlineQueue.drainQueue();

      expect(maxConcurrent).toBeLessThanOrEqual(4);
      expect(maxConcurrent).toBeGreaterThan(1); // Verify some parallelism happened
    });

    it("retries an item twice on failure, then marks as failed", async () => {
      const { processAudioWithAi } = await import("../services/gemini");

      let callCount = 0;
      vi.mocked(processAudioWithAi).mockImplementation(
        async (
          _audioId: number,
          itemId: number,
          itemType: "house" | "sale",
        ) => {
          callCount++;
          const table =
            itemType === "house" ? db.houseVisitItems : db.saleItems;
          // Always fail
          await table.update(itemId, { aiStatus: "failed" });
          throw new Error("Network error");
        },
      );

      const itemId = await createQueuedHouseItem(
        1,
        new Date("2026-01-01T10:00:00Z"),
      );
      await createAudio(itemId, "house");

      const { drainQueue } = await import("../services/offlineQueue");
      await drainQueue();

      // Should have been called 3 times (1 initial + 2 retries)
      expect(callCount).toBe(3);

      // Item should be "failed"
      const item = await db.houseVisitItems.get(itemId);
      expect(item?.aiStatus).toBe("failed");
    });

    it("stops processing if navigator.onLine becomes false mid-drain", async () => {
      const { processAudioWithAi } = await import("../services/gemini");

      let processedCount = 0;
      vi.mocked(processAudioWithAi).mockImplementation(
        async (
          _audioId: number,
          itemId: number,
          itemType: "house" | "sale",
        ) => {
          processedCount++;
          const table =
            itemType === "house" ? db.houseVisitItems : db.saleItems;
          await table.update(itemId, { aiStatus: "done" });
          // After first batch processes, go offline
          if (processedCount >= 4) {
            Object.defineProperty(navigator, "onLine", {
              writable: true,
              configurable: true,
              value: false,
            });
          }
        },
      );

      // Create 8 items
      for (let i = 0; i < 8; i++) {
        const id = await createQueuedHouseItem(
          1,
          new Date(Date.now() + i * 1000),
        );
        await createAudio(id, "house");
      }

      const { drainQueue } = await import("../services/offlineQueue");
      await drainQueue();

      // Only first batch of 4 should have been processed
      expect(processedCount).toBe(4);

      // Remaining 4 should still be queued
      const remaining = await db.houseVisitItems
        .where("aiStatus")
        .equals("queued")
        .count();
      expect(remaining).toBe(4);
    });

    it("concurrent drainQueue calls are blocked by mutex", async () => {
      const { processAudioWithAi } = await import("../services/gemini");

      let callCount = 0;
      vi.mocked(processAudioWithAi).mockImplementation(
        async (
          _audioId: number,
          itemId: number,
          itemType: "house" | "sale",
        ) => {
          callCount++;
          await new Promise((r) => setTimeout(r, 50));
          const table =
            itemType === "house" ? db.houseVisitItems : db.saleItems;
          await table.update(itemId, { aiStatus: "done" });
        },
      );

      const itemId = await createQueuedHouseItem(
        1,
        new Date("2026-01-01T10:00:00Z"),
      );
      await createAudio(itemId, "house");

      const { drainQueue } = await import("../services/offlineQueue");

      // Start two drains simultaneously
      const [r1, r2] = await Promise.allSettled([drainQueue(), drainQueue()]);

      // Both should resolve (second returns immediately)
      expect(r1.status).toBe("fulfilled");
      expect(r2.status).toBe("fulfilled");

      // Only one should have actually processed
      expect(callCount).toBe(1);
    });

    it("handles items with no audio record by marking them as failed", async () => {
      const itemId = await createQueuedHouseItem(
        1,
        new Date("2026-01-01T10:00:00Z"),
      );
      // No audio created for this item

      const { drainQueue } = await import("../services/offlineQueue");
      await drainQueue();

      const item = await db.houseVisitItems.get(itemId);
      expect(item?.aiStatus).toBe("failed");
    });
  });
});
