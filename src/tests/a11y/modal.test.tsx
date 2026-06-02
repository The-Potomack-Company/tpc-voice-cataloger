import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { Modal } from "../../ui/Modal";

beforeEach(() => cleanup());

function OpenModal({ onClose = vi.fn() }: { onClose?: () => void }) {
  return (
    <Modal open onClose={onClose} ariaLabelledBy="modal-title">
      <h2 id="modal-title">Delete item</h2>
      <p>Are you sure?</p>
      <button type="button">Cancel</button>
      <button type="button">Delete</button>
    </Modal>
  );
}

describe("Modal", () => {
  it("renders role=dialog with aria-modal=true and an accessible name", () => {
    render(<OpenModal />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    // accessible name resolves via aria-labelledby → heading text
    expect(dialog).toHaveAccessibleName("Delete item");
  });

  it("renders nothing when open is false", () => {
    render(
      <Modal open={false} onClose={vi.fn()} ariaLabel="hidden">
        <p>body</p>
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("supports ariaLabel when no heading id is available", () => {
    render(
      <Modal open onClose={vi.fn()} ariaLabel="Quick menu">
        <button type="button">x</button>
      </Modal>,
    );
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Quick menu");
  });

  it("Escape closes the modal (via useFocusTrap)", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<OpenModal onClose={onClose} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("has no axe violations (portaled content scanned on document.body)", async () => {
    render(<OpenModal />);
    const results = await axe(document.body, {
      rules: { "color-contrast": { enabled: false } }, // jsdom can't paint (Pitfall 3)
    });
    expect(results).toHaveNoViolations();
  });
});
