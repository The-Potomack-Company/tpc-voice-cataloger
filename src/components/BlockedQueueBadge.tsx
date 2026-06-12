/**
 * BlockedQueueBadge (REL-3 / D-10).
 *
 * Surfaces the count of blocked items (items.ai_status='failed') as a
 * tone="err" Badge in the AppLayout header next to OfflineIndicator. A
 * permanent write-ahead failure now drops + continues the drain (D-09), so
 * blocked work no longer strands silently — this badge is the user-facing
 * signal. Renders nothing when the count is 0 (mirrors OfflineIndicator).
 * Clicking the badge toggles a detail list of the blocked item ids.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { supabase } from "../lib/supabase";
import { Badge } from "../ui/Badge";
import { useDrainSignalStore } from "../stores/drainSignalStore";

interface BlockedItem {
  id: string;
  mode: string;
  session_id: string;
  title: string | null;
  receipt_number: string | null;
}

async function fetchBlockedItems(): Promise<BlockedItem[]> {
  // Mirror getQueuedItems' query shape (offlineQueue.ts) but filter ai_status='failed'.
  const { data, error } = await supabase
    .from("items")
    .select("id, mode, session_id, title, receipt_number")
    .eq("ai_status", "failed");

  if (error || !data) return [];
  return data as BlockedItem[];
}

// Fallback chain (mirror ItemCard.tsx:127 idiom): title → #receipt → short id slice.
// Never the bare UUID (Pitfall 3).
function blockedItemLabel(item: BlockedItem): string {
  if (item.title) return item.title;
  if (item.receipt_number) return `#${item.receipt_number}`;
  return item.id.slice(0, 8);
}

export function BlockedQueueBadge() {
  const [items, setItems] = useState<BlockedItem[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const refresh = useCallback(() => {
    fetchBlockedItems()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  // WR-04: re-fetch whenever a drain finishes — items flip to 'failed' mid-session
  // while already online (no DOM 'online' event), so refreshing only on mount +
  // 'online' left the badge stale until a reconnect/reload.
  const drainTick = useDrainSignalStore((s) => s.drainTick);

  useEffect(() => {
    refresh();
    // Re-read on reconnect — a drain may flip items to/from 'failed'.
    const onOnline = () => refresh();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [refresh, drainTick]);

  const count = items.length;

  // Mirror OfflineIndicator: render nothing when there is nothing to show. The
  // detail panel is gated on count>0 below, so a stale open=true after a drain
  // can never leak a panel — no render-phase / effect setState needed.
  if (count === 0) return null;

  return (
    <div className="relative flex items-center justify-center py-1" role="status" aria-live="polite">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`${count} blocked ${count === 1 ? "item" : "items"} — show details`}
        className="appearance-none bg-transparent border-0 p-0 cursor-pointer"
      >
        <Badge tone="err" data-testid="blocked-queue-badge">
          {count}
        </Badge>
      </button>
      {open && (
        <ul
          data-testid="blocked-queue-detail"
          className="absolute top-full z-10 mt-1 max-h-60 w-56 overflow-y-auto rounded-md border border-red-300 bg-bg p-2 text-sm shadow-lg dark:border-red-800"
        >
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate(`/session/${item.session_id}/item/${item.id}`);
                }}
                className="flex w-full items-center justify-between gap-2 py-0.5 text-left"
              >
                <span className="truncate">{blockedItemLabel(item)}</span>
                <span className="shrink-0 text-xs opacity-70">
                  Sale
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
