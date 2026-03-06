import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { createSession } from "../db/sessions";
import { useActiveSessions } from "../hooks/useSessions";
import { ConfirmDialog } from "../components/ConfirmDialog";

type Mode = "house" | "sale";

export function NewSessionPage() {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<Mode>("house");
  const [notes, setNotes] = useState("");
  const [showActiveWarning, setShowActiveWarning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const activeSessions = useActiveSessions();

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    if (!name.trim() || submitting) return;

    // Check for existing active sessions
    if (activeSessions.length > 0 && !showActiveWarning) {
      setShowActiveWarning(true);
      return;
    }

    await doCreate();
  };

  const doCreate = async () => {
    setSubmitting(true);
    try {
      const newId = await createSession(name.trim(), mode, notes.trim() || undefined);
      navigate(`/session/${newId}`);
    } finally {
      setSubmitting(false);
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
                   focus:outline-none focus:ring-2 focus:ring-accent resize-none mb-8"
      />

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!name.trim() || submitting}
        className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed
                   text-white font-medium py-3 px-8 rounded-lg min-h-12 flex items-center justify-center transition-colors"
      >
        {submitting ? "Creating..." : "Start Session"}
      </button>

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
