import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useUIStore } from "../stores/uiStore";
import { Walkthrough } from "../components/Walkthrough";
import { useWalkthroughStatus } from "../components/walkthrough/useWalkthroughStatus";
import { SessionSearch } from "../components/SessionSearch";
import { SessionTile } from "../components/SessionTile";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Eyebrow } from "../ui/Eyebrow";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import {
  useActiveSessions,
  useSubmittedSessions,
  useReturnedSessions,
  useExportedSessions,
  useSessionItemCount,
  useSessionReviewCount,
  useNameMap,
} from "../hooks/useSessions";
import { useUserRole } from "../hooks/useUserRole";
import { deleteSession, updateSession } from "../db/sessions";
import { groupByAssignee, groupByDate, sessionShortId } from "../utils/groupByDate";
import type { Tables } from "../db/database.types";

type GroupMode = "date" | "specialist";
type ListFilter = "all" | "review" | "export";
const GROUP_MODE_STORAGE_KEY = "tpc.sessions.groupMode";

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
  const reviewCount = useSessionReviewCount(session.id);
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
      reviewCount={reviewCount}
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

/** Specialist-grouped block — admin-only secondary grouping by assignee. */
function AssigneeGroupedTiles({
  sessions,
  onTap,
  onDelete,
  onRename,
  nameMap,
  nameMapReady,
}: TileBlockProps & {
  nameMap: Map<string, string>;
  nameMapReady: boolean;
}) {
  if (!nameMapReady) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[72px] rounded-lg bg-bg-2 animate-pulse"
          />
        ))}
      </div>
    );
  }
  const groups = groupByAssignee(
    sessions,
    (s) => s.assigned_to ?? null,
    nameMap,
  );
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
  const { isAdmin, isReviewer, role, loading: roleLoading } = useUserRole();
  const nameMap = useNameMap();

  const [searchQuery, setSearchQuery] = useState("");
  const [submittedExpanded, setSubmittedExpanded] = useState(true);
  const [exportedExpanded, setExportedExpanded] = useState(false);
  const [returnedExpandedAdmin, setReturnedExpandedAdmin] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<SupabaseSession | null>(null);
  const [listFilter, setListFilter] = useState<ListFilter>("all");
  const [groupMode, setGroupMode] = useState<GroupMode>(() => {
    if (typeof window === "undefined") return "date";
    const stored = window.localStorage.getItem(GROUP_MODE_STORAGE_KEY);
    return stored === "specialist" ? "specialist" : "date";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(GROUP_MODE_STORAGE_KEY, groupMode);
  }, [groupMode]);

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

  // nameMap is async — treat as "ready" once any names have loaded, or when
  // there are no assigned sessions to wait on.
  const hasAssigned =
    activeSessions.some((s) => s.assigned_to) ||
    submittedSessions.some((s) => s.assigned_to) ||
    returnedSessions.some((s) => s.assigned_to) ||
    exportedSessions.some((s) => s.assigned_to);
  const nameMapReady = !hasAssigned || nameMap.size > 0;
  const canSeeAll = isReviewer || isAdmin;
  const roleName =
    role === "dev" ? "Dev" : isAdmin ? "Admin" : isReviewer ? "Manager" : "Specialist";
  const catalogTitle = canSeeAll ? "All sessions" : "My sessions";
  const catalogCopy = canSeeAll
    ? "Search every specialist session with review and export state in one queue."
    : "Search assigned and self-created catalog sessions.";
  const visibleGroups = [
    {
      key: "returned",
      label: canSeeAll ? "Returned" : "Needs Attention",
      sessions: filteredReturned,
      tone: "warn" as const,
      need: "review" as const,
    },
    {
      key: "submitted",
      label: canSeeAll ? "Awaiting Review" : "Submitted",
      sessions: filteredSubmitted,
      tone: "neutral" as const,
      need: "review" as const,
      expanded: submittedExpanded,
      onToggle: () => setSubmittedExpanded((v) => !v),
    },
    {
      key: "active",
      label: "Active",
      sessions: filteredActive,
      tone: "neutral" as const,
      need: "active" as const,
    },
    {
      key: "exported",
      label: "Exported",
      sessions: filteredExported,
      tone: "neutral" as const,
      need: "export" as const,
      expanded: exportedExpanded,
      onToggle: () => setExportedExpanded((v) => !v),
    },
  ].filter((group) => {
    if (group.sessions.length === 0) return false;
    if (!canSeeAll || listFilter === "all") return true;
    return group.need === listFilter;
  });
  const reviewCount = returnedSessions.length + submittedSessions.length;
  const readyExportCount = submittedSessions.length;

  // Admin grouping switcher — uses specialist grouping when toggle is set,
  // otherwise falls back to the existing date-grouped layout.
  const renderAdminGroup = (sessions: SupabaseSession[]) =>
    groupMode === "specialist" ? (
      <AssigneeGroupedTiles
        sessions={sessions}
        onTap={handleTap}
        onDelete={handleDeleteRequest}
        onRename={handleRename}
        nameMap={nameMap}
        nameMapReady={nameMapReady}
      />
    ) : (
      <DateGroupedTiles
        sessions={sessions}
        onTap={handleTap}
        onDelete={handleDeleteRequest}
        onRename={handleRename}
        assigneeNameFor={assigneeNameFor}
      />
    );

  // Empty state -- no sessions at all
  if (totalSessions === 0) {
    return (
      <div className="tpc-page flex flex-col items-center justify-center min-h-full py-12">
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
    <div className="tpc-page">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <Eyebrow>Catalog</Eyebrow>
          <h1 className="tpc-display tpc-display-2 mt-1 text-ink">{catalogTitle}</h1>
          <p className="mt-1 text-sm text-ink-3">{catalogCopy}</p>
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

      <div className="tpc-metric-grid mb-4">
        <div className="tpc-metric">
          <Eyebrow>Scope</Eyebrow>
          <div className="tpc-metric-value">{totalSessions}</div>
          <p className="mt-1 text-xs text-ink-3">
            {roleName === "Specialist" ? "visible sessions" : "sessions tracked"}
          </p>
        </div>
        <div className="tpc-metric">
          <Eyebrow>Review</Eyebrow>
          <div className="tpc-metric-value">{reviewCount}</div>
          <p className="mt-1 text-xs text-ink-3">returned or submitted</p>
        </div>
        <div className="tpc-metric">
          <Eyebrow>Export</Eyebrow>
          <div className="tpc-metric-value">{readyExportCount}</div>
          <p className="mt-1 text-xs text-ink-3">submitted sessions</p>
        </div>
        <div className="tpc-metric">
          <Eyebrow>Sync</Eyebrow>
          <div className="tpc-metric-value">{isOnline ? "On" : "Off"}</div>
          <p className="mt-1 text-xs text-ink-3">
            {isOnline ? "writes drain normally" : "writes queue locally"}
          </p>
        </div>
      </div>

      {!isOnline && (
        <div
          className="mb-4 rounded-md border border-rule bg-bg-2 px-4 py-3 text-ink-3"
          role="status"
          aria-live="polite"
        >
          <span className="text-sm">Offline: writes are queued locally and readable sessions stay available.</span>
        </div>
      )}

      {canSeeAll && (
        <section className="mb-4 grid gap-2 md:grid-cols-3">
          <div className="tpc-card p-3 bg-bg">
            <Eyebrow>Needs review</Eyebrow>
            <div className="mt-1 flex items-center justify-between gap-3">
              <strong className="text-ink">{reviewCount} sessions</strong>
              <Badge tone="warn">Review</Badge>
            </div>
          </div>
          <div className="tpc-card p-3 bg-bg">
            <Eyebrow>Ready export</Eyebrow>
            <div className="mt-1 flex items-center justify-between gap-3">
              <strong className="text-ink">{readyExportCount} sessions</strong>
              <Badge tone="ok">Export</Badge>
            </div>
          </div>
          <div className="tpc-card p-3 bg-bg">
            <Eyebrow>Owner grouping</Eyebrow>
            <p className="mt-1 text-sm text-ink-3">Specialist grouping stays tucked behind the control below.</p>
          </div>
        </section>
      )}

      <section className="tpc-section">
        <div className="tpc-section-head">
          <div>
            <Eyebrow>Sessions</Eyebrow>
            <strong className="block text-ink">{catalogTitle}</strong>
          </div>
          <Badge>{filteredTotal}</Badge>
        </div>
        <div className="tpc-panel">
          <div className="tpc-toolbar">
            <div className="min-w-[240px] flex-1">
              <SessionSearch onSearch={setSearchQuery} />
            </div>
            {canSeeAll && (
              <div className="tpc-segmented" role="group" aria-label="Filter sessions">
                {(["all", "review", "export"] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setListFilter(filter)}
                    aria-pressed={listFilter === filter}
                    className={`tpc-btn tpc-btn-sm ${
                      listFilter === filter ? "tpc-btn-primary" : "tpc-btn-ghost"
                    }`}
                  >
                    {filter === "all" ? "All" : filter === "review" ? "Review" : "Export"}
                  </button>
                ))}
              </div>
            )}
            {canSeeAll && (
              <div className="tpc-segmented" role="group" aria-label="Group sessions by">
                <button
                  type="button"
                  onClick={() => setGroupMode("date")}
                  aria-pressed={groupMode === "date"}
                  className={`tpc-btn tpc-btn-sm ${
                    groupMode === "date" ? "tpc-btn-primary" : "tpc-btn-ghost"
                  }`}
                >
                  Date
                </button>
                <button
                  type="button"
                  onClick={() => setGroupMode("specialist")}
                  aria-pressed={groupMode === "specialist"}
                  className={`tpc-btn tpc-btn-sm ${
                    groupMode === "specialist" ? "tpc-btn-primary" : "tpc-btn-ghost"
                  }`}
                >
                  Specialist
                </button>
              </div>
            )}
          </div>

          {searchQuery && filteredTotal === 0 && (
            <p className="text-center text-ink-3 py-6">
              No sessions match "{searchQuery}"
            </p>
          )}

          {visibleGroups.map((group) => (
            <section key={group.key}>
              <SectionHeader
                title={group.label}
                count={group.sessions.length}
                tone={group.tone}
                collapsible={group.key === "submitted" || group.key === "exported" || group.key === "returned"}
                expanded={
                  group.key === "returned"
                    ? returnedExpandedAdmin
                    : group.expanded ?? true
                }
                onToggle={
                  group.key === "returned"
                    ? () => setReturnedExpandedAdmin((v) => !v)
                    : group.onToggle
                }
              />
              {(group.key !== "returned" || returnedExpandedAdmin) &&
                (group.key !== "submitted" || submittedExpanded) &&
                (group.key !== "exported" || exportedExpanded) &&
                (canSeeAll ? (
                  renderAdminGroup(group.sessions)
                ) : (
                <DateGroupedTiles
                  sessions={group.sessions}
                  onTap={handleTap}
                  onDelete={handleDeleteRequest}
                  onRename={handleRename}
                />
                ))}
            </section>
          ))}
        </div>
      </section>

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
