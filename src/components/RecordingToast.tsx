import { useEffect } from "react";
import { useRecordingStore } from "../stores/recordingStore";
import { formatDuration } from "../utils/audio";
import { Icon } from "../ui/icons";

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

  // Phase 27 (MOTION-04): success-ping animation on save. The
  // tpc-success-ping class wraps the animation in a
  // prefers-reduced-motion: no-preference media query in base.css so
  // users with the reduced-motion pref see an instant fade-in (no scale).
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50
                 bg-gray-800 dark:bg-gray-700 text-white px-4 py-3 rounded-xl shadow-lg
                 animate-[slideUp_0.3s_ease-out]"
    >
      <span className="tpc-success-ping" data-animate="true">
        <Icon name="success" size={16} aria-hidden />
        <span className="text-sm">
          Recording saved &mdash; {formatDuration(lastSavedDurationMs)}
        </span>
      </span>
    </div>
  );
}
