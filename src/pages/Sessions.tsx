import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useUIStore } from "../stores/uiStore";
import { Walkthrough } from "../components/Walkthrough";
import { SessionSearch } from "../components/SessionSearch";
import { SessionCard } from "../components/SessionCard";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useActiveSessions, useCompletedSessions, useArchivedSessions, useSessionItemCount, useNameMap } from "../hooks/useSessions";
import { useUserRole } from "../hooks/useUserRole";
import { deleteSession, updateSession } from "../db/sessions";
import type { Tables } from "../db/database.types";

type SupabaseSession = Tables<"sessions">;

/** Group sessions by assigned_to UUID, resolving names via nameMap */
function groupByAssignee(
  sessions: SupabaseSession[],
  nameMap: Map<string, string>,
): { name: string; id: string; sessions: SupabaseSession[] }[] {
  const groups = new Map<string, SupabaseSession[]>();
  for (const session of sessions) {
    const key = session.assigned_to ?? "unassigned";
    const group = groups.get(key) ?? [];
    group.push(session);
    groups.set(key, group);
  }
  return Array.from(groups.entries())
    .map(([id, sess]) => ({
      id,
      name: id === "unassigned" ? "Unassigned" : (nameMap.get(id) ?? "Loading…"),
      sessions: sess,
    }))
    .sort((a, b) => {
      // Unassigned always at the bottom
      if (a.id === "unassigned") return 1;
      if (b.id === "unassigned") return -1;
      return a.name.localeCompare(b.name);
    });
}

