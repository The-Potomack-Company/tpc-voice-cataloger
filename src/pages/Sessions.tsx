import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useUIStore } from "../stores/uiStore";
import { Walkthrough } from "../components/Walkthrough";
import { SessionSearch } from "../components/SessionSearch";
import { SessionCard } from "../components/SessionCard";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useActiveSessions, useCompletedSessions, useArchivedSessions, useSessionItemCount } from "../hooks/useSessions";
import { softDeleteSession, updateSession, unarchiveSession } from "../db/sessions";
import type { Session } from "../db/types";

/** Wrapper that calls useSessionItemCount for a single session */
function SessionCardWithCount({
  session,
  onTap,
  onDelete,
  onRename,
}: {
  session: Session;
  onTap: () => void;
  onDelete: () => void;
  onRename: (newName: string) => void;
}) {
  const itemCount = useSessionItemCount(session.id!);
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
  const navigate = useNavigate();
  const activeSessions = useActiveSessions();
  const completedSessions = useCompletedSessions();
  const archivedSessions = useArchivedSessions();

  const [searchQuery, setSearchQuery] = useState("");
  const [completedExpanded, setCompletedExpanded] = useState(true);
  const [archivedExpanded, setArchivedExpanded] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);

  if (!hasCompletedWalkthrough) {
    return <Walkthrough />;
  }

  const totalSessions = activeSessions.length + completedSessions.length + archivedSessions.length;

  // Filter by search query
  const filterFn = (s: Session) =>
    !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase());

  const filteredActive = activeSessions.filter(filterFn);
  const filteredCompleted = completedSessions.filter(filterFn);
  const filteredArchived = archivedSessions.filter(filterFn);
  const filteredTotal = filteredActive.length + filteredCompleted.length + filteredArchived.length;

  const handleTap = (session: Session) => {
    navigate(`/session/${session.id}`);
  };

  const handleDeleteRequest = (session: Session) => {
    setDeleteTarget(session);
  };

  const handleDeleteConfirm = async () => {
    if (deleteTarget?.id) {
      await softDeleteSession(deleteTarget.id);
    }
    setDeleteTarget(null);
  };

  const handleRename = async (session: Session, newName: string) => {
    if (session.id) {
      await updateSession(session.id, { name: newName });
    }
  };

  // Empty state — no sessions at all
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
      {/* Search */}
      <SessionSearch onSearch={setSearchQuery} />

      {/* Empty search results */}
      {searchQuery && filteredTotal === 0 && (
        <p className="text-center text-gray-500 dark:text-gray-400 mt-8">
          No sessions match "{searchQuery}"
        </p>
      )}

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

      {/* Archived Sessions */}
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
                <div key={session.id} className="relative">
                  <SessionCardWithCount
                    session={session}
                    onTap={() => handleTap(session)}
                    onDelete={() => handleDeleteRequest(session)}
                    onRename={(newName) => handleRename(session, newName)}
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); unarchiveSession(session.id!); }}
                    className="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800 z-10"
                  >
                    Un-archive
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete session?"
        message="This session and all its items will be moved to trash. You can recover it from Settings."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
