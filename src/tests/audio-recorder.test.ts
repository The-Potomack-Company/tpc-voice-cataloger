import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { useRecordingStore } from "../stores/recordingStore";
import { db } from "../db";

// Helper to flush microtasks and pending promises
const flushPromises = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 50));

describe("useAudioRecorder", () => {
  beforeEach(async () => {
    await db.audio.clear();
    useRecordingStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
  });

  it("starts in idle status with durationMs=0 and error=null", () => {
    const { result } = renderHook(() => useAudioRecorder());
    expect(result.current.status).toBe("idle");
    expect(result.current.durationMs).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it("startRecording transitions status from idle to recording", async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      result.current.startRecording(1, "house");
      await flushPromises();
    });

    expect(result.current.status).toBe("recording");
  });

  it("startRecording calls getUserMedia with noise/echo suppression constraints and AGC off", async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      result.current.startRecording(1, "house");
      await flushPromises();
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        noiseSuppression: true,
        echoCancellation: true,
        autoGainControl: false,
      },
      video: false,
    });
  });

  it("stopRecording transitions status from recording to idle", async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      result.current.startRecording(1, "house");
      await flushPromises();
    });

    expect(result.current.status).toBe("recording");

    await act(async () => {
      const stopPromise = result.current.stopRecording();
      await flushPromises();
      await stopPromise;
    });

    expect(result.current.status).toBe("idle");
  });

  it("stopRecording writes a blob to db.audio with correct fields", async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      result.current.startRecording(1, "house");
      await flushPromises();
    });

    await act(async () => {
      const stopPromise = result.current.stopRecording();
      await flushPromises();
      await stopPromise;
    });

    const records = await db.audio.toArray();
    expect(records.length).toBe(1);
    expect(records[0].itemId).toBe(1);
    expect(records[0].itemType).toBe("house");
    expect(records[0].mimeType).toBeTruthy();
    // fake-indexeddb may not preserve Blob instances, so check it's truthy
    expect(records[0].blob).toBeTruthy();
    expect(records[0].createdAt).toBeInstanceOf(Date);
  });

  it("stopRecording returns the audio record ID from Dexie", async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      result.current.startRecording(1, "house");
      await flushPromises();
    });

    let audioId: number | undefined;
    await act(async () => {
      const stopPromise = result.current.stopRecording();
      await flushPromises();
      audioId = await stopPromise;
    });

    expect(audioId).toBeDefined();
    expect(typeof audioId).toBe("number");
  });

  it("stopRecording calls track.stop() on all MediaStream tracks", async () => {
    const trackStop = vi.fn();
    const mockStream = {
      getTracks: () => [{ stop: trackStop, kind: "audio" }],
      getAudioTracks: () => [{ stop: trackStop, kind: "audio" }],
    } as unknown as MediaStream;

    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValueOnce(
      mockStream,
    );

    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      result.current.startRecording(1, "house");
      await flushPromises();
    });

    await act(async () => {
      const stopPromise = result.current.stopRecording();
      await flushPromises();
      await stopPromise;
    });

    expect(trackStop).toHaveBeenCalled();
  });

  it("hook cleanup on unmount stops active recording and releases stream", async () => {
    const trackStop = vi.fn();
    const mockStream = {
      getTracks: () => [{ stop: trackStop, kind: "audio" }],
      getAudioTracks: () => [{ stop: trackStop, kind: "audio" }],
    } as unknown as MediaStream;

    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValueOnce(
      mockStream,
    );

    const { result, unmount } = renderHook(() => useAudioRecorder());

    await act(async () => {
      result.current.startRecording(1, "house");
      await flushPromises();
    });

    expect(result.current.status).toBe("recording");

    // Unmount while recording is active
    unmount();

    expect(trackStop).toHaveBeenCalled();
  });

  it("sets error status with permission denied message on NotAllowedError", async () => {
    const error = new DOMException("Permission denied", "NotAllowedError");
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(error);

    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      result.current.startRecording(1, "house");
      await flushPromises();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toContain("permission");
  });

  it("sets error status with no microphone message on NotFoundError", async () => {
    const error = new DOMException("No device", "NotFoundError");
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(error);

    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      result.current.startRecording(1, "house");
      await flushPromises();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toContain("microphone");
  });

  it("recording store exposes isRecording, currentDurationMs, lastSavedAudioId, and lastSavedDurationMs", () => {
    const state = useRecordingStore.getState();
    expect(state).toHaveProperty("isRecording");
    expect(state).toHaveProperty("currentDurationMs");
    expect(state).toHaveProperty("lastSavedAudioId");
    expect(state).toHaveProperty("lastSavedDurationMs");
  });
});
