/**
 * src/components/SessionTile.tsx
 *
 * Mockup-faithful single session row used inside the Sessions list
 * (SCREEN-01). Matches docs/design-handoff/tpc-voice.jsx — the 40x40
 * Sale accent-wash mode tile, the mono session id eyebrow,
 * the row title, and the "{n} items · {mins} min" meta line.
 *
 * Wraps the existing SwipeableRow to preserve long-press rename and
 * swipe-to-delete behavior from the prior SessionCard.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useUIStore } from "../stores/uiStore";
import { useLongPress } from "../hooks/useLongPress";
import { SwipeableRow } from "./SwipeableRow";
import { Badge } from "../ui/Badge";
import { Icon } from "../ui/icons";
import { OverflowMenu } from "../ui/OverflowMenu";
import type { Tables } from "../db/database.types";

type SupabaseSession = Tables<"sessions">;

interface SessionTileProps {
  session: SupabaseSession;
  itemCount: number;
  /** Optional ordinal suffix (mockup shows TPC23 / HSE-04 style ids). */
  shortId?: string;
  onTap: () => void;
  /**
   * WR-06/D-04: invoked by both the swipe-delete gesture AND the ⋯ overflow
   * menu's Delete item. The ⋯ menu does NOT confirm internally — this handler
   * MUST perform its own confirmation (e.g. Sessions.tsx routes it through the
   * shared ConfirmDialog). Never wire a raw deleteSession here.
   */
  onDelete: () => void;
  onRename: (newName: string) => void;
  /** Show a divider below this tile. The parent list controls this. */
  showDivider?: boolean;
  /** Optional assignee label (admin cross-user view). */
  assigneeName?: string;
  /** Count of items that need human review (failed AI or missing title). */
  reviewCount?: number;
}

function statusBadgeFor(status: string) {
  if (status === "submitted") return { tone: "warn" as const, label: "Submitted" };
  if (status === "returned") return { tone: "warn" as const, label: "Returned" };
  if (status === "exported") return { tone: "ok" as const, label: "Exported" };
  return null;
}

export function SessionTile({
  session,
  itemCount,
  shortId,
  onTap,
  onDelete,
  onRename,
  showDivider = true,
  assigneeName,
  reviewCount,
}: SessionTileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(session.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const recordingSessionId = useUIStore((s) => s.recordingSessionId);

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
  const statusBadge = statusBadgeFor(session.status);
  // Recording in progress when the UI store's current recording session id
  // matches this row AND the session is still in the active state.
  const isCurrentlyRecording =
    recordingSessionId === session.id && session.status === "active";

  return (
    <SwipeableRow onDelete={onDelete}>
      <div
        data-testid="session-tile"
        data-session-id={session.id}
        data-mode={session.mode}
        onClick={handleCardClick}
        {...(isEditing ? {} : longPressHandlers)}
        className={[
          "flex items-center gap-3 px-3.5 py-3 cursor-pointer select-none",
          "bg-bg active:bg-bg-2 transition-colors",
          showDivider ? "border-b border-rule" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* Mode tile */}
        <div
          aria-hidden="true"
          className="tpc-mode-tile tpc-mode-tile-sale"
        >
          S
        </div>

        <div className="flex-1 min-w-0">
          {/* Eyebrow row: mono short-id · mode · status badge */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {shortId && (
              <span
                className="tnum tpc-mono"
                style={{
                  fontSize: 11,
                  color: "var(--accent)",
                  fontWeight: 500,
                }}
              >
                {shortId}
              </span>
            )}
            {shortId && <span style={{ fontSize: 11, color: "var(--ink-4)" }}>·</span>}
            <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{modeLabel}</span>
            {isCurrentlyRecording && (
              <Badge tone="info" dot>
                Recording
              </Badge>
            )}
            {statusBadge && (
              <Badge tone={statusBadge.tone}>{statusBadge.label}</Badge>
            )}
            {reviewCount && reviewCount > 0 ? (
              <Badge tone="warn" dot>
                Needs review · {reviewCount}
              </Badge>
            ) : null}
          </div>

          {/* Title — italic display is reserved for hero; row title is sans */}
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={saveName}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="w-full mt-1 px-2 py-1 -ml-2 rounded bg-bg-2 text-ink font-medium focus:outline-none focus:ring-2 focus:ring-accent"
            />
          ) : (
            <div
              className="mt-0.5 text-ink font-medium truncate"
              style={{ fontSize: 13.5 }}
            >
              {session.name}
            </div>
          )}

          {/* Meta line — items + assignee (mono, tnum) */}
          <div
            className="tnum tpc-mono mt-0.5"
            style={{
              fontSize: 11,
              color: "var(--ink-3)",
            }}
          >
            {itemCount} item{itemCount === 1 ? "" : "s"}
            {assigneeName && <span>{` · ${assigneeName}`}</span>}
          </div>
        </div>

        {/* Accessible-equivalent of swipe-to-delete (D-03/D-04): routes
            through the same onDelete the parent already confirms. */}
        <OverflowMenu
          actions={[{ label: "Delete", destructive: true, onSelect: onDelete }]}
        />

        <Icon name="chev" size={14} style={{ color: "var(--ink-4)" }} aria-hidden />
      </div>
    </SwipeableRow>
  );
}
