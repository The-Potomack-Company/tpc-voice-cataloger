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
  mockStoreUpdateSession,
  mockUseUIStore,
  mockUseNotePageCount,
} = vi.hoisted(() => ({
  mockUseUserRole: vi.fn(),
  mockListAccounts: vi.fn(),
  mockUseSession: vi.fn(),
  mockUseSessionItemCount: vi.fn(),
  mockUseSessionItems: vi.fn(),
  mockUseSessionStore: vi.fn(),
  mockStoreUpdateSession: vi.fn(),
  mockUseUIStore: vi.fn(),
  mockUseNotePageCount: vi.fn(),
}));

vi.mock("../hooks/useUserRole", () => ({ useUserRole: mockUseUserRole }));
vi.mock("../services/adminApi", () => ({ listAccounts: mockListAccounts }));
vi.mock("../hooks/useSessions", () => ({
  useSession: mockUseSession,
  useSessionItemCount: mockUseSessionItemCount,
  useSessionItems: mockUseSessionItems,
}));
vi.mock("../stores/sessionStore", () => ({
  useSessionStore: Object.assign(mockUseSessionStore, {
    getState: () => ({ updateSession: mockStoreUpdateSession }),
  }),
}));
vi.mock("../stores/uiStore", () => ({ useUIStore: mockUseUIStore }));
vi.mock("../hooks/useNotePages", () => ({ useNotePageCount: mockUseNotePageCount }));
vi.mock("../components/ConfirmDialog", () => ({ ConfirmDialog: () => null }));
vi.mock("../components/ItemList", () => ({ ItemList: () => <div>Items</div> }));
vi.mock("../components/ExportHistoryList", () => ({ ExportHistoryList: () => null }));
vi.mock("../components/RecordingIndicator", () => ({ RecordingIndicator: () => null }));
vi.mock("../components/RecordingToast", () => ({ RecordingToast: () => null }));

const baseSession = {
  id: "session-1",
  name: "Test Session",
  mode: "sale" as const,
  notes: "",
  status: "active",
  created_by: "user-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  assigned_to: "user-a",
  review_notes: null,
};

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={["/session/session-1"]}>
      <Routes>
        <Route path="/session/:sessionId" element={<SessionDetailPage />} />
        <Route
          path="/session/:sessionId/photo-notes"
          element={<div>PHOTO NOTES SCREEN</div>}
        />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SessionDetail — Photo notes entry (PHN-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(baseSession);
    mockUseSessionItemCount.mockReturnValue(0);
    mockUseSessionItems.mockReturnValue([]);
    mockUseSessionStore.mockImplementation((selector: (s: Record<string, unknown>) => unknown) =>
      selector({ fetchItems: vi.fn(), updateSession: mockStoreUpdateSession }),
    );
    mockUseUIStore.mockImplementation((selector: (s: Record<string, unknown>) => unknown) =>
      selector({ recordingSessionId: null, setRecordingSession: vi.fn() }),
    );
    mockListAccounts.mockResolvedValue([]);
    mockUseNotePageCount.mockReturnValue(0);
    mockUseUserRole.mockReturnValue({ role: "specialist", isAdmin: false, loading: false });
  });

  it("shows the Photo notes action on an active sale session", async () => {
    renderDetail();
    expect(await screen.findByRole("button", { name: /photo notes/i })).toBeInTheDocument();
  });

  it("shows the Photo notes action on an active house session", async () => {
    mockUseSession.mockReturnValue({ ...baseSession, mode: "house" });
    renderDetail();
    expect(await screen.findByRole("button", { name: /photo notes/i })).toBeInTheDocument();
  });

  it("hides the action on a submitted (read-only) specialist session", async () => {
    mockUseSession.mockReturnValue({ ...baseSession, status: "submitted" });
    renderDetail();
    await screen.findByRole("button", { name: /delete session/i });
    expect(screen.queryByRole("button", { name: /photo notes/i })).not.toBeInTheDocument();
  });

  it("shows a count chip when captured pages exist", async () => {
    mockUseNotePageCount.mockReturnValue(3);
    renderDetail();
    const btn = await screen.findByRole("button", { name: /photo notes/i });
    expect(btn).toHaveTextContent("3");
  });

  it("navigates to the photo-notes route on click", async () => {
    renderDetail();
    const btn = await screen.findByRole("button", { name: /photo notes/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByText("PHOTO NOTES SCREEN")).toBeInTheDocument();
    });
  });
});
