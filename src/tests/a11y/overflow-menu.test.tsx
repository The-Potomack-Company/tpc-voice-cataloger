import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { OverflowMenu } from "../../ui/OverflowMenu";

beforeEach(() => cleanup());

const AXE_OPTS = { rules: { "color-contrast": { enabled: false } } } as const;

function renderMenu(onSelect = vi.fn()) {
  render(
    // <main> landmark so the page-level axe scan isn't flagged for orphan
    // content (region rule) — the menu itself is what's under test.
    <main className="tpc">
      <OverflowMenu
        actions={[{ label: "Delete", onSelect, destructive: true }]}
      />
    </main>,
  );
  return { onSelect };
}

describe("OverflowMenu", () => {
  it("trigger is a labeled menu button", () => {
    renderMenu();
    const trigger = screen.getByRole("button", { name: "More actions" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    // tooltip string equals the aria-label (UI-SPEC copy contract)
    expect(trigger).toHaveAttribute("title", "More actions");
  });

  it("trigger is a 44px touch target", () => {
    renderMenu();
    const trigger = screen.getByRole("button", { name: "More actions" });
    expect(trigger.className).toContain("min-h-11");
    expect(trigger.className).toContain("min-w-11");
  });

  it("opens by keyboard and reflects aria-expanded", async () => {
    const user = userEvent.setup();
    renderMenu();
    const trigger = screen.getByRole("button", { name: "More actions" });
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(
      within(screen.getByRole("menu")).getByRole("menuitem", { name: "Delete" }),
    ).toBeInTheDocument();
  });

  it("fires the action's onSelect when an item is chosen", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderMenu();
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("Escape closes the menu and restores focus to the trigger", async () => {
    const user = userEvent.setup();
    renderMenu();
    const trigger = screen.getByRole("button", { name: "More actions" });
    await user.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("menu items carry the class-scoped focus ring", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: "More actions" }));
    const item = screen.getByRole("menuitem", { name: "Delete" });
    // A11Y-02 ring is class-scoped — items must carry tpc-btn (or equivalent).
    expect(item.className).toMatch(/tpc-btn|tpc-card-interactive/);
  });

  it("has no axe violations when open", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: "More actions" }));
    const results = await axe(document.body, AXE_OPTS);
    expect(results).toHaveNoViolations();
  });
});
