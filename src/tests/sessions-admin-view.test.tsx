import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SessionsPage } from "../pages/Sessions";

// --- Hoisted mocks ---
const {
  mockUseUserRole,
  mockListAccounts,
  mockUseActiveSessions,
  mockUseSubmittedSessions,
  mockUseReturnedSessions,
  mockUseExportedSessions,
  mockUseSessionItemCount,
  mockUseNameMap,
  mockUseUIStore,
} = vi.hoisted(() => ({
  mockUseUserRole: vi.fn(),
  mockListAccounts: vi.fn(),
  mockUseActiveSessions: vi.fn(),
  mockUseSubmittedSessions: vi.fn(),
  mockUseReturnedSessions: vi.fn(),
  mockUseExportedSessions: vi.fn(),
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
  useSubmittedSessions: mockUseSubmittedSessions,
  useReturnedSessions: mockUseReturnedSessions,
  useExportedSessions: mockUseExportedSessions,
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
    sessionStatus,
  }: {
    session: { name: string };
    sessionStatus?: string;
  }) => (
    <div data-testid="session-card">
      <span>{session.name}</span>
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
    mockUseSubmittedSessions.mockReturnValue([]);
    mockUseReturnedSessions.mockReturnValue([]);
    mockUseExportedSessions.mockReturnValue([]);

    render(
      <MemoryRouter>
        <SessionsPage />
      </MemoryRouter>,
    );

    // Specialist group headers should appear
    expect(screen.getByText("Alice (2)")).toBeInTheDocument();
    expect(screen.getByText("Bob (1)")).toBeInTheDocument();
  });

  it("admin view shows specialist group header instead of per-card assignee", () => {
    mockUseUserRole.mockReturnValue({ role: "admin", isAdmin: true, loading: false });
    mockUseNameMap.mockReturnValue(new Map([["user-a", "Alice"]]));
    mockUseActiveSessions.mockReturnValue([makeSession("s1", "Session 1", "user-a")]);
    mockUseSubmittedSessions.mockReturnValue([]);
    mockUseReturnedSessions.mockReturnValue([]);
    mockUseExportedSessions.mockReturnValue([]);

    render(
      <MemoryRouter>
        <SessionsPage />
      </MemoryRouter>,
    );

    // Specialist group header provides context — no per-card assignee name
    expect(screen.getByText("Alice (1)")).toBeInTheDocument();
    expect(screen.queryByTestId("assignee-name")).not.toBeInTheDocument();
  });

  it("admin view shows status badge on session cards", () => {
    mockUseUserRole.mockReturnValue({ role: "admin", isAdmin: true, loading: false });
    mockUseNameMap.mockReturnValue(new Map([["user-a", "Alice"]]));
    mockUseActiveSessions.mockReturnValue([makeSession("s1", "Session 1", "user-a", "active")]);
    mockUseSubmittedSessions.mockReturnValue([]);
    mockUseReturnedSessions.mockReturnValue([]);
    mockUseExportedSessions.mockReturnValue([]);

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
    mockUseSubmittedSessions.mockReturnValue([]);
    mockUseReturnedSessions.mockReturnValue([]);
    mockUseExportedSessions.mockReturnValue([]);

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
    mockUseSubmittedSessions.mockReturnValue([]);
    mockUseReturnedSessions.mockReturnValue([]);
    mockUseExportedSessions.mockReturnValue([]);

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