/** Specialist group header with collapsible session list */
function SpecialistGroup({
  name,
  sessions,
  onTap,
  onDelete,
  onRename,
  defaultExpanded = true,
}: {
  name: string;
  sessions: SupabaseSession[];
  onTap: (s: SupabaseSession) => void;
  onDelete: (s: SupabaseSession) => void;
  onRename: (s: SupabaseSession, n: string) => void;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 mb-2 ml-1 min-h-12"
      >
        <svg
          className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {name} ({sessions.length})
        </span>
      </button>
      {expanded && (
        <div className="space-y-2">
          {sessions.map((session) => (
            <AdminSessionCard
              key={session.id}
              session={session}
              onTap={() => onTap(session)}
              onDelete={() => onDelete(session)}
              onRename={(newName) => onRename(session, newName)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Admin session card wrapper that passes assigneeName and sessionStatus */
function AdminSessionCard({
  session,
  onTap,
  onDelete,
  onRename,
}: {
  session: SupabaseSession;
  onTap: () => void;
  onDelete: () => void;
  onRename: (newName: string) => void;
}) {
  const itemCount = useSessionItemCount(session.id);
  return (
    <SessionCard
      session={session}
      itemCount={itemCount}
      onTap={onTap}
      onDelete={onDelete}
      onRename={onRename}
      sessionStatus={session.status}
    />
  );
}

/** Collapsible admin section (Completed, Archived) */
function CollapsibleAdminSection({
  title,
  sessions,
  groups,
  onTap,
  onDelete,
  onRename,
  defaultExpanded,
}: {
  title: string;
  sessions: SupabaseSession[];
  groups: { name: string; id: string; sessions: SupabaseSession[] }[];
  onTap: (s: SupabaseSession) => void;
  onDelete: (s: SupabaseSession) => void;
  onRename: (s: SupabaseSession, n: string) => void;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <section className="mt-8">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 mb-3"
      >
        <svg
          className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {title} ({sessions.length})
        </h2>
      </button>
      {expanded && (
        <div className="space-y-4">
          {groups.map((g) => (
            <SpecialistGroup
              key={g.id}
              name={g.name}
              sessions={g.sessions}
              onTap={onTap}
              onDelete={onDelete}
              onRename={onRename}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** Wrapper that calls useSessionItemCount for a single session (specialist view) */
function SessionCardWithCount({
  session,
  onTap,
  onDelete,
  onRename,
}: {
  session: SupabaseSession;
  onTap: () => void;
  onDelete: () => void;
  onRename: (newName: string) => void;
}) {
  const itemCount = useSessionItemCount(session.id);
  return (
    <SessionCard
      session={session}
      itemCount={itemCount}
      onTap={onTap}
      onDelete={onDelete}
      onRename={onRename}
    />
  );
}

export function SessionsPage() {
  const hasCompletedWalkthrough = useUIStore(
    (s) => s.hasCompletedWalkthrough,
  );
  const isOnline = useUIStore((s) => s.isOnline);
  const navigate = useNavigate();
  const activeSessions = useActiveSessions();
  const completedSessions = useCompletedSessions();
  const archivedSessions = useArchivedSessions();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const nameMap = useNameMap();

  const [searchQuery, setSearchQuery] = useState("");
  const [completedExpanded, setCompletedExpanded] = useState(true);
  const [archivedExpanded, setArchivedExpanded] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SupabaseSession | null>(null);

  if (!hasCompletedWalkthrough) {
    return <Walkthrough />;
  }

  // Loading skeleton while role is being determined
  if (roleLoading) {
    return (
      <div className="portrait:px-4 landscape:px-8 landscape:max-w-3xl landscape:mx-auto py-6">
        <SessionSearch onSearch={setSearchQuery} />
        <div className="mt-6 space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 h-[72px] animate-pulse border border-gray-200 dark:border-gray-700"
            />
          ))}
        </div>
      </div>
    );
  }

  const totalSessions = activeSessions.length + completedSessions.length + archivedSessions.length;

  // Filter by search query
  const filterFn = (s: SupabaseSession) =>
    !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase());

  const filteredActive = activeSessions.filter(filterFn);
  const filteredCompleted = completedSessions.filter(filterFn);
  const filteredArchived = archivedSessions.filter(filterFn);
  const filteredTotal = filteredActive.length + filteredCompleted.length + filteredArchived.length;

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

  /** Render an admin section with specialist grouping */
  const renderAdminSection = (
    title: string,
    sessions: SupabaseSession[],
    collapsible: boolean,
    defaultExpanded: boolean,
  ) => {
    if (sessions.length === 0) return null;
    const groups = groupByAssignee(sessions, nameMap);

    if (!collapsible) {
      return (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            {title} ({sessions.length})
          </h2>
          <div className="space-y-4">
            {groups.map((g) => (
              <SpecialistGroup
                key={g.id}
                name={g.name}
                sessions={g.sessions}
                onTap={handleTap}
                onDelete={handleDeleteRequest}
                onRename={handleRename}
              />
            ))}
          </div>
        </section>
      );
    }

    return (
      <CollapsibleAdminSection
        title={title}
        sessions={sessions}
        groups={groups}
        onTap={handleTap}
        onDelete={handleDeleteRequest}
        onRename={handleRename}
        defaultExpanded={defaultExpanded}
      />
    );
  };

  // Empty state -- no sessions at all
  if (totalSessions === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full portrait:px-4 landscape:px-8 landscape:max-w-3xl landscape:mx-auto py-12">
        <svg
          className="w-20 h-20 text-gray-300 dark:text-gray-600 mb-6"
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
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          No sessions yet
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8 text-center">
          Create your first cataloging session to get started.
        </p>
        <Link
          to="/new"
          className="bg-accent hover:bg-accent-hover text-white font-medium py-3 px-8 rounded-lg min-h-12 flex items-center justify-center transition-colors"
        >
          Start New Session
        </Link>
      </div>
    );
  }

  return (
    <div className="portrait:px-4 landscape:px-8 landscape:max-w-3xl landscape:mx-auto py-6">
      {/* Offline banner */}
      {!isOnline && (
        <div className="flex items-center justify-center gap-2 py-2 px-4 mb-4 bg-gray-100 dark:bg-gray-800 rounded-lg" role="status" aria-live="polite">
          <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M3.757 3.757l16.486 16.486" />
          </svg>
          <span className="text-sm text-gray-500 dark:text-gray-400">You're offline. Changes will sync when you reconnect.</span>
        </div>
      )}

      {/* Search */}
      <SessionSearch onSearch={setSearchQuery} />

      {/* Empty search results */}
      {searchQuery && filteredTotal === 0 && (
        <p className="text-center text-gray-500 dark:text-gray-400 mt-8">
          No sessions match "{searchQuery}"
        </p>
      )}

      {isAdmin ? (
        <>
          {renderAdminSection("Active Sessions", filteredActive, false, true)}
          {renderAdminSection("Completed", filteredCompleted, true, true)}
          {renderAdminSection("Archived", filteredArchived, true, false)}
        </>
      ) : (
        <>
          {/* Active Sessions */}
          {filteredActive.length > 0 && (
            <section className="mt-6">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                Active Sessions ({filteredActive.length})
              </h2>
              <div className="space-y-3">
                {filteredActive.map((session) => (
                  <SessionCardWithCount
                    key={session.id}
                    session={session}
                    onTap={() => handleTap(session)}
                    onDelete={() => handleDeleteRequest(session)}
                    onRename={(newName) => handleRename(session, newName)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Completed Sessions */}
          {filteredCompleted.length > 0 && (
            <section className="mt-8">
              <button
                type="button"
                onClick={() => setCompletedExpanded(!completedExpanded)}
                className="flex items-center gap-2 mb-3"
              >
                <svg
                  className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${
                    completedExpanded ? "rotate-90" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Completed ({filteredCompleted.length})
                </h2>
              </button>
              {completedExpanded && (
                <div className="space-y-3">
                  {filteredCompleted.map((session) => (
                    <SessionCardWithCount
                      key={session.id}
                      session={session}
                      onTap={() => handleTap(session)}
                      onDelete={() => handleDeleteRequest(session)}
                      onRename={(newName) => handleRename(session, newName)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Archived Sessions -- currently always empty */}
          {filteredArchived.length > 0 && (
            <section className="mt-8">
              <button
                type="button"
                onClick={() => setArchivedExpanded(!archivedExpanded)}
                className="flex items-center gap-2 mb-3"
              >
                <svg
                  className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${
                    archivedExpanded ? "rotate-90" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Archived ({filteredArchived.length})
                </h2>
              </button>
              {archivedExpanded && (
                <div className="space-y-3">
                  {filteredArchived.map((session) => (
                    <SessionCardWithCount
                      key={session.id}
                      session={session}
                      onTap={() => handleTap(session)}
                      onDelete={() => handleDeleteRequest(session)}
                      onRename={(newName) => handleRename(session, newName)}
                    />
                  ))}
                </div>
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
