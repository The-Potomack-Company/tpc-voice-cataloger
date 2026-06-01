// Wave-0 RED (Phase 35 plan 01) — SC-2 confabulation guard.
// D-03 contract: when the model returns a null / whitespace transcript, reject
// the WHOLE response — write NO catalog fields and set ai_status="failed". RED
// now because gemini.ts persists title/estimate/etc. regardless of transcript.
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

let processAudioWithAi: typeof import("../services/gemini").processAudioWithAi;

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

const nullItem = {
  title: null, description: null, condition: null,
  estimate: null, category: null, measurements: null, transcript: null,
};

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

const CATALOG_KEYS = [
  "title", "description", "condition", "estimate",
  "category", "measurements", "transcript", "receipt_number",
];

describe("gemini confab guard (SC-2)", () => {
  let testAudioId: number;

  beforeEach(async () => {
    const mod = await import("../services/gemini");
    processAudioWithAi = mod.processAudioWithAi;

    await db.audio.clear();

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

  function assertRejected(updateCalls: Array<Record<string, unknown>>) {
    // Only two writes allowed: the leading processing flag, then the failed flag.
    expect(updateCalls[0]).toEqual({ ai_status: "processing" });
    const last = updateCalls[updateCalls.length - 1];
    expect(last.ai_status).toBe("failed");
    // No catalog field may appear in ANY write — invented fields must not persist.
    for (const call of updateCalls) {
      for (const key of CATALOG_KEYS) {
        expect(call[key]).toBeUndefined();
      }
    }
  }

  it("rejects the whole response when transcript is null (no catalog fields written)", async () => {
    const updateCalls: Array<Record<string, unknown>> = [];
    mockFrom.mockImplementation(createMockFrom({ updateCalls, existingItem: nullItem }));

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockGeminiResponse({
        transcript: null,
        title: "Oak table",
        description: "nice oak table",
        condition: "good",
        estimate: "300",
        category: "furniture",
        measurements: null,
      }) as unknown as Response,
    );

    await processAudioWithAi(testAudioId, "item-uuid-1", "session-uuid-1");

    // RED: today gemini.ts writes title/estimate/etc. even with a null transcript.
    assertRejected(updateCalls);
  });

  it("rejects the whole response when transcript is whitespace-only", async () => {
    const updateCalls: Array<Record<string, unknown>> = [];
    mockFrom.mockImplementation(createMockFrom({ updateCalls, existingItem: nullItem }));

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockGeminiResponse({
        transcript: "   ",
        title: "Oak table",
        description: "nice oak table",
        condition: "good",
        estimate: "300",
        category: "furniture",
        measurements: null,
      }) as unknown as Response,
    );

    await processAudioWithAi(testAudioId, "item-uuid-1", "session-uuid-1");

    // RED: whitespace transcript is currently treated as a valid transcript.
    assertRejected(updateCalls);
  });
});
