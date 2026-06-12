import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Eyebrow } from "../ui/Eyebrow";
import { Icon } from "../ui/icons";
import { WarnBanner } from "../ui/WarnBanner";
import { useUserRole } from "../hooks/useUserRole";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useSession } from "../hooks/useSessions";
import { useNotificationStore } from "../stores/notificationStore";
import {
  discardDraft,
  DuplicateDraftPromotionError,
  fetchReviewQueue,
  promoteDraft,
  type ReviewDraft,
} from "../services/reviewQueueApi";
import type { DraftFieldName, DraftFields } from "../services/itemDraftsApi";

const FIELD_LABELS: Array<[DraftFieldName, string]> = [
  ["receipt_number", "Receipt"],
  ["title", "Header"],
  ["description", "Description"],
  ["measurements", "Measurements"],
  ["condition", "Condition"],
  ["estimate", "Estimate"],
  ["category", "Category"],
  ["transcript", "Transcript"],
];

function draftFields(draft: ReviewDraft): DraftFields {
  return {
    title: draft.title,
    description: draft.description,
    condition: draft.condition,
    estimate: draft.estimate,
    measurements: draft.measurements,
    category: draft.category,
    transcript: draft.transcript,
    receipt_number: draft.receipt_number,
  };
}

function statusTone(status: string): "default" | "ok" | "warn" | "info" {
  if (status === "promoted") return "ok";
  if (status === "discarded") return "warn";
  return "info";
}

function pageRefsLabel(refs: unknown[]): string {
  const labels = refs
    .map((ref) => {
      if (!ref || typeof ref !== "object") return null;
      const sortOrder = (ref as { sortOrder?: unknown }).sortOrder;
      return typeof sortOrder === "number" ? `Page ${sortOrder + 1}` : null;
    })
    .filter(Boolean);
  return labels.length > 0 ? labels.join(", ") : "Fields only";
}

