import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "../db";
import {
  processContinuousChunk,
  waitForSessionChunksDrain,
  type ContinuousChunkSnapshot,
} from "../services/geminiContinuous";
import { useContinuousModeStore } from "../stores/continuousModeStore";
import { useRecordingStore } from "../stores/recordingStore";
import { useSessionStore } from "../stores/sessionStore";
import { useUIStore } from "../stores/uiStore";
import { getPreferredMimeType } from "../utils/audio";

type ContinuousRecorderStatus = "idle" | "requesting" | "recording" | "paused" | "finalizing" | "error";

interface ContinuousRecorderReturn {
  status: ContinuousRecorderStatus;
  durationMs: number;
  error: string | null;
  start: (sessionId: string, mode: "house" | "sale") => Promise<void>;
  stop: () => Promise<void>;
  pause: () => void;
  resume: () => void;
}

const CHUNK_MS = 15_000;
const LOOK_BACK_TAIL_BYTES = 8_192;
const WEBM_CLUSTER_ID = [0x1f, 0x43, 0xb6, 0x75] as const;

function bytesToBlob(bytes: Uint8Array, mimeType: string): Blob {
  const copy = new Uint8Array(bytes);
  return new Blob([copy], { type: mimeType });
}

function findWebmClusterOffset(bytes: Uint8Array): number {
  for (let i = 0; i <= bytes.length - WEBM_CLUSTER_ID.length; i++) {
    if (
      bytes[i] === WEBM_CLUSTER_ID[0] &&
      bytes[i + 1] === WEBM_CLUSTER_ID[1] &&
      bytes[i + 2] === WEBM_CLUSTER_ID[2] &&
      bytes[i + 3] === WEBM_CLUSTER_ID[3]
    ) {
      return i;
    }
  }
  return -1;
}

function extractWebmHeader(bytes: Uint8Array): Uint8Array | null {
  const clusterOffset = findWebmClusterOffset(bytes);
  if (clusterOffset <= 0) return null;
  return bytes.slice(0, clusterOffset);
}

function prependHeader(headerBytes: Uint8Array, sliceBytes: Uint8Array, mimeType: string): Blob {
  const combined = new Uint8Array(headerBytes.length + sliceBytes.length);
  combined.set(headerBytes, 0);
  combined.set(sliceBytes, headerBytes.length);
  return bytesToBlob(combined, mimeType);
}

