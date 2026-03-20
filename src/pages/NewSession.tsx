import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { createSession } from "../db/sessions";
import { createBlankItem, updateItemField } from "../db/items";
import { useActiveSessions } from "../hooks/useSessions";
import { useUserRole } from "../hooks/useUserRole";
import { listAccounts, type Account } from "../services/adminApi";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ImportReceiptsButton } from "../components/ImportReceiptsButton";

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
  const { isAdmin, loading: roleLoading } = useUserRole();

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

      // Build toast message per CONTEXT.md locked decision
      const msg = `${receipts.length} item${receipts.length === 1 ? "" : "s"} created${skipped > 0 ? `, ${skipped} ${skipped === 1 ? "entry" : "entries"} skipped` : ""}`;

      // Store in sessionStorage so SessionDetail can show it after navigation
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
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        New Session
      </h1>

      {/* Session Name */}
      <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
        Session Name
      </label>
      <input
        ref={nameRef}
        type="text"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g., Smith Estate House Visit"
        className="w-full px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100
                   placeholder-gray-400 dark:placeholder-gray-500 border border-gray-200 dark:border-gray-700
                   focus:outline-none focus:ring-2 focus:ring-accent min-h-12 mb-6"
      />

      {/* Mode Picker */}
      <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        Cataloging Mode
      </label>
      <div className="grid gap-4 portrait:grid-cols-1 landscape:grid-cols-2 mb-6">
        {/* House Visit card */}
        <button
          type="button"
          onClick={() => setMode("house")}
          className={`flex items-start gap-4 p-5 rounded-xl border min-h-[80px] w-full text-left transition-colors
            ${
              mode === "house"
                ? "border-accent bg-accent/5 dark:bg-accent/10"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-accent dark:hover:border-accent"
            }`}
        >
          <svg
            className="w-8 h-8 text-accent shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
            />
          </svg>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
              House Visit
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Catalog items with photos during a house visit
            </p>
          </div>
        </button>

        {/* Sale Cataloging card */}
        <button
          type="button"
          onClick={() => setMode("sale")}
          className={`flex items-start gap-4 p-5 rounded-xl border min-h-[80px] w-full text-left transition-colors
            ${
              mode === "sale"
                ? "border-accent bg-accent/5 dark:bg-accent/10"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-accent dark:hover:border-accent"
            }`}
        >
          <svg
            className="w-8 h-8 text-accent shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
            />
          </svg>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Sale Cataloging
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter receipt numbers and dictate items for a sale
            </p>
          </div>
        </button>
      </div>

      {/* Notes */}
      <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
        Notes (optional)
      </label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Any notes about this session..."
        rows={3}
        className="w-full px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100
                   placeholder-gray-400 dark:placeholder-gray-500 border border-gray-200 dark:border-gray-700
                   focus:outline-none focus:ring-2 focus:ring-accent resize-none mb-6"
      />

      {/* Assign To - admin only */}
      {isAdmin && (
        <div className="mb-6">
          <label
            className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300"
            htmlFor="assign-to"
          >
            Assign To
          </label>
          <div className={`relative${accountsLoading ? " opacity-50" : ""}`}>
            <select
              id="assign-to"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              disabled={accountsLoading}
              className="w-full px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100
                         border border-gray-200 dark:border-gray-700
                         focus:outline-none focus:ring-2 focus:ring-accent min-h-12
                         appearance-none font-medium"
            >
              {accountsLoading ? (
                <option value="" disabled>
                  Loading...
                </option>
              ) : (
                <>
                  <option value="" disabled>
                    Select a specialist...
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
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
              />
            </svg>
          </div>
          {accountsError && (
            <p
              className="text-sm text-red-600 dark:text-red-400 mt-1"
              role="alert"
            >
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
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
            Upload a CSV or XLSX file with receipt numbers
          </p>
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!name.trim() || submitting || importing || (isAdmin && !assignedTo)}
        className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed
                   text-white font-medium py-3 px-8 rounded-lg min-h-12 flex items-center justify-center transition-colors"
      >
        {submitting ? "Creating..." : "Start Session"}
      </button>

      {/* Toast feedback */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-gray-800 dark:bg-gray-700 text-white px-4 py-3 rounded-xl shadow-lg animate-[slideUp_0.3s_ease-out]">
          <span className="text-sm">{toastMessage}</span>
        </div>
      )}

      {/* Active session warning */}
      <ConfirmDialog
        open={showActiveWarning}
        title="Active Session Exists"
        message="You have an open session -- start a new one anyway?"
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
