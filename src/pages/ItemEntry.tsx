import { useParams, useNavigate } from "react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { isValidReceiptNumber } from "../utils/receiptNumber";
import { PhotoCapture } from "../components/PhotoCapture";
import { PhotoLightbox } from "../components/PhotoLightbox";
import { EditableField } from "../components/EditableField";
import { ReceiptNumberInput } from "../components/ReceiptNumberInput";
import { ItemCounter } from "../components/ItemCounter";
import { RecordButton } from "../components/RecordButton";
import { RecordingIndicator } from "../components/RecordingIndicator";
import { RecordingToast } from "../components/RecordingToast";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { RecordingsList } from "../components/RecordingsList";
import { useSession, useSessionItems } from "../hooks/useSessions";
import { useSessionStore } from "../stores/sessionStore";
import { createBlankItem, updateItemField, deleteItem } from "../db/items";
import { reformatMeasurements } from "../utils/formatMeasurements";
import { getDexieItemId } from "../db/idMapping";
import type { ItemPhoto } from "../db/types";

export function ItemEntryPage() {
  const { sessionId, itemId } = useParams<{
    sessionId: string;
    itemId?: string;
  }>();
  const navigate = useNavigate();
  const creatingRef = useRef(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Load session from Zustand
  const session = useSession(sessionId!);
  const fetchItems = useSessionStore(s => s.fetchItems);

  // Fetch items for this session on mount
  useEffect(() => {
    if (sessionId) {
      fetchItems(sessionId);
    }
  }, [sessionId, fetchItems]);

  const mode = session?.mode === "sale" ? "sale" : "house";
  const isNewItem = itemId === "new";

  // Get items from Zustand store
  const items = useSessionItems(sessionId!);
  const item = isNewItem ? undefined : items.find(i => i.id === itemId);
  const totalItems = items.length;

  // Reset creation ref when itemId changes (navigated to a different item)
  useEffect(() => {
    if (!isNewItem) {
      creatingRef.current = false;
    }
  }, [isNewItem, itemId]);

  // Create new item when navigating to /item/new
  useEffect(() => {
    if (!isNewItem || !session || creatingRef.current) return;
    creatingRef.current = true;

    const createItem = async () => {
      const newId = await createBlankItem(sessionId!, mode);
      navigate(`/session/${sessionId}/item/${newId}`, { replace: true });
    };

    createItem().catch(console.error);
  }, [isNewItem, session, mode, sessionId, navigate]);

  // Photos query STAYS Dexie but needs ID mapping for migrated items
  const [dexieItemId, setDexieItemId] = useState<number | string | null>(null);
  useEffect(() => {
    if (!itemId || isNewItem) return;
    getDexieItemId(itemId).then(id => setDexieItemId(id ?? itemId));
  }, [itemId, isNewItem]);

  const photos = useLiveQuery(
    () => {
      if (mode !== "house") return [] as ItemPhoto[];
      const lookupId = dexieItemId ?? itemId;
      if (!lookupId) return [] as ItemPhoto[];
      return db.photos.where("itemId").equals(lookupId).sortBy("sortOrder");
    },
    [dexieItemId, itemId, mode],
    [] as ItemPhoto[],
  );

  // Receipt number state for sale mode
  const [receiptValue, setReceiptValue] = useState("");

  // Sync receipt value from DB
  useEffect(() => {
    if (mode === "sale" && item) {
      setReceiptValue(item.receipt_number ?? "");
    }
  }, [mode, item]);

  const handleReceiptChange = (value: string) => {
    setReceiptValue(value);
  };

  const handleReceiptBlur = useCallback(() => {
    if (itemId && !isNewItem && mode === "sale" && sessionId) {
      updateItemField(itemId, sessionId, "receipt_number", receiptValue).catch(console.error);
    }
  }, [itemId, isNewItem, mode, sessionId, receiptValue]);

  // Determine current item position (1-based)
  const currentPosition = item ? (item.sort_order + 1) : 1;
  const displayTotal = Math.max(totalItems, currentPosition);

  // Prev/next item computation for left/right arrows (house mode)
  const prevItem = item
    ? items.filter(i => i.sort_order < item.sort_order).sort((a, b) => b.sort_order - a.sort_order)[0] ?? null
    : null;
  const nextItem = item
    ? items.filter(i => i.sort_order > item.sort_order).sort((a, b) => a.sort_order - b.sort_order)[0] ?? null
    : null;

  const navigatingArrowRef = useRef(false);

  const handleArrowRight = useCallback(async () => {
    if (navigatingArrowRef.current || !sessionId) return;
    if (nextItem) {
      navigate(`/session/${sessionId}/item/${nextItem.id}`);
    } else {
      // Last item -- create new
      navigatingArrowRef.current = true;
      try {
        const newId = await createBlankItem(sessionId, mode);
        navigate(`/session/${sessionId}/item/${newId}`);
      } catch (err) {
        console.error("Failed to create item:", err);
      } finally {
        setTimeout(() => { navigatingArrowRef.current = false; }, 500);
      }
    }
  }, [nextItem, sessionId, mode, navigate]);

  // Check if record button should be disabled (sale mode: no valid receipt)
  const isRecordDisabled =
    mode === "sale" && !isValidReceiptNumber(receiptValue);

  // Delete item handler
  const handleDeleteItem = useCallback(async () => {
    if (!itemId || isNewItem || !sessionId) return;
    setShowDeleteConfirm(false);
    await deleteItem(itemId, sessionId);
    navigate(`/session/${sessionId}`);
  }, [itemId, isNewItem, sessionId, navigate]);

  // Lightbox delete handler
  const handleLightboxDelete = useCallback(
    async (photoId: number) => {
      await db.photos.delete(photoId);
    },
    [],
  );

  // Loading state
  if (!session || (isNewItem && !item)) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-gray-400 dark:text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!item && !isNewItem) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-gray-400 dark:text-gray-500">Loading item...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] portrait:px-4 landscape:px-8 landscape:max-w-3xl landscape:mx-auto">
      {/* Back button */}
      <div className="py-2">
        <BackButton sessionId={sessionId!} />
      </div>

      {/* Mode-specific top section */}
      <div className="flex-1 py-2 space-y-3">
        {mode === "house" && itemId && !isNewItem && (
          <PhotoCapture
            itemId={itemId}
            onOpenLightbox={(index) => setLightboxIndex(index)}
          />
        )}

        {/* Editable fields for house mode */}
        {mode === "house" && item && (
          <div className="space-y-3 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <EditableField
              label="Title"
              value={item.title ?? undefined}
              onSave={(val) => { updateItemField(item.id, sessionId!, "title", val).catch(console.error); }}
              placeholder="Enter title"
            />
            <EditableField
              label="Description"
              value={item.description ?? undefined}
              onSave={(val) => { updateItemField(item.id, sessionId!, "description", val).catch(console.error); }}
              placeholder="Enter description"
              multiline
            />
            <EditableField
              label="Measurements"
              value={item.measurements ?? undefined}
              onSave={(val) => {
                const reformatted = reformatMeasurements(val);
                updateItemField(item.id, sessionId!, "measurements", reformatted).catch(console.error);
              }}
              placeholder="Enter measurements"
            />
            <EditableField
              label="Condition"
              value={item.condition ?? undefined}
              onSave={(val) => { updateItemField(item.id, sessionId!, "condition", val).catch(console.error); }}
              placeholder="Enter condition"
            />
            <EditableField
              label="Estimate"
              value={item.estimate ?? undefined}
              onSave={(val) => { updateItemField(item.id, sessionId!, "estimate", val).catch(console.error); }}
              placeholder="Enter estimate"
            />
            <EditableField
              label="Category"
              value={item.category ?? undefined}
              onSave={(val) => { updateItemField(item.id, sessionId!, "category", val).catch(console.error); }}
              placeholder="Enter category"
            />
          </div>
        )}

        {mode === "sale" && (
          <div onBlur={handleReceiptBlur}>
            <ReceiptNumberInput
              value={receiptValue}
              onChange={handleReceiptChange}
            />
          </div>
        )}

        {/* Item counter */}
        <ItemCounter current={currentPosition} total={displayTotal} />
      </div>

      {/* Record button + recordings + next item */}
      <div className="pb-4 pt-2 space-y-3">
        {itemId && !isNewItem && (
          <>
            {isRecordDisabled && (
              <p className="text-center text-sm text-gray-400 dark:text-gray-500 mb-2">
                Enter receipt number to start recording
              </p>
            )}
            <div className={isRecordDisabled ? "opacity-50 pointer-events-none" : ""}>
              <RecordButton itemId={itemId} sessionId={sessionId!} />
            </div>

            {/* Recordings list */}
            <RecordingsList itemId={itemId} />

            {/* Delete Item button */}
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center justify-center gap-2 min-h-12 rounded-lg
                border border-red-200 dark:border-red-800
                text-red-600 dark:text-red-400 font-medium
                hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              <span>Delete Item</span>
            </button>
          </>
        )}
      </div>

      {/* Recording overlays */}
      <RecordingIndicator />
      <RecordingToast />

      {/* Photo lightbox */}
      {lightboxIndex !== null && photos.length > 0 && (
        <PhotoLightbox
          photos={photos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onDelete={handleLightboxDelete}
        />
      )}

      {/* Delete item confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Item"
        message="Delete this item and all its recordings and photos? This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleDeleteItem}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Left/right navigation arrows for house mode */}
      {mode === "house" && item && !isNewItem && (
        <>
          {/* Left arrow */}
          <button
            type="button"
            onClick={() => prevItem && navigate(`/session/${sessionId}/item/${prevItem.id}`)}
            disabled={!prevItem}
            className={`fixed top-1/2 left-1 -translate-y-1/2 w-10 h-10 rounded-full
              bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700
              flex items-center justify-center z-30 transition-opacity
              ${!prevItem ? "opacity-30 pointer-events-none" : "hover:bg-gray-100 dark:hover:bg-gray-700"}`}
            aria-label="Previous item"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>

          {/* Right arrow */}
          <button
            type="button"
            onClick={handleArrowRight}
            className="fixed top-1/2 right-1 -translate-y-1/2 w-10 h-10 rounded-full
              bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700
              flex items-center justify-center z-30
              hover:bg-gray-100 dark:hover:bg-gray-700 transition-opacity"
            aria-label={nextItem ? "Next item" : "Create new item"}
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

/** Back button -- always navigates to session detail */
function BackButton({ sessionId }: { sessionId: string }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(`/session/${sessionId}`)}
      className="flex items-center gap-1 text-accent min-h-12"
    >
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 19.5L8.25 12l7.5-7.5"
        />
      </svg>
      Back to Session
    </button>
  );
}
