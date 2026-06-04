import { useState } from "react";
import { processAudioWithAi } from "../services/gemini";

// Plan 04 (Wave 2, disjoint worktree) adds an optional 4th `isRetry` param to
// processAudioWithAi. This call site passes isRetry=true now (O-1: explicit
// retry signal). Until 04 merges, the live 3-arg signature does not yet declare
// the param, so we widen the reference to the forward-compatible shape. When 04
// lands, the cast is a no-op against the real optional param.
type ProcessAudioWithAi = (
  audioId: number,
  itemId: string,
  sessionId: string,
  isRetry?: boolean,
  alreadyClaimed?: boolean,
) => Promise<void>;
const processAudioWithAiRetry = processAudioWithAi as ProcessAudioWithAi;

/** Shared failed-AI banner. Rendered both on the detail page (ItemEntry) and
 *  inline on a failed list card (ItemCard) so list/detail stay in visual
 *  parity (D-07). Shown when ai_status === "failed" so a user sees the failure
 *  and can re-run AI on the latest audio (D-08 — reuses processAudioWithAi).
 *
 *  `latestAudioId` is a PROP, not a local useLiveQuery: each caller supplies
 *  its own source (the card already receives it as a prop; the detail page
 *  derives it via useLiveQuery). Real terminal failures always have audio
 *  (that's what failed to process); if a synthetic state has no audio, the
 *  banner stays hidden so we don't surface an undismissable dead-end. */
export function AiFailureBanner({
  itemId,
  sessionId,
  latestAudioId,
}: {
  itemId: string;
  sessionId: string;
  latestAudioId: number | null;
}) {
  const [retrying, setRetrying] = useState(false);

  if (latestAudioId == null) return null;

  const handleRetry = () => {
    if (retrying) return;
    setRetrying(true);
    // 4th arg isRetry=true: explicit retry signal (O-1). The param is added in
    // Plan 04 (optional, default false), so this is forward-compatible.
    processAudioWithAiRetry(latestAudioId, itemId, sessionId, true)
      .catch((err) => {
        console.error("AI retry failed:", err);
      })
      .finally(() => setRetrying(false));
  };

  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-lg border border-err bg-err-wash px-3 py-2 text-sm"
      style={{ color: "var(--err)" }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="tpc-status-dot tpc-status-dot-err" aria-hidden />
        <span className="font-medium truncate">AI processing failed</span>
      </div>
      <button
        type="button"
        onClick={handleRetry}
        disabled={retrying}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-err px-2.5 py-1 text-xs font-semibold hover:opacity-80 disabled:opacity-50 transition-opacity"
        style={{ color: "var(--err)" }}
      >
        <svg className={`w-3.5 h-3.5 ${retrying ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
        </svg>
        {retrying ? "Retrying" : "Retry"}
      </button>
    </div>
  );
}
