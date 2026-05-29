import { useParams, useNavigate } from "react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";

import { PhotoCapture } from "../components/PhotoCapture";
import { PhotoLightbox } from "../components/PhotoLightbox";
import { EditableField } from "../components/EditableField";
import { ReceiptNumberInput } from "../components/ReceiptNumberInput";
import { ItemCounter } from "../components/ItemCounter";
import { RecordButton } from "../components/RecordButton";
import { Icon } from "../ui/icons";
import { Waveform } from "../ui/Waveform";
import { StatStrip } from "../ui/StatStrip";
import { useRecordingStore } from "../stores/recordingStore";
import { RecordingIndicator } from "../components/RecordingIndicator";
import { RecordingToast } from "../components/RecordingToast";
import { useSession, useSessionItems } from "../hooks/useSessions";
import { useSessionStore } from "../stores/sessionStore";
import { createBlankItem, updateItemField } from "../db/items";
import { reformatMeasurements } from "../utils/formatMeasurements";
import { getDexieItemId } from "../db/idMapping";
import { formatDuration } from "../utils/audio";
import type { ItemPhoto } from "../db/types";
import { audioRecordsForItem } from "../db/audioLookup";
import { processAudioWithAi } from "../services/gemini";

/** Failed-AI banner. Shown when ai_status === "failed" so a user editing a
 *  single item sees the failure and can re-run AI on the latest audio.
 *  Real terminal failures always have audio (that's what failed to
 *  process); if a synthetic state has no audio, the banner stays hidden
 *  so we don't surface an undismissable dead-end. */
