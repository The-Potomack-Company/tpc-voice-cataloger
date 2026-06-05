import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { processAudioWithAi } from "../services/gemini";
import { updateItemField } from "../db/items";

interface RecordButtonProps {
  itemId: string;
  sessionId: string;
}

export function RecordButton({ itemId, sessionId }: RecordButtonProps) {
  const { status, error, startRecording, stopRecording } = useAudioRecorder();

  const isRecording = status === "recording";
  const isRequesting = status === "requesting";
  const isError = status === "error";

  const handleClick = async () => {
    if (isRecording) {
      const audioId = await stopRecording();
      if (audioId != null) {
        if (navigator.onLine) {
          await updateItemField(itemId, sessionId, "ai_status", "queued");
          // Fire-and-forget -- do not await. Auctioneer moves on immediately.
          processAudioWithAi(audioId, itemId, sessionId).catch((err) =>
            console.error("AI processing failed:", err)
          );
        } else {
          await updateItemField(itemId, sessionId, "ai_status", "queued");
        }
      }
    } else if (!isRequesting) {
      startRecording(itemId, sessionId);
    }
  };

  const fabClass = [
    "tpc-record-fab",
    isRecording ? "tpc-record-pulse" : "",
    isRequesting ? "tpc-record-pulse" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={isRequesting}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
        aria-pressed={isRecording}
        className={fabClass}
        style={isRequesting ? { opacity: 0.5 } : undefined}
      >
        {isRecording ? (
          <svg
            data-testid="stop-icon"
            width={22}
            height={22}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        ) : (
          <svg
            data-testid="mic-icon"
            width={28}
            height={28}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
            />
          </svg>
        )}
      </button>

      {isError && error && (
        <div className="text-center">
          <p className="text-sm text-err">{error}</p>
          <button
            type="button"
            onClick={() => startRecording(itemId, sessionId)}
            className="text-sm text-err underline mt-1"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
