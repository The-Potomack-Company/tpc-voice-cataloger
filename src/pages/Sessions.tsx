import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useUIStore } from "../stores/uiStore";
import { Walkthrough } from "../components/Walkthrough";
import { useWalkthroughStatus } from "../components/walkthrough/useWalkthroughStatus";
import { SessionSearch } from "../components/SessionSearch";
import { SessionTile } from "../components/SessionTile";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Eyebrow } from "../ui/Eyebrow";
import { Button } from "../ui/Button";
import {
  useActiveSessions,
  useSubmittedSessions,
  useReturnedSessions,
  useExportedSessions,
  useSessionItemCount,
  useNameMap,
} from "../hooks/useSessions";
import { useUserRole } from "../hooks/useUserRole";
import { deleteSession, updateSession } from "../db/sessions";
import { groupByDate, sessionShortId } from "../utils/groupByDate";
import type { Tables } from "../db/database.types";

type SupabaseSession = Tables<"sessions">;

interface TileBlockProps {
  sessions: SupabaseSession[];
  onTap: (s: SupabaseSession) => void;
  onDelete: (s: SupabaseSession) => void;
  onRename: (s: SupabaseSession, newName: string) => void;
  assigneeNameFor?: (s: SupabaseSession) => string | undefined;
}

/** Wrapper to look up the item count for a single tile. */
function TileWithCount({
  session,
  onTap,
  onDelete,
  onRename,
  showDivider,
  assigneeName,
}: {
  session: SupabaseSession;
  onTap: () => void;
  onDelete: () => void;
  onRename: (newName: string) => void;
  showDivider: boolean;
  assigneeName?: string;
}) {
  const count = useSessionItemCount(session.id);
  return (
    <SessionTile
      session={session}
      itemCount={count}
      shortId={sessionShortId(session)}
      onTap={onTap}
      onDelete={onDelete}
      onRename={onRename}
      showDivider={showDivider}
      assigneeName={assigneeName}
    />
  );
}

