import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import type { Tables } from "../../db/database.types";

// SwipeableRow renders children only — keeps the swipe gesture out of these
// keyboard-path assertions (matches the existing row tests' mock shape).
vi.mock("../../components/SwipeableRow", () => ({
  SwipeableRow: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("../../stores/uiStore", () => ({
  useUIStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ recordingSessionId: null }),
}));

import { SessionTile } from "../../components/SessionTile";
import { SessionCard } from "../../components/SessionCard";
import { ItemCard } from "../../components/ItemCard";

beforeEach(() => cleanup());

const session = {
  id: "abc12345-aaaa-bbbb-cccc-1234567890ab",
  name: "Modern & Contemporary",
  mode: "sale",
  notes: "",
  status: "active",
  created_by: "creator",
  created_at: "2026-05-12T00:00:00Z",
  updated_at: "2026-05-12T00:00:00Z",
  assigned_to: null,
  review_notes: null,
} as unknown as Tables<"sessions">;

const item = {
  id: "item-1",
  session_id: "s-1",
  sort_order: 0,
  title: "Brass lamp",
  description: null,
  mode: "sale",
  ai_status: "complete",
  receipt_number: "R-100",
} as unknown as Tables<"items">;

describe("SessionTile ⋯ menu → onDelete", () => {
  it("Delete from the menu calls the same onDelete prop", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <MemoryRouter>
        <SessionTile
          session={session}
          itemCount={3}
          onTap={() => {}}
          onDelete={onDelete}
          onRename={() => {}}
        />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

describe("SessionCard ⋯ menu → onDelete", () => {
  it("Delete from the menu calls the same onDelete prop", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <MemoryRouter>
        <SessionCard
          session={session}
          itemCount={3}
          onTap={() => {}}
          onDelete={onDelete}
          onRename={() => {}}
        />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

describe("ItemCard ⋯ menu → ConfirmDialog", () => {
  it("Delete from the menu opens the existing local ConfirmDialog", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ItemCard
          item={item}
          sessionId="s-1"
          isExpanded={false}
          audioCount={0}
          latestAudioId={null}
          hasServerAudio={false}
          isPending={false}
        />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    // Existing local ConfirmDialog (D-04) — no new delete path.
    expect(
      screen.getByRole("dialog", { name: /delete item/i }),
    ).toBeInTheDocument();
  });
});
