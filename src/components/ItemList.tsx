import { useNavigate } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import type { HouseVisitItem, SaleItem } from "../db/types";

interface ItemListProps {
  sessionId: number;
  mode: "house" | "sale";
}

/** Compact row showing item number + indicator icons */
function ItemRow({
  item,
  mode,
  sessionId,
}: {
  item: HouseVisitItem | SaleItem;
  mode: "house" | "sale";
  sessionId: number;
}) {
  const navigate = useNavigate();

  // Check for audio on this item
  const audioCount = useLiveQuery(
    () => db.audio.where("itemId").equals(item.id!).count(),
    [item.id],
    0,
  );

  // Check for photos (house mode only)
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

  return (
    <button
      type="button"
      onClick={() => navigate(`/session/${sessionId}/item/${item.id}`)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                 hover:border-accent dark:hover:border-accent transition-colors text-left"
    >
      {/* Item number */}
      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 min-w-0 flex-1 truncate">
        Item {item.sortOrder + 1}
        {item.title ? ` — ${item.title}` : ""}
      </span>

      {/* Indicator icons */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Receipt number badge (sale mode) */}
        {receiptNumber && (
          <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">
            {receiptNumber}
          </span>
        )}

        {/* Mic icon if has audio */}
        {audioCount > 0 && (
          <svg
            className="w-4 h-4 text-green-600 dark:text-green-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" />
          </svg>
        )}

        {/* Camera icon with photo count (house mode) */}
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

        {/* Chevron */}
        <svg
          className="w-4 h-4 text-gray-400 dark:text-gray-500"
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
    </button>
  );
}

export function ItemList({ sessionId, mode }: ItemListProps) {
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
      {items.map((item) => (
        <ItemRow
          key={item.id}
          item={item}
          mode={mode}
          sessionId={sessionId}
        />
      ))}
    </div>
  );
}
