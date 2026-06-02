import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

interface MigrationSplashProps {
  // SC3/D-07: "partial" is a first-class state — a run that skipped items must
  // never reuse the "complete" success copy.
  state: "in-progress" | "partial" | "complete" | "error";
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
  onRetry,
  onSkip,
  onComplete,
}: MigrationSplashProps) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  // CR-01: latch the Retry button the instant it is clicked so a fast double
  // click cannot fire onRetry twice before the re-render to "in-progress"
  // unmounts the button. The hook's runningRef is the real guard; this is the
  // UI-side belt-and-suspenders that keeps a single tick from dispatching two
  // onRetry calls. Behavior is otherwise identical (D-08).
  const [retryDispatching, setRetryDispatching] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = usePrefersReducedMotion();

  // IN-03: hold onComplete in a ref so an unstable parent closure does not
  // re-arm the auto-dismiss timers (which would delay/restart the dismiss).
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Fold the real focus trap in (D-02) — the splash already declared
  // role=dialog/aria-modal but had no trap. It is a blocking splash with no
  // user-driven close, so Escape is normally swallowed (no-op onClose).
  // WR-05: the error state does NOT auto-dismiss, so map Escape to onSkip
  // ("continue anyway") there to avoid a keyboard dead-end.
  useFocusTrap(panelRef, {
    onClose: state === "error" ? onSkip : () => {},
  });

  useEffect(() => {
    // SC3/D-07: partial auto-dismisses like complete — P36 adds no retry button
    // for partial, so leaving the modal pinned would trap the user.
    if (state !== "complete" && state !== "partial") return;

    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, 1500);

    const dismissTimer = setTimeout(() => {
      setVisible(false);
      onCompleteRef.current();
    }, 1800); // 1500ms wait + 300ms fade

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(dismissTimer);
    };
  }, [state]);

  if (!visible) return null;

  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  const heading =
    state === "complete"
      ? "Migration complete"
      : state === "partial"
        ? "Migration incomplete"
        : state === "error"
          ? "Migration incomplete"
          : "Migrating your data";

  // SC3/D-07: honest partial copy from the DAT-1 `partial` flag. P36 deliberately
  // adds NO retry/Settings flow here — that is Phase 38's banner. The success
  // string is reachable ONLY on a true clean run (state === "complete").
  const body =
    state === "complete"
      ? "All sessions are now synced to the server."
      : state === "partial"
        ? "Some items couldn't be migrated. Your data is safe."
        : state === "error"
          ? // WR-05: the error state is set in useDataMigration's catch, which
            // never updates `skipped` (stays 0 on a fresh run that throws), so a
            // count here read as a clean run. Assert no count instead.
            "Migration didn't finish. Your data is safe — retry now or continue."
          : "Moving your sessions to the server. This only happens once.";

  return createPortal(
    <div
      ref={panelRef}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-gray-900 ${
        reduceMotion ? "" : "transition-opacity duration-300 "
      }${fading && !reduceMotion ? "opacity-0" : "opacity-100"}`}
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
            style={{
              width: `${state === "complete" || state === "partial" ? 100 : percent}%`,
            }}
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
              onClick={() => {
                if (retryDispatching) return;
                setRetryDispatching(true);
                onRetry();
              }}
              disabled={retryDispatching}
              aria-busy={retryDispatching}
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
