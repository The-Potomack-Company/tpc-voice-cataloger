import { useState, useRef, useEffect, useCallback } from "react";
import { db } from "../db";
import { getPreferredMimeType } from "../utils/audio";
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

  // Store a resolve function for the stopRecording promise
  const stopResolveRef = useRef<((id: number) => void) | null>(null);

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
        .getUserMedia({ audio: true, video: false })
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

            try {
              const id = await db.audio.add({
                itemId: itemIdRef.current as unknown as number, // Dexie stores value as-is
                itemType: "house", // Legacy field, kept for backward compat
                blob,
                mimeType: detectedMimeTypeRef.current || "audio/webm",
                durationMs: elapsedMs,
                createdAt: new Date(),
              });

              store.getState().setLastSaved(id as number, elapsedMs);

              if (stopResolveRef.current) {
                stopResolveRef.current(id as number);
                stopResolveRef.current = null;
              }
            } catch (err) {
              console.error("Failed to save audio:", err);
            }
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
    [store, cleanupStream],
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
