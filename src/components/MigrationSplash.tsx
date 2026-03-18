import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface MigrationSplashProps {
  state: "in-progress" | "complete" | "error";
  current: number;
  total: number;
  skipped: number;
  onRetry: () => void;
  onSkip: () => void;
  onComplete: () => void;
}

export function MigrationSplash({
  state,
  current,
  total,
  skipped,
  onRetry,
  onSkip,
  onComplete,
}: MigrationSplashProps) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (state !== "complete") return;

    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, 1500);

    const dismissTimer = setTimeout(() => {
      setVisible(false);
      onComplete();
    }, 1800); // 1500ms wait + 300ms fade

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(dismissTimer);
    };
  }, [state, onComplete]);

  if (!visible) return null;

  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  const heading =
    state === "complete"
      ? "Migration complete"
      : state === "error"
        ? "Migration incomplete"
        : "Migrating your data";

  const body =
    state === "complete"
      ? "All sessions are now synced to the server."
      : state === "error"
        ? `${skipped} items could not be migrated. Your data is safe -- you can retry now or continue and retry later from Settings.`
        : "Moving your sessions to the server. This only happens once.";

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-gray-900 transition-opacity duration-300 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Data migration in progress"
    >
      <div className="max-w-sm mx-4 text-center">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          {heading}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{body}</p>
        <div
          className="mt-8 w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700"
          role="progressbar"
          aria-valuenow={current}
          aria-valuemax={total}
          aria-label="Migration progress"
        >
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${state === "complete" ? 100 : percent}%` }}
          />
        </div>
        {state !== "error" && (
          <p className="text-sm text-gray-500 mt-3">
            {current} of {total} items
          </p>
        )}
        {state === "error" && (
          <div className="mt-6 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={onRetry}
              className="min-h-12 rounded-lg px-6 py-3 font-medium text-white bg-accent"
            >
              Retry Migration
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="min-h-12 px-4 py-3 text-gray-500 dark:text-gray-400"
            >
              Skip and Continue
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
