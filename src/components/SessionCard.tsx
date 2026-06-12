import { useState, useRef, useEffect, useCallback } from "react";
import { useUIStore } from "../stores/uiStore";
import { useLongPress } from "../hooks/useLongPress";
import { SwipeableRow } from "./SwipeableRow";
import { Badge } from "../ui/Badge";
import { OverflowMenu } from "../ui/OverflowMenu";
import type { Tables } from "../db/database.types";

type SupabaseSession = Tables<"sessions">;

interface SessionCardProps {
  session: SupabaseSession;
  itemCount: number;
  onTap: () => void;
  /**
   * WR-06/D-04: invoked by both the swipe-delete gesture AND the ⋯ overflow
   * menu's Delete item. The ⋯ menu does NOT confirm internally — this handler
   * MUST perform its own confirmation (e.g. Sessions.tsx routes it through the
   * shared ConfirmDialog). Never wire a raw deleteSession here.
   */
  onDelete: () => void;
  onRename: (newName: string) => void;
  sessionStatus?: string;
}

const statusColors: Record<string, string> = {
  active: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  submitted:
    "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
  returned:
    "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
  exported:
    "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
};

const statusLabels: Record<string, string> = {
  active: "Active",
  submitted: "Submitted",
  returned: "Returned",
  exported: "Exported",
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay} days ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function SessionCard({
  session,
  itemCount,
  onTap,
  onDelete,
  onRename,
  sessionStatus,
}: SessionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(session.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const recordingSessionId = useUIStore((s) => s.recordingSessionId);
  const isInterrupted = recordingSessionId === session.id;

  const startEditing = useCallback(() => {
    setEditName(session.name);
    setIsEditing(true);
  }, [session.name]);

  const longPressHandlers = useLongPress({ onLongPress: startEditing });

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const saveName = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== session.name) {
      onRename(trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveName();
    } else if (e.key === "Escape") {
      setIsEditing(false);
    }
  };

  const handleCardClick = () => {
    if (!isEditing) {
      onTap();
    }
  };

  const modeLabel = "Sale";

  return (
    <SwipeableRow onDelete={onDelete}>
      <div
        onClick={handleCardClick}
        {...(isEditing ? {} : longPressHandlers)}
        className="bg-bg-2 rounded-xl p-4 min-h-[72px]
                   border border-rule cursor-pointer
                   active:bg-bg-2 select-none"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={saveName}
                onKeyDown={handleKeyDown}
                className="w-full px-2 py-1 -ml-2 rounded bg-bg-2
                           text-ink font-semibold
                           focus:outline-none focus:ring-2 focus:ring-accent"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <h3 className="font-semibold text-ink truncate">
                {session.name}
              </h3>
            )}

            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge>{modeLabel}</Badge>
              <span className="text-xs text-ink-3">
                {itemCount} item{itemCount !== 1 ? "s" : ""}
              </span>
              {sessionStatus && statusColors[sessionStatus] && (
                <span
                  className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[sessionStatus]}`}
                >
                  {statusLabels[sessionStatus] ?? sessionStatus}
                </span>
              )}
              {!sessionStatus && session.status !== 'active' && statusColors[session.status] && (
                <span
                  className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[session.status]}`}
                >
                  {statusLabels[session.status] ?? session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                </span>
              )}
              {isInterrupted && (
                <Badge tone="warn" dot>
                  Recording interrupted
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-ink-3 whitespace-nowrap mt-1">
              {formatRelativeTime(session.updated_at)}
            </span>
            {/* Accessible-equivalent of swipe-to-delete (D-03/D-04). */}
            <OverflowMenu
              actions={[{ label: "Delete", destructive: true, onSelect: onDelete }]}
            />
          </div>
        </div>
      </div>
    </SwipeableRow>
  );
}
