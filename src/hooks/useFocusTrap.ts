import { useEffect, useRef, type RefObject } from "react";

/**
 * Zero-dependency focus trap for modal dialogs (Phase 37, D-01).
 *
 * Owns the four load-bearing modal-focus behaviors:
 *  - initial focus into the panel on mount (first focusable, or `initialFocusRef`,
 *    or the panel itself as a tabindex=-1 fallback),
 *  - Tab / Shift+Tab cycling confined to the panel's focusables,
 *  - Escape → onClose(),
 *  - focus restoration to the opener on unmount.
 *
 * No focus-trap library (forbidden by D-01); ~80 LOC is tractable.
 */

// Canonical APG focusable selector (37-RESEARCH Pattern 1).
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

interface UseFocusTrapOptions {
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

function isVisible(el: HTMLElement): boolean {
  // jsdom doesn't compute layout (offsetParent is always null), so we exclude
  // only elements that are explicitly hidden rather than relying on geometry.
  if (el.hidden || el.getAttribute("aria-hidden") === "true") return false;
  const style = el.ownerDocument.defaultView?.getComputedStyle(el);
  if (style && (style.display === "none" || style.visibility === "hidden")) {
    return false;
  }
  return true;
}

function getFocusable(panel: HTMLElement): HTMLElement[] {
  // Recomputed on EACH keydown (Pitfall 2): content can change (textareas,
  // conditional buttons) after mount, so a cached list would let Tab escape.
  return Array.from(
    panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(isVisible);
}

export function useFocusTrap(
  panelRef: RefObject<HTMLElement | null>,
  { onClose, initialFocusRef }: UseFocusTrapOptions,
): void {
  // CR-01: hold the live onClose in a ref so the keydown handler always calls
  // the latest closure WITHOUT putting onClose in the effect deps. Callers pass
  // a fresh onClose each render (inline arrows); keeping it in deps tore down
  // and re-armed the trap on every parent re-render, stealing focus back to the
  // initial element mid-interaction and corrupting the focus-restore target.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    // Save the opener so we can restore focus on unmount (Pitfall 4).
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Initial focus: explicit ref → first focusable → panel itself.
    const initial = initialFocusRef?.current ?? getFocusable(panel)[0];
    if (initial) {
      initial.focus();
    } else {
      panel.setAttribute("tabindex", "-1");
      panel.focus();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = getFocusable(panel!);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !panel!.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !panel!.contains(active)) {
        // IN-02: mirror the Shift+Tab out-of-panel guard so a forward Tab from
        // outside the panel (e.g. focus moved programmatically) is re-trapped.
        event.preventDefault();
        first.focus();
      }
    }

    panel.addEventListener("keydown", onKeyDown);
    return () => {
      panel.removeEventListener("keydown", onKeyDown);
      // Restore focus only to a still-connected opener (delete flow can remove
      // the trigger — never .focus() a detached node).
      if (previouslyFocused && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [panelRef, initialFocusRef]);
}
