/**
 * Session list tile (SCREEN-01 — Sessions list).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SessionTile } from "../components/SessionTile";

vi.mock("../stores/uiStore", () => ({
  useUIStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ recordingSessionId: null }),
}));
vi.mock("../components/SwipeableRow", () => ({
  SwipeableRow: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const baseSession = {
  id: "abc12345-aaaa-bbbb-cccc-1234567890ab",
  name: "Modern & Contemporary",
  mode: "sale",
  notes: "",
  status: "active",
  created_by: "creator",
  created_at: "2026-05-12T00:00:00Z",
  updated_at: "2026-05-12T00:00:00Z",
  assigned_to: null as string | null,
  review_notes: null,
};

describe("SessionTile", () => {
  it("renders the sale mode tile (S) with the accent-wash variant", () => {
    render(
      <MemoryRouter>
        <SessionTile
          session={baseSession}
          itemCount={42}
          shortId="TPC-1234"
          onTap={() => {}}
          onDelete={() => {}}
          onRename={() => {}}
        />
      </MemoryRouter>,
    );
    const tile = screen.getByTestId("session-tile");
    expect(tile.getAttribute("data-mode")).toBe("sale");
    // Tile letter "S"
    expect(screen.getByText("S")).toBeInTheDocument();
    // Short id rendered in mono
    expect(screen.getByText("TPC-1234")).toBeInTheDocument();
    // Item meta line
    expect(screen.getByText(/42 items/)).toBeInTheDocument();
  });

  it("renders the house mode tile (H) with the sand-wash variant", () => {
    render(
      <MemoryRouter>
        <SessionTile
          session={{ ...baseSession, mode: "house" }}
          itemCount={1}
          onTap={() => {}}
          onDelete={() => {}}
          onRename={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("H")).toBeInTheDocument();
    expect(screen.getByText(/1 item/)).toBeInTheDocument();
  });

  it("shows the assignee name when provided (admin view)", () => {
    render(
      <MemoryRouter>
        <SessionTile
          session={baseSession}
          itemCount={3}
          assigneeName="Alice"
          onTap={() => {}}
          onDelete={() => {}}
          onRename={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
  });

  it("renders Needs review badge with count when reviewCount > 0", () => {
    render(
      <MemoryRouter>
        <SessionTile
          session={baseSession}
          itemCount={5}
          reviewCount={3}
          onTap={() => {}}
          onDelete={() => {}}
          onRename={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Needs review · 3/)).toBeInTheDocument();
  });

  it("does not render Needs review badge when reviewCount is 0 or undefined", () => {
    render(
      <MemoryRouter>
        <SessionTile
          session={baseSession}
          itemCount={5}
          onTap={() => {}}
          onDelete={() => {}}
          onRename={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/Needs review/)).not.toBeInTheDocument();
  });
});
