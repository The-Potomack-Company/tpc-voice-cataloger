import { useParams, useNavigate } from "react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { isValidReceiptNumber } from "../utils/receiptNumber";
import { PhotoCapture } from "../components/PhotoCapture";
import { PhotoLightbox } from "../components/PhotoLightbox";
import { ReceiptNumberInput } from "../components/ReceiptNumberInput";
import { ItemCounter } from "../components/ItemCounter";
import { RecordButton } from "../components/RecordButton";
import { RecordingIndicator } from "../components/RecordingIndicator";
import { RecordingToast } from "../components/RecordingToast";
import { ConfirmDialog } from "../components/ConfirmDialog";
import type { ItemPhoto } from "../db/types";

export function ItemEntryPage() {
  const { sessionId, itemId } = useParams<{
    sessionId: string;
    itemId?: string;
  }>();
  const navigate = useNavigate();
  const creatingRef = useRef(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showEmptyWarning, setShowEmptyWarning] = useState(false);
  const isCreatingNext = useRef(false);

  const numericSessionId = Number(sessionId);

  // Load session
  const session = useLiveQuery(
    () => db.sessions.get(numericSessionId),
    [numericSessionId],
  );

  const mode = session?.mode ?? "house";
  const isNewItem = itemId === "new";

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
      const table = mode === "house" ? db.houseVisitItems : db.saleItems;
      const existingCount = await table
        .where("sessionId")
        .equals(numericSessionId)
        .count();

      const newItem = {
        sessionId: numericSessionId,
        sortOrder: existingCount,
        createdAt: new Date(),
        ...(mode === "sale" ? { receiptNumber: "" } : {}),
      };

      const newId = await table.add(newItem as never);
      navigate(`/session/${sessionId}/item/${newId}`, { replace: true });
    };

    createItem().catch(console.error);
  }, [isNewItem, session, mode, numericSessionId, navigate, sessionId]);

  const numericItemId = isNewItem ? undefined : Number(itemId);

  // Load current item
  const item = useLiveQuery(
    () => {
      if (!numericItemId) return undefined;
      return mode === "house"
        ? db.houseVisitItems.get(numericItemId)
        : db.saleItems.get(numericItemId);
    },
    [numericItemId, mode],
  );

  // Load total item count
  const totalItems = useLiveQuery(
    () => {
      const table = mode === "house" ? db.houseVisitItems : db.saleItems;
      return table.where("sessionId").equals(numericSessionId).count();
    },
    [numericSessionId, mode],
    0,
  );

  // Load photos for lightbox (house mode)
  const photos = useLiveQuery(
    () => {
      if (!numericItemId || mode !== "house") return [] as ItemPhoto[];
      return db.photos.where("itemId").equals(numericItemId).sortBy("sortOrder");
    },
    [numericItemId, mode],
    [] as ItemPhoto[],
  );

  // Receipt number state for sale mode
  const [receiptValue, setReceiptValue] = useState("");

  // Sync receipt value from DB
  useEffect(() => {
    if (mode === "sale" && item && "receiptNumber" in item) {
      setReceiptValue(item.receiptNumber ?? "");
    }
  }, [mode, item]);

  const handleReceiptChange = (value: string) => {
    setReceiptValue(value);
  };

  const handleReceiptBlur = useCallback(() => {
    if (numericItemId && mode === "sale") {
      db.saleItems
        .update(numericItemId, { receiptNumber: receiptValue })
        .catch(console.error);
    }
  }, [numericItemId, mode, receiptValue]);

  // Determine current item position (1-based)
  const currentPosition = item ? item.sortOrder + 1 : totalItems + 1;

  // Check if record button should be disabled (sale mode: no valid receipt)
  const isRecordDisabled =
    mode === "sale" && !isValidReceiptNumber(receiptValue);

  // Next Item handler
  const handleNextItem = useCallback(async () => {
    if (!numericItemId || isCreatingNext.current) return;

    // Check if item is empty
    const audioCount = await db.audio
      .where("itemId")
      .equals(numericItemId)
      .count();
    const photoCount =
      mode === "house"
        ? await db.photos.where("itemId").equals(numericItemId).count()
        : 0;
    const hasReceipt =
      mode === "sale" && isValidReceiptNumber(receiptValue);

    const isEmpty =
      audioCount === 0 &&
      photoCount === 0 &&
      (mode === "house" || !hasReceipt);

    if (isEmpty) {
      setShowEmptyWarning(true);
      return;
    }

    proceedToNextItem();
  }, [numericItemId, mode, receiptValue, sessionId, navigate]);

  const proceedToNextItem = useCallback(() => {
    if (isCreatingNext.current) return;
    isCreatingNext.current = true;
    setShowEmptyWarning(false);
    navigate(`/session/${sessionId}/item/new`);
    // Reset after navigation
    setTimeout(() => {
      isCreatingNext.current = false;
    }, 500);
  }, [sessionId, navigate]);

  // Lightbox delete handler
  const handleLightboxDelete = useCallback(
    async (photoId: number) => {
      await db.photos.delete(photoId);
    },
    [],
  );

  // Loading state
  if (!session || (isNewItem && !numericItemId)) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-gray-400 dark:text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!item && numericItemId) {
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
        <BackButton
          sessionId={numericSessionId}
          currentItem={item}
          mode={mode}
        />
      </div>

      {/* Mode-specific top section */}
      <div className="flex-1 py-2 space-y-3">
        {mode === "house" && numericItemId && (
          <PhotoCapture
            itemId={numericItemId}
            onOpenLightbox={(index) => setLightboxIndex(index)}
          />
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
        <ItemCounter current={currentPosition} total={totalItems} />
      </div>

      {/* Bottom record + next item section (sticky) */}
      <div className="sticky bottom-0 pb-4 pt-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm space-y-3">
        {numericItemId && (
          <>
            {isRecordDisabled && (
              <p className="text-center text-sm text-gray-400 dark:text-gray-500 mb-2">
                Enter receipt number to start recording
              </p>
            )}
            <div className={isRecordDisabled ? "opacity-50 pointer-events-none" : ""}>
              <RecordButton itemId={numericItemId} itemType={mode} />
            </div>

            {/* Next Item button */}
            <button
              type="button"
              onClick={handleNextItem}
              className="w-full flex items-center justify-center gap-2 min-h-12 rounded-lg
                bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                text-gray-700 dark:text-gray-300 font-medium
                hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <span>Next Item</span>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
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

      {/* Empty item warning dialog */}
      <ConfirmDialog
        open={showEmptyWarning}
        title="Skip Item?"
        message="This item has no recording or photos. Skip it?"
        confirmLabel="Skip"
        cancelLabel="Cancel"
        onConfirm={proceedToNextItem}
        onCancel={() => setShowEmptyWarning(false)}
      />
    </div>
  );
}

/** Back button with smart navigation to previous item or session detail */
function BackButton({
  sessionId,
  currentItem,
  mode,
}: {
  sessionId: number;
  currentItem: { sortOrder: number } | undefined;
  mode: "house" | "sale";
}) {
  const navigate = useNavigate();

  const previousItem = useLiveQuery(
    () => {
      if (!currentItem || currentItem.sortOrder === 0) return undefined;
      const table = mode === "house" ? db.houseVisitItems : db.saleItems;
      return table
        .where("sessionId")
        .equals(sessionId)
        .filter((i) => i.sortOrder < currentItem.sortOrder)
        .sortBy("sortOrder")
        .then((items) => items[items.length - 1]);
    },
    [sessionId, currentItem?.sortOrder, mode],
  );

  const handleBack = () => {
    if (previousItem?.id) {
      navigate(`/session/${sessionId}/item/${previousItem.id}`);
    } else {
      navigate(`/session/${sessionId}`);
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
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
      {previousItem?.id ? "Previous Item" : "Back to Session"}
    </button>
  );
}
