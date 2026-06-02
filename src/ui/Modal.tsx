import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "../hooks/useFocusTrap";

/**
 * Shared dialog primitive (Phase 37, D-02).
 *
 * Portals a scrim + centered panel to document.body, marks it
 * role="dialog" aria-modal="true", and wires useFocusTrap so Tab-wrap /
 * Escape / focus-restore are handled once for every migrated modal site.
 *
 * Accessible name: pass `ariaLabelledBy` (preferred — points at the panel
 * heading) or `ariaLabel`. One must be present.
 */

interface ModalProps {
  open: boolean;
  onClose: () => void;
  ariaLabelledBy?: string;
  ariaLabel?: string;
  children: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  /**
   * Override the scrim wrapper class. Modals that are not centered cards
   * (e.g. a bottom-sheet peek, or a full-screen splash) supply their own
   * layout while still inheriting the trap + ARIA + portal.
   */
  overlayClassName?: string;
  /** Override the panel class (defaults to the centered max-w-sm card). */
  panelClassName?: string;
  /**
   * When true, Modal does not paint its own scrim background — the caller's
   * overlayClassName owns the backdrop (splash/bottom-sheet looks).
   */
  bareOverlay?: boolean;
}

const DEFAULT_OVERLAY =
  "fixed inset-0 z-50 flex items-center justify-center p-4";
const DEFAULT_PANEL = "w-full max-w-sm rounded-xl bg-white p-6 dark:bg-gray-800";

function usePrefersReducedMotion(): boolean {
  const [pref, setPref] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = (e: MediaQueryListEvent) => setPref(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);
  return pref;
}

export function Modal({ open, ...rest }: ModalProps) {
  // WR-02: the focus trap (and its initial-focus + Escape wiring) lives in
  // ModalPanel, which Modal mounts ONLY when open is true. That ties the
  // useFocusTrap lifecycle to `open` — a kept-mounted Modal toggled
  // false→true remounts the panel and re-arms the trap, instead of calling
  // the hook unconditionally above an early `return null` (which never
  // re-armed because panelRef is always stable).
  if (!open) return null;
  return <ModalPanel {...rest} />;
}

function ModalPanel({
  onClose,
  ariaLabelledBy,
  ariaLabel,
  children,
  initialFocusRef,
  overlayClassName = DEFAULT_OVERLAY,
  panelClassName = DEFAULT_PANEL,
  bareOverlay = false,
}: Omit<ModalProps, "open">) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = usePrefersReducedMotion();

  useFocusTrap(panelRef, { onClose, initialFocusRef });

  return createPortal(
    <div
      className={overlayClassName}
      style={
        bareOverlay
          ? undefined
          : { background: "color-mix(in oklch, var(--bg-3) 60%, transparent)" }
      }
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        aria-label={ariaLabelledBy ? undefined : ariaLabel}
        onClick={(e) => e.stopPropagation()}
        className={panelClassName}
        style={reduceMotion ? undefined : { transition: "opacity 150ms" }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
