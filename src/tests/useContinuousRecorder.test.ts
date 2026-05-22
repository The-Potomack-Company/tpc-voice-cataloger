import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  transaction: vi.fn(async (_mode: string, _table: unknown, callback: () => Promise<void>) => callback()),
  audio: {
    add: vi.fn(async () => 11),
  },
  sessionAudio: {
    get: vi.fn(async () => undefined),
    put: vi.fn(async () => undefined),
  },
}));

const processContinuousChunk = vi.hoisted(() => vi.fn(async () => {}));
const waitForSessionChunksDrain = vi.hoisted(() => vi.fn(async () => {}));
const continuousState = vi.hoisted(() => ({
  active: true,
  finalizing: false,
  sessionId: "session-1",
  currentItemId: "item-1",
  epoch: 0,
  chunkIndex: 0,
  enterMode: vi.fn(),
  exitMode: vi.fn(),
  setFinalizing: vi.fn((value: boolean) => {
    continuousState.finalizing = value;
  }),
  pushChunk: vi.fn(),
}));
const sessionStore = vi.hoisted(() => ({
  createItem: vi.fn(async () => "item-1"),
}));
const recordingStore = vi.hoisted(() => ({
  setRecording: vi.fn(),
  setDuration: vi.fn(),
  setLastSaved: vi.fn(),
  pushLevel: vi.fn(),
}));
const uiStore = vi.hoisted(() => ({
  setRecordingSession: vi.fn(),
}));

vi.mock("../db", () => ({ db: dbMock }));
vi.mock("../services/geminiContinuous", () => ({ processContinuousChunk, waitForSessionChunksDrain }));
vi.mock("../stores/continuousModeStore", () => ({
  useContinuousModeStore: {
    getState: () => continuousState,
    setState: vi.fn((patch) => {
      Object.assign(continuousState, patch);
    }),
  },
}));
vi.mock("../stores/sessionStore", () => ({
  useSessionStore: {
    getState: () => sessionStore,
  },
}));
vi.mock("../stores/recordingStore", () => ({
  useRecordingStore: {
    getState: () => recordingStore,
  },
}));
vi.mock("../stores/uiStore", () => ({
  useUIStore: {
    getState: () => uiStore,
  },
}));
vi.mock("../utils/audio", () => ({
  getPreferredMimeType: () => "audio/webm",
}));

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  state: "inactive" | "recording" = "inactive";
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  startTimeslice: number | undefined;

  constructor() {
    FakeMediaRecorder.instances.push(this);
  }

  start(timeslice?: number) {
    this.startTimeslice = timeslice;
    this.state = "recording";
  }

  emit(data: Blob) {
    this.ondataavailable?.({ data } as BlobEvent);
  }

  stop() {
    this.state = "inactive";
    this.ondataavailable?.({
      data: new Blob([new Uint8Array([0xaa, 0xbb, 0x1f, 0x43, 0xb6, 0x75, 0x01])], { type: "audio/webm" }),
    } as BlobEvent);
    this.onstop?.();
  }
}

async function blobBytes(blob: Blob): Promise<number[]> {
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}

