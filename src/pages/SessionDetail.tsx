import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useSession, useSessionItemCount } from "../hooks/useSessions";
import { updateSession, softDeleteSession, archiveSession, unarchiveSession } from "../db/sessions";
import { createBlankItem } from "../db/items";
import { db } from "../db";
import { exportSession } from "../utils/export";
import { useUIStore } from "../stores/uiStore";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ItemList } from "../components/ItemList";
import { ExportHistoryList } from "../components/ExportHistoryList";
import { RecordingIndicator } from "../components/RecordingIndicator";
import { RecordingToast } from "../components/RecordingToast";

function formatRelativeTime(date: Date): string {
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

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SessionDetailPage() {
  const { sessionId: sessionIdParam } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const sessionId = Number(sessionIdParam);
  const session = useSession(sessionId);
  const itemCount = useSessionItemCount(sessionId);

  const queuedCount = useLiveQuery(async () => {
    if (!session) return 0;
    const table = session.mode === "house" ? db.houseVisitItems : db.saleItems;
    return table.where({ sessionId, aiStatus: "queued" }).count();
  }, [sessionId, session?.mode], 0);

  const recordingSessionId = useUIStore((s) => s.recordingSessionId);
  const setRecordingSession = useUIStore((s) => s.setRecordingSession);
  const isInterrupted = recordingSessionId === sessionId;

  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [editNotes, setEditNotes] = useState<string | null>(null);
  const [showDismissedBanner, setShowDismissedBanner] = useState(false);

  const addItemRef = useRef<(() => Promise<void>) | null>(null);

  const [exporting, setExporting] = useState(false);

  const [confirmAction, setConfirmAction] = useState<
    "complete" | "reopen" | "delete" | "export" | null
  >(null);

  const [showArchivePrompt, setShowArchivePrompt] = useState(false);

  const [importToast, setImportToast] = useState<string | null>(null);

  // Check for import toast from sessionStorage on mount
  useEffect(() => {
    const msg = sessionStorage.getItem("importToast");
    if (msg) {
      setImportToast(msg);
      sessionStorage.removeItem("importToast");
    }
  }, []);

  // Auto-dismiss import toast after 3 seconds
  useEffect(() => {
    if (!importToast) return;
    const timer = setTimeout(() => setImportToast(null), 3000);
    return () => clearTimeout(timer);
  }, [importToast]);

  // Focus name input when editing starts
  useEffect(() => {
    if (isEditingName) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [isEditingName]);

  if (session === undefined) {
    return (
      <div className="portrait:px-4 landscape:px-8 landscape:max-w-3xl landscape:mx-auto py-6">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1 text-accent min-h-12 mb-4"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
        <p className="text-gray-500 dark:text-gray-400">Session not found.</p>
      </div>
    );
  }

  const isArchived = !!session.archivedAt;
  const isCompleted = session.status === "completed";
  const isReadOnly = isCompleted || isArchived;
  const modeLabel = session.mode === "house" ? "House Visit" : "Sale Cataloging";

  const startEditingName = () => {
    if (isReadOnly) return;
    setEditName(session.name);
    setIsEditingName(true);
  };

  const saveNameEdit = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== session.name) {
      updateSession(sessionId, { name: trimmed });
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveNameEdit();
    } else if (e.key === "Escape") {
      setIsEditingName(false);
    }
  };

  const handleNotesSave = () => {
    if (editNotes !== null && editNotes !== session.notes) {
      updateSession(sessionId, { notes: editNotes });
    }
    setEditNotes(null);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportSession(sessionId);
      // After successful export, offer to archive
      setShowArchivePrompt(true);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  const handleExportClick = () => {
    if (session.status === "active" && !isArchived) {
      setConfirmAction("export");
    } else {
      handleExport();
    }
  };

  const handleArchive = async () => {
    await archiveSession(sessionId);
    setShowArchivePrompt(false);
    navigate("/");
  };

  const handleUnarchive = async () => {
    await unarchiveSession(sessionId);
    // Session data refreshes via useLiveQuery -- no manual refresh needed
  };

  const handleConfirm = async () => {
    if (confirmAction === "complete") {
      await updateSession(sessionId, { status: "completed" });
    } else if (confirmAction === "reopen") {
      await updateSession(sessionId, { status: "active" });
    } else if (confirmAction === "delete") {
      await softDeleteSession(sessionId);
      navigate("/");
    } else if (confirmAction === "export") {
      await handleExport();
    }
    setConfirmAction(null);
  };

  const handleAddItem = async () => {
    if (addItemRef.current) {
      await addItemRef.current();
    } else {
      await createBlankItem(sessionId, session.mode);
    }
  };

  return (
    <div className="portrait:px-4 landscape:px-8 landscape:max-w-3xl landscape:mx-auto py-6 pb-24">
      {/* Sticky header with back button */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/")}
          className="flex items-center justify-center w-10 h-10 -ml-2 rounded-lg
                     text-accent hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Back to sessions"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          {isEditingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={saveNameEdit}
              onKeyDown={handleNameKeyDown}
              className="w-full text-2xl font-bold px-2 py-1 -ml-2 rounded-lg
                         bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100
                         focus:outline-none focus:ring-2 focus:ring-accent"
            />
          ) : isReadOnly ? (
            <h1
              className="text-2xl font-bold text-gray-900 dark:text-gray-100 truncate"
            >
              {session.name}
            </h1>
          ) : (
            <h1
              onClick={startEditingName}
              className="text-2xl font-bold text-gray-900 dark:text-gray-100 truncate cursor-pointer
                         hover:text-accent dark:hover:text-accent transition-colors"
              title="Tap to edit name"
            >
              {session.name}
            </h1>
          )}
        </div>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full
                         bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
          {modeLabel}
        </span>
        <span
          className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${
            session.status === "active"
              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
              : "bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300"
          }`}
        >
          {session.status === "active" ? "Active" : "Completed"}
        </span>
        {isArchived && (
          <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full
                           bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
            Archived
          </span>
        )}
      </div>

      {/* Archived read-only banner */}
      {isArchived && (
        <div className="mb-6 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-2 text-sm text-amber-700 dark:text-amber-300">
          This session is archived and read-only.{" "}
          <button
            type="button"
            onClick={handleUnarchive}
            className="underline font-medium hover:text-amber-900 dark:hover:text-amber-100"
          >
            Un-archive to edit.
          </button>
        </div>
      )}

      {/* Interrupted recording banner */}
      {isInterrupted && !showDismissedBanner && (
        <div className="mb-6 flex items-start gap-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
          <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              A recording may have been interrupted.
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
              Check your items for missing audio.
            </p>
          </div>
          <button
            onClick={() => {
              setRecordingSession(null);
              setShowDismissedBanner(true);
            }}
            className="shrink-0 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200"
            aria-label="Dismiss"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Metadata section */}
      <section className="mb-6">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">Items</span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {itemCount}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">Created</span>
            <span className="text-sm text-gray-900 dark:text-gray-100">
              {formatDate(session.createdAt)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">Last updated</span>
            <span className="text-sm text-gray-900 dark:text-gray-100">
              {formatRelativeTime(session.updatedAt)}
            </span>
          </div>
        </div>
      </section>

      {/* Notes section */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
          Notes
        </h2>
        {isReadOnly ? (
          <div className="w-full rounded-lg border border-gray-200 dark:border-gray-700
                          bg-gray-50 dark:bg-gray-800 p-3 text-sm
                          text-gray-900 dark:text-gray-100 min-h-[4.5rem]">
            {session.notes || <span className="text-gray-400 dark:text-gray-500">No notes</span>}
          </div>
        ) : (
          <textarea
            value={editNotes !== null ? editNotes : session.notes}
            onChange={(e) => setEditNotes(e.target.value)}
            onBlur={handleNotesSave}
            placeholder="Add notes..."
            rows={3}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700
                       bg-gray-50 dark:bg-gray-800 p-3 text-sm
                       text-gray-900 dark:text-gray-100
                       placeholder:text-gray-400 dark:placeholder:text-gray-500
                       focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent
                       resize-none"
          />
        )}
      </section>

      {/* Item list section */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
          Items ({itemCount})
        </h2>
        <ItemList sessionId={sessionId} mode={session.mode} onAddItemRef={addItemRef} readOnly={isReadOnly} />
      </section>

      {/* Export History */}
      <ExportHistoryList sessionId={sessionId} />

      {/* Action buttons */}
      <section className="space-y-3">
        {/* Export button */}
        <button
          onClick={handleExportClick}
          disabled={exporting || queuedCount > 0}
          className="w-full min-h-12 rounded-lg border border-accent text-accent font-medium
                     hover:bg-accent/10 transition-colors flex items-center justify-center gap-2
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : queuedCount > 0 ? null : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          )}
          {queuedCount > 0
            ? `${queuedCount} item${queuedCount === 1 ? "" : "s"} still queued`
            : exporting ? "Exporting..." : "Export Session"}
        </button>

        {isArchived ? (
          <button
            onClick={handleUnarchive}
            className="w-full min-h-12 rounded-lg bg-amber-600 text-white font-medium
                       hover:bg-amber-700 transition-colors"
          >
            Un-archive Session
          </button>
        ) : session.status === "active" ? (
          <button
            onClick={() => setConfirmAction("complete")}
            className="w-full min-h-12 rounded-lg bg-green-600 text-white font-medium
                       hover:bg-green-700 transition-colors"
          >
            Mark Complete
          </button>
        ) : (
          <button
            onClick={() => setConfirmAction("reopen")}
            className="w-full min-h-12 rounded-lg bg-accent text-white font-medium
                       hover:opacity-90 transition-opacity"
          >
            Reopen Session
          </button>
        )}

        {!isArchived && (
          <button
            onClick={() => setConfirmAction("delete")}
            className="w-full min-h-12 rounded-lg border border-red-300 dark:border-red-700
                       text-red-600 dark:text-red-400 font-medium
                       hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            Delete Session
          </button>
        )}
      </section>

      {/* Confirmation dialogs */}
      <ConfirmDialog
        open={confirmAction === "complete"}
        title="Mark Complete"
        message="Mark this session as complete? You can reopen it later if needed."
        confirmLabel="Mark Complete"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmDialog
        open={confirmAction === "reopen"}
        title="Reopen Session"
        message="This session was marked complete. Reopen it?"
        confirmLabel="Reopen"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmDialog
        open={confirmAction === "delete"}
        title="Delete Session"
        message="Delete this session? You can recover it from Settings."
        confirmLabel="Delete"
        destructive
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmDialog
        open={confirmAction === "export"}
        title="Export Active Session"
        message="This session is still active. Items may be incomplete. Export anyway?"
        confirmLabel="Export Anyway"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />

      {/* Archive prompt after export */}
      <ConfirmDialog
        open={showArchivePrompt}
        title="Archive this session?"
        message="Archived sessions are hidden from the main list. You can un-archive anytime from the Sessions page."
        confirmLabel="Archive"
        cancelLabel="Not Now"
        onConfirm={handleArchive}
        onCancel={() => setShowArchivePrompt(false)}
      />

      {/* Floating Add Item button */}
      {!isReadOnly && (
        <div className="fixed bottom-20 left-0 right-0 px-4 landscape:max-w-3xl landscape:mx-auto z-30">
          <button
            onClick={handleAddItem}
            className="w-full bg-accent hover:bg-accent-hover text-white font-medium
                       py-3 px-6 rounded-lg min-h-12 flex items-center justify-center gap-2
                       shadow-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {itemCount === 0 ? "Start Cataloging" : "Add Item"}
          </button>
        </div>
      )}

      {/* Import toast feedback */}
      {importToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-gray-800 dark:bg-gray-700 text-white px-4 py-3 rounded-xl shadow-lg animate-[slideUp_0.3s_ease-out]">
          <span className="text-sm">{importToast}</span>
        </div>
      )}

      {/* Recording overlays for re-record from ItemList mic icons */}
      <RecordingIndicator />
      <RecordingToast />
    </div>
  );
}
