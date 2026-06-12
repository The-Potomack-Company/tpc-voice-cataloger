import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { createSession } from "../db/sessions";
import { useNotificationStore } from "../stores/notificationStore";
import { useActiveSessions } from "../hooks/useSessions";
import { useUserRole } from "../hooks/useUserRole";
import { listAccounts, type Account } from "../services/adminApi";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Eyebrow } from "../ui/Eyebrow";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";

export function NewSessionPage() {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [showActiveWarning, setShowActiveWarning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const activeSessions = useActiveSessions();
  const { isAdmin } = useUserRole();
  const noAssignableAccounts = isAdmin && !accountsLoading && !accountsError && accounts.length === 0;

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Load accounts for admin specialist dropdown
  useEffect(() => {
    if (!isAdmin) return;
    setAccountsLoading(true);
    setAccountsError(null);
    listAccounts()
      .then((data) => {
        const active = data
          .filter((a) => a.is_active)
          .sort((a, b) => a.display_name.localeCompare(b.display_name));
        setAccounts(active);
      })
      .catch(() => {
        setAccountsError(
          "Could not load team members. Check your connection and try again.",
        );
      })
      .finally(() => {
        setAccountsLoading(false);
      });
  }, [isAdmin]);

  const handleSubmit = async () => {
    if (!name.trim() || submitting) return;

    // Check for existing active sessions (admins always create while others are active)
    if (!isAdmin && activeSessions.length > 0 && !showActiveWarning) {
      setShowActiveWarning(true);
      return;
    }

    await doCreate();
  };

  const doCreate = async () => {
    setSubmitting(true);
    try {
      const newId = await createSession(
        name.trim(),
        "sale",
        notes.trim() || undefined,
        isAdmin ? assignedTo : undefined,
      );
      navigate(`/session/${newId}`);
    } catch {
      // Surface the failure instead of dying silently; navigation only on success.
      // UI-SPEC copy overrides toUserMessage's generic for this known operation.
      useNotificationStore
        .getState()
        .notifyError(
          "Couldn't create the session — nothing was saved. Try again.",
          () => doCreate(),
        );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="portrait:px-4 landscape:px-8 landscape:max-w-3xl landscape:mx-auto py-6">
      {/* Eyebrow + display title */}
      <header className="mb-6">
        <Eyebrow>The Potomack Co.</Eyebrow>
        <h1 className="tpc-display tpc-display-2 mt-1 text-ink">New Session</h1>
      </header>

      {/* Session Name */}
      <div className="mb-6">
        <Input
          ref={nameRef}
          label="Session Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. June Fine Sale"
        />
      </div>

      {/* Cataloging mode */}
      <div className="mb-6">
        <Eyebrow className="mb-2">Cataloging Mode</Eyebrow>
        <div className="tpc-card-mode tpc-card-mode-sale" aria-label="Sale Cataloging">
          <div className="flex items-center gap-3">
            <span className="tpc-mode-tile tpc-mode-tile-sale" aria-hidden>
              S
            </span>
            <div>
              <div className="tpc-display tpc-display-4 text-ink">Sale Cataloging</div>
              <p className="text-sm text-ink-3 mt-0.5">
                Enter receipt numbers and dictate items for a sale
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="mb-6">
        <Eyebrow className="mb-1">Notes (optional)</Eyebrow>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any notes about this session…"
          rows={3}
          className="tpc-input resize-none"
        />
      </div>

      {/* Assign To - admin only */}
      {isAdmin && (
        <div className="mb-6">
          <Eyebrow className="mb-1">Assign To</Eyebrow>
          <div className={`relative${accountsLoading ? " opacity-50" : ""}`}>
            <select
              id="assign-to"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              disabled={accountsLoading || accounts.length === 0}
              className="tpc-input appearance-none pr-9 font-medium"
            >
              {accountsLoading ? (
                <option value="" disabled>
                  Loading…
                </option>
              ) : (
                <>
                  <option value="" disabled>
                    {accounts.length === 0 ? "No team profiles available" : "Select a specialist…"}
                  </option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.display_name}
                    </option>
                  ))}
                </>
              )}
            </select>
            <svg
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
              />
            </svg>
          </div>
          {accountsError && (
            <p className="text-sm text-err mt-1" role="alert">
              {accountsError}
            </p>
          )}
          {noAssignableAccounts && (
            <p className="text-sm text-ink-3 mt-1" role="status">
              No active team profiles yet. Seed staff profiles before assigning sessions.
            </p>
          )}
        </div>
      )}

      {/* Submit */}
      <Button
        type="button"
        variant="primary"
        fullWidth
        onClick={handleSubmit}
        disabled={!name.trim() || submitting || (isAdmin && !assignedTo)}
      >
        {submitting ? "Creating…" : "Start Session"}
      </Button>

      {/* Active session warning */}
      <ConfirmDialog
        open={showActiveWarning}
        title="Active Session Exists"
        message="You have an open session — start a new one anyway?"
        confirmLabel="Start New"
        cancelLabel="Go Back"
        onConfirm={() => {
          setShowActiveWarning(false);
          doCreate();
        }}
        onCancel={() => setShowActiveWarning(false)}
      />
    </div>
  );
}
