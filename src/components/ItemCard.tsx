import React, { useState } from "react";
import { useNavigate } from "react-router";
import type { Tables } from "../db/database.types";
import { EditableField } from "./EditableField";
import { SwipeableRow } from "./SwipeableRow";
import { ConfirmDialog } from "./ConfirmDialog";
import { updateItemField, deleteItem } from "../db/items";
import { processAudioWithAi } from "../services/gemini";
import { reformatMeasurements } from "../utils/formatMeasurements";
import { useAudioUploadStatus } from "../hooks/useAudioUploadStatus";
import { retryFailedUploads } from "../services/audioUploadQueue";
import { Badge } from "../ui/Badge";
import { AiFailureBanner } from "./AiFailureBanner";
import { OverflowMenu } from "../ui/OverflowMenu";

type SupabaseItem = Tables<"items">;

interface ItemCardProps {
  item: SupabaseItem;
  sessionId: string;
  isExpanded: boolean;
  onToggle: () => void;
  readOnly?: boolean;
  audioCount: number;
  latestAudioId: number | null;
  // F2: server-side audio existence (cross-device) — gates AiFailureBanner Retry.
  hasServerAudio: boolean;
  photoCount: number;
  dexieItemId: number | string | null;
  isPending: boolean;
}

// D-08: dev-only render counter. PERF-3 render-count test imports this from this
// module (contract), so the non-component export lives here intentionally — proves a
// one-item state change re-renders only that card. No-op in production builds.
// eslint-disable-next-line react-refresh/only-export-components
export const __itemCardRenderCounts = new Map<string, number>();

