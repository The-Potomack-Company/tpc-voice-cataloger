import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { createSession } from "../db/sessions";
import { createBlankItem, updateItemField } from "../db/items";
import { useActiveSessions } from "../hooks/useSessions";
import { useUserRole } from "../hooks/useUserRole";
import { listAccounts, type Account } from "../services/adminApi";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ImportReceiptsButton } from "../components/ImportReceiptsButton";
import { Eyebrow } from "../ui/Eyebrow";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";

type Mode = "house" | "sale";

export function NewSessionPage() {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<Mode>("house");
  const [notes, setNotes] = useState("");
  const [showActiveWarning, setShowActiveWarning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const activeSessions = useActiveSessions();
  const { isAdmin } = useUserRole();

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

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

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
        mode,
        notes.trim() || undefined,
        isAdmin ? assignedTo : undefined,
      );
      navigate(`/session/${newId}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleImport = async (receipts: string[], skipped: number) => {
    if (receipts.length === 0) {
      setToastMessage("No valid receipt numbers found in file");
      return;
    }

    setImporting(true);
    try {
      const sessionId = await createSession(
        name.trim(),
        "sale",
        notes.trim() || undefined,
        isAdmin ? assignedTo : undefined,
      );

      for (const receipt of receipts) {
        const itemId = await createBlankItem(sessionId, "sale");
        await updateItemField(itemId, sessionId, "receipt_number", receipt);
      }

      const msg = `${receipts.length} item${receipts.length === 1 ? "" : "s"} created${skipped > 0 ? `, ${skipped} ${skipped === 1 ? "entry" : "entries"} skipped` : ""}`;
      sessionStorage.setItem("importToast", msg);
      navigate(`/session/${sessionId}`);
    } catch (err) {
      console.error("Import failed:", err);
      setToastMessage("Import failed. Please try again.");
    } finally {
      setImporting(false);
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
          placeholder="e.g. Smith Estate House Visit"
        />
      </div>

      {/* Mode Picker — paired accent-wash / sand-wash tiles */}
      <div className="mb-6">
        <Eyebrow className="mb-2">Cataloging Mode</Eyebrow>
        <div className="grid gap-3 portrait:grid-cols-1 landscape:grid-cols-2">
          {/* House Visit card */}
          <button
            type="button"
            onClick={() => setMode("house")}
            aria-pressed={mode === "house"}
            className="tpc-card-mode tpc-card-mode-house"
          >
            <div className="flex items-center gap-3">
              <span className="tpc-mode-tile tpc-mode-tile-house" aria-hidden>
                H
              </span>
              <div>
                <div className="tpc-display tpc-display-4 text-ink">House Visit</div>
                <p className="text-sm text-ink-3 mt-0.5">
                  Catalog items with photos during a house visit
                </p>
              </div>
            </div>
          </button>

          {/* Sale Cataloging card */}
          <button
            type="button"
            onClick={() => setMode("sale")}
            aria-pressed={mode === "sale"}
            className="tpc-card-mode tpc-card-mode-sale"
          >
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
          </button>
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
              disabled={accountsLoading}
              className="tpc-input appearance-none pr-9 font-medium"
            >
              {accountsLoading ? (
                <option value="" disabled>
                  Loading…
                </option>
              ) : (
                <>
                  <option value="" disabled>
                    Select a specialist…
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
        </div>
      )}

      {/* Import Receipt List - only in sale mode */}
      {mode === "sale" && (
        <div className="mb-6">
          <ImportReceiptsButton
            onImport={handleImport}
            disabled={!name.trim() || importing || submitting || (isAdmin && !assignedTo)}
          />
          <p className="text-xs text-ink-4 mt-2 text-center">
            Upload a CSV or XLSX file with receipt numbers
          </p>
        </div>
      )}

      {/* Submit */}
      <Button
        type="button"
        variant="primary"
        fullWidth
        onClick={handleSubmit}
        disabled={!name.trim() || submitting || importing || (isAdmin && !assignedTo)}
      >
        {submitting ? "Creating…" : "Start Session"}
      </Button>

      {/* Toast feedback */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-ink text-bg px-4 py-3 rounded-md shadow-lg animate-[slideUp_0.3s_ease-out]">
          <span className="text-sm">{toastMessage}</span>
        </div>
      )}

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
