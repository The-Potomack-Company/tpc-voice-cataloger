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
}

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

export function Modal({
  open,
  onClose,
  ariaLabelledBy,
  ariaLabel,
  children,
  initialFocusRef,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = usePrefersReducedMotion();

  useFocusTrap(panelRef, { onClose, initialFocusRef });

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "color-mix(in oklch, var(--bg-3) 60%, transparent)" }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        aria-label={ariaLabelledBy ? undefined : ariaLabel}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl bg-white p-6 dark:bg-gray-800"
        style={reduceMotion ? undefined : { transition: "opacity 150ms" }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
