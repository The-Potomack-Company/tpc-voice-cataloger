import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SessionsPage } from "../pages/Sessions";

// --- Hoisted mocks ---
const {
  mockUseUserRole,
  mockListAccounts,
  mockUseActiveSessions,
  mockUseCompletedSessions,
  mockUseArchivedSessions,
  mockUseSessionItemCount,
  mockUseNameMap,
  mockUseUIStore,
} = vi.hoisted(() => ({
  mockUseUserRole: vi.fn(),
  mockListAccounts: vi.fn(),
  mockUseActiveSessions: vi.fn(),
  mockUseCompletedSessions: vi.fn(),
  mockUseArchivedSessions: vi.fn(),
  mockUseSessionItemCount: vi.fn(),
  mockUseNameMap: vi.fn(),
  mockUseUIStore: vi.fn(),
}));

vi.mock("../hooks/useUserRole", () => ({
  useUserRole: mockUseUserRole,
}));

vi.mock("../services/adminApi", () => ({
  listAccounts: mockListAccounts,
}));

vi.mock("../hooks/useSessions", () => ({
  useActiveSessions: mockUseActiveSessions,
  useCompletedSessions: mockUseCompletedSessions,
  useArchivedSessions: mockUseArchivedSessions,
  useSessionItemCount: mockUseSessionItemCount,
  useNameMap: mockUseNameMap,
}));

vi.mock("../stores/uiStore", () => ({
  useUIStore: mockUseUIStore,
}));

vi.mock("../db/sessions", () => ({
  deleteSession: vi.fn(),
  updateSession: vi.fn(),
}));

vi.mock("../components/Walkthrough", () => ({
  Walkthrough: () => <div>Walkthrough</div>,
}));

vi.mock("../components/SessionSearch", () => ({
  SessionSearch: ({ onSearch }: { onSearch: (q: string) => void }) => (
    <input data-testid="search" onChange={(e) => onSearch(e.target.value)} />
  ),
}));

vi.mock("../components/SessionCard", () => ({
  SessionCard: ({
    session,
    assigneeName,
    sessionStatus,
  }: {
    session: { name: string };
    assigneeName?: string;
    sessionStatus?: string;
  }) => (
    <div data-testid="session-card">
      <span>{session.name}</span>
      {assigneeName && <span data-testid="assignee-name">Assigned to {assigneeName}</span>}
      {sessionStatus && <span data-testid="status-badge">{sessionStatus}</span>}
    </div>
  ),
}));

vi.mock("../components/ConfirmDialog", () => ({
  ConfirmDialog: () => null,
}));

vi.mock("../components/SwipeableRow", () => ({
  SwipeableRow: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const makeSession = (id: string, name: string, assignedTo: string | null, status = "active") => ({
  id,
  name,
  mode: "sale",
  notes: "",
  status,
  created_by: "creator-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  assigned_to: assignedTo,
  review_notes: null,
});

describe("Sessions admin view (ASGN-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUIStore.mockImplementation((selector: (s: Record<string, unknown>) => unknown) =>
      selector({ hasCompletedWalkthrough: true, isOnline: true, recordingSessionId: null }),
    );
    mockUseSessionItemCount.mockReturnValue(3);
    mockListAccounts.mockResolvedValue([]);
  });

  it("admin view groups sessions by specialist name", () => {
    mockUseUserRole.mockReturnValue({ role: "admin", isAdmin: true, loading: false });
    mockUseNameMap.mockReturnValue(
      new Map([
        ["user-a", "Alice"],
        ["user-b", "Bob"],
      ]),
    );
    mockUseActiveSessions.mockReturnValue([
      makeSession("s1", "Session 1", "user-a"),
      makeSession("s2", "Session 2", "user-b"),
      makeSession("s3", "Session 3", "user-a"),
    ]);
    mockUseCompletedSessions.mockReturnValue([]);
    mockUseArchivedSessions.mockReturnValue([]);

    render(
      <MemoryRouter>
        <SessionsPage />
      </MemoryRouter>,
    );

    // Specialist group headers should appear
    expect(screen.getByText("Alice (2)")).toBeInTheDocument();
    expect(screen.getByText("Bob (1)")).toBeInTheDocument();
  });

  it("admin view shows assignee name on session cards", () => {
    mockUseUserRole.mockReturnValue({ role: "admin", isAdmin: true, loading: false });
    mockUseNameMap.mockReturnValue(new Map([["user-a", "Alice"]]));
    mockUseActiveSessions.mockReturnValue([makeSession("s1", "Session 1", "user-a")]);
    mockUseCompletedSessions.mockReturnValue([]);
    mockUseArchivedSessions.mockReturnValue([]);

    render(
      <MemoryRouter>
        <SessionsPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("assignee-name")).toHaveTextContent("Assigned to Alice");
  });

  it("admin view shows status badge on session cards", () => {
    mockUseUserRole.mockReturnValue({ role: "admin", isAdmin: true, loading: false });
    mockUseNameMap.mockReturnValue(new Map([["user-a", "Alice"]]));
    mockUseActiveSessions.mockReturnValue([makeSession("s1", "Session 1", "user-a", "active")]);
    mockUseCompletedSessions.mockReturnValue([]);
    mockUseArchivedSessions.mockReturnValue([]);

    render(
      <MemoryRouter>
        <SessionsPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("status-badge")).toHaveTextContent("active");
  });

  it("specialist view shows flat list without grouping", () => {
    mockUseUserRole.mockReturnValue({ role: "specialist", isAdmin: false, loading: false });
    mockUseNameMap.mockReturnValue(new Map());
    mockUseActiveSessions.mockReturnValue([
      makeSession("s1", "Session 1", "user-a"),
      makeSession("s2", "Session 2", "user-b"),
    ]);
    mockUseCompletedSessions.mockReturnValue([]);
    mockUseArchivedSessions.mockReturnValue([]);

    render(
      <MemoryRouter>
        <SessionsPage />
      </MemoryRouter>,
    );

    // No specialist group headers
    expect(screen.queryByText(/Alice/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Bob/)).not.toBeInTheDocument();
    // Cards still render but without assigneeName
    expect(screen.queryByTestId("assignee-name")).not.toBeInTheDocument();
    // Section title present
    expect(screen.getByText("Active Sessions (2)")).toBeInTheDocument();
  });

  it("shows skeleton loading state while role is loading", () => {
    mockUseUserRole.mockReturnValue({ role: null, isAdmin: false, loading: true });
    mockUseNameMap.mockReturnValue(new Map());
    mockUseActiveSessions.mockReturnValue([]);
    mockUseCompletedSessions.mockReturnValue([]);
    mockUseArchivedSessions.mockReturnValue([]);

    const { container } = render(
      <MemoryRouter>
        <SessionsPage />
      </MemoryRouter>,
    );

    // Should show animated skeleton cards
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBe(3);
  });
});

