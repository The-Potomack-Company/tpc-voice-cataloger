import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuthStore } from "../stores/authStore";
import { useWalkthroughStatus } from "../components/walkthrough/useWalkthroughStatus";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { isFirebaseAuthBackend } from "../lib/authBackend";
import { useUserRole } from "../hooks/useUserRole";
import { ThemePicker } from "../ui/ThemePicker";
import { Eyebrow } from "../ui/Eyebrow";
import { Badge } from "../ui/Badge";
import { Input } from "../ui/Input";

export function SettingsPage() {
  const { resetWalkthrough } = useWalkthroughStatus();

  // Auth store hooks
  const user = useAuthStore((s) => s.user);
  const signIn = useAuthStore((s) => s.signIn);
  const signOut = useAuthStore((s) => s.signOut);
  const updatePassword = useAuthStore((s) => s.updatePassword);
  const isFirebaseAuth = isFirebaseAuthBackend();
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

  const { isAdmin } = useUserRole();

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
    <div className="tpc-page">
      <header className="mb-6">
        <Eyebrow>Setup</Eyebrow>
        <h1 className="tpc-display tpc-display-2 mt-1 text-ink">Settings</h1>
        <p className="mt-1 text-sm text-ink-3">
          Install, appearance, account, and admin controls.
        </p>
      </header>

      {/* Appearance section (Phase 25) */}
      <section className="tpc-section mb-6">
        <div className="tpc-section-head">
          <Eyebrow>Appearance</Eyebrow>
        </div>
        <div className="tpc-panel">
          <ThemePicker />
          <p className="text-xs text-ink-3">
            Choose Light, Dark, or System (follows your OS).
          </p>
        </div>
      </section>

      {/* About section */}
      <section className="tpc-section mb-6">
        <div className="tpc-section-head">
          <Eyebrow>About</Eyebrow>
        </div>
        <div className="tpc-panel">
          <p className="text-ink font-medium">
            TPC Catalog v1.1
          </p>
          <p className="text-sm text-ink-3 mt-1">
            Speech-to-catalog tool for auctioneers
          </p>
        </div>
      </section>

      {/* Admin section (admin-only) */}
      {isAdmin && (
        <section className="tpc-section mb-6">
          <div className="tpc-section-head">
            <Eyebrow>Admin</Eyebrow>
          </div>
          <div className="tpc-panel">
          <button
            onClick={() => navigate("/admin/accounts")}
            className="w-full rounded-md border border-rule bg-bg p-4 text-left text-ink min-h-12 hover:bg-bg-2 transition-colors flex items-center justify-between"
          >
            <span>Account Management</span>
            <svg
              className="w-5 h-5 text-ink-3"
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
          </div>
        </section>
      )}

      {/* Storage section */}
      <section className="tpc-section mb-6">
        <div className="tpc-section-head">
          <Eyebrow>Storage</Eyebrow>
        </div>
        <div className="tpc-panel">
          <div className="flex items-center justify-between">
            <span className="text-ink">Database</span>
            <Badge tone="ok">Active</Badge>
          </div>
        </div>
      </section>

      {/* Account section */}
      {!isFirebaseAuth && (
      <section className="tpc-section mb-6">
        <div className="tpc-section-head">
          <Eyebrow>Account</Eyebrow>
        </div>
        <div className="tpc-panel">

        {/* Change Password expandable row */}
        {!passwordExpanded ? (
          <button
            onClick={() => setPasswordExpanded(true)}
            className="w-full rounded-md border border-rule bg-bg p-4 text-left text-ink min-h-12 hover:bg-bg-2 transition-colors flex items-center justify-between"
          >
            <span>Change Password</span>
            <svg
              className="w-5 h-5 text-ink-3"
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
          <div className="rounded-md border border-rule bg-bg p-4">
            <form onSubmit={handlePasswordChange} className="flex flex-col gap-4">
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                label="Current Password"
              />
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                label="New Password"
              />
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                label="Confirm New Password"
              />

              {passwordError && (
                <p
                  role="alert"
                  className="text-sm text-err"
                >
                  {passwordError}
                </p>
              )}

              {passwordSuccess && (
                <p className="text-sm text-ok">
                  Password updated successfully
                </p>
              )}

              <div className="flex justify-end gap-3 mt-1">
                <button
                  type="button"
                  onClick={handleDiscardPasswordChange}
                  className="tpc-btn tpc-btn-ghost min-h-12"
                >
                  Discard Changes
                </button>
                <button
                  type="submit"
                  disabled={passwordSubmitting}
                  className="tpc-btn tpc-btn-primary min-h-12 disabled:opacity-50"
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
        </div>
      </section>
      )}

      {/* Actions section */}
      <section className="tpc-section">
        <div className="tpc-section-head">
          <Eyebrow>Actions</Eyebrow>
        </div>
        <div className="tpc-panel">
        <button
          onClick={resetWalkthrough}
          className="w-full rounded-md border border-rule bg-bg p-4 text-left
                     text-ink min-h-12
                     hover:bg-bg-2 transition-colors"
        >
          Reset Walkthrough
        </button>
        <button
          onClick={() => setShowSignOutConfirm(true)}
          className="w-full rounded-md border border-rule bg-bg p-4 text-left text-err min-h-12 hover:bg-bg-2 transition-colors"
        >
          Sign Out
        </button>
        </div>
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
