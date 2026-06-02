import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { OverflowMenu } from "../../ui/OverflowMenu";

beforeEach(() => cleanup());

// Codex #46 / D-06: interactive icon-only targets must be ≥44px. We assert the
// shared min-h-11/min-w-11 utility (Tailwind 11 = 2.75rem = 44px) is applied
// rather than a computed box (jsdom has no layout).
describe("44px touch targets", () => {
  it("OverflowMenu trigger carries min-h-11 min-w-11", () => {
    render(
      <div className="tpc">
        <OverflowMenu actions={[{ label: "Delete", onSelect: vi.fn() }]} />
      </div>,
    );
    const trigger = screen.getByRole("button", { name: "More actions" });
    expect(trigger.className).toContain("min-h-11");
    expect(trigger.className).toContain("min-w-11");
  });
});
