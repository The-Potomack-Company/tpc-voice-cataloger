import { useState, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { ItemCard } from "./ItemCard";
import { createBlankItem } from "../db/items";

interface ItemListProps {
  sessionId: number;
  mode: "house" | "sale";
}

export function ItemList({ sessionId, mode }: ItemListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

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
    setExpandedIds((prev) => new Set(prev).add(newId));
  }, [sessionId, mode]);

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
        <ItemCard
          key={item.id}
          item={item}
          mode={mode}
          isExpanded={expandedIds.has(item.id!)}
          onToggle={() => toggleExpand(item.id!)}
        />
      ))}
    </div>
  );
}
