import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { ItemEntryPage } from "../pages/ItemEntry";

const { mockItems, mockFetchItems } = vi.hoisted(() => ({
  mockItems: [] as Array<Record<string, unknown>>,
  mockFetchItems: vi.fn(),
}));

vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: (_fn: unknown, _deps: unknown, initial: unknown) => initial,
}));

vi.mock("../hooks/useSessions", () => ({
  useSession: () => ({ id: "session-1", mode: "house" }),
  useSessionItems: () => mockItems,
}));

vi.mock("../stores/sessionStore", () => ({
  useSessionStore: vi.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({ fetchItems: mockFetchItems })
  ),
}));

vi.mock("../db/items", () => ({
  createBlankItem: vi.fn(),
  updateItemField: vi.fn(),
}));

vi.mock("../db/idMapping", () => ({
  getDexieItemId: vi.fn(() => new Promise(() => {})),
}));

vi.mock("../db/audioLookup", () => ({
  audioRecordsForItem: vi.fn().mockResolvedValue([]),
}));

vi.mock("../components/PhotoCapture", () => ({
  PhotoCapture: () => <div data-testid="photo-capture" />,
}));

vi.mock("../components/RecordButton", () => ({
  RecordButton: () => <button type="button">Record</button>,
}));

describe("ItemEntryPage waiting indicator", () => {
  beforeEach(() => {
    mockFetchItems.mockReset();
    mockItems.length = 0;
    mockItems.push({
      id: "item-1",
      mode: "house",
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
});
