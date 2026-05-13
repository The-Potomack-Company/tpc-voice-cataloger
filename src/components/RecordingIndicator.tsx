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

      {/* Timer pill — top right (Phase 26 reskin: token-driven surface +
          mono / tnum for stable digits; pulse animation gated by
          prefers-reduced-motion). */}
      <div className="fixed top-4 right-4 z-40 pointer-events-none">
        <span className="tpc-badge tpc-badge-err tnum tpc-record-pulse tpc-record-pill">
          <span className="tpc-dot" aria-hidden="true" />
          {formatDuration(currentDurationMs)}
        </span>
      </div>
    </>
  );
}
