import { useState, useCallback, useEffect, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useSessionItems } from "../hooks/useSessions";
import { audioRecordsForItem } from "../db/audioLookup";
import { getDexieItemId } from "../db/idMapping";
import { hasPendingForItem } from "../hooks/useWriteAheadQueue";
import { db } from "../db";
import { ItemCard } from "./ItemCard";
import { createBlankItem } from "../db/items";
import { processAudioWithAi } from "../services/gemini";
import { ConfirmDialog } from "./ConfirmDialog";
import { mergeItems } from "../services/mergeItems";
import { ItemPeekModal } from "./ItemPeekModal";

interface ItemListProps {
  sessionId: string;
  mode: "house" | "sale";
  onAddItemRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  readOnly?: boolean;
  compact?: boolean;
}

// PERF-3: per-item meta hoisted out of ItemCard into ONE aggregate subscription.
interface ItemMeta {
  audioCount: number;
  latestAudioId: number | null;
  photoCount: number;
  dexieItemId: number | string | null;
  isPending: boolean;
}

// Module scope — stable identity so the empty default never churns memo props.
const EMPTY_META = new Map<string, ItemMeta>();

export function ItemList({ sessionId, mode, onAddItemRef, readOnly, compact = false }: ItemListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [newItemId, setNewItemId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMergeConfirm, setShowMergeConfirm] = useState(false);
  const [merging, setMerging] = useState(false);
  const [peekItemId, setPeekItemId] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  const items = useSessionItems(sessionId);
  const peekItem = items.find((item) => item.id === peekItemId) ?? null;

  // PERF-3: ONE aggregate subscription replaces the ~4N per-card subscriptions/effects.
  // Each slice is threaded to ItemCard as a primitive prop (clean React.memo compare).
  const itemMeta = useLiveQuery(
    async () => {
      const map = new Map<string, ItemMeta>();
      for (const item of items) {
        const audios = await audioRecordsForItem(item.id);
        const audioCount = audios.length;
        const latestAudioId = audioCount > 0
          ? audios.reduce((max, a) => (a.id! > max ? a.id! : max), audios[0].id!)
          : null;
        const dexieItemId = (await getDexieItemId(item.id)) ?? item.id;
        const photoCount = item.mode === "house" && dexieItemId != null
          ? await db.photos.where("itemId").equals(dexieItemId).count()
          : 0;
        const isPending = await hasPendingForItem(item.id);
        map.set(item.id, { audioCount, latestAudioId, photoCount, dexieItemId, isPending });
      }
      return map;
    },
    [items],
    EMPTY_META,
  );
  const metaMap = itemMeta instanceof Map ? itemMeta : EMPTY_META;

  useEffect(() => {
    if (peekItemId !== null && !peekItem) {
      setPeekItemId(null);
    }
  }, [peekItemId, peekItem]);

  const toggleExpand = useCallback((itemId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  const handleAddItem = useCallback(async () => {
    const newId = await createBlankItem(sessionId, mode);
    setExpandedIds(new Set([newId]));
    setNewItemId(newId);
  }, [sessionId, mode]);

  // Scroll to newly created item once it appears in the DOM
  useEffect(() => {
    if (newItemId !== null) {
      const timer = setTimeout(() => {
        const el = document.querySelector(`[data-item-id="${newItemId}"]`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
        setNewItemId(null);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [newItemId, items]);

  // Expose handleAddItem to parent via ref
  useEffect(() => {
    if (onAddItemRef) {
      onAddItemRef.current = handleAddItem;
    }
    return () => {
      if (onAddItemRef) {
        onAddItemRef.current = null;
      }
    };
  }, [onAddItemRef, handleAddItem]);

  const stuckItems = items.filter(
    (i) => i.ai_status === "processing" || i.ai_status === "failed",
  );
  const [retryingAll, setRetryingAll] = useState(false);

  const handleRetryAll = useCallback(async () => {
    if (retryingAll || stuckItems.length === 0) return;
    setRetryingAll(true);
    try {
      await Promise.all(
        stuckItems.map(async (item) => {
          const audios = await audioRecordsForItem(item.id);
          if (audios.length === 0) return;
          const latestAudioId = audios.reduce((max, a) => (a.id! > max ? a.id! : max), audios[0].id!);
          // Retry-all targets stuck (processing/failed) items — a retry path,
          // so isRetry=true to honor the no-clobber guard (D-05).
          return processAudioWithAi(latestAudioId, item.id, sessionId, true);
        }),
      );
    } catch (err) {
      console.error("Retry all failed:", err);
    } finally {
      setRetryingAll(false);
    }
  }, [retryingAll, stuckItems, sessionId]);

  // Long-press handlers
  const handlePointerDown = useCallback((itemId: string) => {
    if (readOnly) return;
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setSelectMode(true);
      setSelectedIds(new Set([itemId]));
    }, 500);
  }, [readOnly]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Toggle selection in select mode
  const toggleSelection = useCallback((itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  // PERF-3: stable per-item onToggle so React.memo'd ItemCards aren't re-rendered by
  // a fresh closure on every ItemList render. The dispatcher's identity stays constant
  // per item id; the select-mode-aware behavior is read live from a ref.
  const toggleHandlerRef = useRef<(itemId: string) => void>(() => {});
  toggleHandlerRef.current = (itemId: string) =>
    (selectMode ? toggleSelection : toggleExpand)(itemId);
  const onToggleCacheRef = useRef(new Map<string, () => void>());
  const getOnToggle = useCallback((itemId: string) => {
    const cache = onToggleCacheRef.current;
    let fn = cache.get(itemId);
    if (!fn) {
      fn = () => toggleHandlerRef.current(itemId);
      cache.set(itemId, fn);
    }
    return fn;
  }, []);

  // Cancel select mode
  const cancelSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  // Get merge target and source based on sort_order
  const getMergeItemNumbers = useCallback(() => {
    if (selectedIds.size !== 2) return { targetNum: 0, sourceNum: 0 };
    const [id1, id2] = Array.from(selectedIds);
    const item1 = items.find((i) => i.id === id1);
    const item2 = items.find((i) => i.id === id2);
    if (!item1 || !item2) return { targetNum: 0, sourceNum: 0 };

    const target = item1.sort_order <= item2.sort_order ? item1 : item2;
    const source = item1.sort_order <= item2.sort_order ? item2 : item1;
    return {
      targetNum: items.indexOf(target) + 1,
      sourceNum: items.indexOf(source) + 1,
      targetId: target.id,
      sourceId: source.id,
    };
  }, [selectedIds, items]);

  // Handle merge
  const handleMerge = useCallback(async () => {
    const { targetId, sourceId } = getMergeItemNumbers();
    if (!targetId || !sourceId) return;

    setMerging(true);
    try {
      await mergeItems(targetId, sourceId, sessionId);
    } catch (err) {
      console.error("Merge failed:", err);
    } finally {
      setMerging(false);
      setSelectMode(false);
      setSelectedIds(new Set());
      setShowMergeConfirm(false);
    }
  }, [getMergeItemNumbers, sessionId]);

  if (items.length === 0) {
    return (
      <div className="bg-bg-2 rounded-lg p-6 text-center">
        <p className="text-ink-3 text-sm">
          No items yet. Tap "Add Item" to start cataloging.
        </p>
      </div>
    );
  }

  const mergeInfo = getMergeItemNumbers();

  if (compact) {
    return (
      <div className="space-y-1.5">
        {items.map((item) => {
          const hasReceipt = Boolean(item.receipt_number);
          const preview = item.description ?? item.title ?? "No description yet";
          return (
            <button
              key={item.id}
              type="button"
              data-item-id={item.id}
              onClick={() => setPeekItemId(item.id)}
              className="w-full grid grid-cols-[minmax(5rem,8rem)_auto_1fr] items-center gap-2 rounded-lg border border-rule bg-bg-2 px-3 py-2 text-left"
            >
              <span className={`tnum text-xs truncate ${hasReceipt ? "text-ink" : "text-err"}`}>
                {item.receipt_number ?? `Item ${item.sort_order + 1}`}
              </span>
              <span
                className={`h-2 w-2 rounded-full ${
                  item.ai_status === "done"
                    ? "bg-ok"
                    : item.ai_status === "failed"
                      ? "bg-err"
                      : item.ai_status === "processing"
                        ? "bg-accent"
                        : "bg-ink-4"
                }`}
                aria-hidden
              />
              <span className="text-sm text-ink-2 truncate">{preview}</span>
            </button>
          );
        })}
        {peekItem ? <ItemPeekModal item={peekItem} onClose={() => setPeekItemId(null)} /> : null}
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${selectMode ? "pb-20" : ""}`}>
      {!readOnly && !selectMode && stuckItems.length > 0 && (
        <button
          type="button"
          onClick={handleRetryAll}
          disabled={retryingAll}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                     border border-warn
                     bg-warn-wash
                     text-sm text-warn font-medium
                     hover:opacity-80
                     disabled:opacity-50 transition-colors"
        >
          {retryingAll ? (
            <span className="animate-pulse">Retrying {stuckItems.length} items...</span>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
              Retry All Stuck ({stuckItems.length})
            </>
          )}
        </button>
      )}

      {items.map((item) => {
        const meta = metaMap.get(item.id);
        return (
        <div
          key={item.id}
          data-item-id={item.id}
          className="flex items-start gap-2"
          onPointerDown={() => handlePointerDown(item.id)}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
        >
          {/* Checkbox in select mode */}
          {selectMode && (
            <button
              type="button"
              className="mt-3 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleSelection(item.id);
              }}
              aria-label={selectedIds.has(item.id) ? "Deselect item" : "Select item"}
            >
              {selectedIds.has(item.id) ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="11" fill="currentColor" className="text-accent" />
                  <path d="M7 12.5L10 15.5L17 8.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="1.5" className="text-ink-3" />
                </svg>
              )}
            </button>
          )}

          <div
            className="flex-1 min-w-0"
            onClick={selectMode ? (e) => { e.stopPropagation(); toggleSelection(item.id); } : undefined}
          >
            <ItemCard
              item={item}
              sessionId={sessionId}
              isExpanded={!selectMode && expandedIds.has(item.id)}
              onToggle={getOnToggle(item.id)}
              readOnly={readOnly || selectMode}
              audioCount={meta?.audioCount ?? 0}
              latestAudioId={meta?.latestAudioId ?? null}
              photoCount={meta?.photoCount ?? 0}
              dexieItemId={meta?.dexieItemId ?? null}
              isPending={meta?.isPending ?? false}
            />
          </div>
        </div>
        );
      })}

      {/* Floating merge toolbar */}
      {selectMode && (
        <div className="fixed bottom-0 left-0 right-0 bg-bg border-t border-rule shadow-lg px-4 py-3 flex items-center justify-between z-50">
          <button
            type="button"
            onClick={cancelSelectMode}
            className="text-ink-2 font-medium px-3 py-2"
          >
            Cancel
          </button>

          <span className="text-sm text-ink-3">
            {selectedIds.size} selected
          </span>

          <button
            type="button"
            onClick={() => setShowMergeConfirm(true)}
            disabled={selectedIds.size !== 2 || merging}
            className="bg-accent text-white font-medium px-4 py-2 rounded-lg disabled:opacity-40 transition-opacity"
          >
            {merging ? "Merging..." : `Merge (${selectedIds.size})`}
          </button>
        </div>
      )}

      {/* Merge confirmation dialog */}
      <ConfirmDialog
        open={showMergeConfirm}
        title="Merge Items"
        message={`Merge Item #${mergeInfo.sourceNum} into Item #${mergeInfo.targetNum}? All fields and media will be combined into Item #${mergeInfo.targetNum}.`}
        confirmLabel="Merge"
        cancelLabel="Cancel"
        onConfirm={handleMerge}
        onCancel={() => setShowMergeConfirm(false)}
      />
    </div>
  );
}
