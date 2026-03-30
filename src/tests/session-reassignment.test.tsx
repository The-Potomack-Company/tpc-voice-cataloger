import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { SessionDetailPage } from "../pages/SessionDetail";

// --- Hoisted mocks ---
const {
  mockUseUserRole,
  mockListAccounts,
  mockUseSession,
  mockUseSessionItemCount,
  mockUseSessionItems,
  mockUseSessionStore,
  mockUpdateSession,
  mockDeleteSession,
  mockCreateBlankItem,
  mockExportSession,
  mockUseUIStore,
  mockStoreUpdateSession,
} = vi.hoisted(() => ({
  mockUseUserRole: vi.fn(),
  mockListAccounts: vi.fn(),
  mockUseSession: vi.fn(),
  mockUseSessionItemCount: vi.fn(),
  mockUseSessionItems: vi.fn(),
  mockUseSessionStore: vi.fn(),
  mockUpdateSession: vi.fn(),
  mockDeleteSession: vi.fn(),
  mockCreateBlankItem: vi.fn(),
  mockExportSession: vi.fn(),
  mockUseUIStore: vi.fn(),
  mockStoreUpdateSession: vi.fn(),
}));

vi.mock("../hooks/useUserRole", () => ({
  useUserRole: mockUseUserRole,
}));

vi.mock("../services/adminApi", () => ({
  listAccounts: mockListAccounts,
}));

vi.mock("../hooks/useSessions", () => ({
  useSession: mockUseSession,
  useSessionItemCount: mockUseSessionItemCount,
  useSessionItems: mockUseSessionItems,
}));

vi.mock("../stores/sessionStore", () => ({
  useSessionStore: Object.assign(mockUseSessionStore, {
    getState: () => ({
      updateSession: mockStoreUpdateSession,
    }),
  }),
}));

vi.mock("../db/sessions", () => ({
  updateSession: mockUpdateSession,
  deleteSession: mockDeleteSession,
}));

vi.mock("../db/items", () => ({
  createBlankItem: mockCreateBlankItem,
}));

vi.mock("../utils/export", () => ({
  exportSession: mockExportSession,
}));

vi.mock("../stores/uiStore", () => ({
  useUIStore: mockUseUIStore,
}));

vi.mock("../components/ConfirmDialog", () => ({
  ConfirmDialog: () => null,
}));

vi.mock("../components/ItemList", () => ({
  ItemList: () => <div data-testid="item-list">Items</div>,
}));

vi.mock("../components/ExportHistoryList", () => ({
  ExportHistoryList: () => null,
}));

vi.mock("../components/RecordingIndicator", () => ({
  RecordingIndicator: () => null,
}));

vi.mock("../components/RecordingToast", () => ({
  RecordingToast: () => null,
}));

const testSession = {
  id: "session-1",
  name: "Test Session",
  mode: "sale",
  notes: "",
  status: "active",
  created_by: "user-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  assigned_to: "user-a",
  review_notes: null,
};

const testAccounts = [
  { id: "user-a", email: "alice@test.com", display_name: "Alice", role: "specialist", is_active: true, created_at: "2026-01-01" },
  { id: "user-b", email: "bob@test.com", display_name: "Bob", role: "specialist", is_active: true, created_at: "2026-01-01" },
];

function renderSessionDetail() {
  return render(
    <MemoryRouter initialEntries={["/session/session-1"]}>
      <Routes>
        <Route path="/session/:sessionId" element={<SessionDetailPage />} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Session reassignment (ASGN-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(testSession);
    mockUseSessionItemCount.mockReturnValue(5);
    mockUseSessionItems.mockReturnValue([]);
    mockUseSessionStore.mockImplementation((selector: (s: Record<string, unknown>) => unknown) =>
      selector({ fetchItems: vi.fn(), updateSession: mockStoreUpdateSession }),
    );
    mockUseUIStore.mockImplementation((selector: (s: Record<string, unknown>) => unknown) =>
      selector({ recordingSessionId: null, setRecordingSession: vi.fn() }),
    );
    mockListAccounts.mockResolvedValue(testAccounts);
    mockStoreUpdateSession.mockResolvedValue(undefined);
  });

  it("admin sees assignee field on session detail", async () => {
    mockUseUserRole.mockReturnValue({ role: "admin", isAdmin: true, loading: false });

    renderSessionDetail();

    await waitFor(() => {
      expect(screen.getByText("Assigned to")).toBeInTheDocument();
    });
    // Should show the current assignee name once accounts load
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
  });

  it("tapping assignee name opens dropdown", async () => {
    mockUseUserRole.mockReturnValue({ role: "admin", isAdmin: true, loading: false });

    renderSessionDetail();

    // Wait for accounts to load and name to appear
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });

    // Click the assignee name to open dropdown
    fireEvent.click(screen.getByText("Alice"));

    // Dropdown (select) should now appear
    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });
  });

  it("specialist does not see assignee field", () => {
    mockUseUserRole.mockReturnValue({ role: "specialist", isAdmin: false, loading: false });

    renderSessionDetail();

    expect(screen.queryByText("Assigned to")).not.toBeInTheDocument();
  });

  it("reassignment calls updateSession with new assigned_to", async () => {
    mockUseUserRole.mockReturnValue({ role: "admin", isAdmin: true, loading: false });

    renderSessionDetail();

    // Wait for accounts
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });

    // Open the dropdown
    fireEvent.click(screen.getByText("Alice"));

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    // Select Bob
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "user-b" } });

    await waitFor(() => {
      expect(mockStoreUpdateSession).toHaveBeenCalledWith(
        "session-1",
        expect.objectContaining({ assigned_to: "user-b" }),
      );
    });
  });
});