function AiFailureBanner({
  itemId,
  sessionId,
}: {
  itemId: string;
  sessionId: string;
}) {
  const [retrying, setRetrying] = useState(false);
  const latestAudioId = useLiveQuery(
    async () => {
      const audios = await audioRecordsForItem(itemId);
      return audios.length > 0
        ? audios.reduce((max, a) => (a.id! > max ? a.id! : max), audios[0].id!)
        : null;
    },
    [itemId],
    null as number | null,
  );

  if (latestAudioId == null) return null;

  const handleRetry = () => {
    if (retrying) return;
    setRetrying(true);
    processAudioWithAi(latestAudioId, itemId, sessionId)
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

/** Always-visible waveform wrapper. Renders the bars dimmed when idle and
 *  swaps the timer copy for a "Tap to record" prompt so the surface always
 *  occupies its space. While AI is processing a just-finished recording
 *  (and we are no longer recording), the bars are replaced by a spinner. */
function RecordingWaveform({ isProcessing = false }: { isProcessing?: boolean }) {
  const isRecording = useRecordingStore((s) => s.isRecording);
  const currentDurationMs = useRecordingStore((s) => s.currentDurationMs);
  const showSpinner = isProcessing && !isRecording;
  return (
    <div className="tpc-card p-3" style={{ background: "var(--bg-2)" }}>
      {showSpinner ? (
        <div
          className="tpc-waveform flex items-center justify-center"
          role="status"
          aria-label="Processing recording"
        >
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      ) : (
        <Waveform />
      )}
      {isRecording ? (
        <div
          className="tnum tpc-display-text mt-3 text-center"
          style={{
            fontSize: 22,
            color: "var(--ink)",
          }}
        >
          {formatDuration(currentDurationMs)}
        </div>
      ) : showSpinner ? (
        <div className="mt-3 text-center text-sm text-ink-3">
          Processing…
        </div>
      ) : (
        <div className="mt-3 text-center text-sm text-ink-3">
          Tap to record
        </div>
      )}
    </div>
  );
}

/**
 * Two-stat strip beneath the record button (mockup SCREEN-02).
 *
 * Shows the live count of items entered and photos captured across this
 * session. Reads directly from the items array passed in to avoid extra
 * round trips.
 */
function RecordingStats({
  itemCount,
  photoCount,
}: {
  itemCount: number;
  photoCount: number;
}) {
  return (
    <StatStrip
      variant="cards"
      stats={[
        { label: "Items", value: itemCount, showBar: false },
        { label: "Photos", value: photoCount, showBar: false },
      ]}
      large
    />
  );
}

export function ItemEntryPage() {
  const { sessionId, itemId } = useParams<{
    sessionId: string;
    itemId?: string;
  }>();
  const navigate = useNavigate();
  const creatingRef = useRef(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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

  // Scroll to top when navigating to a different item
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [itemId]);

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

  // Session-wide photo count for the SCREEN-02 stat strip.
  const sessionPhotoCount = useLiveQuery(
    async () => {
      if (!items.length || mode !== "house") return 0;
      // Sum photos across every item in the session.
      const counts = await Promise.all(
        items.map(async (i) => {
          const lookupId = (await getDexieItemId(i.id)) ?? i.id;
          return db.photos.where("itemId").equals(lookupId).count();
        }),
      );
      return counts.reduce((a, b) => a + b, 0);
    },
    [items.map((i) => i.id).join("|"), mode],
    0,
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

  // Prev/next item computation for left/right arrows (both modes)
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
        <div className="text-ink-3">Loading...</div>
      </div>
    );
  }

  if (!item && !isNewItem) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-ink-3">Loading item...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] portrait:px-4 landscape:px-8 landscape:max-w-3xl landscape:mx-auto pb-40">
      {/* Back button */}
      <div className="py-2">
        <BackButton sessionId={sessionId!} />
      </div>

      {/* Mode-specific top section */}
      <div className="py-2 space-y-3">
        {mode === "house" && itemId && !isNewItem && (
          <PhotoCapture
            itemId={itemId}
            sessionId={sessionId!}
            onOpenLightbox={(index) => setLightboxIndex(index)}
          />
        )}

        {/* AI failure banner — only renders when the last AI run terminally
            failed. Without this, the detail page has no failure surface and
            users have no path back to a successful run. */}
        {item?.ai_status === "failed" && itemId && (
          <AiFailureBanner itemId={itemId} sessionId={sessionId!} />
        )}

        {/* Receipt number input for sale mode (top field) */}
        {mode === "sale" && (
          <div onBlur={handleReceiptBlur}>
            <ReceiptNumberInput
              value={receiptValue}
              onChange={handleReceiptChange}
            />
          </div>
        )}

        {/* Editable fields for both modes */}
        {item && (
          <div className="space-y-3 border border-rule rounded-lg p-3">
            <EditableField
              label="Header"
              value={item.title ?? undefined}
              onSave={(val) => { updateItemField(item.id, sessionId!, "title", val).catch(console.error); }}
              placeholder="Enter header"
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

        {/* Raw transcript — collapsed by default so the long copy doesn't
            dominate the screen. Native <details> keeps it a11y-correct. */}
        {item?.transcript && (
          <details className="border border-rule rounded-lg p-3">
            <summary className="text-xs font-medium text-ink-3 uppercase tracking-wide cursor-pointer flex items-center gap-2">
              <span className="tpc-disclosure-chev"><Icon name="chev" size={12} aria-hidden /></span>
              Raw transcript
            </summary>
            <p className="mt-2 text-sm text-ink-2 whitespace-pre-wrap italic">
              {item.transcript}
            </p>
          </details>
        )}

        {/* Item counter */}
        <ItemCounter current={currentPosition} total={displayTotal} />
      </div>

      {/* Always-on waveform + recording stats. Record button lives in the
          bottom trio (mockup tpc-voice.jsx:151-161). Item deletion is handled
          exclusively from SessionDetail's SwipeableRow swipe-to-delete. */}
      <div className="pb-4 pt-2 space-y-3">
        {itemId && !isNewItem && (
          <>
            {/* Live waveform — always rendered; dims when idle. Replaced by
                a spinner while AI processes a just-finished recording. */}
            <RecordingWaveform
              isProcessing={item?.ai_status === "processing"}
            />

            {/* Two-stat strip — items entered and photos captured. */}
            {session && (
              <RecordingStats
                itemCount={totalItems}
                photoCount={sessionPhotoCount}
              />
            )}
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

      {/* Bottom control trio — prev item / record / next item (mockup
          tpc-voice.jsx:151-161). Anchored above the tab bar so it stays
          reachable on small screens. */}
      {item && !isNewItem && itemId && (
        <div className="fixed bottom-20 left-0 right-0 px-4 pb-[env(safe-area-inset-bottom)] landscape:max-w-3xl landscape:mx-auto z-40">
          <div className="flex items-center justify-around">
            {/* Previous item */}
            <button
              type="button"
              onClick={() => prevItem && navigate(`/session/${sessionId}/item/${prevItem.id}`)}
              disabled={!prevItem}
              aria-label="Previous item"
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "var(--bg-2)",
                border: "1px solid var(--rule-2)",
                color: "var(--ink-2)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: prevItem ? 1 : 0.3,
                cursor: prevItem ? "pointer" : "default",
              }}
            >
              <Icon name="back" size={20} aria-hidden />
            </button>

            {/* Record (FAB) */}
            <RecordButton itemId={itemId} sessionId={sessionId!} />

            {/* Next item / create new */}
            <button
              type="button"
              onClick={handleArrowRight}
              aria-label={nextItem ? "Next item" : "Create new item"}
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "var(--accent-wash)",
                border: "1px solid color-mix(in oklch, var(--accent) 30%, transparent)",
                color: "var(--accent)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <Icon name="plus" size={20} aria-hidden />
            </button>
          </div>
        </div>
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
