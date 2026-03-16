import { useState, useCallback, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { ItemCard } from "./ItemCard";
import { createBlankItem } from "../db/items";

interface ItemListProps {
  sessionId: number;
  mode: "house" | "sale";
  onAddItemRef?: React.MutableRefObject<(() => Promise<void>) | null>;
}

export function ItemList({ sessionId, mode, onAddItemRef }: ItemListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [newItemId, setNewItemId] = useState<number | null>(null);

  const items = useLiveQuery(
    () => {
      if (mode === "house") {
        return db.houseVisitItems
          .where("sessionId")
          .equals(sessionId)
          .sortBy("sortOrder");
      }
      return db.saleItems
        .where("sessionId")
        .equals(sessionId)
        .sortBy("sortOrder");
    },
    [sessionId, mode],
    [],
  );

  const toggleExpand = useCallback((itemId: number) => {
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

      {items.map((item) => (
        <div key={item.id} data-item-id={item.id}>
          <ItemCard
            item={item}
            mode={mode}
            isExpanded={expandedIds.has(item.id!)}
            onToggle={() => toggleExpand(item.id!)}
          />
        </div>
      ))}
    </div>
  );
}
