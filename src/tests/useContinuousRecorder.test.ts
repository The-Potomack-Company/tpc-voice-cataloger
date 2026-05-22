import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
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
  currentItemId: "item-1",
  chunkIndex: 0,
  enterMode: vi.fn(),
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
    continuousState.currentItemId = "item-1";
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
    expect(processContinuousChunk).toHaveBeenCalledWith(11, "item-1", "session-1", 0);

    await act(async () => {
      vi.advanceTimersByTime(200);
      await Promise.resolve();
    });

    expect(FakeMediaRecorder.instances).toHaveLength(2);
  });
});
