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
  mockUseSessionReviewCount,
  mockUseNameMap,
  mockUseUIStore,
  mockUseAuthStore,
} = vi.hoisted(() => ({
  mockUseUserRole: vi.fn(),
  mockListAccounts: vi.fn(),
  mockUseActiveSessions: vi.fn(),
  mockUseSubmittedSessions: vi.fn(),
  mockUseReturnedSessions: vi.fn(),
  mockUseExportedSessions: vi.fn(),
  mockUseSessionItemCount: vi.fn(),
  mockUseSessionReviewCount: vi.fn(),
  mockUseNameMap: vi.fn(),
  mockUseUIStore: vi.fn(),
  mockUseAuthStore: vi.fn(),
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
  useSessionReviewCount: mockUseSessionReviewCount,
  useNameMap: mockUseNameMap,
}));

vi.mock("../stores/uiStore", () => ({
  useUIStore: mockUseUIStore,
}));

vi.mock("../stores/authStore", () => ({
  useAuthStore: mockUseAuthStore,
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

describe("Sessions admin view (mockup-faithful date-grouped tiles)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUIStore.mockImplementation((selector: (s: Record<string, unknown>) => unknown) =>
      selector({ hasCompletedWalkthrough: true, isOnline: true, recordingSessionId: null }),
    );
    mockUseAuthStore.mockImplementation((selector: (s: Record<string, unknown>) => unknown) =>
      selector({ user: { id: "viewer-admin" } }),
    );
    mockUseSessionItemCount.mockReturnValue(3);
    mockUseSessionReviewCount.mockReturnValue(0);
    mockListAccounts.mockResolvedValue([]);
  });

  it("renders the eyebrow + display title and a New action in the header", () => {
    mockUseUserRole.mockReturnValue({ role: "admin", isAdmin: true, loading: false });
    mockUseNameMap.mockReturnValue(new Map());
    mockUseActiveSessions.mockReturnValue([makeSession("s1", "Session 1", "user-a")]);
    mockUseSubmittedSessions.mockReturnValue([]);
    mockUseReturnedSessions.mockReturnValue([]);
    mockUseExportedSessions.mockReturnValue([]);

    render(
      <MemoryRouter>
        <SessionsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("The Potomack Co.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sessions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new/i })).toBeInTheDocument();
  });

  it("admin view shows each session as a tile with the assignee name visible", () => {
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

    expect(screen.getByTestId("session-tile")).toBeInTheDocument();
    // Meta line shows the assignee in the admin viewport (Alice).
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
  });

  it("admin view renders an Active Sessions section eyebrow header", () => {
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

    expect(screen.getByText("Active Sessions (1)")).toBeInTheDocument();
  });

  it("specialist view doesn't surface assignee names on tiles", () => {
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

    expect(screen.queryByText(/Alice/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Bob/)).not.toBeInTheDocument();
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

    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBe(3);
  });
});
