import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { useSession, useSessionItemCount, useSessionItems } from "../hooks/useSessions";
import { useNotePageCount } from "../hooks/useNotePages";
import { useSessionStore } from "../stores/sessionStore";
import { useUserRole } from "../hooks/useUserRole";
import { listAccounts, type Account } from "../services/adminApi";
import { createBlankItem } from "../db/items";
import { exportSession, exportSessionAsSpreadsheet } from "../utils/export";
import { useNotificationStore } from "../stores/notificationStore";
import { trackUiInteraction } from "../services/analytics";
import { useUIStore } from "../stores/uiStore";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ReturnDialog } from "../components/ReturnDialog";
import { ItemList } from "../components/ItemList";
import { ContinuousModeControlBar } from "../components/ContinuousModeControlBar";
import { ContinuousModeFAB } from "../components/ContinuousModeFAB";
import { ContinuousModePanel } from "../components/ContinuousModePanel";
import { ExportHistoryList } from "../components/ExportHistoryList";
import { RecordingIndicator } from "../components/RecordingIndicator";
import { RecordingToast } from "../components/RecordingToast";
import { useContinuousRecorder } from "../hooks/useContinuousRecorder";
import { useContinuousModeStore } from "../stores/continuousModeStore";
import { Eyebrow } from "../ui/Eyebrow";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Icon } from "../ui/icons";
import { StatStrip } from "../ui/StatStrip";
import { WarnBanner } from "../ui/WarnBanner";
import { sessionShortId } from "../utils/groupByDate";
import { isNeedsReview } from "../utils/itemStatus";
import { featureFlags } from "../lib/featureFlags";

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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
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
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const session = useSession(sessionId!);
  const itemCount = useSessionItemCount(sessionId!);
  const fetchItems = useSessionStore(s => s.fetchItems);
  const storeUpdateSession = useSessionStore(s => s.updateSession);

  // Fetch items for this session on mount
  useEffect(() => {
    if (sessionId) {
      fetchItems(sessionId);
    }
  }, [sessionId, fetchItems]);

  // Get queued count from Zustand store
  const items = useSessionItems(sessionId!);
  const queuedCount = items.filter(i => i.ai_status === "queued").length;
  const photoNotesEnabled = featureFlags.photoNotes;
  const notePageCount = useNotePageCount(photoNotesEnabled ? sessionId : undefined);

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
  const [exportingXlsx, setExportingXlsx] = useState(false);

  const [confirmAction, setConfirmAction] = useState<
    "submit" | "delete" | "export" | "reopen" | null
  >(null);

  const [showReturnDialog, setShowReturnDialog] = useState(false);

  const [importToast, setImportToast] = useState<string | null>(null);
  const continuousCaptureEnabled = featureFlags.continuousCapture;
  const continuousActive = useContinuousModeStore(
    (s) => continuousCaptureEnabled && (s.active || s.finalizing) && s.sessionId === sessionId,
  );
  const continuousFinalizing = useContinuousModeStore(
    (s) => continuousCaptureEnabled && s.finalizing && s.sessionId === sessionId,
  );
  const advanceContinuousItem = useContinuousModeStore((s) => s.advanceItem);
  const continuousRecorder = useContinuousRecorder();
  const continuousPaused = continuousRecorder.status === "paused";

  // Admin reassignment state
  const { isAdmin, loading: roleLoading } = useUserRole();
  const isSpecialist = !isAdmin && !roleLoading;
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [editingAssignee, setEditingAssignee] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);

  // Fetch accounts when admin
  useEffect(() => {
    if (!isAdmin) return;
    listAccounts()
      .then((data) => {
        setAccounts(
          data
            .filter((a) => a.is_active)
            .sort((a, b) => a.display_name.localeCompare(b.display_name)),
        );
      })
      .catch(() => {
        // IN-03: don't fail silently — the assignee dropdown would render empty
        // with no explanation. Surface it like NewSession's accountsError so the
        // admin knows the team list didn't load (phase goal, Codex #16-20).
        useNotificationStore
          .getState()
          .notifyError(
            "Could not load team members. Check your connection and try again.",
          );
      });
  }, [isAdmin]);

  // Auto-clear reassign error after 5 seconds
  useEffect(() => {
    if (!reassignError) return;
    const timer = setTimeout(() => setReassignError(null), 5000);
    return () => clearTimeout(timer);
  }, [reassignError]);

  const handleReassign = async (newAssigneeId: string) => {
    if (!session || newAssigneeId === session.assigned_to) {
      setEditingAssignee(false);
      return;
    }
    try {
      await storeUpdateSession(session.id, {
        assigned_to: newAssigneeId,
        updated_at: new Date().toISOString(),
      });
      setEditingAssignee(false);
      setReassignError(null);
    } catch {
      setReassignError("Reassignment failed. Please try again.");
      setEditingAssignee(false);
    }
  };

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
        <p className="text-ink-3">Session not found.</p>
      </div>
    );
  }

  // Specialist on submitted/exported session = locked. Admin is NEVER locked.
  const isLifecycleLocked = isSpecialist && session.status === 'submitted';
  const isReadOnly = isLifecycleLocked || (isSpecialist && session.status === 'exported');
  const modeLabel = "Sale Cataloging";

  const startEditingName = () => {
    if (isReadOnly) return;
    setEditName(session.name);
    setIsEditingName(true);
  };

  const saveNameEdit = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== session.name) {
      storeUpdateSession(session.id, { name: trimmed });
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
      storeUpdateSession(session.id, { notes: editNotes });
    }
    setEditNotes(null);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportSession(sessionId!);
      await storeUpdateSession(session.id, { status: 'exported' });
    } catch {
      // D-08: sticky retry toast (retry attached ⇒ won't auto-dismiss). Fixed
      // UI-SPEC copy keeps raw backend text out of the UI (T-36-04).
      useNotificationStore
        .getState()
        .notifyError("Export failed — your data wasn't downloaded.", () =>
          handleExport(),
        );
    } finally {
      setExporting(false);
    }
  };

  const handleExportClick = () => {
    trackUiInteraction({
      interaction_type: "click",
      element_id: "btn.session-export-json",
      session_id: sessionId,
    });
    setConfirmAction('export');
  };

  const handleExportSpreadsheet = async () => {
    trackUiInteraction({
      interaction_type: "click",
      element_id: "btn.session-export-excel",
      session_id: sessionId,
    });
    setExportingXlsx(true);
    try {
      await exportSessionAsSpreadsheet(sessionId!);
    } catch {
      // D-08: same sticky-retry surfacing as the JSON export path.
      useNotificationStore
        .getState()
        .notifyError("Export failed — your data wasn't downloaded.", () =>
          handleExportSpreadsheet(),
        );
    } finally {
      setExportingXlsx(false);
    }
  };

  const handleConfirm = async () => {
    if (confirmAction === "submit") {
      trackUiInteraction({
        interaction_type: "submit",
        element_id: "btn.session-submit",
        session_id: sessionId,
      });
      await storeUpdateSession(session.id, { status: 'submitted', review_notes: null });
    } else if (confirmAction === "export") {
      await handleExport();
    } else if (confirmAction === "reopen") {
      trackUiInteraction({
        interaction_type: "click",
        element_id: "btn.session-reopen",
        session_id: sessionId,
      });
      await storeUpdateSession(session.id, { status: 'active' });
    } else if (confirmAction === "delete") {
      const success = await useSessionStore.getState().deleteSession(session.id);
      if (success) {
        navigate("/");
        return;
      }
    }
    setConfirmAction(null);
  };

  const handleReturn = async (notes: string) => {
    await storeUpdateSession(session.id, {
      status: 'returned',
      review_notes: notes || null,
    });
    setShowReturnDialog(false);
  };

  const handleAddItem = async () => {
    if (addItemRef.current) {
      await addItemRef.current();
    } else {
      await createBlankItem(sessionId!, session.mode as "house" | "sale");
    }
  };

  const handleStartContinuous = async () => {
    if (!continuousCaptureEnabled) return;
    await continuousRecorder.start(sessionId!, session.mode as "house" | "sale");
  };

  const handleStopContinuous = async () => {
    if (!continuousCaptureEnabled) return;
    await continuousRecorder.stop();
  };

  const handleContinuousNewItem = () => {
    if (!continuousCaptureEnabled) return;
    void advanceContinuousItem(null);
  };

  const shortId = sessionShortId(session);

  // Three-stat strip: AI-cataloged / Needs review / Total
  const transcribedCount = items.filter((i) => i.ai_status === "done").length;
  const failedCount = items.filter(isNeedsReview).length;
  const statusBadgeTone =
    session.status === "submitted"
      ? "warn"
      : session.status === "returned"
        ? "warn"
        : session.status === "exported"
          ? "ok"
          : "info";
  const statusBadgeLabel =
    session.status === "submitted"
      ? "Submitted"
      : session.status === "returned"
        ? "Returned"
        : session.status === "exported"
          ? "Exported"
          : session.status === "active"
            ? "Active"
            : session.status;

  return (
    <div className={`relative portrait:px-4 landscape:px-8 landscape:max-w-3xl landscape:mx-auto ${
      continuousActive ? "pb-32" : isReadOnly ? "pb-24" : "pb-60"
    }`}>
      {/* Sticky header — eyebrow ("Review · TPCXX") + italic display ("N items · M min") + Sync action */}
      <div className="tpc-sticky-header py-3 -mx-4 portrait:px-4 landscape:px-8 mb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="tpc-btn tpc-btn-ghost"
            style={{ padding: 6 }}
            aria-label="Back to sessions"
          >
            <Icon name="back" size={16} aria-hidden />
          </button>

          <div className="flex-1 min-w-0">
            <Eyebrow>
              Review · {shortId}
            </Eyebrow>
            {isEditingName ? (
              <input
                ref={nameInputRef}
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={saveNameEdit}
                onKeyDown={handleNameKeyDown}
                className="w-full mt-1 px-2 py-1 -ml-2 rounded bg-bg-2 text-ink tpc-display tpc-display-4 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            ) : (
              <h1
                onClick={isReadOnly ? undefined : startEditingName}
                title={isReadOnly ? undefined : "Tap to edit name"}
                className={
                  "tpc-display tpc-display-4 truncate text-ink mt-0.5" +
                  (isReadOnly ? "" : " cursor-pointer hover:text-accent transition-colors")
                }
              >
                {session.name}
              </h1>
            )}
          </div>

          {/* Finalize action — admin export trigger from the header (mockup behavior). */}
          {isAdmin && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleExportClick}
              disabled={exporting || queuedCount > 0}
              icon={<Icon name="upload" size={14} aria-hidden />}
              aria-label="Finalize and export session"
              title="Export session JSON and mark as exported"
            >
              Finalize
            </Button>
          )}
        </div>

        {/* Mode + status badges, mono assigned-to */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Badge>{modeLabel}</Badge>
          <Badge tone={statusBadgeTone}>{statusBadgeLabel}</Badge>
          <span
            className="tnum tpc-mono"
            style={{
              fontSize: 11,
              color: "var(--ink-3)",
            }}
          >
            {itemCount} item{itemCount === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* Three-stat strip with mini bars (mockup SCREEN-03) */}
      {itemCount > 0 && (
        <section className="mb-6">
          <StatStrip
            stats={[
              {
                label: "Transcribed",
                value: transcribedCount,
                total: itemCount,
                tone: "accent",
              },
              {
                label: "Processed",
                value: items.filter((i) => i.title).length,
                total: itemCount,
                tone: "accent",
              },
              {
                label: "Needs review",
                value: failedCount,
                total: itemCount,
                tone: "warn",
              },
            ]}
          />
        </section>
      )}

      {/* Lifecycle action stack — admin Sync lives in the sticky header (mockup).
          Remaining actions: specialist Submit, admin Spreadsheet export, Return, Reopen. */}
      {!roleLoading && (
        <div className="flex flex-col gap-2 mb-6">
          {/* Photo notes -- capture handwritten note pages for this session (Phase 46).
              Same mutate gate as the Add-Item FAB; both modes. */}
          {photoNotesEnabled && !isReadOnly && !continuousActive && (
            <Button
              variant="secondary"
              fullWidth
              onClick={() => navigate(`/session/${sessionId}/photo-notes`)}
              icon={<Icon name="image" size={14} aria-hidden />}
            >
              Photo notes
              {notePageCount > 0 && (
                <Badge className="ml-2" aria-label={`${notePageCount} pages captured`}>
                  {notePageCount}
                </Badge>
              )}
            </Button>
          )}

          {/* Submit for Review -- specialist only, active or returned sessions */}
          {isSpecialist && (session.status === 'active' || session.status === 'returned') && (
            <Button
              variant="primary"
              fullWidth
              onClick={() => {
                if (queuedCount > 0) return;
                setConfirmAction('submit');
              }}
              disabled={queuedCount > 0}
            >
              {queuedCount > 0
                ? `${queuedCount} items still processing`
                : 'Submit for Review'}
            </Button>
          )}

          {/* Export Spreadsheet button -- admin only, no confirmation needed */}
          {isAdmin && (
            <Button
              variant="secondary"
              fullWidth
              onClick={handleExportSpreadsheet}
              disabled={exportingXlsx || queuedCount > 0}
              icon={<Icon name="download" size={14} aria-hidden />}
            >
              {queuedCount > 0
                ? `${queuedCount} item${queuedCount === 1 ? '' : 's'} still queued`
                : exportingXlsx
                  ? 'Exporting…'
                  : 'Export Spreadsheet'}
            </Button>
          )}

          {/* Return to Specialist -- admin only, submitted sessions */}
          {isAdmin && session.status === 'submitted' && (
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setShowReturnDialog(true)}
            >
              Return to Specialist
            </Button>
          )}

          {/* Reopen Session -- admin only, exported sessions */}
          {isAdmin && session.status === 'exported' && (
            <Button
              variant="ghost"
              fullWidth
              onClick={() => setConfirmAction('reopen')}
            >
              Reopen Session
            </Button>
          )}
        </div>
      )}

      {/* Submitted status banner -- specialist only */}
      {session.status === 'submitted' && isSpecialist && (
        <div className="mb-6 flex items-center gap-3 rounded-lg bg-accent-wash text-accent px-4 py-3 text-sm">
          <Icon name="info" size={20} className="shrink-0" aria-hidden />
          Submitted &mdash; awaiting admin review
        </div>
      )}

      {/* Returned / review notes banner -- specialist only */}
      {session.status === 'returned' && isSpecialist && (
        <WarnBanner
          className="mb-6"
          title="Returned by Admin"
          body={session.review_notes ?? undefined}
        />
      )}

      {/* Admin-only assignee field */}
      {isAdmin && session && (
        <div className="tpc-card flex items-center justify-between px-4 py-3 mb-6" style={{ background: "var(--bg-2)" }}>
          <span className="text-sm text-ink-3">Assigned to</span>
          {editingAssignee ? (
            <select
              autoFocus
              value={session.assigned_to ?? ""}
              onChange={(e) => handleReassign(e.target.value)}
              onBlur={() => setEditingAssignee(false)}
              className="text-sm font-medium rounded border border-rule
                         bg-bg text-ink
                         px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.display_name}
                </option>
              ))}
            </select>
          ) : (
            <span
              onClick={() => setEditingAssignee(true)}
              className="text-sm font-medium text-ink cursor-pointer
                         hover:text-accent transition-colors"
              title="Tap to reassign"
            >
              {accounts.find((a) => a.id === session.assigned_to)?.display_name ??
                (session.assigned_to ? "Loading..." : "Unassigned")}
            </span>
          )}
        </div>
      )}
      {/* Reassign error */}
      {reassignError && (
        <p className="text-sm text-err -mt-4 mb-6" role="alert">
          {reassignError}
        </p>
      )}

      {/* Interrupted recording banner */}
      {isInterrupted && !showDismissedBanner && (
        <WarnBanner
          className="mb-6"
          title="A recording may have been interrupted."
          body="Check your items for missing audio."
          onDismiss={() => {
            setRecordingSession(null);
            setShowDismissedBanner(true);
          }}
        />
      )}

      {/* Metadata section */}
      <section className="mb-6">
        <div className="tpc-card p-4 space-y-3" style={{ background: "var(--bg-2)" }}>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-3">Items</span>
            <span className="tnum text-sm font-medium text-ink">{itemCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-3">Created</span>
            <span className="tnum text-sm text-ink">{formatDate(session.created_at)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-3">Last updated</span>
            <span className="tnum text-sm text-ink">{formatRelativeTime(session.updated_at)}</span>
          </div>
        </div>
      </section>

      {/* Notes section */}
      <section className="mb-6">
        <Eyebrow className="mb-2">Notes</Eyebrow>
        {isReadOnly ? (
          <div className="w-full rounded-lg border border-rule
                          bg-bg-2 p-3 text-sm
                          text-ink min-h-[4.5rem]">
            {session.notes || <span className="text-ink-3">No notes</span>}
          </div>
        ) : (
          <textarea
            value={editNotes !== null ? editNotes : session.notes}
            onChange={(e) => setEditNotes(e.target.value)}
            onBlur={handleNotesSave}
            placeholder="Add notes..."
            rows={3}
            className="w-full rounded-lg border border-rule
                       bg-bg-2 p-3 text-sm
                       text-ink
                       placeholder:text-ink-3
                       focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent
                       resize-none"
          />
        )}
      </section>

      {/* Item list section */}
      <section className="mb-8">
        <Eyebrow className="mb-3">Items ({itemCount})</Eyebrow>
        {continuousActive && <ContinuousModePanel sessionId={sessionId!} />}
        <ItemList
          sessionId={sessionId!}
          mode={session.mode as "house" | "sale"}
          onAddItemRef={addItemRef}
          readOnly={isReadOnly || continuousActive}
          compact={continuousActive}
        />
      </section>

      {/* Export History */}
      <ExportHistoryList sessionId={sessionId!} />

      {/* Bottom action -- Delete only (lifecycle buttons are in header) */}
      <section className="space-y-3">
        <Button
          variant="danger"
          fullWidth
          onClick={() => setConfirmAction("delete")}
        >
          Delete Session
        </Button>
      </section>

      {/* Submit confirmation */}
      <ConfirmDialog
        open={confirmAction === 'submit'}
        title="Submit for Review?"
        message={`${session.name} will be locked for editing until returned or approved by admin.`}
        confirmLabel="Lock & Submit"
        cancelLabel="Keep Editing"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />

      {/* Export confirmation */}
      <ConfirmDialog
        open={confirmAction === 'export'}
        title="Export Session?"
        message={`Export ${session.name} as JSON? The session will be marked as exported.`}
        confirmLabel="Export"
        cancelLabel="Cancel"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />

      {/* Reopen confirmation */}
      <ConfirmDialog
        open={confirmAction === 'reopen'}
        title="Reopen Session?"
        message={`Reopen ${session.name}? It will return to active status and be editable again.`}
        confirmLabel="Reopen"
        cancelLabel="Cancel"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={confirmAction === 'delete'}
        title="Delete Session"
        message="Permanently delete this session and all its items? This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />

      {/* Return dialog */}
      <ReturnDialog
        open={showReturnDialog}
        sessionName={session.name}
        onConfirm={handleReturn}
        onCancel={() => setShowReturnDialog(false)}
      />

      {/* Floating Add Item button */}
      {!isReadOnly && !continuousActive && (
        <div className="fixed bottom-44 left-0 right-0 px-4 pb-[env(safe-area-inset-bottom)] landscape:max-w-3xl landscape:mx-auto z-40">
          <Button
            variant="primary"
            fullWidth
            onClick={handleAddItem}
            icon={<Icon name="plus" size={14} aria-hidden />}
            style={{
              minHeight: 48,
              boxShadow: "0 8px 24px var(--accent-wash)",
            }}
          >
            {itemCount === 0 ? "Start Cataloging" : "Add Item"}
          </Button>
        </div>
      )}

      {!isReadOnly && !continuousActive && continuousCaptureEnabled && (
        <ContinuousModeFAB
          onStart={handleStartContinuous}
          disabled={continuousRecorder.status === "requesting"}
        />
      )}

      {continuousActive && (
        <ContinuousModeControlBar
          paused={continuousPaused}
          finalizing={continuousFinalizing}
          onStop={handleStopContinuous}
          onPause={continuousRecorder.pause}
          onResume={continuousRecorder.resume}
          onNewItem={handleContinuousNewItem}
        />
      )}

      {/* Import toast feedback */}
      {importToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-ink text-bg px-4 py-3 rounded-xl shadow-lg animate-[slideUp_0.3s_ease-out]">
          <span className="text-sm">{importToast}</span>
        </div>
      )}

      {/* Recording overlays for re-record from ItemList mic icons */}
      <RecordingIndicator />
      <RecordingToast />
    </div>
  );
}
