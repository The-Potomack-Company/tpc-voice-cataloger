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
const continuousState = vi.hoisted(() => ({
  active: true,
  sessionId: "session-1",
  currentItemId: "item-1",
  epoch: 0,
  chunkIndex: 0,
  enterMode: vi.fn(),
  exitMode: vi.fn(),
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
vi.mock("../services/geminiContinuous", () => ({ processContinuousChunk }));
vi.mock("../stores/continuousModeStore", () => ({
  useContinuousModeStore: {
    getState: () => continuousState,
    setState: vi.fn((patch) => Object.assign(continuousState, patch)),
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

  constructor() {
    FakeMediaRecorder.instances.push(this);
  }

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["chunk"], { type: "audio/webm" }) } as BlobEvent);
    this.onstop?.();
  }
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
    continuousState.sessionId = "session-1";
    continuousState.currentItemId = "item-1";
    continuousState.epoch = 0;
    continuousState.chunkIndex = 0;
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

  it("writes 15s chunks, appends session audio, and restarts after 200ms", async () => {
    const { useContinuousRecorder } = await import("../hooks/useContinuousRecorder");
    const { result } = renderHook(() => useContinuousRecorder());

    await act(async () => {
      await result.current.start("session-1", "sale");
    });

    expect(FakeMediaRecorder.instances).toHaveLength(1);

    await act(async () => {
      vi.advanceTimersByTime(15_000);
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
    });

    await act(async () => {
      vi.advanceTimersByTime(200);
      await Promise.resolve();
    });

    expect(FakeMediaRecorder.instances).toHaveLength(2);
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
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(stopped).toBe(false);
    expect(dbMock.sessionAudio.put).toHaveBeenCalledWith(expect.objectContaining({ sessionId: "session-1" }));

    resolvePut?.();
    await act(async () => {
      await stopPromise;
    });

    expect(stopped).toBe(true);
  });
});
