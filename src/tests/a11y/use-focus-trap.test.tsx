import { describe, it, expect, vi, beforeEach } from "vitest";
import { useRef, useState } from "react";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useFocusTrap } from "../../hooks/useFocusTrap";

beforeEach(() => cleanup());

/**
 * Minimal panel harness driving the hook. Mounts after a trigger button so we
 * can assert focus restoration to the opener on unmount.
 */
function TrapHarness({
  onClose,
  withInitialRef = false,
  removeTriggerBeforeClose = false,
}: {
  onClose: () => void;
  withInitialRef?: boolean;
  removeTriggerBeforeClose?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [triggerGone, setTriggerGone] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const secondBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <div>
      {!triggerGone && (
        <button data-testid="trigger" onClick={() => setOpen(true)}>
          open
        </button>
      )}
      {open && (
        <Panel
          panelRef={panelRef}
          initialFocusRef={withInitialRef ? secondBtnRef : undefined}
          secondBtnRef={secondBtnRef}
          onClose={() => {
            if (removeTriggerBeforeClose) setTriggerGone(true);
            setOpen(false);
            onClose();
          }}
        />
      )}
    </div>
  );
}

function Panel({
  panelRef,
  secondBtnRef,
  initialFocusRef,
  onClose,
}: {
  panelRef: React.RefObject<HTMLDivElement | null>;
  secondBtnRef: React.RefObject<HTMLButtonElement | null>;
  initialFocusRef?: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  useFocusTrap(panelRef, { onClose, initialFocusRef });
  return (
    <div ref={panelRef} data-testid="panel">
      <button data-testid="first">first</button>
      <button ref={secondBtnRef} data-testid="second">
        second
      </button>
      <button data-testid="last" onClick={onClose}>
        last
      </button>
    </div>
  );
}

describe("useFocusTrap", () => {
  it("focuses the first focusable in the panel on mount", async () => {
    const user = userEvent.setup();
    render(<TrapHarness onClose={vi.fn()} />);
    await user.click(screen.getByTestId("trigger"));
    expect(screen.getByTestId("first")).toHaveFocus();
  });

  it("honors initialFocusRef when provided", async () => {
    const user = userEvent.setup();
    render(<TrapHarness onClose={vi.fn()} withInitialRef />);
    await user.click(screen.getByTestId("trigger"));
    expect(screen.getByTestId("second")).toHaveFocus();
  });

  it("Tab on the last focusable wraps to the first", async () => {
    const user = userEvent.setup();
    render(<TrapHarness onClose={vi.fn()} />);
    await user.click(screen.getByTestId("trigger"));
    screen.getByTestId("last").focus();
    await user.tab();
    expect(screen.getByTestId("first")).toHaveFocus();
  });

  it("Shift+Tab on the first focusable wraps to the last", async () => {
    const user = userEvent.setup();
    render(<TrapHarness onClose={vi.fn()} />);
    await user.click(screen.getByTestId("trigger"));
    screen.getByTestId("first").focus();
    await user.tab({ shift: true });
    expect(screen.getByTestId("last")).toHaveFocus();
  });

  it("Escape calls onClose", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<TrapHarness onClose={onClose} />);
    await user.click(screen.getByTestId("trigger"));
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("restores focus to the trigger when the panel unmounts", async () => {
    const user = userEvent.setup();
    render(<TrapHarness onClose={vi.fn()} />);
    const trigger = screen.getByTestId("trigger");
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
  });

  it("does not throw when the trigger was removed before close", async () => {
    const user = userEvent.setup();
    render(<TrapHarness onClose={vi.fn()} removeTriggerBeforeClose />);
    await user.click(screen.getByTestId("trigger"));
    // Closing removes the trigger from the DOM; restore must not throw / focus a detached node.
    await expect(user.keyboard("{Escape}")).resolves.toBeUndefined();
    expect(screen.queryByTestId("trigger")).toBeNull();
    expect(document.activeElement).not.toBe(null);
  });
});
