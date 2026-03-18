import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "../db";

// --- Mocks for Supabase ---
const {
  mockFrom,
  mockSupabaseSelect,
  mockSupabaseEq,
  mockSupabaseOrder,
  mockSupabaseSingle,
  mockSupabaseInsert,
  mockSupabaseHead,
} = vi.hoisted(() => {
  return {
    mockFrom: vi.fn(),
    mockSupabaseSelect: vi.fn(),
    mockSupabaseEq: vi.fn(),
    mockSupabaseOrder: vi.fn(),
    mockSupabaseSingle: vi.fn(),
    mockSupabaseInsert: vi.fn(),
    mockSupabaseHead: vi.fn(),
  };
});

vi.mock("../lib/supabase", () => ({
  supabase: {
    from: mockFrom,
  },
}));

// Mock getDexieItemId
const { mockGetDexieItemId } = vi.hoisted(() => {
  return { mockGetDexieItemId: vi.fn() };
});

vi.mock("../db/idMapping", () => ({
  getDexieItemId: mockGetDexieItemId,
}));

// Mock authStore for export
const { mockAuthStore } = vi.hoisted(() => {
  return {
    mockAuthStore: {
      user: { id: "user-uuid-123" },
    },
  };
});

vi.mock("../stores/authStore", () => ({
  useAuthStore: {
    getState: () => mockAuthStore,
  },
}));

beforeEach(async () => {
  await db.delete();
  await db.open();
  vi.clearAllMocks();
  mockFrom.mockReset();
  mockSupabaseSelect.mockReset();
  mockSupabaseEq.mockReset();
  mockSupabaseOrder.mockReset();
  mockSupabaseSingle.mockReset();
  mockSupabaseInsert.mockReset();
  mockSupabaseHead.mockReset();
  mockGetDexieItemId.mockReset();
});

describe("blobToBase64", () => {
  it("converts a Blob to a data URL string", async () => {
    const { blobToBase64 } = await import("../utils/export");
    const blob = new Blob(["hello"], { type: "text/plain" });
    const result = await blobToBase64(blob);
    expect(result).toMatch(/^data:text\/plain;base64,/);
  });
});

