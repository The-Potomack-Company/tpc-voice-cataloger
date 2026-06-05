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
  mockExportSession,
  mockExportSpreadsheet,
  mockUseUIStore,
  mockNotifyError,
  mockDismiss,
} = vi.hoisted(() => ({
  mockUseUserRole: vi.fn(),
  mockListAccounts: vi.fn(),
  mockUseSession: vi.fn(),
  mockUseSessionItemCount: vi.fn(),
  mockUseSessionItems: vi.fn(),
  mockUseSessionStore: vi.fn(),
  mockStoreUpdateSession: vi.fn(),
  mockExportSession: vi.fn(),
  mockExportSpreadsheet: vi.fn(),
  mockUseUIStore: vi.fn(),
  mockNotifyError: vi.fn(),
  mockDismiss: vi.fn(),
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
vi.mock("../db/items", () => ({ createBlankItem: vi.fn() }));
vi.mock("../utils/export", () => ({
  exportSession: mockExportSession,
  exportSessionAsSpreadsheet: mockExportSpreadsheet,
}));
vi.mock("../stores/uiStore", () => ({ useUIStore: mockUseUIStore }));
vi.mock("../stores/notificationStore", () => ({
  useNotificationStore: {
    getState: () => ({ notifyError: mockNotifyError, dismiss: mockDismiss }),
  },
}));

// ConfirmDialog mock: render a clickable confirm button when open so the JSON
// export path (gated behind a confirmation) is reachable in the test.
vi.mock("../components/ConfirmDialog", () => ({
  ConfirmDialog: ({
    open,
    onConfirm,
    confirmLabel,
  }: {
    open: boolean;
    onConfirm?: () => void;
    confirmLabel?: string;
  }) =>
    open ? (
      <button type="button" onClick={onConfirm}>
        confirm-{confirmLabel}
      </button>
    ) : null,
}));

vi.mock("../components/ItemList", () => ({
  ItemList: () => <div data-testid="item-list">Items</div>,
}));
vi.mock("../components/ExportHistoryList", () => ({ ExportHistoryList: () => null }));
vi.mock("../components/RecordingIndicator", () => ({ RecordingIndicator: () => null }));
vi.mock("../components/RecordingToast", () => ({ RecordingToast: () => null }));

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

describe("SessionDetail export failure surfacing (SC1, D-08)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUserRole.mockReturnValue({ role: "admin", isAdmin: true, loading: false });
    mockUseSession.mockReturnValue(testSession);
    mockUseSessionItemCount.mockReturnValue(5);
    mockUseSessionItems.mockReturnValue([]);
    mockUseSessionStore.mockImplementation(
      (selector: (s: Record<string, unknown>) => unknown) =>
        selector({ fetchItems: vi.fn(), updateSession: mockStoreUpdateSession }),
    );
    mockUseUIStore.mockImplementation(
      (selector: (s: Record<string, unknown>) => unknown) =>
        selector({ recordingSessionId: null, setRecordingSession: vi.fn() }),
    );
    mockListAccounts.mockResolvedValue([]);
    mockStoreUpdateSession.mockResolvedValue(undefined);
  });

  it("JSON export failure calls notifyError with friendly copy + a retry callback", async () => {
    mockExportSession.mockRejectedValue(new Error("disk full"));

    renderSessionDetail();

    fireEvent.click(screen.getByRole("button", { name: /Finalize/i }));
    fireEvent.click(await screen.findByRole("button", { name: "confirm-Export" }));

    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledTimes(1));
    expect(mockNotifyError).toHaveBeenCalledWith(
      "Export failed — your data wasn't downloaded.",
      expect.any(Function),
    );
  });

  it("spreadsheet export failure calls notifyError with friendly copy + retry", async () => {
    mockExportSpreadsheet.mockRejectedValue(new Error("boom"));

    renderSessionDetail();

    fireEvent.click(screen.getByRole("button", { name: /Export Spreadsheet/i }));

    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledTimes(1));
    expect(mockNotifyError).toHaveBeenCalledWith(
      "Export failed — your data wasn't downloaded.",
      expect.any(Function),
    );
  });

  it("the retry callback re-runs the spreadsheet export", async () => {
    mockExportSpreadsheet.mockRejectedValueOnce(new Error("boom"));

    renderSessionDetail();
    fireEvent.click(screen.getByRole("button", { name: /Export Spreadsheet/i }));

    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledTimes(1));
    const retry = mockNotifyError.mock.calls[0][1] as () => void;

    mockExportSpreadsheet.mockClear();
    mockExportSpreadsheet.mockResolvedValueOnce(undefined);
    retry();
    await waitFor(() => expect(mockExportSpreadsheet).toHaveBeenCalledWith("session-1"));
  });
});