describe("useContinuousRecorder", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    FakeMediaRecorder.instances = [];
    dbMock.transaction.mockImplementation(async (_mode: string, _table: unknown, callback: () => Promise<void>) => callback());
    dbMock.sessionAudio.get.mockResolvedValue(undefined);
    dbMock.sessionAudio.put.mockResolvedValue(undefined);
    continuousState.active = true;
    continuousState.finalizing = false;
    continuousState.sessionId = "session-1";
    continuousState.currentItemId = "item-1";
    continuousState.epoch = 0;
    continuousState.chunkIndex = 0;
    processContinuousChunk.mockResolvedValue(undefined);
    waitForSessionChunksDrain.mockResolvedValue(undefined);
    Object.defineProperty(globalThis, "MediaRecorder", {
      value: FakeMediaRecorder,
      configurable: true,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop: vi.fn(), enabled: true }],
          getAudioTracks: () => [{ stop: vi.fn(), enabled: true }],
        })),
      },
      configurable: true,
    });
  });

  it("starts one continuous recorder with a 15s timeslice", async () => {
    const { useContinuousRecorder } = await import("../hooks/useContinuousRecorder");
    const { result } = renderHook(() => useContinuousRecorder());

    await act(async () => {
      await result.current.start("session-1", "sale");
    });

    expect(FakeMediaRecorder.instances).toHaveLength(1);
    expect(FakeMediaRecorder.instances[0].startTimeslice).toBe(15_000);
  });

  it("writes timeslice chunks and prepends the cached WebM header after the first chunk", async () => {
    const { useContinuousRecorder } = await import("../hooks/useContinuousRecorder");
    const { result } = renderHook(() => useContinuousRecorder());

    await act(async () => {
      await result.current.start("session-1", "sale");
    });

    await act(async () => {
      FakeMediaRecorder.instances[0].emit(new Blob([
        new Uint8Array([0xaa, 0xbb, 0x1f, 0x43, 0xb6, 0x75, 0x01, 0x02, 0x03]),
      ], { type: "audio/webm" }));
      await Promise.resolve();
    });

    expect(dbMock.audio.add).toHaveBeenCalledWith(expect.objectContaining({
      itemId: "item-1",
      mimeType: "audio/webm",
    }));
    expect(dbMock.sessionAudio.put).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: "session-1",
      mimeType: "audio/webm",
    }));
    expect(processContinuousChunk).toHaveBeenCalledWith(11, "item-1", "session-1", 0, {
      snapshot: { epoch: 0, itemId: "item-1", sessionId: "session-1" },
      signal: expect.any(AbortSignal),
      lookBackBytes: undefined,
    });

    await act(async () => {
      FakeMediaRecorder.instances[0].emit(new Blob([
        new Uint8Array([0x1f, 0x43, 0xb6, 0x75, 0x04, 0x05]),
      ], { type: "audio/webm" }));
      await Promise.resolve();
    });

    expect(FakeMediaRecorder.instances).toHaveLength(1);
    expect(await blobBytes(dbMock.audio.add.mock.calls[0][0].blob)).toEqual([
      0xaa, 0xbb, 0x1f, 0x43, 0xb6, 0x75, 0x01, 0x02, 0x03,
    ]);
    expect(await blobBytes(dbMock.audio.add.mock.calls[1][0].blob)).toEqual([
      0xaa, 0xbb, 0x1f, 0x43, 0xb6, 0x75, 0x04, 0x05,
    ]);
    expect(processContinuousChunk).toHaveBeenLastCalledWith(11, "item-1", "session-1", 1, {
      snapshot: { epoch: 0, itemId: "item-1", sessionId: "session-1" },
      signal: expect.any(AbortSignal),
      lookBackBytes: new Uint8Array([0xaa, 0xbb, 0x1f, 0x43, 0xb6, 0x75, 0x01, 0x02, 0x03]),
    });
  });

  it("serializes session audio appends inside a Dexie transaction", async () => {
    const stored = { current: undefined as { blob: Blob; durationMs: number; mimeType: string; createdAt: Date; updatedAt: Date } | undefined };
    let txChain = Promise.resolve();
    dbMock.transaction.mockImplementation((_mode: string, _table: unknown, callback: () => Promise<void>) => {
      const next = txChain.then(callback);
      txChain = next.catch(() => undefined);
      return next;
    });
    dbMock.sessionAudio.get.mockImplementation(async () => stored.current);
    dbMock.sessionAudio.put.mockImplementation(async (record) => {
      stored.current = record;
    });
    const { appendSessionAudio } = await import("../hooks/useContinuousRecorder");

    await Promise.all([
      appendSessionAudio("session-1", new Blob(["first"], { type: "audio/webm" }), "audio/webm", 100),
      appendSessionAudio("session-1", new Blob(["second"], { type: "audio/webm" }), "audio/webm", 200),
    ]);

    await expect(stored.current?.blob.text()).resolves.toBe("firstsecond");
    expect(stored.current?.durationMs).toBe(300);
  });

  it("stop waits for the final slice session audio append", async () => {
    let resolvePut: (() => void) | null = null;
    dbMock.sessionAudio.put.mockImplementation(
      () => new Promise<void>((resolve) => {
        resolvePut = resolve;
      }),
    );
    const { useContinuousRecorder } = await import("../hooks/useContinuousRecorder");
    const { result } = renderHook(() => useContinuousRecorder());

    await act(async () => {
      await result.current.start("session-1", "sale");
    });

    let stopped = false;
    const stopPromise = result.current.stop().then(() => {
      stopped = true;
    });
    await vi.waitFor(() => expect(dbMock.sessionAudio.put).toHaveBeenCalledWith(expect.objectContaining({ sessionId: "session-1" })));

    expect(stopped).toBe(false);

    resolvePut?.();
    await act(async () => {
      await stopPromise;
    });

    expect(stopped).toBe(true);
    expect(continuousState.setFinalizing).toHaveBeenCalledWith(true);
    expect(waitForSessionChunksDrain).toHaveBeenCalledWith("session-1");
    expect(continuousState.exitMode).toHaveBeenCalled();
  });

  it("stop drains final chunk processing before exiting continuous mode", async () => {
    let resolveChunk: (() => void) | null = null;
    const chunkPromise = new Promise<void>((resolve) => {
      resolveChunk = resolve;
    });
    processContinuousChunk.mockReturnValue(chunkPromise);
    waitForSessionChunksDrain.mockImplementation(async () => {
      await chunkPromise;
    });
    const { useContinuousRecorder } = await import("../hooks/useContinuousRecorder");
    const { result } = renderHook(() => useContinuousRecorder());

    await act(async () => {
      await result.current.start("session-1", "sale");
    });

    let stopped = false;
    const stopPromise = result.current.stop().then(() => {
      stopped = true;
    });
    await vi.waitFor(() => expect(processContinuousChunk).toHaveBeenCalled());

    expect(processContinuousChunk).toHaveBeenCalledWith(11, "item-1", "session-1", 0, {
      snapshot: { epoch: 0, itemId: "item-1", sessionId: "session-1" },
      signal: expect.any(AbortSignal),
      lookBackBytes: undefined,
    });
    expect(waitForSessionChunksDrain).toHaveBeenCalledWith("session-1");
    expect(continuousState.exitMode).not.toHaveBeenCalled();
    expect(stopped).toBe(false);

    resolveChunk?.();
    await act(async () => {
      await stopPromise;
    });

    expect(continuousState.exitMode).toHaveBeenCalled();
    expect(stopped).toBe(true);
  });
});
