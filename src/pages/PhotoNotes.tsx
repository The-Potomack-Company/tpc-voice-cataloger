import { useRef, useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Button } from "../ui/Button";
import { Icon } from "../ui/icons";
import { useBlobUrl } from "../hooks/useBlobUrl";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useNotePages } from "../hooks/useNotePages";
import {
  addNotePage,
  retakeNotePage,
  deleteNotePage,
  reorderNotePages,
} from "../db/notePages";
import { resizeImage } from "../utils/image";
import { processNotes } from "../services/notesProcessing";
import { DuplicateDraftBatchError } from "../services/itemDraftsApi";
import { useNotificationStore } from "../stores/notificationStore";
import type { NotePage } from "../db/types";

const OFFLINE_HINT = "Processing needs a connection — pages are saved.";

function PageRow({
  page,
  index,
  total,
  onRetake,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  page: NotePage;
  index: number;
  total: number;
  onRetake: (id: number) => void;
  onDelete: (id: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}) {
  const url = useBlobUrl(page.thumbnail ?? page.blob);
  const pageNumber = index + 1;

  return (
    <li className="flex items-center gap-3 rounded-lg border border-rule bg-bg-2 p-2">
      <span
        className="tnum shrink-0 w-6 text-center text-sm font-semibold text-ink-3"
        aria-hidden
      >
        {pageNumber}
      </span>
      <div className="shrink-0 w-16 h-16 rounded-md overflow-hidden border border-rule bg-bg-3">
        {url ? (
          <img src={url} alt={`Note page ${pageNumber}`} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full" />
        )}
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onMoveUp(index)}
          disabled={index === 0}
          aria-label={`Move page ${pageNumber} up`}
          className="grid place-items-center w-11 h-11 rounded-md text-ink-2 disabled:opacity-30"
        >
          <Icon name="arrowUp" size={20} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onMoveDown(index)}
          disabled={index === total - 1}
          aria-label={`Move page ${pageNumber} down`}
          className="grid place-items-center w-11 h-11 rounded-md text-ink-2 disabled:opacity-30"
        >
          <Icon name="arrowDown" size={20} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onRetake(page.id!)}
          aria-label={`Retake page ${pageNumber}`}
          className="grid place-items-center w-11 h-11 rounded-md text-ink-2"
        >
          <Icon name="refresh" size={20} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onDelete(page.id!)}
          aria-label={`Delete page ${pageNumber}`}
          className="grid place-items-center w-11 h-11 rounded-md"
          style={{ color: "var(--err)" }}
        >
          <Icon name="trash" size={20} aria-hidden />
        </button>
      </div>
    </li>
  );
}

export function PhotoNotesPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const pages = useNotePages(sessionId);
  const isOnline = useOnlineStatus();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const retakeTargetRef = useRef<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const openPicker = (retakeId: number | null) => {
    retakeTargetRef.current = retakeId;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sessionId) return;
    setIsSaving(true);
    try {
      const [blob, thumbnail] = await Promise.all([
        resizeImage(file, 2048), // 2048 for handwriting legibility (Phase 47 model call)
        resizeImage(file, 200),
      ]);
      const target = retakeTargetRef.current;
      if (target !== null) {
        await retakeNotePage(target, { blob, thumbnail });
      } else {
        await addNotePage({ sessionId, blob, thumbnail });
      }
    } catch (err) {
      console.error("Failed to save note page:", err);
    } finally {
      retakeTargetRef.current = null;
      setIsSaving(false);
    }
  };

  const handleMove = async (index: number, delta: number) => {
    const next = index + delta;
    if (next < 0 || next >= pages.length) return;
    const ids = pages.map((p) => p.id!);
    [ids[index], ids[next]] = [ids[next], ids[index]];
    await reorderNotePages(ids);
  };

  const handleConfirmDelete = async () => {
    if (confirmDeleteId !== null) await deleteNotePage(confirmDeleteId);
    setConfirmDeleteId(null);
  };

  const handleProcess = async () => {
    if (!sessionId || pages.length === 0 || !isOnline || isProcessing) return;
    setIsProcessing(true);
    try {
      const result = await processNotes(sessionId);
      setToast(`Created ${result.draftCount} draft${result.draftCount === 1 ? "" : "s"}.`);
    } catch (error) {
      if (error instanceof DuplicateDraftBatchError) {
        setToast("These pages were already processed.");
      } else {
        useNotificationStore
          .getState()
          .notifyError("Couldn't process note pages.", () => void handleProcess());
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const count = pages.length;
  const processDisabled = count === 0 || !isOnline || isProcessing;

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] portrait:px-4 landscape:px-8 landscape:max-w-3xl landscape:mx-auto pb-28">
      <div className="py-2">
        <button
          type="button"
          onClick={() => navigate(`/session/${sessionId}`)}
          aria-label="Back to session"
          className="flex items-center gap-1 text-accent min-h-12"
        >
          <Icon name="back" size={20} aria-hidden />
          Back to Session
        </button>
      </div>

      <h1 className="tpc-display-text text-xl mt-2 mb-4" style={{ color: "var(--ink)" }}>
        Photo notes
      </h1>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      <Button
        variant="primary"
        fullWidth
        onClick={() => openPicker(null)}
        disabled={isSaving}
        icon={<Icon name="camera" size={16} aria-hidden />}
      >
        {isSaving ? "Saving…" : "Add page"}
      </Button>

      {count === 0 ? (
        <p className="mt-6 text-center text-sm text-ink-3">
          No pages yet. Tap “Add page” to photograph a sheet of notes.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {pages.map((page, index) => (
            <PageRow
              key={page.pageUid}
              page={page}
              index={index}
              total={count}
              onRetake={(id) => openPicker(id)}
              onDelete={(id) => setConfirmDeleteId(id)}
              onMoveUp={(i) => handleMove(i, -1)}
              onMoveDown={(i) => handleMove(i, +1)}
            />
          ))}
        </ul>
      )}

      {/* Sticky Process footer */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] bg-bg border-t border-rule landscape:max-w-3xl landscape:mx-auto z-40">
        {processDisabled && !isOnline && count > 0 && (
          <p className="mb-2 text-center text-xs text-ink-3">{OFFLINE_HINT}</p>
        )}
        <Button
          variant="primary"
          fullWidth
          onClick={handleProcess}
          disabled={processDisabled}
        >
          {isProcessing ? "Processing…" : `Process ${count} page${count === 1 ? "" : "s"}`}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete page?"
        message="This removes the photographed page. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />

      {toast && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-ink text-bg px-4 py-3 rounded-xl shadow-lg"
        >
          <span className="text-sm">{toast}</span>
        </div>
      )}
    </div>
  );
}
