import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Tables } from "../db/database.types";

type SupabaseItem = Tables<"items">;

// Mock supabase
const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const mockDelete = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const mockPhotosUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

vi.mock("../lib/supabase", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "items") {
        return {
          update: mockUpdate,
          delete: mockDelete,
        };
      }
      if (table === "photos") {
        return {
          update: mockPhotosUpdate,
        };
      }
      return {};
    }),
  },
}));

// Mock Dexie db
const mockPhotosModify = vi.fn().mockResolvedValue(undefined);
const mockAudioModify = vi.fn().mockResolvedValue(undefined);

vi.mock("../db", () => ({
  db: {
    photos: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          modify: mockPhotosModify,
        }),
      }),
    },
    audio: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          modify: mockAudioModify,
        }),
      }),
    },
  },
}));

// Mock idMapping
vi.mock("../db/idMapping", () => ({
  getDexieItemId: vi.fn().mockImplementation((id: string) => {
    if (id === "target-id") return Promise.resolve(100);
    if (id === "source-id") return Promise.resolve(200);
    return Promise.resolve(null);
  }),
}));

// Mock sessionStore
const mockFetchItems = vi.fn().mockResolvedValue(undefined);

vi.mock("../stores/sessionStore", () => ({
  useSessionStore: {
    getState: vi.fn(() => ({
      itemsBySession: {
        "session-1": [
          {
            id: "target-id",
            session_id: "session-1",
            mode: "house",
            sort_order: 0,
            title: "Chair",
            description: "Wooden chair",
            condition: "Good",
            estimate: "$100",
            measurements: "30x30",
            category: "Furniture",
            transcript: "One chair",
            receipt_number: "R001",
            ai_status: "done",
            created_at: "2026-01-01T00:00:00Z",
          },
          {
            id: "source-id",
            session_id: "session-1",
            mode: "house",
            sort_order: 1,
            title: "Ottoman",
            description: "Matching ottoman",
            condition: "Fair",
            estimate: "$50",
            measurements: "20x20",
            category: "Seating",
            transcript: "And an ottoman",
            receipt_number: "R002",
            ai_status: "done",
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
      },
      fetchItems: mockFetchItems,
    })),
  },
}));

function makeItem(overrides: Partial<SupabaseItem> = {}): SupabaseItem {
  return {
    id: "item-1",
    session_id: "session-1",
    mode: "house",
    sort_order: 0,
    title: null,
    description: null,
    condition: null,
    estimate: null,
    measurements: null,
    category: null,
    transcript: null,
    receipt_number: null,
    ai_status: "done",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("mergeFields", () => {
  it("concatenates titles with semicolon when both have values", async () => {
    const { mergeFields } = await import("../services/mergeItems");
    const target = makeItem({ title: "Chair" });
    const source = makeItem({ title: "Ottoman" });
    const result = mergeFields(target, source);
    expect(result.title).toBe("Chair; Ottoman");
  });

  it("uses single value when only target has title", async () => {
    const { mergeFields } = await import("../services/mergeItems");
    const target = makeItem({ title: "Chair" });
    const source = makeItem({ title: null });
    const result = mergeFields(target, source);
    expect(result.title).toBe("Chair");
  });

  it("uses single value when only source has title", async () => {
    const { mergeFields } = await import("../services/mergeItems");
    const target = makeItem({ title: null });
    const source = makeItem({ title: "Ottoman" });
    const result = mergeFields(target, source);
    expect(result.title).toBe("Ottoman");
  });

  it("returns null when neither has title", async () => {
    const { mergeFields } = await import("../services/mergeItems");
    const target = makeItem({});
    const source = makeItem({});
    const result = mergeFields(target, source);
    expect(result.title).toBeNull();
  });

  it("concatenates description with newline", async () => {
    const { mergeFields } = await import("../services/mergeItems");
    const target = makeItem({ description: "Wooden chair" });
    const source = makeItem({ description: "Matching ottoman" });
    const result = mergeFields(target, source);
    expect(result.description).toBe("Wooden chair\nMatching ottoman");
  });

  it("concatenates transcript with newline", async () => {
    const { mergeFields } = await import("../services/mergeItems");
    const target = makeItem({ transcript: "One chair" });
    const source = makeItem({ transcript: "And an ottoman" });
    const result = mergeFields(target, source);
    expect(result.transcript).toBe("One chair\nAnd an ottoman");
  });

  it("concatenates estimate with semicolon", async () => {
    const { mergeFields } = await import("../services/mergeItems");
    const target = makeItem({ estimate: "$100" });
    const source = makeItem({ estimate: "$50" });
    const result = mergeFields(target, source);
    expect(result.estimate).toBe("$100; $50");
  });

  it("concatenates condition with semicolon", async () => {
    const { mergeFields } = await import("../services/mergeItems");
    const target = makeItem({ condition: "Good" });
    const source = makeItem({ condition: "Fair" });
    const result = mergeFields(target, source);
    expect(result.condition).toBe("Good; Fair");
  });

  it("concatenates measurements with semicolon", async () => {
    const { mergeFields } = await import("../services/mergeItems");
    const target = makeItem({ measurements: "30x30" });
    const source = makeItem({ measurements: "20x20" });
    const result = mergeFields(target, source);
    expect(result.measurements).toBe("30x30; 20x20");
  });

  it("keeps target category when both have values", async () => {
    const { mergeFields } = await import("../services/mergeItems");
    const target = makeItem({ category: "Furniture" });
    const source = makeItem({ category: "Seating" });
    const result = mergeFields(target, source);
    expect(result.category).toBe("Furniture");
  });

  it("uses source category when target has none", async () => {
    const { mergeFields } = await import("../services/mergeItems");
    const target = makeItem({ category: null });
    const source = makeItem({ category: "Seating" });
    const result = mergeFields(target, source);
    expect(result.category).toBe("Seating");
  });

  it("keeps target receipt_number", async () => {
    const { mergeFields } = await import("../services/mergeItems");
    const target = makeItem({ receipt_number: "R001" });
    const source = makeItem({ receipt_number: "R002" });
    const result = mergeFields(target, source);
    expect(result.receipt_number).toBe("R001");
  });

  it("uses source receipt_number when target has none", async () => {
    const { mergeFields } = await import("../services/mergeItems");
    const target = makeItem({ receipt_number: null });
    const source = makeItem({ receipt_number: "R002" });
    const result = mergeFields(target, source);
    expect(result.receipt_number).toBe("R002");
  });

  it("sets ai_status to done when both are done", async () => {
    const { mergeFields } = await import("../services/mergeItems");
    const target = makeItem({ ai_status: "done" });
    const source = makeItem({ ai_status: "done" });
    const result = mergeFields(target, source);
    expect(result.ai_status).toBe("done");
  });

  it("keeps target ai_status when source is not done", async () => {
    const { mergeFields } = await import("../services/mergeItems");
    const target = makeItem({ ai_status: "processing" });
    const source = makeItem({ ai_status: "done" });
    const result = mergeFields(target, source);
    expect(result.ai_status).toBe("processing");
  });
});

describe("mergeItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls supabase and dexie in correct sequence", async () => {
    // Re-setup mocks after clearAllMocks
    mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    mockPhotosUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    mockDelete.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    const { mergeItems } = await import("../services/mergeItems");
    await mergeItems("target-id", "source-id", "session-1");

    // Should have updated target item fields
    expect(mockUpdate).toHaveBeenCalled();
    // Should have reassigned photos
    expect(mockPhotosUpdate).toHaveBeenCalled();
    // Should have deleted source item
    expect(mockDelete).toHaveBeenCalled();
    // Should have refreshed store
    expect(mockFetchItems).toHaveBeenCalledWith("session-1");
  });
});