function ItemCardImpl({
  item,
  sessionId,
  isExpanded,
  onToggle,
  readOnly,
  audioCount,
  latestAudioId,
  hasServerAudio,
  photoCount,
  isPending,
}: ItemCardProps) {
  if (import.meta.env.MODE !== "production") {
    __itemCardRenderCounts.set(item.id, (__itemCardRenderCounts.get(item.id) ?? 0) + 1);
  }
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const isQueued = item.ai_status === "queued";
  const isFailed = item.ai_status === "failed";
  const isProcessing = item.ai_status === "processing";

  // D-06: surface audio upload durability for the item's latest recording.
  const uploadStatus = useAudioUploadStatus(latestAudioId ?? undefined);

  const handleRetryAi = () => {
    if (!latestAudioId || retrying) return;
    setRetrying(true);
    processAudioWithAi(latestAudioId, item.id, sessionId, true)
      .then(() => setRetrying(false))
      .catch((err) => {
        console.error("AI retry failed:", err);
        setRetrying(false);
      });
  };

  const handleFieldSave = (field: string) => (value: string) => {
    updateItemField(item.id, sessionId, field, value);
  };

  const handleDelete = async () => {
    await deleteItem(item.id, sessionId);
    setShowDeleteConfirm(false);
  };

  // Status dot tone \u2014 mirrors mockup item-status dots (ok / warn / err / info).
  const dotTone: "ok" | "warn" | "err" | "info" =
    isFailed ? "err"
      : isQueued || isProcessing ? "info"
      : !item.title ? "warn"
      : "ok";

  return (
    <SwipeableRow onDelete={() => setShowDeleteConfirm(true)} disabled={readOnly}>
      <div className={`tpc-card${isQueued ? " opacity-50" : ""}`} style={{ background: "var(--bg-2)" }}>
        {/* Collapsed row - always visible (div instead of button to allow nested mic button) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            navigate(`/session/${sessionId}/item/${item.id}`);
          }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/session/${sessionId}/item/${item.id}`); } }}
          className="w-full grid items-start gap-3 px-4 py-3 text-left cursor-pointer"
          style={{ gridTemplateColumns: "auto 1fr auto" }}
          data-testid="item-card"
        >
          {/* Item number + status dot (mockup column 1) */}
          <div className="flex flex-col items-center gap-1 pt-0.5 min-w-[28px]" aria-hidden>
            <span
              className="tnum tpc-mono"
              style={{
                fontSize: 11,
                color: "var(--accent)",
                fontWeight: 500,
              }}
            >
              {item.mode === "sale" && item.receipt_number
                ? `#${item.receipt_number}`
                : String(item.sort_order + 1).padStart(3, "0")}
            </span>
            <span
              className={`tpc-status-dot tpc-status-dot-${dotTone}`}
              data-testid="item-status-dot"
              data-tone={dotTone}
            />
          </div>

          {/* Title + description preview */}
          <div className="min-w-0">
            <span className={`text-sm font-medium truncate block ${dotTone === "err" ? "text-err" : "text-ink"}`}>
              {item.title || "\u2014 needs title \u2014"}
            </span>
            {item.description && (
              <span className="text-xs text-ink-3 mt-0.5 line-clamp-2 leading-snug block whitespace-pre-wrap">
                {item.description}
              </span>
            )}
          </div>

          {/* Indicator icons */}
          <div className="flex items-center gap-2 shrink-0">
            {isPending && (
              <Badge tone="warn" aria-label="This change will sync when you reconnect">
                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 12a8 8 0 0116 0M20 12a8 8 0 01-16 0" />
                </svg>
                Pending sync
              </Badge>
            )}

            {audioCount > 0 && (
              <svg
                className="w-4 h-4 text-ok"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" />
              </svg>
            )}

            {item.mode === "house" && photoCount > 0 && (
              <span className="flex items-center gap-0.5 text-accent">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M1 8a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 018.07 3h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0016.07 6H17a2 2 0 012 2v7a2 2 0 01-2 2H3a2 2 0 01-2-2V8zm13.5 3a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM10 14a3 3 0 100-6 3 3 0 000 6z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-xs font-medium">{photoCount}</span>
              </span>
            )}

            {/* D-06: audio upload durability pill (pending/uploaded/failed).
                'none' renders nothing. 'failed' is a retry control that
                re-enqueues via retryFailedUploads(). LIB Badge tones only. */}
            {(uploadStatus === "pending" || uploadStatus === "uploading") && (
              <Badge tone="info" data-testid="audio-upload-pill">
                Pending
              </Badge>
            )}
            {uploadStatus === "uploaded" && (
              <Badge tone="ok" data-testid="audio-upload-pill">
                Uploaded
              </Badge>
            )}
            {uploadStatus === "failed" && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void retryFailedUploads();
                }}
                aria-label="Audio upload failed — tap to retry"
                title="Upload failed — tap to retry"
              >
                <Badge tone="err" data-testid="audio-upload-pill">
                  Failed — retry
                </Badge>
              </button>
            )}

            {isQueued && <Badge tone="warn">Queued</Badge>}

            {isProcessing && (
              <Badge tone="info" className="animate-pulse">
                Processing...
              </Badge>
            )}

            {/* Chevron — house mode only. Sale mode navigates to detail, so
                an inline expand toggle would be dead weight. House mode keeps
                it for the read-only field summary which has no other surface. */}
            {item.mode === "house" && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggle(); }}
                className="p-0.5 -m-0.5 rounded hover:bg-bg-2 transition-colors"
                aria-label={isExpanded ? "Collapse details" : "Expand details"}
              >
                <svg
                  className={`w-4 h-4 text-ink-3 transition-transform ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.25 4.5l7.5 7.5-7.5 7.5"
                  />
                </svg>
              </button>
            )}

            {/* Accessible-equivalent of swipe-to-delete (D-03). Routes through
                the existing local ConfirmDialog via setShowDeleteConfirm — no
                new delete path (D-04). */}
            {!readOnly && (
              <OverflowMenu
                actions={[
                  {
                    label: "Delete",
                    destructive: true,
                    onSelect: () => setShowDeleteConfirm(true),
                  },
                ]}
              />
            )}
          </div>
        </div>

        {/* D-07: full-width inline AI-failure row, gated on ai_status==="failed".
            Shares ONE component with the detail-view banner (AiFailureBanner) so
            list/detail stay in visual parity. Reuses the existing
            processAudioWithAi retry path (D-08); the card passes its own
            latestAudioId prop. */}
        {isFailed && (
          <div className="border-t border-rule px-3 py-3">
            <AiFailureBanner
              itemId={item.id}
              sessionId={sessionId}
              latestAudioId={latestAudioId}
              hasServerAudio={hasServerAudio}
            />
          </div>
        )}

        {/* Expanded section -- queued waiting message */}
        {isExpanded && isQueued && (
          <div className="border-t border-rule px-3 py-6 text-center">
            <p className="text-sm text-ink-3">
              Waiting for connectivity to process...
            </p>
          </div>
        )}

        {/* Expanded section -- house mode: read-only field summary */}
        {isExpanded && !isQueued && item.mode === "house" && (
          <div className="border-t border-rule px-3 py-3 space-y-2">
            {([
              ["Header", item.title],
              ["Description", item.description],
              ["Measurements", item.measurements],
              ["Condition", item.condition],
              ["Estimate", item.estimate],
              ["Category", item.category],
            ] as const).filter(([, val]) => val).map(([label, val]) => (
              <div key={label}>
                <span className="text-xs font-medium text-ink-3 uppercase">{label}</span>
                <p className="text-sm text-ink whitespace-pre-wrap">{val}</p>
              </div>
            ))}

            {!readOnly && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="tpc-btn tpc-btn-danger tpc-btn-fullwidth mt-3"
              >
                Delete Item
              </button>
            )}
          </div>
        )}

        {/* Expanded section -- sale mode: editable fields (non-queued only) */}
        {isExpanded && !isQueued && item.mode !== "house" && (
          <div className="border-t border-rule px-3 py-3 space-y-3">
            <EditableField
              label="Header"
              value={item.title ?? undefined}
              onSave={handleFieldSave("title")}
              placeholder="Enter header"
              readOnly={readOnly}
            />
            <EditableField
              label="Description"
              value={item.description ?? undefined}
              onSave={handleFieldSave("description")}
              placeholder="Enter description"
              multiline
              readOnly={readOnly}
            />
            <EditableField
              label="Measurements"
              value={item.measurements ?? undefined}
              onSave={(val) => {
                const reformatted = reformatMeasurements(val);
                handleFieldSave("measurements")(reformatted);
              }}
              placeholder="Enter measurements"
              readOnly={readOnly}
            />
            <EditableField
              label="Condition"
              value={item.condition ?? undefined}
              onSave={handleFieldSave("condition")}
              placeholder="Enter condition"
              readOnly={readOnly}
            />
            <EditableField
              label="Estimate"
              value={item.estimate ?? undefined}
              onSave={handleFieldSave("estimate")}
              placeholder="Enter estimate"
              readOnly={readOnly}
            />
            <EditableField
              label="Category"
              value={item.category ?? undefined}
              onSave={handleFieldSave("category")}
              placeholder="Enter category"
              readOnly={readOnly}
            />

            {item.mode === "sale" && (
              <EditableField
                label="Receipt Number"
                value={item.receipt_number ?? undefined}
                onSave={handleFieldSave("receipt_number")}
                placeholder="Enter receipt number"
                readOnly={readOnly}
              />
            )}

            {/* Raw transcript — collapsed by default. */}
            {item.transcript && (
              <details className="pt-2 border-t border-rule">
                <summary className="text-xs font-medium text-ink-3 uppercase tracking-wide cursor-pointer flex items-center gap-2">
                  <span className="tpc-disclosure-chev">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
                    </svg>
                  </span>
                  Raw transcript
                </summary>
                <p className="mt-2 text-sm text-ink-2 whitespace-pre-wrap italic">
                  {item.transcript}
                </p>
              </details>
            )}

            {/* Retry AI button for failed or stuck-processing items */}
            {!readOnly && (isFailed || isProcessing) && (
              <button
                type="button"
                onClick={handleRetryAi}
                disabled={retrying || !latestAudioId}
                title={!latestAudioId ? "No audio to retry" : undefined}
                className="w-full text-sm text-accent font-medium
                           py-2 rounded-lg border border-accent
                           hover:bg-accent-wash transition-colors
                           disabled:opacity-50"
              >
                {retrying ? (
                  <span className="animate-pulse">Retrying...</span>
                ) : isProcessing ? (
                  "Stuck? Retry Processing"
                ) : (
                  "Retry AI"
                )}
              </button>
            )}

            {/* Delete button */}
            {!readOnly && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="tpc-btn tpc-btn-danger tpc-btn-fullwidth mt-2"
              >
                Delete Item
              </button>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Item"
        message="Delete this item and all its recordings and photos? This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </SwipeableRow>
  );
}

// PERF-3 (Pitfall 2): memo delivers the fan-out cut. The 5 meta values arrive as
// primitives, but `item` is an object whose reference changes whenever the parent's
// items array is rebuilt (every Dexie emit). A default shallow compare would then
// re-render every card on any single-item write. The comparator shallow-compares the
// item's own fields so a structurally-unchanged item skips re-render; only the card
// whose item data actually changed re-renders.
function arePropsEqual(prev: ItemCardProps, next: ItemCardProps): boolean {
  if (
    prev.sessionId !== next.sessionId ||
    prev.isExpanded !== next.isExpanded ||
    prev.onToggle !== next.onToggle ||
    prev.readOnly !== next.readOnly ||
    prev.audioCount !== next.audioCount ||
    prev.latestAudioId !== next.latestAudioId ||
    prev.hasServerAudio !== next.hasServerAudio ||
    prev.photoCount !== next.photoCount ||
    prev.dexieItemId !== next.dexieItemId ||
    prev.isPending !== next.isPending
  ) {
    return false;
  }
  if (prev.item === next.item) return true;
  const a = prev.item as Record<string, unknown>;
  const b = next.item as Record<string, unknown>;
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((k) => a[k] === b[k]);
}

export const ItemCard = React.memo(ItemCardImpl, arePropsEqual);