export async function appendSessionAudio(
  sessionId: string,
  blob: Blob,
  mimeType: string,
  durationForChunk: number,
): Promise<void> {
  await db.transaction("rw", db.sessionAudio, async () => {
    const now = new Date();
    const existing = await db.sessionAudio.get(sessionId);
    const nextBlob = existing
      ? new Blob([existing.blob, blob], { type: existing.mimeType || mimeType })
      : blob;

    await db.sessionAudio.put({
      sessionId,
      blob: nextBlob,
      mimeType,
      durationMs: (existing?.durationMs ?? 0) + durationForChunk,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  });
}

export function useContinuousRecorder(): ContinuousRecorderReturn {
  const [status, setStatus] = useState<ContinuousRecorderStatus>("idle");
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const mimeTypeRef = useRef("");
  const activeRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const sliceSequenceRef = useRef(0);
  const sliceStartRef = useRef(0);
  const recordingStartRef = useRef(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalizePromiseRef = useRef<Promise<void> | null>(null);
  const dataAvailableChainRef = useRef<Promise<void>>(Promise.resolve());
  const chunkAbortControllerRef = useRef<AbortController | null>(null);
  const containerHeaderBytesRef = useRef<Uint8Array | null>(null);
  const tailBufferRef = useRef<Uint8Array | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopLevelLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    analyserRef.current = null;
    if (audioContextRef.current) {
      try {
        void audioContextRef.current.close();
      } catch {
        /* ignore */
      }
      audioContextRef.current = null;
    }
  }, []);

  const startLevelLoop = useCallback((stream: MediaStream) => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const Ctor =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    try {
      const ctx = new Ctor();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      let lastPush = 0;
      const pushLevel = useRecordingStore.getState().pushLevel;

      const loop = () => {
        const currentAnalyser = analyserRef.current;
        if (!currentAnalyser) return;
        currentAnalyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const value = (data[i] - 128) / 128;
          sum += value * value;
        }
        const now = performance.now();
        if (now - lastPush > 50) {
          pushLevel(Math.min(1, Math.sqrt(sum / data.length) * 2.2));
          lastPush = now;
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      console.warn("[useContinuousRecorder] analyser setup failed:", err);
    }
  }, []);

  const saveAndProcessSlice = useCallback(
    async (
      blob: Blob,
      sessionBlob: Blob,
      elapsedMs: number,
      itemId: string | null,
      chunkIndex: number,
      sliceStart: number,
      snapshot: ContinuousChunkSnapshot | null,
      lookBackBytes: Uint8Array | null,
    ) => {
      const sessionId = sessionIdRef.current;
      if (!sessionId || !itemId || blob.size === 0) return;

      const id = await db.audio.add({
        itemId: itemId as unknown as number,
        itemType: "house",
        blob,
        mimeType: mimeTypeRef.current || "audio/webm",
        durationMs: elapsedMs,
        createdAt: new Date(),
      });

      const audioId = id as number;
      useRecordingStore.getState().setLastSaved(audioId, elapsedMs);
      useContinuousModeStore.getState().pushChunk(audioId, sliceStart);
      await appendSessionAudio(sessionId, sessionBlob, mimeTypeRef.current || "audio/webm", elapsedMs);

      void processContinuousChunk(audioId, itemId, sessionId, chunkIndex, {
        snapshot: snapshot ?? undefined,
        signal: chunkAbortControllerRef.current?.signal,
        lookBackBytes: lookBackBytes ?? undefined,
      });
    },
    [],
  );

  const finalizeRecorderData = useCallback(
    async (data: Blob) => {
      if (!data || data.size === 0) return;

      const mimeType = mimeTypeRef.current || "audio/webm";
      const bytes = new Uint8Array(await data.arrayBuffer());
      const headerBytes = containerHeaderBytesRef.current;
      let standaloneBlob = data;

      if (headerBytes === null) {
        const extractedHeader = extractWebmHeader(bytes);
        if (extractedHeader) {
          containerHeaderBytesRef.current = extractedHeader;
        } else {
          console.warn("[useContinuousRecorder] Could not locate WebM Cluster header; using first chunk as-is");
        }
      } else {
        standaloneBlob = prependHeader(headerBytes, bytes, mimeType);
      }

      const continuousState = useContinuousModeStore.getState();
      const itemId = continuousState.currentItemId;
      const snapshot = continuousState.currentItemId && continuousState.sessionId
        ? {
            epoch: continuousState.epoch,
            itemId: continuousState.currentItemId,
            sessionId: continuousState.sessionId,
          }
        : null;
      const chunkIndex = sliceSequenceRef.current++;
      const sliceStart = sliceStartRef.current || Date.now();
      const now = Date.now();
      const elapsedMs = Math.max(0, now - sliceStart);
      const lookBackBytes = tailBufferRef.current ? new Uint8Array(tailBufferRef.current) : null;

      if (bytes.length > 0) {
        tailBufferRef.current = bytes.slice(Math.max(0, bytes.length - LOOK_BACK_TAIL_BYTES));
      }
      sliceStartRef.current = now;

      await saveAndProcessSlice(
        standaloneBlob,
        data,
        elapsedMs,
        itemId,
        chunkIndex,
        sliceStart,
        snapshot,
        lookBackBytes,
      );
    },
    [saveAndProcessSlice],
  );

  const startRecorder = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || !activeRef.current) return;

    const options: MediaRecorderOptions = {};
    if (mimeTypeRef.current) {
      options.mimeType = mimeTypeRef.current;
    }

    sliceStartRef.current = Date.now();

    const recorder = new MediaRecorder(stream, options);
    recorderRef.current = recorder;

    recorder.ondataavailable = (event: BlobEvent) => {
      if (!event.data || event.data.size === 0) return;
      const nextFinalize = dataAvailableChainRef.current
        .catch(() => undefined)
        .then(() => finalizeRecorderData(event.data));
      dataAvailableChainRef.current = nextFinalize;
      const trackedFinalize = nextFinalize.finally(() => {
        if (finalizePromiseRef.current === trackedFinalize) {
          finalizePromiseRef.current = null;
        }
      });
      finalizePromiseRef.current = trackedFinalize;
    };

    recorder.onstop = () => {
      recorderRef.current = null;
    };

    recorder.start(CHUNK_MS);
    setStatus("recording");
  }, [finalizeRecorderData]);

  const stopActiveRecorderAndWait = useCallback((): Promise<void> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") {
      return finalizePromiseRef.current ?? Promise.resolve();
    }

    return new Promise((resolve) => {
      const originalOnStop = recorder.onstop;
      recorder.onstop = () => {
        originalOnStop?.call(recorder, new Event("stop"));
        void (finalizePromiseRef.current ?? Promise.resolve()).finally(resolve);
      };
      recorder.stop();
    });
  }, []);

  const cleanup = useCallback(async () => {
    activeRef.current = false;
    chunkAbortControllerRef.current?.abort();
    if (timerIntervalRef.current !== null) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    stopLevelLoop();
    useRecordingStore.getState().setRecording(false);
    useRecordingStore.getState().setDuration(0);
    useUIStore.getState?.().setRecordingSession(null);
    useContinuousModeStore.getState().exitMode();
  }, [stopLevelLoop]);

  const start = useCallback(
    async (sessionId: string, mode: "house" | "sale") => {
      setStatus("requesting");
      setError(null);
      setDurationMs(0);

      try {
        useContinuousModeStore.getState().enterMode(sessionId);
        if (!useContinuousModeStore.getState().currentItemId) {
          const itemId = await useSessionStore.getState().createItem(sessionId, mode);
          useContinuousModeStore.setState({ currentItemId: itemId });
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            noiseSuppression: true,
            echoCancellation: true,
            autoGainControl: false,
          },
          video: false,
        });

        streamRef.current = stream;
        sessionIdRef.current = sessionId;
        mimeTypeRef.current = getPreferredMimeType();
        activeRef.current = true;
        sliceSequenceRef.current = 0;
        containerHeaderBytesRef.current = null;
        tailBufferRef.current = null;
        dataAvailableChainRef.current = Promise.resolve();
        finalizePromiseRef.current = null;
        chunkAbortControllerRef.current = new AbortController();
        recordingStartRef.current = Date.now();
        useRecordingStore.getState().setRecording(true);
        useUIStore.getState().setRecordingSession(sessionId);

        timerIntervalRef.current = setInterval(() => {
          const elapsed = Date.now() - recordingStartRef.current;
          setDurationMs(elapsed);
          useRecordingStore.getState().setDuration(elapsed);
        }, 1000);

        startLevelLoop(stream);
        startRecorder();
      } catch (err) {
        await cleanup();
        let message = "Failed to access microphone";
        if (err instanceof DOMException && err.name === "NotAllowedError") {
          message = "Microphone permission denied. Please allow access.";
        } else if (err instanceof DOMException && err.name === "NotFoundError") {
          message = "No microphone found on this device.";
        } else if (err instanceof Error) {
          message = err.message;
        }
        setError(message);
        setStatus("error");
      }
    },
    [cleanup, startLevelLoop, startRecorder],
  );

  const stop = useCallback(async () => {
    if (!activeRef.current) return;

    const sessionId = sessionIdRef.current;
    if (!sessionId) return;

    useContinuousModeStore.getState().setFinalizing(true);
    useContinuousModeStore.setState({ active: false });
    activeRef.current = false;
    setStatus("finalizing");

    if (timerIntervalRef.current !== null) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    await stopActiveRecorderAndWait();
    await waitForSessionChunksDrain(sessionId);

    useContinuousModeStore.getState().exitMode();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    stopLevelLoop();
    useRecordingStore.getState().setRecording(false);
    useRecordingStore.getState().setDuration(0);
    useUIStore.getState?.().setRecordingSession(null);
    setStatus("idle");
    setDurationMs(0);
  }, [stopActiveRecorderAndWait, stopLevelLoop]);

  const pause = useCallback(() => {
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });
    setStatus("recording");
  }, []);

  useEffect(() => {
    return () => {
      void cleanup();
    };
  }, [cleanup]);

  return { status, durationMs, error, start, stop, pause, resume };
}
