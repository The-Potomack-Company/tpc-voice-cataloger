import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { SessionDetailPage } from "../pages/SessionDetail";

const {
  mockUseUserRole,
  mockListAccounts,
  mockUseSession,
  mockUseSessionItemCount,
  mockUseSessionItems,
  mockUseSessionStore,
  mockUseUIStore,
  mockUseNotePageCount,
} = vi.hoisted(() => ({
  mockUseUserRole: vi.fn(),
  mockListAccounts: vi.fn(),
  mockUseSession: vi.fn(),
  mockUseSessionItemCount: vi.fn(),
  mockUseSessionItems: vi.fn(),
  mockUseSessionStore: vi.fn(),
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
vi.mock("../stores/sessionStore", () => ({ useSessionStore: mockUseSessionStore }));
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
      </Routes>
    </MemoryRouter>,
  );
}

describe("SessionDetail feature flags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(baseSession);
    mockUseSessionItemCount.mockReturnValue(0);
    mockUseSessionItems.mockReturnValue([]);
    mockUseSessionStore.mockImplementation((selector: (s: Record<string, unknown>) => unknown) =>
      selector({ fetchItems: vi.fn(), updateSession: vi.fn(), deleteSession: vi.fn() }),
    );
    mockUseUIStore.mockImplementation((selector: (s: Record<string, unknown>) => unknown) =>
      selector({ recordingSessionId: null, setRecordingSession: vi.fn() }),
    );
    mockListAccounts.mockResolvedValue([]);
    mockUseNotePageCount.mockReturnValue(0);
    mockUseUserRole.mockReturnValue({ role: "specialist", isAdmin: false, loading: false });
  });

  afterEach(() => {
    vi.stubEnv("VITE_FEATURE_CONTINUOUS_CAPTURE", "true");
    vi.stubEnv("VITE_FEATURE_PHOTO_NOTES", "true");
  });

  it("hides the continuous capture entry point when the flag is off", async () => {
    vi.stubEnv("VITE_FEATURE_CONTINUOUS_CAPTURE", "false");
    renderDetail();
    await screen.findByRole("button", { name: /start cataloging/i });
    expect(screen.queryByRole("button", { name: /continuous mode/i })).not.toBeInTheDocument();
  });

  it("hides the photo notes entry point when the flag is off", async () => {
    vi.stubEnv("VITE_FEATURE_PHOTO_NOTES", "false");
    renderDetail();
    await screen.findByRole("button", { name: /start cataloging/i });
    expect(screen.queryByRole("button", { name: /photo notes/i })).not.toBeInTheDocument();
  });
});
