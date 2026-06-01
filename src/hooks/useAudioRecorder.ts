import { useState, useRef, useEffect, useCallback } from "react";
import { db } from "../db";
import { getPreferredMimeType } from "../utils/audio";
import {
  enqueueAudioUpload,
  drainAudioQueue,
} from "../services/audioUploadQueue";
import { useRecordingStore } from "../stores/recordingStore";

type RecordingStatus = "idle" | "requesting" | "recording" | "error";

interface AudioRecorderReturn {
  status: RecordingStatus;
  durationMs: number;
  error: string | null;
  startRecording: (itemId: string, sessionId: string) => void;
  stopRecording: () => Promise<number | undefined>;
}

/**
 * Hook that manages the full MediaRecorder lifecycle:
 * getUserMedia -> MediaRecorder -> Blob assembly -> Dexie persistence.
 */
export function useAudioRecorder(): AudioRecorderReturn {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const detectedMimeTypeRef = useRef<string>("");

  // Phase 27 (MOTION-02): AnalyserNode for live waveform amplitude.
  // Optional — gracefully degrades when AudioContext is unavailable.
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  // Store a resolve function for the stopRecording promise.
  // REL-4 (D-12): widened to accept undefined so the always-settle path can
  // resolve undefined on final db.audio.add failure without breaking D-11's
  // Promise<number | undefined> contract.
  const stopResolveRef = useRef<((id: number | undefined) => void) | null>(
    null,
  );

  // Track itemId/sessionId for onstop handler
  const itemIdRef = useRef<string>("");
  const sessionIdRef = useRef<string>("");

  const store = useRecordingStore;

  const cleanupStream = useCallback(() => {
    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    // Clear interval
    if (timerIntervalRef.current !== null) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    // Stop MediaRecorder if still recording
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    // Phase 27 — teardown the analyser loop and audio graph.
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
    // Honor prefers-reduced-motion — skip the loop entirely.
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
      const push = useRecordingStore.getState().pushLevel;

      const loop = () => {
        const a = analyserRef.current;
        if (!a) return;
        a.getByteTimeDomainData(data);
        // Compute RMS amplitude normalized to ~[0, 1].
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        // Throttle to ~20 fps so the store doesn't churn.
        const now = performance.now();
        if (now - lastPush > 50) {
          push(Math.min(1, rms * 2.2));
          lastPush = now;
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      // Audio context unavailable / permission revoked mid-flow — no-op.
      console.warn("[useAudioRecorder] analyser setup failed:", e);
    }
  }, []);

  const startRecording = useCallback(
    (itemId: string, sessionId: string) => {
      itemIdRef.current = itemId;
      sessionIdRef.current = sessionId;
      setStatus("requesting");
      setError(null);
      setDurationMs(0);
      chunksRef.current = [];

      navigator.mediaDevices
        .getUserMedia({
          audio: {
            // Suppress non-voice background sounds (HVAC, crowd hum, etc.)
            noiseSuppression: true,
            // Strip room echo / PA bleed
            echoCancellation: true,
            // Intentionally OFF: AGC normalises loudness, which would erase
            // the natural gap between the close auctioneer and bystander
            // chatter — that gap is the signal Gemini uses to focus on the
            // intended voice.
            autoGainControl: false,
          },
          video: false,
        })
        .then((stream) => {
          streamRef.current = stream;

          const mimeType = getPreferredMimeType();
          detectedMimeTypeRef.current = mimeType;

          const options: MediaRecorderOptions = {};
          if (mimeType) {
            options.mimeType = mimeType;
          }

          const recorder = new MediaRecorder(stream, options);
          mediaRecorderRef.current = recorder;

          recorder.ondataavailable = (event: BlobEvent) => {
            if (event.data && event.data.size > 0) {
              chunksRef.current.push(event.data);
            }
          };

          recorder.onstop = async () => {
            const blob = new Blob(chunksRef.current, {
              type: detectedMimeTypeRef.current || "audio/webm",
            });
            const elapsedMs = Date.now() - startTimeRef.current;

            // REL-4 (D-12): retry the IndexedDB add up to 2× (3 attempts
            // total). Quota/transient failures are common; a single reject
            // used to leave stopResolveRef unfired forever, hanging the
            // recorder. We retry, then ALWAYS settle below.
            const MAX_ATTEMPTS = 3;
            let lastErr: unknown = null;
            for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
              try {
                const id = await db.audio.add({
                  itemId: itemIdRef.current as unknown as number, // Dexie stores value as-is
                  itemType: "house", // Legacy field, kept for backward compat
                  sessionId: sessionIdRef.current, // D-02: thread the session UUID for the Storage path token
                  blob,
                  mimeType: detectedMimeTypeRef.current || "audio/webm",
                  durationMs: elapsedMs,
                  createdAt: new Date(),
                });

                store.getState().setLastSaved(id as number, elapsedMs);

                // D-05: fire-and-forget background upload — never blocks the
                // resolve below or the AI trigger (RecordButton). A rejected
                // enqueue/drain is swallowed. Mirrors PhotoCapture.tsx:130-136.
                // itemId here is the Supabase UUID STRING (itemIdRef.current),
                // NOT the `as unknown as number` coercion the Dexie row uses.
                enqueueAudioUpload({
                  dexieAudioId: id as number,
                  itemId: itemIdRef.current,
                  sessionId: sessionIdRef.current,
                  mimeType: detectedMimeTypeRef.current || "audio/webm",
                })
                  .then(() => drainAudioQueue())
                  .catch(() => {});

                stopResolveRef.current?.(id as number);
                stopResolveRef.current = null;
                return;
              } catch (err) {
                lastErr = err;
              }
            }

            // Final failure after all retries. Preserve the recording and
            // surface an error for manual re-save (T-33-10).
            console.error("Failed to save audio after retries:", lastErr);
            store
              .getState()
              .setRecorderError(
                "Couldn't save the recording locally. It's been kept so you can retry saving it.",
              );
            store.getState().stashForRetry({
              blob,
              itemId: itemIdRef.current,
              durationMs: elapsedMs,
            });
            // REL-4 (D-11/D-12): ALWAYS settle — a rejected db.audio.add must
            // never leave stopRecording()'s Promise<number|undefined> hanging
            // (the original bug at useAudioRecorder.ts:202-204).
            stopResolveRef.current?.(undefined);
            stopResolveRef.current = null;
          };

          // Start recording (no timeslice - Safari compatibility)
          recorder.start();
          startTimeRef.current = Date.now();

          // Duration timer - update every second
          timerIntervalRef.current = setInterval(() => {
            const elapsed = Date.now() - startTimeRef.current;
            setDurationMs(elapsed);
            store.getState().setDuration(elapsed);
          }, 1000);

          setStatus("recording");
          store.getState().setRecording(true);

          // Phase 27 — kick off the AnalyserNode loop. Honors
          // prefers-reduced-motion: when set, we skip the RAF loop and
          // never push samples; the waveform component will render its
          // static glyph fallback.
          startLevelLoop(stream);
        })
        .catch((err: DOMException) => {
          let message = "Failed to access microphone";
          if (err.name === "NotAllowedError") {
            message = "Microphone permission denied. Please allow access.";
          } else if (err.name === "NotFoundError") {
            message = "No microphone found on this device.";
          } else if (err.name === "NotReadableError") {
            message =
              "Microphone is in use by another application. Please close it and try again.";
          }
          setStatus("error");
          setError(message);
        });
    },
    [store, startLevelLoop],
  );

  const stopRecording = useCallback((): Promise<number | undefined> => {
    return new Promise<number | undefined>((resolve) => {
      if (
        !mediaRecorderRef.current ||
        mediaRecorderRef.current.state !== "recording"
      ) {
        resolve(undefined);
        return;
      }

      stopResolveRef.current = resolve;

      // Stop the timer
      if (timerIntervalRef.current !== null) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }

      // Stop the recorder (triggers onstop which resolves the promise)
      mediaRecorderRef.current.stop();

      // Stop all stream tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      // Phase 27 (Codex P2 fix) — tear down the AnalyserNode loop here too.
      // Without this, the RAF + AudioContext live until component unmount,
      // and repeated record/stop cycles stack duplicate loops.
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

      setStatus("idle");
      store.getState().setRecording(false);
    });
  }, [store]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupStream();
      store.getState().setRecording(false);
    };
  }, [cleanupStream, store]);

  return { status, durationMs, error, startRecording, stopRecording };
}
