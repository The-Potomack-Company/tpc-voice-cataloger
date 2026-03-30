import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuthStore } from "../stores/authStore";
import { useWalkthroughStatus } from "../components/walkthrough/useWalkthroughStatus";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { supabase } from "../lib/supabase";

export function SettingsPage() {
  const { resetWalkthrough } = useWalkthroughStatus();

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

  // Admin role detection
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.role === "admin") setIsAdmin(true);
      });
  }, [user]);

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
            TPC Catalog v1.1
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Speech-to-catalog tool for auctioneers
          </p>
        </div>
      </section>

      {/* Admin section (admin-only) */}
      {isAdmin && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
            Admin
          </h2>
          <button
            onClick={() => navigate("/admin/accounts")}
            className="w-full bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-left text-gray-900 dark:text-gray-100 min-h-12 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between"
          >
            <span>Account Management</span>
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
        </section>
      )}

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
