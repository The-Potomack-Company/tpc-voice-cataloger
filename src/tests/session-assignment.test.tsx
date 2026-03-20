import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SessionCard } from "../components/SessionCard";
import type { Tables } from "../db/database.types";

// Mock dependencies
vi.mock("../stores/uiStore", () => ({
  useUIStore: () => null,
}));

vi.mock("../hooks/useLongPress", () => ({
  useLongPress: () => ({}),
}));

vi.mock("./SwipeableRow", () => ({
  SwipeableRow: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Fix: SwipeableRow is imported from ../components/SwipeableRow in SessionCard
vi.mock("../components/SwipeableRow", () => ({
  SwipeableRow: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

const mockSession: Tables<"sessions"> = {
  id: "test-id",
  name: "Test Session",
  mode: "house",
  status: "active",
  notes: "",
  created_by: "user-1",
  assigned_to: null,
  review_notes: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const defaultProps = {
  session: mockSession,
  itemCount: 3,
  onTap: vi.fn(),
  onDelete: vi.fn(),
  onRename: vi.fn(),
};

describe("SessionCard admin variant", () => {
  it("renders status badge when sessionStatus prop provided", () => {
    render(<SessionCard {...defaultProps} sessionStatus="submitted" />);
    const badge = screen.getByText("Submitted");
    expect(badge).toBeDefined();
    expect(badge.className).toContain("bg-yellow-100");
  });

  it("does not render Completed badge when sessionStatus is provided", () => {
    const completedSession = { ...mockSession, status: "completed" };
    render(
      <SessionCard
        {...defaultProps}
        session={completedSession}
        sessionStatus="exported"
      />,
    );
    expect(screen.queryByText("Completed")).toBeNull();
    expect(screen.getByText("Exported")).toBeDefined();
  });

  it("does not render assignee name or status badge when props omitted", () => {
    render(<SessionCard {...defaultProps} />);
    expect(screen.queryByText(/Assigned to/)).toBeNull();
  });

  it("renders all four status badge colors", () => {
    const statuses = [
      { key: "active", label: "Active", color: "bg-blue-100" },
      { key: "submitted", label: "Submitted", color: "bg-yellow-100" },
      { key: "returned", label: "Returned", color: "bg-orange-100" },
      { key: "exported", label: "Exported", color: "bg-green-100" },
    ];

    for (const { key, label, color } of statuses) {
      const { unmount } = render(
        <SessionCard {...defaultProps} sessionStatus={key} />,
      );
      const badge = screen.getByText(label);
      expect(badge).toBeDefined();
      expect(badge.className).toContain(color);
      unmount();
    }
  });
});
