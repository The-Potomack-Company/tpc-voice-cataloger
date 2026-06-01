// Wave-0 RED scaffold (Phase 34 plan 00, PERF-3 / D-08). This suite asserts the
// render-fan-out contract that Plan 02 delivers: ItemList owns a single aggregate
// useLiveQuery and ItemCard is React.memo-wrapped with prop-driven meta, so flipping
// ONE item's ai_status re-renders only that card. It forward-references symbols that
// do not exist yet (`__itemCardRenderCounts` on ItemCard) — so it is EXPECTED to be
// RED at this commit: either the import is unresolved or all 3 cards re-render.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ItemList } from "../components/ItemList";
// RED: Plan 02 adds this dev-only render counter to ItemCard. Until then this
// import resolves to `undefined` and the assertions below fail.
import { __itemCardRenderCounts } from "../components/ItemCard";

// --- item source: drive ItemList with a deterministic 3-item array ---
const { mockUseSessionItems } = vi.hoisted(() => ({
  mockUseSessionItems: vi.fn(),
}));
vi.mock("../hooks/useSessions", () => ({
  useSessionItems: mockUseSessionItems,
}));

// --- supporting mocks (copied from item-card-audio-status.test.tsx:28-53) ---
vi.mock("../services/gemini", () => ({ processAudioWithAi: vi.fn() }));
vi.mock("../db", () => ({
  db: {
    photos: { where: vi.fn().mockReturnValue({ equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }) }) },
    audio: { where: vi.fn().mockReturnValue({ equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }) }) },
  },
}));
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: (fn: () => unknown) => {
    try { return fn(); } catch { return undefined; }
  },
}));
vi.mock("../hooks/useWriteAheadQueue", () => ({
  hasPendingForItem: vi.fn().mockResolvedValue(false),
}));
vi.mock("../db/idMapping", () => ({
  getDexieItemId: vi.fn().mockResolvedValue(10),
}));
vi.mock("../db/audioLookup", () => ({
  audioRecordsForItem: vi.fn().mockResolvedValue([{ id: 10 }]),
}));
vi.mock("../db/items", () => ({
  updateItemField: vi.fn(),
  deleteItem: vi.fn(),
  createBlankItem: vi.fn(),
}));
vi.mock("../services/mergeItems", () => ({ mergeItems: vi.fn() }));

function makeItem(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    session_id: "session-uuid-1",
    ai_status: "queued",
    title: "TEST ITEM",
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const ITEM_IDS = ["item-1", "item-2", "item-3"];

function itemsWith(flippedId: string | null) {
  return ITEM_IDS.map((id) =>
    makeItem(id, flippedId === id ? { ai_status: "done" } : {})
  );
}

function renderList() {
  return render(
    <MemoryRouter>
      <ItemList sessionId="session-uuid-1" mode="house" />
    </MemoryRouter>
  );
}

describe("ItemList render fan-out (PERF-3, D-08)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __itemCardRenderCounts.clear();
  });

  it("flipping one item's ai_status re-renders only that card", () => {
    mockUseSessionItems.mockReturnValue(itemsWith(null));
    const { rerender } = renderList();

    const before = new Map(__itemCardRenderCounts);
    expect(before.size).toBe(3);

    // Flip only item-2's status; the other two are unchanged.
    mockUseSessionItems.mockReturnValue(itemsWith("item-2"));
    rerender(
      <MemoryRouter>
        <ItemList sessionId="session-uuid-1" mode="house" />
      </MemoryRouter>
    );

    // Only the flipped card should have re-rendered (React.memo + stable primitive props).
    expect(__itemCardRenderCounts.get("item-2")).toBeGreaterThan(before.get("item-2")!);
    expect(__itemCardRenderCounts.get("item-1")).toBe(before.get("item-1"));
    expect(__itemCardRenderCounts.get("item-3")).toBe(before.get("item-3"));
  });
});