/** Date-grouped block of tiles, each group wrapped in a tpc-card container. */
function DateGroupedTiles({
  sessions,
  onTap,
  onDelete,
  onRename,
  assigneeNameFor,
}: TileBlockProps) {
  const groups = groupByDate(sessions, (s) => s.updated_at);
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.key}>
          <Eyebrow className="tpc-date-group">{group.label}</Eyebrow>
          <div className="tpc-card overflow-hidden">
            {group.items.map((s, i) => (
              <TileWithCount
                key={s.id}
                session={s}
                onTap={() => onTap(s)}
                onDelete={() => onDelete(s)}
                onRename={(newName) => onRename(s, newName)}
                showDivider={i < group.items.length - 1}
                assigneeName={assigneeNameFor?.(s)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Section header used at the top level (Active / Submitted / etc.). */
function SectionHeader({
  title,
  count,
  collapsible,
  expanded,
  onToggle,
  tone = "neutral",
}: {
  title: string;
  count: number;
  collapsible?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  tone?: "neutral" | "warn";
}) {
  const colorClass =
    tone === "warn" ? "text-warn" : "text-ink-3";

  if (collapsible) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className={`flex items-center gap-2 mb-3 ${colorClass}`}
      >
        <svg
          className={`w-4 h-4 transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="tpc-eyebrow">
          {title} ({count})
        </span>
      </button>
    );
  }

  return (
    <div className={`flex items-center gap-2 mb-3 ${colorClass}`}>
      {tone === "warn" && (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      )}
      <span className="tpc-eyebrow">
        {title} ({count})
      </span>
    </div>
  );
}

export function SessionsPage() {
  const {
    walkthroughCompleted,
    role: walkthroughRole,
    loading: walkthroughLoading,
    completeWalkthrough,
  } = useWalkthroughStatus();
  const isOnline = useUIStore((s) => s.isOnline);
  const navigate = useNavigate();
  const activeSessions = useActiveSessions();
  const submittedSessions = useSubmittedSessions();
  const returnedSessions = useReturnedSessions();
  const exportedSessions = useExportedSessions();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const nameMap = useNameMap();

  const [searchQuery, setSearchQuery] = useState("");
  const [submittedExpanded, setSubmittedExpanded] = useState(true);
  const [exportedExpanded, setExportedExpanded] = useState(false);
  const [returnedExpandedAdmin, setReturnedExpandedAdmin] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<SupabaseSession | null>(null);

  // Gate: default to "completed" while loading to avoid flash of walkthrough for returning users
  if (!walkthroughLoading && walkthroughCompleted === false) {
    return <Walkthrough role={walkthroughRole} onComplete={completeWalkthrough} />;
  }

  // Loading skeleton while role is being determined
  if (roleLoading) {
    return (
      <div className="portrait:px-4 landscape:px-8 landscape:max-w-3xl landscape:mx-auto py-6">
        <SessionSearch onSearch={setSearchQuery} />
        <div className="mt-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[72px] rounded-lg bg-bg-2 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const totalSessions =
    activeSessions.length +
    submittedSessions.length +
    returnedSessions.length +
    exportedSessions.length;

  // Filter by search query
  const filterFn = (s: SupabaseSession) =>
    !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase());

  const filteredActive = activeSessions.filter(filterFn);
  const filteredSubmitted = submittedSessions.filter(filterFn);
  const filteredReturned = returnedSessions.filter(filterFn);
  const filteredExported = exportedSessions.filter(filterFn);
  const filteredTotal =
    filteredActive.length +
    filteredSubmitted.length +
    filteredReturned.length +
    filteredExported.length;

  const handleTap = (session: SupabaseSession) => {
    navigate(`/session/${session.id}`);
  };

  const handleDeleteRequest = (session: SupabaseSession) => {
    setDeleteTarget(session);
  };

  const handleDeleteConfirm = async () => {
    if (deleteTarget?.id) {
      await deleteSession(deleteTarget.id);
    }
    setDeleteTarget(null);
  };

  const handleRename = async (session: SupabaseSession, newName: string) => {
    if (session.id) {
      await updateSession(session.id, { name: newName });
    }
  };

  // Resolve the assignee display name (admin cross-user view).
  const assigneeNameFor = (s: SupabaseSession): string | undefined => {
    if (!isAdmin) return undefined;
    if (!s.assigned_to) return "Unassigned";
    return nameMap.get(s.assigned_to) ?? "Loading…";
  };

  // Empty state -- no sessions at all
  if (totalSessions === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full portrait:px-4 landscape:px-8 landscape:max-w-3xl landscape:mx-auto py-12">
        <svg
          className="w-20 h-20 text-ink-4 mb-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>
        <h2 className="tpc-display tpc-display-3 text-ink mb-2">No sessions yet</h2>
        <p className="text-ink-3 mb-8 text-center">
          Create your first cataloging session to get started.
        </p>
        <Link
          to="/new"
          className="tpc-btn tpc-btn-primary tpc-btn-fullwidth"
          style={{ maxWidth: 280 }}
        >
          Start New Session
        </Link>
      </div>
    );
  }

  return (
    <div className="portrait:px-4 landscape:px-8 landscape:max-w-3xl landscape:mx-auto py-6">
      {/* Header — eyebrow + display title + New button */}
      <header className="mb-5 flex items-baseline justify-between gap-3">
        <div>
          <Eyebrow>The Potomack Co.</Eyebrow>
          <h1 className="tpc-display tpc-display-2 mt-1 text-ink">Sessions</h1>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          }
          onClick={() => navigate("/new")}
          aria-label="New session"
        >
          New
        </Button>
      </header>

      {/* Offline banner */}
      {!isOnline && (
        <div
          className="flex items-center justify-center gap-2 py-2 px-4 mb-4 bg-bg-2 rounded-md text-ink-3"
          role="status"
          aria-live="polite"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M3.757 3.757l16.486 16.486"
            />
          </svg>
          <span className="text-sm">You're offline. Changes will sync when you reconnect.</span>
        </div>
      )}

      {/* Search */}
      <SessionSearch onSearch={setSearchQuery} />

      {/* Empty search results */}
      {searchQuery && filteredTotal === 0 && (
        <p className="text-center text-ink-3 mt-8">
          No sessions match "{searchQuery}"
        </p>
      )}

      {isAdmin ? (
        <>
          {/* Admin view — Awaiting Review / Active / Returned / Exported */}
          {filteredSubmitted.length > 0 && (
            <section className="mt-6">
              <SectionHeader title="Awaiting Review" count={filteredSubmitted.length} />
              <DateGroupedTiles
                sessions={filteredSubmitted}
                onTap={handleTap}
                onDelete={handleDeleteRequest}
                onRename={handleRename}
                assigneeNameFor={assigneeNameFor}
              />
            </section>
          )}

          {filteredActive.length > 0 && (
            <section className="mt-8">
              <SectionHeader title="Active Sessions" count={filteredActive.length} />
              <DateGroupedTiles
                sessions={filteredActive}
                onTap={handleTap}
                onDelete={handleDeleteRequest}
                onRename={handleRename}
                assigneeNameFor={assigneeNameFor}
              />
            </section>
          )}

          {filteredReturned.length > 0 && (
            <section className="mt-8">
              <SectionHeader
                title="Returned"
                count={filteredReturned.length}
                collapsible
                expanded={returnedExpandedAdmin}
                onToggle={() => setReturnedExpandedAdmin((v) => !v)}
              />
              {returnedExpandedAdmin && (
                <DateGroupedTiles
                  sessions={filteredReturned}
                  onTap={handleTap}
                  onDelete={handleDeleteRequest}
                  onRename={handleRename}
                  assigneeNameFor={assigneeNameFor}
                />
              )}
            </section>
          )}

          {filteredExported.length > 0 && (
            <section className="mt-8">
              <SectionHeader
                title="Exported"
                count={filteredExported.length}
                collapsible
                expanded={exportedExpanded}
                onToggle={() => setExportedExpanded((v) => !v)}
              />
              {exportedExpanded && (
                <DateGroupedTiles
                  sessions={filteredExported}
                  onTap={handleTap}
                  onDelete={handleDeleteRequest}
                  onRename={handleRename}
                  assigneeNameFor={assigneeNameFor}
                />
              )}
            </section>
          )}
        </>
      ) : (
        <>
          {/* Specialist view — Needs Attention / Active / Submitted / Exported */}
          {filteredReturned.length > 0 && (
            <section className="mt-6">
              <SectionHeader
                title={`Needs Attention`}
                count={filteredReturned.length}
                tone="warn"
              />
              <DateGroupedTiles
                sessions={filteredReturned}
                onTap={handleTap}
                onDelete={handleDeleteRequest}
                onRename={handleRename}
              />
            </section>
          )}

          {filteredActive.length > 0 && (
            <section className={filteredReturned.length > 0 ? "mt-8" : "mt-6"}>
              <SectionHeader title="Active Sessions" count={filteredActive.length} />
              <DateGroupedTiles
                sessions={filteredActive}
                onTap={handleTap}
                onDelete={handleDeleteRequest}
                onRename={handleRename}
              />
            </section>
          )}

          {filteredSubmitted.length > 0 && (
            <section className="mt-8">
              <SectionHeader
                title="Submitted"
                count={filteredSubmitted.length}
                collapsible
                expanded={submittedExpanded}
                onToggle={() => setSubmittedExpanded((v) => !v)}
              />
              {submittedExpanded && (
                <DateGroupedTiles
                  sessions={filteredSubmitted}
                  onTap={handleTap}
                  onDelete={handleDeleteRequest}
                  onRename={handleRename}
                />
              )}
            </section>
          )}

          {filteredExported.length > 0 && (
            <section className="mt-8">
              <SectionHeader
                title="Exported"
                count={filteredExported.length}
                collapsible
                expanded={exportedExpanded}
                onToggle={() => setExportedExpanded((v) => !v)}
              />
              {exportedExpanded && (
                <DateGroupedTiles
                  sessions={filteredExported}
                  onTap={handleTap}
                  onDelete={handleDeleteRequest}
                  onRename={handleRename}
                />
              )}
            </section>
          )}
        </>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete session?"
        message="This session and all its items will be permanently deleted."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
