import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import type { HouseVisitItem, SaleItem } from "../db/types";
import { EditableField } from "./EditableField";
import { SwipeableRow } from "./SwipeableRow";
import { ConfirmDialog } from "./ConfirmDialog";
import { updateItemField, deleteItem } from "../db/items";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { processAudioWithAi } from "../services/gemini";

interface ItemCardProps {
  item: HouseVisitItem | SaleItem;
  mode: "house" | "sale";
  isExpanded: boolean;
  onToggle: () => void;
  readOnly?: boolean;
}

export function ItemCard({ item, mode, isExpanded, onToggle, readOnly }: ItemCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const { status, startRecording, stopRecording } = useAudioRecorder();
  const isQueued = item.aiStatus === "queued";
  const isFailed = item.aiStatus === "failed";
  const isProcessing = item.aiStatus === "processing";

  const audioData = useLiveQuery(
    async () => {
      const audios = await db.audio.where("itemId").equals(item.id!).toArray();
      const count = audios.length;
      const latestAudioId = count > 0
        ? audios.reduce((max, a) => (a.id! > max ? a.id! : max), audios[0].id!)
        : null;
      return { count, latestAudioId };
    },
    [item.id],
    { count: 0, latestAudioId: null as number | null },
  );

  const audioCount = audioData.count;
  const latestAudioId = audioData.latestAudioId;

  const handleRetryAi = () => {
    if (!latestAudioId || retrying) return;
    setRetrying(true);
    processAudioWithAi(latestAudioId, item.id!, mode)
      .then(() => setRetrying(false))
      .catch((err) => {
        console.error("AI retry failed:", err);
        setRetrying(false);
      });
  };

  const photoCount = useLiveQuery(
    () =>
      mode === "house"
        ? db.photos.where("itemId").equals(item.id!).count()
        : Promise.resolve(0),
    [item.id, mode],
    0,
  );

  const receiptNumber =
    mode === "sale" ? (item as SaleItem).receiptNumber : undefined;

  const handleFieldSave = (field: string) => (value: string) => {
    updateItemField(item.id!, mode, field, value);
  };

  const handleDelete = async () => {
    await deleteItem(item.id!, mode);
    setShowDeleteConfirm(false);
  };

  const handleMicClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (status === "recording") {
      const audioId = await stopRecording();
      if (audioId != null) {
        if (navigator.onLine) {
          processAudioWithAi(audioId, item.id!, mode).catch((err) =>
            console.error("AI processing failed:", err),
          );
        } else {
          const table = mode === "house" ? db.houseVisitItems : db.saleItems;
          await table.update(item.id!, { aiStatus: "queued" as const });
        }
      }
    } else if (status === "idle") {
      startRecording(item.id!, mode);
    }
  };

  return (
    <SwipeableRow onDelete={() => setShowDeleteConfirm(true)} disabled={readOnly}>
      <div className={`bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg${isQueued ? " opacity-50" : ""}`}>
        {/* Collapsed row - always visible (div instead of button to allow nested mic button) */}
        <div
          role="button"
          tabIndex={0}
          onClick={onToggle}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-left cursor-pointer"
        >
          {/* Item number + title preview */}
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate block">
              {mode === "sale" && receiptNumber
                ? `#${receiptNumber}`
                : `Item ${item.sortOrder + 1}`}
              {item.title ? ` — ${item.title}` : ""}
            </span>
            {item.description && (
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate block mt-0.5">
                {item.description}
              </span>
            )}
          </div>

          {/* Indicator icons */}
          <div className="flex items-center gap-2 shrink-0">
            {audioCount > 0 && (
              <svg
                className="w-4 h-4 text-green-600 dark:text-green-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" />
              </svg>
            )}

            {mode === "house" && photoCount > 0 && (
              <span className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400">
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

            {isQueued && (
              <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                Queued
              </span>
            )}

            {isFailed && (
              <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                Failed
              </span>
            )}

            {isProcessing && (
              <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 animate-pulse">
                Processing...
              </span>
            )}

            {/* Mic icon for re-record */}
            {!readOnly && !isQueued && !isProcessing && <button
              type="button"
              onClick={handleMicClick}
              className={`w-6 h-6 flex items-center justify-center rounded-full transition-colors ${
                status === "recording"
                  ? "bg-red-500 text-white animate-pulse"
                  : "text-gray-500 dark:text-gray-400 hover:text-accent dark:hover:text-accent hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
              aria-label={status === "recording" ? "Stop recording" : "Record audio"}
            >
              {status === "recording" ? (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
              ) : (
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                  />
                </svg>
              )}
            </button>}

            {/* Chevron */}
            <svg
              className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${
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
          </div>
        </div>

        {/* Expanded section -- queued waiting message */}
        {isExpanded && isQueued && (
          <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-6 text-center">
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Waiting for connectivity to process...
            </p>
          </div>
        )}

        {/* Expanded section -- editable fields (non-queued only) */}
        {isExpanded && !isQueued && (
          <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-3 space-y-3">
            <EditableField
              label="Title"
              value={item.title}
              onSave={handleFieldSave("title")}
              placeholder="Enter title"
              readOnly={readOnly}
            />
            <EditableField
              label="Description"
              value={item.description}
              onSave={handleFieldSave("description")}
              placeholder="Enter description"
              multiline
              readOnly={readOnly}
            />
            <EditableField
              label="Condition"
              value={item.condition}
              onSave={handleFieldSave("condition")}
              placeholder="Enter condition"
              readOnly={readOnly}
            />
            <EditableField
              label="Estimate"
              value={item.estimate}
              onSave={handleFieldSave("estimate")}
              placeholder="Enter estimate"
              readOnly={readOnly}
            />
            <EditableField
              label="Category"
              value={item.category}
              onSave={handleFieldSave("category")}
              placeholder="Enter category"
              readOnly={readOnly}
            />

            {mode === "sale" && (
              <EditableField
                label="Receipt Number"
                value={receiptNumber}
                onSave={handleFieldSave("receiptNumber")}
                placeholder="Enter receipt number"
                readOnly={readOnly}
              />
            )}

            {/* Raw transcript */}
            {item.transcript && (
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Raw Transcript
                </span>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap italic">
                  {item.transcript}
                </p>
              </div>
            )}

            {/* Retry AI button for failed or stuck-processing items */}
            {!readOnly && (isFailed || isProcessing) && (
              <button
                type="button"
                onClick={handleRetryAi}
                disabled={retrying || !latestAudioId}
                title={!latestAudioId ? "No audio to retry" : undefined}
                className="w-full text-sm text-blue-600 dark:text-blue-400 font-medium
                           py-2 rounded-lg border border-blue-200 dark:border-blue-800
                           hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors
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
                className="w-full mt-2 text-sm text-red-600 dark:text-red-400 font-medium
                           py-2 rounded-lg border border-red-200 dark:border-red-800
                           hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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
