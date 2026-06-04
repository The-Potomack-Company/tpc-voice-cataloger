// Phase 45 Plan 01 — RED→GREEN: the single-item AI success write must route
// through preconditionUpdate (SEAM-3 lost-write fix). Today gemini.ts:421-424
// does a bare `supabase.from("items").update(supabaseUpdate).eq("id", itemId)` —
// last-writer-wins — so a concurrent human edit to an untouched catalog field is
// silently clobbered. This test pins:
//   (A) the success write calls preconditionUpdate({ table:"items", id, prevUpdatedAt })
//       with a patch carrying ai_status:"done" + completed_at, and NO bare catalog
//       .update().eq("id") write happens.
//   (B) the reconcile passed to preconditionUpdate drops a catalog field another
//       writer changed since the AI read (fresh[field] !== valueAtRead[field], D-06)
//       while keeping control fields + untouched catalog fields.
// RED until Task 2 lands: today gemini.ts never imports/calls preconditionUpdate.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db } from "../db";

const {
  mockFrom,
  mockGetSession,
  mockRefreshSession,
  mockPreconditionUpdate,
} = vi.hoisted(() => {
  return {
    mockFrom: vi.fn(),
    mockGetSession: vi.fn(),
    mockRefreshSession: vi.fn(),
    mockPreconditionUpdate: vi.fn(),
  };
});

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      refreshSession: mockRefreshSession,
    },
    from: mockFrom,
  },
}));

vi.mock("../stores/sessionStore", () => ({
  useSessionStore: {
    getState: () => ({
      fetchItems: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

// Intercept the success write. preconditionUpdate is the primitive the fixed
// gemini.ts must call instead of the bare .update().eq("id").
vi.mock("../db/optimisticUpdate", () => ({
  preconditionUpdate: mockPreconditionUpdate,
}));

type ProcessAudioWithAi = (
  audioId: number,
  itemId: string,
  sessionId: string,
  isRetry?: boolean,
  alreadyClaimed?: boolean,
) => Promise<void>;
let processAudioWithAi: ProcessAudioWithAi;

vi.stubEnv("VITE_GEMINI_PROXY_URL", "https://test-proxy.example.com/api");

function mockGeminiResponse(fields: Record<string, unknown>) {
  return {
    ok: true,
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify(fields) }],
          },
        },
      ],
    }),
  };
}

const ITEM_UUID = "item-uuid-precondition-1";
const SNAPSHOT_TOKEN = "2026-06-04T19:00:00.000Z";

// valueAtRead: the catalog values present when the AI read the snapshot (gemini.ts:254).
const VALUE_AT_READ = {
  title: "OLD TITLE",
  description: "old description",
  condition: "fair",
  estimate: "100",
  category: "GEN",
  measurements: null,
  transcript: "old transcript",
  receipt_number: null,
};

// The success write routes through the mocked preconditionUpdate, so the supabase
// `from("items")` chain only serves the claim write and the snapshot read.
//   - claim:    .update({ai_status:"processing",...}).eq("id").in/eq("ai_status").select("id")
//   - snapshot: .select("...,updated_at").eq("id").maybeSingle()
//   - failure:  .update({ai_status}).eq("id")  (thenable; not exercised on success)
function createMockFrom(options: {
  updateCalls: Array<Record<string, unknown>>;
  snapshot: Record<string, unknown> | null;
}) {
  const { updateCalls, snapshot } = options;
  return () => ({
    update: (data: Record<string, unknown>) => {
      updateCalls.push(data);
      const eqResult = {
        // claim write: .eq("ai_status", [...]) or .in("ai_status", [...]) → .select("id")
        in: vi.fn().mockReturnValue({
          select: vi
            .fn()
            .mockResolvedValue({ data: [{ id: "claimed" }], error: null }),
        }),
        eq: vi.fn().mockReturnValue({
          select: vi
            .fn()
            .mockResolvedValue({ data: [{ id: "claimed" }], error: null }),
        }),
        // failure write: bare .update(update).eq("id") thenable
        then: (resolve: (v: { error: null }) => unknown) =>
          resolve({ error: null }),
      };
      return {
        eq: vi.fn().mockReturnValue(eqResult),
      };
    },
    select: () => ({
      eq: () => ({
        single: vi.fn().mockResolvedValue({ data: snapshot, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: snapshot, error: null }),
      }),
    }),
  });
}

