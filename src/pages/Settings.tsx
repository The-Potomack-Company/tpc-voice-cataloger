import { useState } from "react";
import { useNavigate } from "react-router";
import { useUIStore } from "../stores/uiStore";
import { useAuthStore } from "../stores/authStore";
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

  // Auth store hooks
  const user = useAuthStore((s) => s.user);
  const signIn = useAuthStore((s) => s.signIn);
  const signOut = useAuthStore((s) => s.signOut);
  const updatePassword = useAuthStore((s) => s.updatePassword);
  const navigate = useNavigate();

  // Password change form state
  const [passwordExpanded, setPasswordExpanded] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  // Sign out state
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setPasswordSubmitting(true);

    // Verify current password by re-authenticating
    const { error: verifyError } = await signIn(user!.email!, currentPassword);
    if (verifyError) {
      setPasswordError("Current password is incorrect");
      setPasswordSubmitting(false);
      return;
    }

    // Update password
    const { error: updateError } = await updatePassword(newPassword);
    if (updateError) {
      setPasswordError(updateError.message);
      setPasswordSubmitting(false);
      return;
    }

    setPasswordSuccess(true);
    setPasswordSubmitting(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");

    // Collapse after 2 seconds
    setTimeout(() => {
      setPasswordExpanded(false);
      setPasswordSuccess(false);
    }, 2000);
  };

  const handleDiscardPasswordChange = () => {
    setPasswordExpanded(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
    setPasswordSuccess(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

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

      {/* Account section */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
          Account
        </h2>

        {/* Change Password expandable row */}
        {!passwordExpanded ? (
          <button
            onClick={() => setPasswordExpanded(true)}
            className="w-full bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-left text-gray-900 dark:text-gray-100 min-h-12 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between"
          >
            <span>Change Password</span>
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 4.5l7.5 7.5-7.5 7.5"
              />
            </svg>
          </button>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <form onSubmit={handlePasswordChange}>
              <div className="mb-4">
                <label
                  htmlFor="currentPassword"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Current Password
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full min-h-12 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                />
              </div>

              <div className="mb-4">
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full min-h-12 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                />
              </div>

              <div className="mb-4">
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Confirm New Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full min-h-12 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                />
              </div>

              {passwordError && (
                <p
                  role="alert"
                  className="text-sm text-red-600 dark:text-red-400 mt-2"
                >
                  {passwordError}
                </p>
              )}

              {passwordSuccess && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                  Password updated successfully
                </p>
              )}

              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={handleDiscardPasswordChange}
                  className="min-h-12 rounded-lg px-4 py-3 text-gray-700 dark:text-gray-300"
                >
                  Discard Changes
                </button>
                <button
                  type="submit"
                  disabled={passwordSubmitting}
                  className="min-h-12 rounded-lg px-4 py-3 font-medium text-white bg-accent disabled:opacity-50"
                >
                  {passwordSubmitting ? (
                    <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full inline-block" />
                  ) : (
                    "Update Password"
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
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
        <button
          onClick={() => setShowSignOutConfirm(true)}
          className="w-full bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-left text-red-600 dark:text-red-400 min-h-12 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors mt-3"
        >
          Sign Out
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

      {/* Sign out confirmation */}
      <ConfirmDialog
        open={showSignOutConfirm}
        title="Sign Out"
        message="Sign out of your account? Your local data will be preserved."
        confirmLabel="Sign Out"
        cancelLabel="Stay Signed In"
        destructive
        onConfirm={handleSignOut}
        onCancel={() => setShowSignOutConfirm(false)}
      />
    </div>
  );
}
