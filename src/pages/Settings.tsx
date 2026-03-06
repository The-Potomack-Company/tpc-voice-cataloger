import { useState } from "react";
import { useUIStore } from "../stores/uiStore";
import { useDeletedSessions } from "../hooks/useSessions";
import { restoreSession, permanentlyDeleteSession } from "../db/sessions";
import { ConfirmDialog } from "../components/ConfirmDialog";

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

export function SettingsPage() {
  const resetWalkthrough = useUIStore((s) => s.resetWalkthrough);
  const deletedSessions = useDeletedSessions();
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const handlePermanentDelete = async () => {
    if (confirmDeleteId !== null) {
      await permanentlyDeleteSession(confirmDeleteId);
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="portrait:px-4 landscape:px-8 landscape:max-w-3xl landscape:mx-auto py-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        Settings
      </h1>

      {/* About section */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
          About
        </h2>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <p className="text-gray-900 dark:text-gray-100 font-medium">
            TPC Catalog v1.0
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Speech-to-catalog tool for auctioneers
          </p>
        </div>
      </section>

      {/* Storage section */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
          Storage
        </h2>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-900 dark:text-gray-100">Database</span>
            <span className="text-sm text-green-600 dark:text-green-400 font-medium">
              Active
            </span>
          </div>
        </div>
      </section>

      {/* Deleted Sessions section */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
          Deleted Sessions
        </h2>
        {deletedSessions.length === 0 ? (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-400 dark:text-gray-500">
              No deleted sessions
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {deletedSessions.map((session) => (
              <div
                key={session.id}
                className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                    {session.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                      {session.mode === "house" ? "House Visit" : "Sale"}
                    </span>
                    {session.deletedAt && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        Deleted {formatRelativeTime(session.deletedAt)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => restoreSession(session.id!)}
                    className="min-h-12 px-3 py-2 rounded-lg text-sm font-medium
                               text-accent hover:bg-accent/10 transition-colors"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(session.id!)}
                    className="min-h-12 px-3 py-2 rounded-lg text-sm font-medium
                               text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700
                               hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    Delete Forever
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Actions section */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
          Actions
        </h2>
        <button
          onClick={resetWalkthrough}
          className="w-full bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-left
                     text-gray-900 dark:text-gray-100 min-h-12
                     hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          Reset Walkthrough
        </button>
      </section>

      {/* Permanent delete confirmation */}
      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Permanently Delete"
        message="Permanently delete this session? This cannot be undone. All items, audio, and photos will be lost."
        confirmLabel="Delete Forever"
        destructive
        onConfirm={handlePermanentDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