describe("buildExportData", () => {
  function setupSessionResponse(session: Record<string, unknown>) {
    mockFrom.mockImplementation((table: string) => {
      if (table === "sessions") {
        return {
          select: mockSupabaseSelect.mockReturnValue({
            eq: mockSupabaseEq.mockReturnValue({
              single: mockSupabaseSingle.mockResolvedValue({
                data: session,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "items") {
        return {
          select: mockSupabaseSelect.mockReturnValue({
            eq: mockSupabaseEq.mockReturnValue({
              order: mockSupabaseOrder.mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });
  }

  function setupFullResponse(
    session: Record<string, unknown>,
    items: Array<Record<string, unknown>>,
  ) {
    mockFrom.mockImplementation((table: string) => {
      if (table === "sessions") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: session,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "items") {
        return {
          select: () => ({
            eq: () => ({
              order: vi.fn().mockResolvedValue({
                data: items,
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });
  }

  it("reads session from Supabase via supabase.from('sessions')", async () => {
    const { buildExportData } = await import("../utils/export");

    const session = {
      id: "sess-uuid-1",
      name: "Test Session",
      mode: "house",
      status: "active",
      notes: "Some notes",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      created_by: "user-uuid-123",
      assigned_to: null,
      review_notes: null,
    };

    setupFullResponse(session, []);

    const data = await buildExportData("sess-uuid-1");

    expect(data.version).toBe(1);
    expect(data.exportedAt).toBeTruthy();
    expect(data.session.name).toBe("Test Session");
    expect(data.session.mode).toBe("house");
  });

  it("reads items from Supabase via supabase.from('items')", async () => {
    const { buildExportData } = await import("../utils/export");

    const session = {
      id: "sess-uuid-1",
      name: "Multi Item",
      mode: "house",
      status: "active",
      notes: "",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      created_by: "user-uuid-123",
      assigned_to: null,
      review_notes: null,
    };

    const items = [
      {
        id: "item-uuid-1",
        session_id: "sess-uuid-1",
        mode: "house",
        title: "First",
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
        session_id: "sess-uuid-1",
        mode: "house",
        title: "Second",
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

    setupFullResponse(session, items);
    mockGetDexieItemId.mockResolvedValue(null); // post-migration items

    const data = await buildExportData("sess-uuid-1");

    expect(data.items).toHaveLength(2);
    expect(data.items[0].title).toBe("First");
    expect(data.items[1].title).toBe("Second");
  });

  it("reads photos/audio from Dexie via getDexieItemId for migrated items", async () => {
    const { buildExportData } = await import("../utils/export");

    const session = {
      id: "sess-uuid-1",
      name: "Photo Test",
      mode: "house",
      status: "active",
      notes: "",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      created_by: "user-uuid-123",
      assigned_to: null,
      review_notes: null,
    };

    const items = [
      {
        id: "item-uuid-1",
        session_id: "sess-uuid-1",
        mode: "house",
        title: "With Photo",
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

    setupFullResponse(session, items);

    // Migrated item: getDexieItemId returns legacy integer ID
    mockGetDexieItemId.mockResolvedValue(42);

    // Add photo and audio to Dexie with legacy integer itemId
    await db.photos.add({
      itemId: 42,
      itemType: "house",
      blob: new Blob(["photo-data"], { type: "image/jpeg" }),
      sortOrder: 0,
      createdAt: new Date(),
    });
    await db.audio.add({
      itemId: 42,
      itemType: "house",
      blob: new Blob(["audio-data"], { type: "audio/webm" }),
      mimeType: "audio/webm",
      durationMs: 5000,
      createdAt: new Date(),
    });

    const data = await buildExportData("sess-uuid-1");

    expect(data.items[0].photos).toHaveLength(1);
    expect(data.items[0].photos[0].blob).toMatch(/^data:/);
    expect(data.items[0].audio).toHaveLength(1);
    expect(data.items[0].audio[0].mimeType).toBe("audio/webm");
  });

  it("handles session with zero items", async () => {
    const { buildExportData } = await import("../utils/export");

    setupFullResponse(
      {
        id: "sess-uuid-1",
        name: "Empty Session",
        mode: "house",
        status: "active",
        notes: "",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        created_by: "user-uuid-123",
        assigned_to: null,
        review_notes: null,
      },
      [],
    );

    const data = await buildExportData("sess-uuid-1");
    expect(data.items).toEqual([]);
  });

  it("throws when session not found", async () => {
    const { buildExportData } = await import("../utils/export");

    mockFrom.mockImplementation((table: string) => {
      if (table === "sessions") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: "Not found" },
              }),
            }),
          }),
        };
      }
      return {};
    });

    await expect(buildExportData("nonexistent")).rejects.toThrow();
  });
});

describe("exportSession", () => {
  it("records export to Supabase export_history table", async () => {
    const { exportSession } = await import("../utils/export");

    const session = {
      id: "sess-uuid-1",
      name: "Export Test",
      mode: "house",
      status: "active",
      notes: "",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      created_by: "user-uuid-123",
      assigned_to: null,
      review_notes: null,
    };

    let insertData: Record<string, unknown> | null = null;

    mockFrom.mockImplementation((table: string) => {
      if (table === "sessions") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: session,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "items") {
        return {
          select: () => ({
            eq: () => ({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "export_history") {
        return {
          insert: (data: Record<string, unknown>) => {
            insertData = data;
            return { error: null };
          },
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: null,
                count: 0,
              }),
            }),
          }),
        };
      }
      return {};
    });

    // Mock DOM
    const clickMock = vi.fn();
    const fakeAnchor = {
      href: "",
      download: "",
      click: clickMock,
      style: {},
      setAttribute: vi.fn(),
    } as unknown as HTMLAnchorElement;

    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValue(fakeAnchor);

    await exportSession("sess-uuid-1");

    expect(createElementSpy).toHaveBeenCalledWith("a");
    expect(clickMock).toHaveBeenCalled();
    expect(insertData).not.toBeNull();
    expect((insertData as Record<string, unknown>).session_id).toBe(
      "sess-uuid-1",
    );
    expect((insertData as Record<string, unknown>).session_name).toBe(
      "Export Test",
    );

    createElementSpy.mockRestore();
  });
});

describe("sanitizeFilename", () => {
  it("replaces slashes, colons, and other unsafe characters with dashes", async () => {
    const { sanitizeFilename } = await import("../utils/export");
    expect(sanitizeFilename("test/file:name*foo")).toBe("test-file-name-foo");
  });

  it("trims leading/trailing dots and spaces", async () => {
    const { sanitizeFilename } = await import("../utils/export");
    expect(sanitizeFilename("  ..hello world..  ")).toBe("hello world");
  });

  it("collapses consecutive dashes into one", async () => {
    const { sanitizeFilename } = await import("../utils/export");
    expect(sanitizeFilename("a///b")).toBe("a-b");
  });

  it("returns empty string for all-unsafe input", async () => {
    const { sanitizeFilename } = await import("../utils/export");
    expect(sanitizeFilename("///")).toBe("");
  });
});
