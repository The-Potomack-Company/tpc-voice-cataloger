import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";

// --- Mocks (vi.hoisted so factories see them) ---
const {
  mockCreateSession,
  mockDeleteSession,
  mockCreateBlankItem,
  mockUpdateItemField,
  mockDeleteItem,
  mockNotifyError,
  mockDismiss,
  mockNavigate,
} = vi.hoisted(() => ({
  mockCreateSession: vi.fn(),
  mockDeleteSession: vi.fn(),
  mockCreateBlankItem: vi.fn(),
  mockUpdateItemField: vi.fn(),
  mockDeleteItem: vi.fn(),
  mockNotifyError: vi.fn(),
  mockDismiss: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock("../db/sessions", () => ({
  createSession: mockCreateSession,
  deleteSession: mockDeleteSession,
}));

vi.mock("../db/items", () => ({
  createBlankItem: mockCreateBlankItem,
  updateItemField: mockUpdateItemField,
  deleteItem: mockDeleteItem,
}));

vi.mock("../stores/notificationStore", () => ({
  useNotificationStore: {
    getState: () => ({ notifyError: mockNotifyError, dismiss: mockDismiss }),
  },
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return { ...actual, useNavigate: () => mockNavigate };
});

// Admin path adds an "Assign To" gate we don't want here — keep non-admin.
vi.mock("../hooks/useUserRole", () => ({
  useUserRole: () => ({ isAdmin: false }),
}));

vi.mock("../hooks/useSessions", () => ({
  useActiveSessions: () => [],
}));

// ImportReceiptsButton: stub that exposes a button which fires onImport with a
// fixed receipt list, so we can drive handleImport without parsing a real file.
const TEST_RECEIPTS = ["R1", "R2", "R3"];
vi.mock("../components/ImportReceiptsButton", () => ({
  ImportReceiptsButton: ({
    onImport,
  }: {
    onImport: (receipts: string[], skipped: number) => void;
  }) => (
    <button type="button" onClick={() => onImport(TEST_RECEIPTS, 0)}>
      mock-import
    </button>
  ),
}));

import { NewSessionPage } from "../pages/NewSession";

function renderNewSession() {
  return render(
    <MemoryRouter>
      <NewSessionPage />
    </MemoryRouter>,
  );
}

async function selectSaleModeAndName(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Session Name"), "Test Sale");
  await user.click(screen.getByRole("button", { name: /Sale Cataloging/i }));
}

describe("NewSession import compensating rollback (SC2, D-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateSession.mockResolvedValue("session-1");
    mockDeleteSession.mockResolvedValue(undefined);
    mockDeleteItem.mockResolvedValue(undefined);
    mockUpdateItemField.mockResolvedValue(undefined);
    // CR-01: jsdom defaults navigator.onLine to true; ensure online for the
    // happy/rollback paths and override per-test for the offline-refusal case.
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  it("CR-01: refuses the import when offline — creates nothing, no navigate", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    const user = userEvent.setup();
    renderNewSession();
    await selectSaleModeAndName(user);
    await user.click(screen.getByRole("button", { name: "mock-import" }));

    // Transactional import requires connectivity — nothing is created.
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockCreateBlankItem).not.toHaveBeenCalled();
    expect(mockDeleteItem).not.toHaveBeenCalled();
    expect(mockDeleteSession).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockNotifyError).toHaveBeenCalledWith(
      "You're offline — reconnect to import.",
    );
  });

  it("CR-02: duplicate receipt at creation throws → full rollback, no navigate", async () => {
    // createBlankItem now persists receipt_number at creation. A unique-receipt
    // violation surfaces here (createItem reverts + throws) rather than being
    // swallowed by updateItemField. The blank-receipt orphan must roll back.
    const dupErr = Object.assign(new Error("duplicate key value"), {
      code: "23505",
    });
    mockCreateBlankItem
      .mockResolvedValueOnce("item-1")
      .mockRejectedValueOnce(dupErr);

    const user = userEvent.setup();
    renderNewSession();
    await selectSaleModeAndName(user);
    await user.click(screen.getByRole("button", { name: "mock-import" }));

    // The one created item is rolled back, then the session — reverse order.
    expect(mockDeleteItem).toHaveBeenCalledTimes(1);
    expect(mockDeleteItem).toHaveBeenCalledWith("item-1", "session-1");
    expect(mockDeleteSession).toHaveBeenCalledTimes(1);
    expect(mockDeleteSession).toHaveBeenCalledWith("session-1");
    // No false success: the loop never reaches navigate().
    expect(mockNavigate).not.toHaveBeenCalled();
    // 23505 names the offending receipt (R2 is the collider — item-1 resolves,
    // the 2nd createBlankItem rejects). Retry callback preserved.
    expect(mockNotifyError).toHaveBeenCalledWith(
      expect.stringContaining("R2"),
      expect.any(Function),
    );
  });

  it("WR-01: a pre-loop 23505 (createSession) keeps generic copy — never 'Receipt #undefined'", async () => {
    // A 23505 thrown before the receipt loop has no identified collider:
    // lastReceipt is still undefined, so the dup branch must NOT fire.
    mockCreateSession.mockReset();
    const dupErr = Object.assign(new Error("duplicate key value"), {
      code: "23505",
    });
    mockCreateSession.mockRejectedValue(dupErr);

    const user = userEvent.setup();
    renderNewSession();
    await selectSaleModeAndName(user);
    await user.click(screen.getByRole("button", { name: "mock-import" }));

    // No collider identified → generic copy, not the receipt-naming branch.
    expect(mockNotifyError).toHaveBeenCalledWith(
      "Import didn't finish — changes were undone. Try again.",
      expect.any(Function),
    );
    const [[msg]] = mockNotifyError.mock.calls;
    expect(msg).not.toContain("undefined");
    expect(mockCreateBlankItem).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("CR-02: clean import passes each receipt to createBlankItem at creation", async () => {
    mockCreateBlankItem
      .mockResolvedValueOnce("item-1")
      .mockResolvedValueOnce("item-2")
      .mockResolvedValueOnce("item-3");

    const user = userEvent.setup();
    renderNewSession();
    await selectSaleModeAndName(user);
    await user.click(screen.getByRole("button", { name: "mock-import" }));

    expect(mockCreateBlankItem).toHaveBeenNthCalledWith(1, "session-1", "sale", "R1");
    expect(mockCreateBlankItem).toHaveBeenNthCalledWith(2, "session-1", "sale", "R2");
    expect(mockCreateBlankItem).toHaveBeenNthCalledWith(3, "session-1", "sale", "R3");
    // updateItemField is no longer used by the import path.
    expect(mockUpdateItemField).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/session/session-1");
  });

  it("rolls back created item + session (reverse order) and notifies on mid-loop failure", async () => {
    // 1st item created, 2nd item creation throws mid-loop.
    mockCreateBlankItem
      .mockResolvedValueOnce("item-1")
      .mockRejectedValueOnce(new Error("boom"));

    const user = userEvent.setup();
    renderNewSession();
    await selectSaleModeAndName(user);
    await user.click(screen.getByRole("button", { name: "mock-import" }));

    // The one created item is deleted, then the session — reverse of creation.
    expect(mockDeleteItem).toHaveBeenCalledTimes(1);
    expect(mockDeleteItem).toHaveBeenCalledWith("item-1", "session-1");
    expect(mockDeleteSession).toHaveBeenCalledTimes(1);
    expect(mockDeleteSession).toHaveBeenCalledWith("session-1");

    const deleteItemOrder = mockDeleteItem.mock.invocationCallOrder[0];
    const deleteSessionOrder = mockDeleteSession.mock.invocationCallOrder[0];
    expect(deleteItemOrder).toBeLessThan(deleteSessionOrder);

    expect(mockNotifyError).toHaveBeenCalledTimes(1);
    expect(mockNotifyError).toHaveBeenCalledWith(
      "Import didn't finish — changes were undone. Try again.",
      expect.any(Function),
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("clean import creates all items, navigates, and never deletes or notifies", async () => {
    mockCreateBlankItem
      .mockResolvedValueOnce("item-1")
      .mockResolvedValueOnce("item-2")
      .mockResolvedValueOnce("item-3");

    const user = userEvent.setup();
    renderNewSession();
    await selectSaleModeAndName(user);
    await user.click(screen.getByRole("button", { name: "mock-import" }));

    expect(mockCreateBlankItem).toHaveBeenCalledTimes(3);
    expect(mockDeleteItem).not.toHaveBeenCalled();
    expect(mockDeleteSession).not.toHaveBeenCalled();
    expect(mockNotifyError).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/session/session-1");
  });

  it("retry callback from a failed import re-runs the import", async () => {
    mockCreateBlankItem
      .mockResolvedValueOnce("item-1")
      .mockRejectedValueOnce(new Error("boom"));

    const user = userEvent.setup();
    renderNewSession();
    await selectSaleModeAndName(user);
    await user.click(screen.getByRole("button", { name: "mock-import" }));

    const retry = mockNotifyError.mock.calls[0][1] as () => void;

    // Second attempt fully succeeds — proves retry re-runs handleImport.
    mockCreateBlankItem
      .mockResolvedValueOnce("item-1")
      .mockResolvedValueOnce("item-2")
      .mockResolvedValueOnce("item-3");
    mockNavigate.mockClear();

    retry();
    await vi.waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/session/session-1"),
    );
  });

  it("doCreate failure surfaces a notify with retry and does not navigate", async () => {
    mockCreateSession.mockReset();
    mockCreateSession.mockRejectedValue(new Error("network down"));

    const user = userEvent.setup();
    renderNewSession();
    await user.type(screen.getByLabelText("Session Name"), "Test House");
    await user.click(screen.getByRole("button", { name: "Start Session" }));

    await vi.waitFor(() => expect(mockNotifyError).toHaveBeenCalledTimes(1));
    expect(mockNotifyError).toHaveBeenCalledWith(
      "Couldn't create the session — nothing was saved. Try again.",
      expect.any(Function),
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