describe("gemini single-item AI success write routes through preconditionUpdate (SEAM-3)", () => {
  let testAudioId: number;

  beforeEach(async () => {
    const mod = await import("../services/gemini");
    processAudioWithAi = mod.processAudioWithAi as unknown as ProcessAudioWithAi;

    await db.audio.clear();
    await db.userEditedFields.clear();

    const audioBlob = new Blob(["fake-audio-data"], {
      type: "audio/webm;codecs=opus",
    });
    testAudioId = (await db.audio.add({
      itemId: 1,
      itemType: "house",
      blob: audioBlob,
      mimeType: "audio/webm;codecs=opus",
      durationMs: 5000,
      createdAt: new Date(),
    })) as number;

    vi.restoreAllMocks();
    mockFrom.mockReset();
    mockGetSession.mockReset();
    mockRefreshSession.mockReset();
    mockPreconditionUpdate.mockReset();
    mockPreconditionUpdate.mockResolvedValue({ status: "applied", row: {} });

    mockGetSession.mockResolvedValue({
      data: {
        session: {
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          access_token: "test-token",
        },
      },
    });
    mockRefreshSession.mockResolvedValue({ data: { session: {} }, error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Case A: a fresh success calls preconditionUpdate with the snapshot token + ai_status:done patch, not a bare catalog write", async () => {
    const updateCalls: Array<Record<string, unknown>> = [];
    mockFrom.mockImplementation(
      createMockFrom({
        updateCalls,
        snapshot: { ...VALUE_AT_READ, updated_at: SNAPSHOT_TOKEN },
      }),
    );

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockGeminiResponse({
        title: "AI NEW TITLE",
        description: "ai new description",
        condition: "good",
        estimate: null,
        category: null,
        measurements: null,
        transcript: "a real ai transcript",
        receipt_number: null,
      }) as unknown as Response,
    );

    await processAudioWithAi(testAudioId, ITEM_UUID, "session-uuid-1");

    expect(mockPreconditionUpdate).toHaveBeenCalledTimes(1);
    const arg = mockPreconditionUpdate.mock.calls[0][0];
    expect(arg).toEqual(
      expect.objectContaining({
        table: "items",
        id: ITEM_UUID,
        prevUpdatedAt: SNAPSHOT_TOKEN,
      }),
    );
    expect(arg.patch.ai_status).toBe("done");
    expect(arg.patch.completed_at).toBeDefined();
    // Never put updated_at in the patch — the trigger owns the bump.
    expect(arg.patch.updated_at).toBeUndefined();

    // The catalog success write must NOT go through a bare update(...).eq("id").
    // Only the claim write (ai_status:"processing") is a direct .update here.
    const catalogWrites = updateCalls.filter(
      (u) => u.ai_status === "done" || u.title === "AI NEW TITLE",
    );
    expect(catalogWrites).toHaveLength(0);
    expect(
      updateCalls.some((u) => u.ai_status === "processing"),
    ).toBe(true);
  });

  it("Case B: the reconcile drops a concurrently-changed catalog field, keeps control + untouched fields", async () => {
    const updateCalls: Array<Record<string, unknown>> = [];
    mockFrom.mockImplementation(
      createMockFrom({
        updateCalls,
        snapshot: { ...VALUE_AT_READ, updated_at: SNAPSHOT_TOKEN },
      }),
    );

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockGeminiResponse({
        title: "AI NEW TITLE",
        description: "ai new description",
        condition: null,
        estimate: null,
        category: null,
        measurements: null,
        transcript: "a real ai transcript",
        receipt_number: null,
      }) as unknown as Response,
    );

    await processAudioWithAi(testAudioId, ITEM_UUID, "session-uuid-1");

    expect(mockPreconditionUpdate).toHaveBeenCalledTimes(1);
    const reconcile = mockPreconditionUpdate.mock.calls[0][0].reconcile as (
      fresh: Record<string, unknown>,
      intended: Record<string, unknown>,
    ) => Record<string, unknown> | null;
    expect(typeof reconcile).toBe("function");

    // Another writer changed `title` since the AI read; `description` is untouched.
    const fresh = {
      ...VALUE_AT_READ,
      title: "USER EDIT SINCE READ",
      updated_at: "2026-06-04T19:05:00.000Z",
    };
    const intended = {
      ai_status: "done",
      completed_at: "2026-06-04T19:06:00.000Z",
      title: "AI NEW TITLE",
      description: "ai new description",
    };

    const result = reconcile(fresh, intended);
    expect(result).not.toBeNull();
    // Concurrently-changed catalog field is dropped — AI yields (D-06).
    expect(result).not.toHaveProperty("title");
    // Untouched catalog field + control fields re-apply.
    expect(result!.description).toBe("ai new description");
    expect(result!.ai_status).toBe("done");
    expect(result!.completed_at).toBe("2026-06-04T19:06:00.000Z");
  });
});
