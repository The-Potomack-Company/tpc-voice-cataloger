import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ReturnDialog } from "../../components/ReturnDialog";
import { ItemPeekModal } from "../../components/ItemPeekModal";
import type { Tables } from "../../db/database.types";

// PhotoLightbox pulls a photo display URL off Dexie + Supabase; stub both so the
// lightbox renders an <img> without touching IndexedDB or the network.
vi.mock("dexie-react-hooks", () => ({ useLiveQuery: () => undefined }));
vi.mock("../../hooks/usePhotoUrl", () => ({
  usePhotoUrl: () => "blob:mock-photo",
}));

import { PhotoLightbox } from "../../components/PhotoLightbox";
import { MigrationSplash } from "../../components/MigrationSplash";
import type { ItemPhoto } from "../../db/types";

beforeEach(() => cleanup());

const AXE_OPTS = { rules: { "color-contrast": { enabled: false } } } as const;

const peekItem = {
  id: "item-1",
  sort_order: 0,
  receipt_number: "R-100",
  title: "Brass lamp",
  description: "A nice lamp",
  condition: "Good",
  estimate: "$50",
  measurements: "10cm",
  category: "Lighting",
} as unknown as Tables<"items">;

describe("ConfirmDialog (migrated to <Modal>)", () => {
  it("renders role=dialog + aria-modal=true with an accessible name", () => {
    render(
      <ConfirmDialog
        open
        title="Delete item"
        message="Sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("Delete item");
  });

  it("Escape calls onCancel (non-destructive)", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        open
        title="Delete item"
        message="Sure?"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("keeps the destructive red-button branch", () => {
    render(
      <ConfirmDialog
        open
        title="Delete item"
        message="Sure?"
        confirmLabel="Delete"
        destructive
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("Delete").className).toContain("bg-red-500");
  });

  it("has no axe violations", async () => {
    render(
      <ConfirmDialog
        open
        title="Delete item"
        message="Sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(await axe(document.body, AXE_OPTS)).toHaveNoViolations();
  });
});

describe("ReturnDialog (migrated to <Modal>)", () => {
  it("renders role=dialog + aria-modal with an accessible name", () => {
    render(
      <ReturnDialog
        open
        sessionName="Session A"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("Return to Specialist");
  });

  it("focuses the textarea on open", () => {
    render(
      <ReturnDialog
        open
        sessionName="Session A"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText("Review notes (optional)")).toHaveFocus();
  });

  it("Escape calls onCancel", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <ReturnDialog
        open
        sessionName="Session A"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("has no axe violations", async () => {
    render(
      <ReturnDialog
        open
        sessionName="Session A"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(await axe(document.body, AXE_OPTS)).toHaveNoViolations();
  });
});

describe("ItemPeekModal (migrated to <Modal> — biggest prior gap)", () => {
  it("renders role=dialog + aria-modal with an accessible name (previously absent)", () => {
    render(<ItemPeekModal item={peekItem} onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName(/Brass lamp|R-100/);
  });

  it("Escape calls onClose (previously close-button only)", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ItemPeekModal item={peekItem} onClose={onClose} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("close button is a >=44px target", () => {
    render(<ItemPeekModal item={peekItem} onClose={vi.fn()} />);
    const closeBtn = screen.getByRole("button", { name: "Close item preview" });
    expect(closeBtn.className).toMatch(/min-h-11/);
    expect(closeBtn.className).toMatch(/min-w-11/);
  });

  it("has no axe violations", async () => {
    render(<ItemPeekModal item={peekItem} onClose={vi.fn()} />);
    expect(await axe(document.body, AXE_OPTS)).toHaveNoViolations();
  });

  it("renders nothing when item is null", () => {
    render(<ItemPeekModal item={null} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

const lightboxPhotos: ItemPhoto[] = [
  { id: 1, itemId: 10, blob: new Blob(["a"]), kind: "full", createdAt: 0 },
  { id: 2, itemId: 10, blob: new Blob(["b"]), kind: "full", createdAt: 0 },
] as unknown as ItemPhoto[];

describe("PhotoLightbox (migrated to <Modal>, nested ConfirmDialog)", () => {
  it("renders role=dialog + aria-modal and keeps Close/Delete labels", () => {
    render(
      <PhotoLightbox
        photos={lightboxPhotos}
        initialIndex={0}
        onClose={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(
      within(dialog).getByRole("button", { name: "Close" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Delete photo" }),
    ).toBeInTheDocument();
  });

  it("Escape closes the lightbox", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <PhotoLightbox
        photos={lightboxPhotos}
        initialIndex={0}
        onClose={onClose}
        onDelete={vi.fn()}
      />,
    );
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("nested-trap: opening the photo-delete confirm moves focus into it; Escape returns to the lightbox (not all the way out)", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <PhotoLightbox
        photos={lightboxPhotos}
        initialIndex={0}
        onClose={onClose}
        onDelete={vi.fn()}
      />,
    );

    // Open the nested ConfirmDialog.
    await user.click(screen.getByRole("button", { name: "Delete photo" }));

    // Two dialogs are present; focus is inside the inner confirm.
    const dialogs = screen.getAllByRole("dialog");
    expect(dialogs).toHaveLength(2);
    const confirm = screen.getByText("Delete Photo").closest('[role="dialog"]')!;
    expect(confirm.contains(document.activeElement)).toBe(true);

    // Escape on the inner confirm closes ONLY the confirm — lightbox stays open.
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Delete Photo")).toBeNull();
    expect(screen.getByRole("dialog")).toBeInTheDocument(); // lightbox still here
    expect(onClose).not.toHaveBeenCalled(); // did not blow all the way out
  });

  it("has no axe violations", async () => {
    render(
      <PhotoLightbox
        photos={lightboxPhotos}
        initialIndex={0}
        onClose={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(await axe(document.body, AXE_OPTS)).toHaveNoViolations();
  });
});

describe("MigrationSplash (folds in real trap, reduced-motion gate)", () => {
  afterEach(() => cleanup());

  it("renders role=dialog + aria-modal + accessible name", () => {
    render(
      <MigrationSplash
        state="error"
        current={1}
        total={3}
        skipped={0}
        onRetry={vi.fn()}
        onSkip={vi.fn()}
        onComplete={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("Data migration in progress");
  });

  it("traps focus: conditional error-state buttons are reachable", () => {
    render(
      <MigrationSplash
        state="error"
        current={1}
        total={3}
        skipped={0}
        onRetry={vi.fn()}
        onSkip={vi.fn()}
        onComplete={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Retry Migration" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Skip and Continue" }),
    ).toBeInTheDocument();
  });

  it("animates the opacity fade by default (motion allowed)", () => {
    render(
      <MigrationSplash
        state="error"
        current={1}
        total={3}
        skipped={0}
        onRetry={vi.fn()}
        onSkip={vi.fn()}
        onComplete={vi.fn()}
      />,
    );
    expect(screen.getByRole("dialog").className).toMatch(/transition-opacity/);
  });

  it("suppresses the opacity fade transition when prefers-reduced-motion is set", () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    try {
      render(
        <MigrationSplash
          state="error"
          current={1}
          total={3}
          skipped={0}
          onRetry={vi.fn()}
          onSkip={vi.fn()}
          onComplete={vi.fn()}
        />,
      );
      expect(screen.getByRole("dialog").className).not.toMatch(
        /transition-opacity/,
      );
    } finally {
      window.matchMedia = original;
    }
  });

  it("has no axe violations", async () => {
    render(
      <MigrationSplash
        state="error"
        current={1}
        total={3}
        skipped={0}
        onRetry={vi.fn()}
        onSkip={vi.fn()}
        onComplete={vi.fn()}
      />,
    );
    expect(await axe(document.body, AXE_OPTS)).toHaveNoViolations();
  });
});
