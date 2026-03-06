import { useEffect } from "react";
import { useRecordingStore } from "../stores/recordingStore";
import { formatDuration } from "../utils/audio";

export function RecordingToast() {
  const lastSavedAudioId = useRecordingStore((s) => s.lastSavedAudioId);
  const lastSavedDurationMs = useRecordingStore((s) => s.lastSavedDurationMs);

  // Auto-dismiss after 3 seconds
  useEffect(() => {
    if (lastSavedAudioId === null) return;

    const timer = setTimeout(() => {
      useRecordingStore.setState({ lastSavedAudioId: null, lastSavedDurationMs: 0 });
    }, 3000);

    return () => clearTimeout(timer);
  }, [lastSavedAudioId]);

  if (lastSavedAudioId === null) {
    return null;
  }

  return (
    <div
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50
                 bg-gray-800 dark:bg-gray-700 text-white px-4 py-3 rounded-xl shadow-lg
                 animate-[slideUp_0.3s_ease-out]"
    >
      <span className="text-sm">
        Recording saved &mdash; {formatDuration(lastSavedDurationMs)}
      </span>
    </div>
  );
}
