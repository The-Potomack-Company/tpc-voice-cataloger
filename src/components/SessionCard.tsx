import { useState, useRef, useEffect, useCallback } from "react";
import { useUIStore } from "../stores/uiStore";
import { useLongPress } from "../hooks/useLongPress";
import { SwipeableRow } from "./SwipeableRow";
import type { Tables } from "../db/database.types";

type SupabaseSession = Tables<"sessions">;

interface SessionCardProps {
  session: SupabaseSession;
  itemCount: number;
  onTap: () => void;
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

  const modeLabel = session.mode === "house" ? "House Visit" : "Sale";

  return (
    <SwipeableRow onDelete={onDelete}>
      <div
        onClick={handleCardClick}
        {...(isEditing ? {} : longPressHandlers)}
        className="bg-white dark:bg-gray-800 rounded-xl p-4 min-h-[72px]
                   border border-gray-200 dark:border-gray-700 cursor-pointer
                   active:bg-gray-50 dark:active:bg-gray-750 select-none"
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
                className="w-full px-2 py-1 -ml-2 rounded bg-gray-100 dark:bg-gray-700
                           text-gray-900 dark:text-gray-100 font-semibold
                           focus:outline-none focus:ring-2 focus:ring-accent"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                {session.name}
              </h3>
            )}

            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                {modeLabel}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
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
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Recording interrupted
                </span>
              )}
            </div>
          </div>

          <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap shrink-0 mt-1">
            {formatRelativeTime(session.updated_at)}
          </span>
        </div>
      </div>
    </SwipeableRow>
  );
}
