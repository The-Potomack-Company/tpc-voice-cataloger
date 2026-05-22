import { useMemo } from "react";
import { useSessionItems } from "../hooks/useSessions";
import { useContinuousModeStore } from "../stores/continuousModeStore";
import { useRecordingStore } from "../stores/recordingStore";
import { Waveform } from "../ui/Waveform";
import { Badge } from "../ui/Badge";
import { Icon } from "../ui/icons";

interface ContinuousModePanelProps {
  sessionId: string;
}

const summaryFields = [
  ["title", "Title"],
  ["description", "Description"],
  ["measurements", "Measurements"],
  ["estimate", "Estimate"],
  ["condition", "Condition"],
  ["category", "Category"],
  ["receipt_number", "Receipt"],
] as const;

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function ContinuousModePanel({ sessionId }: ContinuousModePanelProps) {
  const items = useSessionItems(sessionId);
  const currentItemId = useContinuousModeStore((s) => s.currentItemId);
  const liveTranscript = useContinuousModeStore((s) => s.liveTranscript);
  const pendingCount = useContinuousModeStore((s) => s.pendingChunks.size);
  const failedCount = useContinuousModeStore((s) => s.failedChunks.size);
  const chunkIndex = useContinuousModeStore((s) => s.chunkIndex);
  const durationMs = useRecordingStore((s) => s.currentDurationMs);
  const currentItem = items.find((item) => item.id === currentItemId) ?? null;

  const itemNumber = currentItem ? items.indexOf(currentItem) + 1 : items.length + 1;
  const statusLabel = failedCount > 0
    ? `Failed - ${failedCount} chunk${failedCount === 1 ? "" : "s"} need retry`
    : pendingCount > 0
      ? `Processing chunk ${chunkIndex}...`
      : "Listening";

  const transcriptLines = useMemo(
    () => liveTranscript.split("\n").filter(Boolean).slice(-3),
    [liveTranscript],
  );

  return (
    <section className="sticky top-[5.5rem] z-30 mb-5 rounded-lg border border-accent bg-bg shadow-lg overflow-hidden">
      <div className="bg-accent-wash px-4 py-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone="info">Current item</Badge>
            <span className="text-sm font-semibold text-ink truncate">
              #{currentItem?.receipt_number ?? itemNumber}
            </span>
            <span className="tnum text-xs text-ink-3">{formatDuration(durationMs)}</span>
          </div>
          <Waveform className="mt-2" ariaLabel="Continuous recording level" />
        </div>
        <Icon name="mic" size={20} className="text-accent shrink-0" aria-hidden />
      </div>

      <div className="px-4 py-3 border-b border-rule">
        <div className="min-h-[4.5rem] rounded-lg bg-bg-2 px-3 py-2 tpc-mono text-xs text-ink-2 overflow-hidden">
          {transcriptLines.length > 0 ? (
            transcriptLines.map((line, index) => (
              <p
                key={`${line}-${index}`}
                className={index === transcriptLines.length - 1 ? "text-ink" : "text-ink-3"}
              >
                {line}
              </p>
            ))
          ) : (
            <p className="text-ink-3">Listening for item details...</p>
          )}
        </div>
      </div>

      <div className="divide-y divide-rule">
        {summaryFields.map(([key, label]) => {
          const value = currentItem?.[key];
          return (
            <div
              key={key}
              className="px-4 py-2 grid grid-cols-[6.5rem_1fr] gap-3 text-sm bg-bg transition-colors"
            >
              <span className="text-ink-3">{label}</span>
              <span className="text-ink truncate">
                {typeof value === "string" && value.trim() ? value : "Not captured"}
              </span>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 flex items-center justify-between bg-bg-2 text-xs">
        <span className={failedCount > 0 ? "text-err" : "text-ink-3"}>{statusLabel}</span>
        {currentItem?.ai_status && (
          <span className="tnum text-ink-3">{currentItem.ai_status}</span>
        )}
      </div>
    </section>
  );
}