function DraftCard({
  draft,
  canReview,
  online,
  busy,
  onPromote,
  onDiscard,
  onJumpToDraft,
}: {
  draft: ReviewDraft;
  canReview: boolean;
  online: boolean;
  busy: boolean;
  onPromote: (draft: ReviewDraft, fields: DraftFields) => void;
  onDiscard: (draft: ReviewDraft) => void;
  onJumpToDraft: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<DraftFields>(() => draftFields(draft));
  const duplicateBlock = draft.duplicate_block;
  const isDuplicateBlocked = duplicateBlock !== null;
  const actionsDisabled = busy || !online || !canReview || draft.status !== "draft" || isDuplicateBlocked;

  return (
    <article
      id={`draft-${draft.id}`}
      className="tpc-card p-4 space-y-4"
      style={{ background: "var(--bg-2)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow>{pageRefsLabel(draft.source_page_refs)}</Eyebrow>
          <h2 className="mt-1 text-base font-semibold text-ink truncate">
            {fields.title || "Untitled draft"}
          </h2>
        </div>
        <Badge tone={statusTone(draft.status)}>{draft.status}</Badge>
      </div>

      {isDuplicateBlocked && (
        <button
          type="button"
          className="w-full text-left rounded border border-warn/30 bg-warn/10 px-3 py-2 text-sm text-ink"
          onClick={() => onJumpToDraft(duplicateBlock.blocking_draft_id)}
        >
          Duplicate receipt blocked by draft {duplicateBlock.blocking_draft_id.slice(0, 8)}
        </button>
      )}

      <div className="space-y-3">
        {FIELD_LABELS.map(([field, label]) => {
          const lowConfidence = draft.low_confidence_fields.includes(field);
          return (
            <label key={field} className="block">
              <span className="flex items-center gap-2 text-xs font-medium uppercase text-ink-3">
                {label}
                {lowConfidence && <Badge tone="warn">Low confidence</Badge>}
              </span>
              {editing ? (
                field === "description" || field === "transcript" ? (
                  <textarea
                    value={fields[field] ?? ""}
                    onChange={(event) => setFields((current) => ({
                      ...current,
                      [field]: event.target.value || null,
                    }))}
                    rows={field === "transcript" ? 4 : 3}
                    className="mt-1 w-full rounded border border-rule bg-bg px-3 py-2 text-sm text-ink"
                  />
                ) : (
                  <input
                    value={fields[field] ?? ""}
                    onChange={(event) => setFields((current) => ({
                      ...current,
                      [field]: event.target.value || null,
                    }))}
                    className="mt-1 w-full rounded border border-rule bg-bg px-3 py-2 text-sm text-ink"
                  />
                )
              ) : (
                <span className="mt-1 block whitespace-pre-wrap text-sm text-ink">
                  {fields[field] || <span className="text-ink-3">Blank</span>}
                </span>
              )}
            </label>
          );
        })}
      </div>

      {draft.raw_ocr_text && (
        <details className="rounded border border-rule px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium uppercase text-ink-3">
            Raw OCR
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-sm text-ink-2">{draft.raw_ocr_text}</p>
        </details>
      )}

      <div className="flex flex-wrap gap-2">
        {canReview && draft.status === "draft" && !isDuplicateBlocked && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEditing((current) => !current)}
            disabled={busy}
            icon={<Icon name="file" size={14} aria-hidden />}
          >
            {editing ? "Preview" : "Edit fields"}
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          onClick={() => onPromote(draft, fields)}
          disabled={actionsDisabled}
          icon={<Icon name="check" size={14} aria-hidden />}
        >
          Promote
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDiscard(draft)}
          disabled={actionsDisabled}
          icon={<Icon name="x" size={14} aria-hidden />}
        >
          Discard
        </Button>
      </div>
    </article>
  );
}

export function ReviewQueuePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const session = useSession(sessionId!);
  const { isReviewer, loading: roleLoading } = useUserRole();
  const online = useOnlineStatus();
  const [drafts, setDrafts] = useState<ReviewDraft[]>([]);
  const [canReview, setCanReview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyDraftId, setBusyDraftId] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const data = await fetchReviewQueue(sessionId);
      setDrafts(data.drafts);
      setCanReview(data.can_review);
    } catch (err) {
      useNotificationStore
        .getState()
        .notifyError(err instanceof Error ? err.message : "Could not load draft review queue");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const counts = useMemo(() => drafts.reduce(
    (next, draft) => ({
      draft: next.draft + (draft.status === "draft" ? 1 : 0),
      promoted: next.promoted + (draft.status === "promoted" ? 1 : 0),
      discarded: next.discarded + (draft.status === "discarded" ? 1 : 0),
    }),
    { draft: 0, promoted: 0, discarded: 0 },
  ), [drafts]);

  const handlePromote = async (draft: ReviewDraft, fields: DraftFields) => {
    if (!online || !canReview) return;
    setBusyDraftId(draft.id);
    try {
      const result = await promoteDraft(draft.id, fields);
      await loadQueue();
      void result;
    } catch (err) {
      if (err instanceof DuplicateDraftPromotionError) {
        useNotificationStore.getState().notifyError("Duplicate receipt blocks promotion.");
        document.getElementById(`draft-${err.duplicate.blocking_draft_id}`)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      } else {
        useNotificationStore
          .getState()
          .notifyError(err instanceof Error ? err.message : "Could not promote draft");
      }
    } finally {
      setBusyDraftId(null);
    }
  };

  const handleDiscard = async (draft: ReviewDraft) => {
    if (!online || !canReview) return;
    setBusyDraftId(draft.id);
    try {
      await discardDraft(draft.id);
      await loadQueue();
    } catch (err) {
      useNotificationStore
        .getState()
        .notifyError(err instanceof Error ? err.message : "Could not discard draft");
    } finally {
      setBusyDraftId(null);
    }
  };

  const jumpToDraft = (id: string) => {
    document.getElementById(`draft-${id}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  if (loading || roleLoading) {
    return (
      <div className="portrait:px-4 landscape:px-8 landscape:max-w-3xl landscape:mx-auto py-8">
        <p className="text-sm text-ink-3">Loading review queue...</p>
      </div>
    );
  }

  return (
    <div className="portrait:px-4 landscape:px-8 landscape:max-w-3xl landscape:mx-auto py-4 pb-20">
      <div className="tpc-sticky-header py-3 -mx-4 portrait:px-4 landscape:px-8 mb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/session/${sessionId}`)}
            className="tpc-btn tpc-btn-ghost"
            style={{ padding: 6 }}
            aria-label="Back to session"
          >
            <Icon name="back" size={16} aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <Eyebrow>Draft Review</Eyebrow>
            <h1 className="tpc-display tpc-display-4 truncate text-ink mt-0.5">
              {session?.name ?? "Session drafts"}
            </h1>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone="info">{counts.draft} pending</Badge>
          <Badge tone="ok">{counts.promoted} promoted</Badge>
          <Badge tone="warn">{counts.discarded} discarded</Badge>
        </div>
      </div>

      {!online && (
        <WarnBanner
          className="mb-4"
          title="Review actions unavailable offline"
          body="Reconnect to promote or discard drafts."
        />
      )}

      {!isReviewer && (
        <WarnBanner
          className="mb-4"
          title="Read-only drafts"
          body="Only managers and admins can promote or discard drafts."
        />
      )}

      {isReviewer && !canReview && (
        <WarnBanner
          className="mb-4"
          title="Session is not ready for review"
          body="Draft actions unlock after the specialist submits the session."
        />
      )}

      <div className="space-y-4">
        {drafts.length === 0 ? (
          <div className="rounded border border-rule bg-bg-2 px-4 py-8 text-center text-sm text-ink-3">
            No drafts ready for this session.
          </div>
        ) : drafts.map((draft) => (
          <DraftCard
            key={`${draft.id}:${draft.updated_at}`}
            draft={draft}
            canReview={canReview}
            online={online}
            busy={busyDraftId === draft.id}
            onPromote={handlePromote}
            onDiscard={handleDiscard}
            onJumpToDraft={jumpToDraft}
          />
        ))}
      </div>
    </div>
  );
}
