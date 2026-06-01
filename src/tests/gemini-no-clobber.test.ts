// Wave-0 RED (Phase 35 plan 01) — SC-3 retry no-clobber + clear-on-fresh.
// D-05/D-06 contract: an AI retry must NEVER overwrite a user-edited field
// (tracked client-side in db.userEditedFields), and a FRESH (non-retry) success
// must clear the item's flags. Encodes the O-1 resolution: an explicit `isRetry`
// 4th param on processAudioWithAi (retry sites pass true; fresh sites omit/false).
// RED now: flagged fields are clobbered on retry, and flags never clear.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db } from "../db";

const { mockFrom, mockUpdate, mockEq, mockSelect, mockSingle, mockGetSession, mockRefreshSession } = vi.hoisted(
  () => {
    const mockSingle = vi.fn();
    const mockEq = vi.fn();
    const mockSelect = vi.fn();
    const mockUpdate = vi.fn();
    const mockFrom = vi.fn();
    const mockGetSession = vi.fn();
    const mockRefreshSession = vi.fn();

    return { mockFrom, mockUpdate, mockEq, mockSelect, mockSingle, mockGetSession, mockRefreshSession };
  },
);

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

// Loosened call signature: the FINAL intended signature carries a 4th `isRetry`
// boolean (O-1). The implementation has not added it yet, so we type the call
// site explicitly so the test compiles cleanly and stays RED for the right
// (behavior-absent) reason rather than a type error.
type ProcessAudioWithAi = (
  audioId: number,
  itemId: string,
  sessionId: string,
  isRetry?: boolean,
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

const ITEM_ID = "item-uuid-1";

function createMockFrom(options: {
  updateCalls?: Array<Record<string, unknown>>;
  existingItem?: Record<string, unknown> | null;
}) {
  const { updateCalls = [], existingItem = null } = options;
  return () => ({
    update: (data: Record<string, unknown>) => {
      updateCalls.push(data);
      return { eq: vi.fn().mockResolvedValue({ error: null }) };
    },
    select: () => ({
      eq: () => ({
        single: vi.fn().mockResolvedValue({ data: existingItem, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: existingItem, error: null }),
      }),
    }),
  });
}

describe("gemini retry no-clobber (SC-3)", () => {
  let testAudioId: number;

  beforeEach(async () => {
    const mod = await import("../services/gemini");
    processAudioWithAi = mod.processAudioWithAi as unknown as ProcessAudioWithAi;

    await db.audio.clear();
    // Isolate provenance per case — the v11 store must exist for these reads/writes.
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
    mockUpdate.mockReset();
    mockEq.mockReset();
    mockSelect.mockReset();
    mockSingle.mockReset();
    mockGetSession.mockReset();
    mockRefreshSession.mockReset();
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

  it("a retry does NOT overwrite a user-flagged field but does write unflagged ones", async () => {
    // User edited the title — flag it.
    await db.userEditedFields.put({ itemId: ITEM_ID, field: "title" });

    const existingItem = {
      title: "USER TITLE",
      description: "old description",
      condition: "good",
      estimate: "500",
      category: "FRN",
      measurements: "36 x 24 in. (91.4 x 61 cm.)",
      transcript: "user edited title here",
    };

    const updateCalls: Array<Record<string, unknown>> = [];
    mockFrom.mockImplementation(createMockFrom({ updateCalls, existingItem }));

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockGeminiResponse({
        title: "AI REWRITTEN TITLE",
        description: "ai new description",
        condition: "good",
        estimate: "500",
        category: "FRN",
        measurements: "36 x 24 in. (91.4 x 61 cm.)",
        transcript: "user edited title here\nnew ai content",
      }) as unknown as Response,
    );

    // Explicit retry (4th arg true) — O-1 resolution.
    await processAudioWithAi(testAudioId, ITEM_ID, "session-uuid-1", true);

    const last = updateCalls[updateCalls.length - 1];
    expect(last.ai_status).toBe("done");
    // RED: title is currently written despite the user-edited flag.
    expect(last.title).toBeUndefined();
    // Unflagged fields still flow through.
    expect(last.description).toBe("ai new description");
  });

  it("a fresh (non-retry) success clears the item's user-edited flags", async () => {
    // Seed a flag, then run a FRESH extraction (no isRetry / false).
    await db.userEditedFields.put({ itemId: ITEM_ID, field: "title" });

    const updateCalls: Array<Record<string, unknown>> = [];
    // Fresh extraction: no pre-existing data (first recording).
    mockFrom.mockImplementation(
      createMockFrom({
        updateCalls,
        existingItem: {
          title: null, description: null, condition: null,
          estimate: null, category: null, measurements: null, transcript: null,
        },
      }),
    );

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockGeminiResponse({
        title: "Fresh title",
        description: "fresh description",
        condition: null,
        estimate: null,
        category: null,
        measurements: null,
        transcript: "a fresh recording transcript",
      }) as unknown as Response,
    );

    // Fresh call — omit the isRetry arg (defaults to false).
    await processAudioWithAi(testAudioId, ITEM_ID, "session-uuid-1");

    const remaining = await db.userEditedFields.where("itemId").equals(ITEM_ID).toArray();
    // RED: flags are never cleared today, so this array is still non-empty.
    expect(remaining).toHaveLength(0);
  });
});
