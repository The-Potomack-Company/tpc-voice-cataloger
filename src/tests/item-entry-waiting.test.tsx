import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { ItemEntryPage } from "../pages/ItemEntry";

const { mockItems, mockFetchItems, mockCreateBlankItem, mockUseSession } = vi.hoisted(() => ({
  mockItems: [] as Array<Record<string, unknown>>,
  mockFetchItems: vi.fn(),
  mockCreateBlankItem: vi.fn(),
  mockUseSession: vi.fn(),
}));

vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: (_fn: unknown, _deps: unknown, initial: unknown) => initial,
}));

vi.mock("../hooks/useSessions", () => ({
  useSession: mockUseSession,
  useSessionItems: () => mockItems,
}));

vi.mock("../stores/sessionStore", () => ({
  useSessionStore: vi.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({ fetchItems: mockFetchItems })
  ),
}));

vi.mock("../db/items", () => ({
  createBlankItem: mockCreateBlankItem,
  updateItemField: vi.fn(),
}));

vi.mock("../db/idMapping", () => ({
  getDexieItemId: vi.fn(() => new Promise(() => {})),
}));

vi.mock("../db/audioLookup", () => ({
  audioRecordsForItem: vi.fn().mockResolvedValue([]),
}));

vi.mock("../components/RecordButton", () => ({
  RecordButton: () => <button type="button">Record</button>,
}));

describe("ItemEntryPage waiting indicator", () => {
  beforeEach(() => {
    mockFetchItems.mockReset();
    mockCreateBlankItem.mockReset();
    mockCreateBlankItem.mockResolvedValue("item-2");
    mockUseSession.mockReset();
    mockUseSession.mockReturnValue({ id: "session-1", mode: "sale" });
    mockItems.length = 0;
    mockItems.push({
      id: "item-1",
      mode: "sale",
      sort_order: 0,
      ai_status: "pending",
      title: null,
      description: null,
      measurements: null,
      condition: null,
      estimate: null,
      category: null,
      transcript: null,
      receipt_number: null,
    });
    window.scrollTo = vi.fn();
  });

  it("renders the waiting indicator for a pending item", () => {
    render(
      <MemoryRouter initialEntries={["/session/session-1/item/item-1"]}>
        <Routes>
          <Route path="/session/:sessionId/item/:itemId" element={<ItemEntryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Waiting for connectivity to process..."),
    ).toBeInTheDocument();
  });

  it("creates a new item with the sale session mode unchanged", async () => {
    mockItems.length = 0;

    render(
      <MemoryRouter initialEntries={["/session/session-1/item/new"]}>
        <Routes>
          <Route path="/session/:sessionId/item/:itemId" element={<ItemEntryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockCreateBlankItem).toHaveBeenCalledWith("session-1", "sale");
    });
  });

  it("blocks item creation for a synthetic house-mode session row", async () => {
    mockItems.length = 0;
    mockUseSession.mockReturnValue({ id: "session-1", mode: "house" });

    render(
      <MemoryRouter initialEntries={["/session/session-1/item/new"]}>
        <Routes>
          <Route path="/session/:sessionId/item/:itemId" element={<ItemEntryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "unsupported legacy session mode",
    );
    expect(mockCreateBlankItem).not.toHaveBeenCalled();
  });
});
