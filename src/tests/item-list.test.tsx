import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ItemList } from "../components/ItemList";

// Mock useAudioRecorder to avoid MediaRecorder in component tests
vi.mock("../hooks/useAudioRecorder", () => ({
  useAudioRecorder: () => ({
    status: "idle" as const,
    durationMs: 0,
    error: null,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
  }),
}));

// Mock processAudioWithAi
vi.mock("../services/gemini", () => ({
  processAudioWithAi: vi.fn(),
}));

// Mock sessionStore
const { mockItems } = vi.hoisted(() => ({
  mockItems: { current: [] as Array<Record<string, unknown>> },
}));

vi.mock("../stores/sessionStore", () => ({
  useSessionStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) => {
    const state = {
      itemsBySession: { "session-1": mockItems.current },
      fetchItems: vi.fn(),
    };
    return selector(state);
  }),
}));

// Mock hooks that depend on sessionStore
vi.mock("../hooks/useSessions", () => ({
  useSessionItems: () => mockItems.current,
  useSessionItemCount: () => mockItems.current.length,
}));

// Mock Dexie for photo queries
vi.mock("../db", () => ({
  db: {
    photos: { where: vi.fn().mockReturnValue({ equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }) }) },
    audio: { where: vi.fn().mockReturnValue({ equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }) }) },
  },
}));

// Mock dexie-react-hooks
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: (fn: () => unknown) => {
    try { return fn(); } catch { return undefined; }
  },
}));

// Mock useWriteAheadQueue
vi.mock("../hooks/useWriteAheadQueue", () => ({
  hasPendingForItem: vi.fn().mockResolvedValue(false),
}));

// Mock idMapping
vi.mock("../db/idMapping", () => ({
  getDexieItemId: vi.fn().mockResolvedValue(null),
}));

// Mock db/items
vi.mock("../db/items", () => ({
  createBlankItem: vi.fn().mockResolvedValue("new-item-uuid"),
  updateItemField: vi.fn().mockResolvedValue(undefined),
  deleteItem: vi.fn().mockResolvedValue(undefined),
}));

// Mock photoUploadQueue
vi.mock("../services/photoUploadQueue", () => ({
  enqueuePhotoUpload: vi.fn(),
  drainPhotoQueue: vi.fn(),
}));

// Mock usePhotoUrl
vi.mock("../hooks/usePhotoUrl", () => ({
  usePhotoUrl: () => undefined,
}));

beforeEach(() => {
  mockItems.current = [];
});

describe("ItemList", () => {
  it("shows empty state when no items exist", () => {
    render(<MemoryRouter><ItemList sessionId="session-1" mode="house" /></MemoryRouter>);
    expect(screen.getByText(/No items yet/)).toBeInTheDocument();
  });

  it("renders items as cards with correct item numbers", async () => {
    mockItems.current = [
      {
        id: "item-uuid-1",
        session_id: "session-1",
        mode: "house",
        title: "Antique Chair",
        description: null,
        condition: null,
        estimate: null,
        measurements: null,
        category: null,
        transcript: null,
        receipt_number: null,
        sort_order: 0,
        ai_status: "done",
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "item-uuid-2",
        session_id: "session-1",
        mode: "house",
        title: "Oak Table",
        description: null,
        condition: null,
        estimate: null,
        measurements: null,
        category: null,
        transcript: null,
        receipt_number: null,
        sort_order: 1,
        ai_status: "done",
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    render(<MemoryRouter><ItemList sessionId="session-1" mode="house" /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText(/Item 1/)).toBeInTheDocument();
      expect(screen.getByText(/Item 2/)).toBeInTheDocument();
    });
  });

  it("navigates sale card to detail view on tap", async () => {
    mockItems.current = [
      {
        id: "item-uuid-1",
        session_id: "session-1",
        mode: "sale",
        title: "Vase",
        description: "Blue porcelain",
        condition: null,
        estimate: null,
        measurements: null,
        category: null,
        transcript: null,
        receipt_number: "12345-1",
        sort_order: 0,
        ai_status: "done",
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    render(<MemoryRouter><ItemList sessionId="session-1" mode="sale" /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText(/12345-1/)).toBeInTheDocument();
    });

    // Click navigates to detail view (same as house mode) — no inline expansion
    fireEvent.click(screen.getByText(/12345-1/));

    // Sale cards no longer expand inline; they navigate to /session/:id/item/:itemId
    // Since we're in MemoryRouter, navigation won't render the target page,
    // but we verify no inline expansion occurs (no field labels appear)
    expect(screen.queryByText("Title")).not.toBeInTheDocument();
  });

  it("shows Add Item button when items exist", async () => {
    mockItems.current = [
      {
        id: "item-uuid-1",
        session_id: "session-1",
        mode: "house",
        title: "Item A",
        description: null,
        condition: null,
        estimate: null,
        measurements: null,
        category: null,
        transcript: null,
        receipt_number: null,
        sort_order: 0,
        ai_status: "done",
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    render(<MemoryRouter><ItemList sessionId="session-1" mode="house" /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText("Add Item")).toBeInTheDocument();
    });
  });
});
