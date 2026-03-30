import { useState, useCallback, useEffect } from "react";
import { useSessionItems } from "../hooks/useSessions";
import { db } from "../db";
import { ItemCard } from "./ItemCard";
import { createBlankItem } from "../db/items";
import { processAudioWithAi } from "../services/gemini";

interface ItemListProps {
  sessionId: string;
  mode: "house" | "sale";
  onAddItemRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  readOnly?: boolean;
}

export function ItemList({ sessionId, mode, onAddItemRef, readOnly }: ItemListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [newItemId, setNewItemId] = useState<string | null>(null);

  const items = useSessionItems(sessionId);

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
          const audios = await db.audio.where("itemId").equals(item.id).toArray();
          if (audios.length === 0) return;
          const latestAudioId = audios.reduce((max, a) => (a.id! > max ? a.id! : max), audios[0].id!);
          return processAudioWithAi(latestAudioId, item.id, sessionId);
        }),
      );
    } catch (err) {
      console.error("Retry all failed:", err);
    } finally {
      setRetryingAll(false);
    }
  }, [retryingAll, stuckItems, sessionId]);

  if (items.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 text-center">
        <p className="text-gray-400 dark:text-gray-500 text-sm">
          No items yet. Tap "Add Item" to start cataloging.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {/* Add Item button at top */}
      {!readOnly && (
        <button
          type="button"
          onClick={handleAddItem}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                     border border-dashed border-gray-300 dark:border-gray-600
                     text-sm text-gray-600 dark:text-gray-400 font-medium
                     hover:border-accent hover:text-accent dark:hover:border-accent dark:hover:text-accent
                     transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Item
        </button>
      )}

      {!readOnly && stuckItems.length > 0 && (
        <button
          type="button"
          onClick={handleRetryAll}
          disabled={retryingAll}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                     border border-amber-300 dark:border-amber-700
                     bg-amber-50 dark:bg-amber-900/20
                     text-sm text-amber-700 dark:text-amber-400 font-medium
                     hover:bg-amber-100 dark:hover:bg-amber-900/40
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

      {items.map((item) => (
        <div key={item.id} data-item-id={item.id}>
          <ItemCard
            item={item}
            sessionId={sessionId}
            isExpanded={expandedIds.has(item.id)}
            onToggle={() => toggleExpand(item.id)}
            readOnly={readOnly}
          />
        </div>
      ))}
    </div>
  );
}
