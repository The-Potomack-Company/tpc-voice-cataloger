import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "../db";
import { processContinuousChunk } from "../services/geminiContinuous";
import { useContinuousModeStore } from "../stores/continuousModeStore";
import { useRecordingStore } from "../stores/recordingStore";
import { useSessionStore } from "../stores/sessionStore";
import { useUIStore } from "../stores/uiStore";
import { getPreferredMimeType } from "../utils/audio";

type ContinuousRecorderStatus = "idle" | "requesting" | "recording" | "paused" | "error";

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
const RESTART_DELAY_MS = 200;

export function useContinuousRecorder(): ContinuousRecorderReturn {
  const [status, setStatus] = useState<ContinuousRecorderStatus>("idle");
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef("");
  const activeRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const currentItemIdForSliceRef = useRef<string | null>(null);
  const chunkIndexForSliceRef = useRef(0);
  const sliceStartRef = useRef(0);
  const recordingStartRef = useRef(0);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startSliceRef = useRef<() => void>(() => {});

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

  const appendSessionAudio = useCallback(
    async (sessionId: string, blob: Blob, mimeType: string, durationForChunk: number) => {
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
    },
    [],
  );

  const saveAndProcessSlice = useCallback(
    async (blob: Blob, elapsedMs: number) => {
      const sessionId = sessionIdRef.current;
      const itemId = currentItemIdForSliceRef.current;
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
      useContinuousModeStore.getState().pushChunk(audioId, sliceStartRef.current);
      await appendSessionAudio(sessionId, blob, mimeTypeRef.current || "audio/webm", elapsedMs);

      void processContinuousChunk(audioId, itemId, sessionId, chunkIndexForSliceRef.current);
    },
    [appendSessionAudio],
  );

  const startSlice = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || !activeRef.current) return;

    const options: MediaRecorderOptions = {};
    if (mimeTypeRef.current) {
      options.mimeType = mimeTypeRef.current;
    }

    chunksRef.current = [];
    currentItemIdForSliceRef.current = useContinuousModeStore.getState().currentItemId;
    chunkIndexForSliceRef.current = useContinuousModeStore.getState().chunkIndex;
    sliceStartRef.current = Date.now();

    const recorder = new MediaRecorder(stream, options);
    recorderRef.current = recorder;

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current || "audio/webm" });
      const elapsedMs = Date.now() - sliceStartRef.current;
      void saveAndProcessSlice(blob, elapsedMs);

      if (activeRef.current) {
        restartTimeoutRef.current = setTimeout(() => startSliceRef.current(), RESTART_DELAY_MS);
      }
    };

    recorder.start();
    setStatus("recording");
    restartTimeoutRef.current = setTimeout(() => {
      if (recorder.state === "recording") {
        recorder.stop();
      }
    }, CHUNK_MS);
  }, [saveAndProcessSlice]);

  useEffect(() => {
    startSliceRef.current = startSlice;
  }, [startSlice]);

  const cleanup = useCallback(() => {
    activeRef.current = false;
    if (restartTimeoutRef.current !== null) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    if (timerIntervalRef.current !== null) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    stopLevelLoop();
    useRecordingStore.getState().setRecording(false);
    useRecordingStore.getState().setDuration(0);
    useUIStore.getState().setRecordingSession(null);
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
        recordingStartRef.current = Date.now();
        useRecordingStore.getState().setRecording(true);
        useUIStore.getState().setRecordingSession(sessionId);

        timerIntervalRef.current = setInterval(() => {
          const elapsed = Date.now() - recordingStartRef.current;
          setDurationMs(elapsed);
          useRecordingStore.getState().setDuration(elapsed);
        }, 1000);

        startLevelLoop(stream);
        startSlice();
      } catch (err) {
        cleanup();
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
    [cleanup, startLevelLoop, startSlice],
  );

  const stop = useCallback(async () => {
    cleanup();
    useContinuousModeStore.getState().exitMode();
    setStatus("idle");
    setDurationMs(0);
  }, [cleanup]);

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

  useEffect(() => cleanup, [cleanup]);

  return { status, durationMs, error, start, stop, pause, resume };
}
