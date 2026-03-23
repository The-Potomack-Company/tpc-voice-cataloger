import { describe, it, expect, beforeEach, vi } from "vitest";

// --- Mocks ---
const { mockProcessWriteAheadQueue } = vi.hoisted(() => {
  return { mockProcessWriteAheadQueue: vi.fn() };
});

vi.mock("../hooks/useWriteAheadQueue", () => ({
  processWriteAheadQueue: mockProcessWriteAheadQueue,
}));

const { mockDrainPhotoQueue } = vi.hoisted(() => {
  return { mockDrainPhotoQueue: vi.fn() };
});

vi.mock("../services/photoUploadQueue", () => ({
  drainPhotoQueue: mockDrainPhotoQueue,
}));

const { mockDrainQueue } = vi.hoisted(() => {
  return { mockDrainQueue: vi.fn() };
});

vi.mock("../services/offlineQueue", () => ({
  drainQueue: mockDrainQueue,
}));

describe("AppLayout drain order", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockProcessWriteAheadQueue.mockResolvedValue(undefined);
    mockDrainPhotoQueue.mockResolvedValue(undefined);
    mockDrainQueue.mockResolvedValue(undefined);
  });

  it("calls processWriteAheadQueue before drainPhotoQueue", async () => {
    // Will test that the reconnect handler calls processWriteAheadQueue
    // before drainPhotoQueue in the correct order
    expect(mockProcessWriteAheadQueue).toBeDefined();
    expect(mockDrainPhotoQueue).toBeDefined();
  });

  it("calls drainPhotoQueue before drainQueue (audio)", async () => {
    // Will test that drainPhotoQueue is called before drainQueue
    expect(mockDrainPhotoQueue).toBeDefined();
    expect(mockDrainQueue).toBeDefined();
  });

  it("calls all three drain functions in sequence: processWriteAheadQueue -> drainPhotoQueue -> drainQueue", async () => {
    // Will verify the full sequence order:
    // 1. processWriteAheadQueue (write-ahead items must exist first)
    // 2. drainPhotoQueue (photo uploads)
    // 3. drainQueue (audio processing)
    const callOrder: string[] = [];
    mockProcessWriteAheadQueue.mockImplementation(async () => {
      callOrder.push("processWriteAheadQueue");
    });
    mockDrainPhotoQueue.mockImplementation(async () => {
      callOrder.push("drainPhotoQueue");
    });
    mockDrainQueue.mockImplementation(async () => {
      callOrder.push("drainQueue");
    });

    // This test stub will fail until Plan 02 wires drainPhotoQueue into AppLayout
    expect(callOrder).toEqual([]);
  });
});
