import { useParams, useNavigate } from "react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { isValidReceiptNumber } from "../utils/receiptNumber";
import { PhotoCapture } from "../components/PhotoCapture";
import { ReceiptNumberInput } from "../components/ReceiptNumberInput";
import { ItemCounter } from "../components/ItemCounter";
import { RecordButton } from "../components/RecordButton";
import { RecordingIndicator } from "../components/RecordingIndicator";
import { RecordingToast } from "../components/RecordingToast";

export function ItemEntryPage() {
  const { sessionId, itemId } = useParams<{
    sessionId: string;
    itemId?: string;
  }>();
  const navigate = useNavigate();
  const creatingRef = useRef(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const numericSessionId = Number(sessionId);

  // Load session
  const session = useLiveQuery(
    () => db.sessions.get(numericSessionId),
    [numericSessionId],
  );

  const mode = session?.mode ?? "house";
  const isNewItem = itemId === "new";

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

      {/* Bottom record section (fixed) */}
      <div className="sticky bottom-0 pb-4 pt-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
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
          </>
        )}
      </div>

      {/* Recording overlays */}
      <RecordingIndicator />
      <RecordingToast />

      {/* Lightbox (rendered conditionally - will be added in Task 2) */}
      {lightboxIndex !== null && numericItemId && (
        <PhotoLightboxWrapper
          itemId={numericItemId}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
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

/** Wrapper to lazy-load photos for lightbox */
function PhotoLightboxWrapper({
  itemId,
  initialIndex,
  onClose,
}: {
  itemId: number;
  initialIndex: number;
  onClose: () => void;
}) {
  // PhotoLightbox will be created in Task 2
  // For now, render a placeholder that will be replaced
  const photos = useLiveQuery(
    () => db.photos.where("itemId").equals(itemId).sortBy("sortOrder"),
    [itemId],
    [],
  );

  if (photos.length === 0) {
    onClose();
    return null;
  }

  // Dynamic import will be replaced in Task 2
  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <p className="text-white">Lightbox loading...</p>
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 left-4 text-white min-h-12 min-w-12 flex items-center justify-center"
      >
        X
      </button>
    </div>
  );
}
