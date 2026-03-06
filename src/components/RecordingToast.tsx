import { useEffect, useRef, useCallback } from "react";
import { useRecordingStore } from "../stores/recordingStore";
import { formatDuration } from "../utils/audio";
import { db } from "../db";

export function RecordingToast() {
  const lastSavedAudioId = useRecordingStore((s) => s.lastSavedAudioId);
  const lastSavedDurationMs = useRecordingStore((s) => s.lastSavedDurationMs);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  // Auto-dismiss after 4 seconds
  useEffect(() => {
    if (lastSavedAudioId === null) return;

    const timer = setTimeout(() => {
      cleanup();
      useRecordingStore.getState().setLastSaved(
        null as unknown as number,
        0,
      );
      // Clear by resetting lastSavedAudioId to null
      useRecordingStore.setState({ lastSavedAudioId: null, lastSavedDurationMs: 0 });
    }, 4000);

    return () => clearTimeout(timer);
  }, [lastSavedAudioId, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  if (lastSavedAudioId === null) {
    return null;
  }

  const handlePlay = async () => {
    try {
      const record = await db.audio.get(lastSavedAudioId);
      if (!record) return;

      cleanup();
      const url = URL.createObjectURL(record.blob);
      objectUrlRef.current = url;

      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      audioRef.current.src = url;
      audioRef.current.play();
    } catch (err) {
      console.error("Failed to play recording:", err);
    }
  };

  return (
    <div
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50
                 bg-gray-800 dark:bg-gray-700 text-white px-4 py-3 rounded-xl shadow-lg
                 flex items-center gap-3
                 animate-[slideUp_0.3s_ease-out]"
    >
      <span className="text-sm">
        Recording saved &mdash; {formatDuration(lastSavedDurationMs)}
      </span>
      <button
        type="button"
        onClick={handlePlay}
        aria-label="Play recording"
        className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
      >
        <svg
          className="w-4 h-4 text-white"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>
    </div>
  );
}
