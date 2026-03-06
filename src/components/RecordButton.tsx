import { useAudioRecorder } from "../hooks/useAudioRecorder";

interface RecordButtonProps {
  itemId: number;
  itemType: "house" | "sale";
}

export function RecordButton({ itemId, itemType }: RecordButtonProps) {
  const { status, error, startRecording, stopRecording } = useAudioRecorder();

  const isRecording = status === "recording";
  const isRequesting = status === "requesting";
  const isError = status === "error";

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else if (!isRequesting) {
      startRecording(itemId, itemType);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={isRequesting}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
        className={`
          w-18 h-18 flex items-center justify-center shadow-lg transition-all
          ${
            isRecording
              ? "rounded-lg bg-red-600 ring-4 ring-red-300 animate-pulse"
              : isRequesting
                ? "rounded-full bg-red-500 opacity-50 animate-pulse cursor-not-allowed"
                : "rounded-full bg-red-500 hover:bg-red-600 active:bg-red-700"
          }
        `}
      >
        {isRecording ? (
          <svg
            data-testid="stop-icon"
            className="w-7 h-7 text-white"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        ) : (
          <svg
            data-testid="mic-icon"
            className="w-7 h-7 text-white"
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
          <p className="text-sm text-red-500">{error}</p>
          <button
            type="button"
            onClick={() => startRecording(itemId, itemType)}
            className="text-sm text-red-500 underline mt-1"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
