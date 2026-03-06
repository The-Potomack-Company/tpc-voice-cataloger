import { useRecordingStore } from "../stores/recordingStore";
import { formatDuration } from "../utils/audio";

export function RecordingIndicator() {
  const isRecording = useRecordingStore((s) => s.isRecording);
  const currentDurationMs = useRecordingStore((s) => s.currentDurationMs);

  if (!isRecording) {
    return null;
  }

  return (
    <>
      {/* Red border overlay around viewport */}
      <div
        data-testid="recording-border"
        className="fixed inset-0 border-4 border-red-500 pointer-events-none z-40 animate-pulse"
        style={{ animationDuration: "2s" }}
      />

      {/* Timer display — top right */}
      <div className="fixed top-4 right-4 z-40 pointer-events-none">
        <span className="text-lg font-mono text-red-500 bg-white/80 dark:bg-gray-900/80 px-3 py-1 rounded-full shadow">
          {formatDuration(currentDurationMs)}
        </span>
      </div>
    </>
  );
}
