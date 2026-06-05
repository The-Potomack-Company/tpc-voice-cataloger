import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Icon } from "./icons";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

/**
 * Overflow (⋯) menu primitive (Phase 37, D-03).
 *
 * A keyboard- and screen-reader-reachable icon-button that opens a small menu
 * of row actions (Delete this phase; the API leaves room for more). It is the
 * accessible-equivalent of the swipe-to-delete gesture — the swipe stays as a
 * power-user shortcut, this is the path keyboard/AT users can actually use.
 *
 * Hand-rolled per D-03 (no Radix/headlessui). Trigger follows the APG
 * menu-button pattern (aria-haspopup + aria-expanded); Escape closes the menu
 * and restores focus to the trigger; items carry tpc-btn so they inherit the
 * class-scoped A11Y-02 focus ring (there is no generic *:focus-visible rule).
 */

export interface OverflowAction {
  label: string;
  onSelect: () => void;
  /** Destructive actions render with --err ink (UI-SPEC). */
  destructive?: boolean;
}

interface OverflowMenuProps {
  actions: OverflowAction[];
  /** Accessible name + tooltip for the trigger (UI-SPEC copy contract). */
  label?: string;
}

export function OverflowMenu({
  actions,
  label = "More actions",
}: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const reduceMotion = usePrefersReducedMotion();

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  // Focus the first item when the menu opens (keyboard reachability).
  useEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    first?.focus();
  }, [open]);

  // Close on outside click / focus leaving the menu region.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (
        !menuRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    // WR-01: the Arrow branches compute `% items.length`; an empty menu would
    // make that NaN. Bail before any index arithmetic (also documents the
    // never-empty invariant for this reusable primitive).
    if (items.length === 0) return;
    const activeIndex = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(activeIndex + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(activeIndex - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Tab") {
      // Tabbing out closes the menu without stealing focus back.
      close(false);
    }
  };

  const menuStyle: CSSProperties = {
    background: "var(--bg)",
    border: "1px solid var(--rule)",
    transition: reduceMotion ? undefined : "opacity 120ms",
  };

  return (
    <div className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={onTriggerKeyDown}
        className="tpc-btn tpc-btn-ghost min-h-11 min-w-11 flex items-center justify-center"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
      >
        <Icon name="dots" size={18} aria-hidden />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-full z-50 mt-1 min-w-[10rem] rounded-lg py-1 shadow-lg"
          style={menuStyle}
        >
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                action.onSelect();
              }}
              className="tpc-btn tpc-btn-ghost tpc-btn-fullwidth flex items-center justify-start gap-2 px-3 py-2 text-sm"
              style={action.destructive ? { color: "var(--err)" } : undefined}
            >
              {action.destructive && (
                <Icon name="trash" size={15} aria-hidden />
              )}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
