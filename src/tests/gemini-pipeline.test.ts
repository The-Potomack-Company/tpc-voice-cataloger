import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db } from "../db";

// --- Mocks for Supabase (vi.hoisted ensures availability in vi.mock factory) ---
const { mockFrom, mockUpdate, mockEq, mockSelect, mockSingle } = vi.hoisted(
  () => {
    const mockSingle = vi.fn();
    const mockEq = vi.fn();
    const mockSelect = vi.fn();
    const mockUpdate = vi.fn();
    const mockFrom = vi.fn();

    return { mockFrom, mockUpdate, mockEq, mockSelect, mockSingle };
  },
);

vi.mock("../lib/supabase", () => ({
  supabase: {
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

// We'll dynamically import gemini.ts after setting up env
let processAudioWithAi: typeof import("../services/gemini").processAudioWithAi;
let blobToBase64: typeof import("../services/gemini").blobToBase64;

// Set env before importing
vi.stubEnv("VITE_GEMINI_PROXY_URL", "https://test-proxy.example.com/api");

// Helper to build a mock Gemini proxy response
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

describe("gemini pipeline", () => {
  let testAudioId: number;

  beforeEach(async () => {
    // Dynamically import to pick up env stub
    const mod = await import("../services/gemini");
    processAudioWithAi = mod.processAudioWithAi;
    blobToBase64 = mod.blobToBase64;

    // Clean audio table (still Dexie for blobs)
    await db.audio.clear();

    // Seed a test audio record
    const audioBlob = new Blob(["fake-audio-data"], {
      type: "audio/webm;codecs=opus",
    });
    testAudioId = (await db.audio.add({
      itemId: 1, // legacy integer, doesn't matter for pipeline
      itemType: "house",
      blob: audioBlob,
      mimeType: "audio/webm;codecs=opus",
      durationMs: 5000,
      createdAt: new Date(),
    })) as number;

    // Reset mocks
    vi.restoreAllMocks();
    mockFrom.mockReset();
    mockUpdate.mockReset();
    mockEq.mockReset();
    mockSelect.mockReset();
    mockSingle.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("blobToBase64", () => {
    it("converts a Blob to a base64 string", async () => {
      const blob = new Blob(["hello world"], { type: "text/plain" });
      const result = await blobToBase64(blob);
      // "hello world" in base64 is "aGVsbG8gd29ybGQ="
      expect(result).toBe("aGVsbG8gd29ybGQ=");
    });
  });

  describe("processAudioWithAi", () => {
    // Null item simulating first recording (no existing data)
    const nullItem = {
      title: null, description: null, condition: null,
      estimate: null, category: null, measurements: null, transcript: null,
    };

    // Helper to create a mockFrom implementation with configurable existing item
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

    it("sets ai_status to 'processing' via supabase.from('items').update", async () => {
      const updateCalls: Array<Record<string, unknown>> = [];

      mockFrom.mockImplementation(createMockFrom({ updateCalls, existingItem: nullItem }));

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        mockGeminiResponse({
          title: "Oak table",
          description: "nice oak table",
          condition: "good",
          estimate: "300 to 500",
          category: "furniture",
          measurements: null,
          transcript: null,
        }) as unknown as Response,
      );

      await processAudioWithAi(testAudioId, "item-uuid-1", "session-uuid-1");

      // First update should be setting ai_status to 'processing'
      expect(updateCalls[0]).toEqual({ ai_status: "processing" });
    });

    it("on success, writes title, description, condition, estimate, category, measurements, transcript to Supabase items table", async () => {
      const updateCalls: Array<Record<string, unknown>> = [];

      mockFrom.mockImplementation(createMockFrom({ updateCalls, existingItem: nullItem }));

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        mockGeminiResponse({
          title: "Oak table",
          description: "nice oak table, kinda beat up",
          condition: "fair",
          estimate: "500",
          category: "furniture",
          measurements: "36 x 24 in. (91.4 x 61 cm.)",
          transcript:
            "nice oak table, kinda beat up, fair condition, about five hundred",
        }) as unknown as Response,
      );

      await processAudioWithAi(testAudioId, "item-uuid-1", "session-uuid-1");

      // Last update should contain the AI results
      const lastUpdate = updateCalls[updateCalls.length - 1];
      expect(lastUpdate.ai_status).toBe("done");
      expect(lastUpdate.title).toBe("OAK TABLE");
      expect(lastUpdate.description).toBe("nice oak table, kinda beat up");
      expect(lastUpdate.condition).toBe("fair");
      expect(lastUpdate.estimate).toBeDefined();
      expect(lastUpdate.category).toBe("FRN");
      expect(lastUpdate.measurements).toBe("36 x 24 in. (91.4 x 61 cm.)");
      expect(lastUpdate.transcript).toBeDefined();
    });

    it("on error, sets ai_status to 'failed' via supabase update", async () => {
      const updateCalls: Array<Record<string, unknown>> = [];

      mockFrom.mockImplementation(createMockFrom({ updateCalls, existingItem: nullItem }));

      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("Network error"),
      );

      await processAudioWithAi(testAudioId, "item-uuid-1", "session-uuid-1");

      // Last update should set ai_status to 'failed'
      const lastUpdate = updateCalls[updateCalls.length - 1];
      expect(lastUpdate.ai_status).toBe("failed");
      expect(lastUpdate.description).toBe(
        "AI processing failed - audio recorded, awaiting manual review",
      );
    });

    it("audio blob is still read from Dexie db.audio.get(audioId)", async () => {
      const getSpy = vi.spyOn(db.audio, "get");

      mockFrom.mockImplementation(createMockFrom({ existingItem: nullItem }));

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        mockGeminiResponse({
          title: "test",
          description: null,
          condition: null,
          estimate: null,
          category: null,
          measurements: null,
          transcript: null,
        }) as unknown as Response,
      );

      await processAudioWithAi(testAudioId, "item-uuid-1", "session-uuid-1");

      expect(getSpy).toHaveBeenCalledWith(testAudioId);
    });

    it("MIME type codec parameters are stripped before sending", async () => {
      let sentPayload: Record<string, unknown> | null = null;

      mockFrom.mockImplementation(createMockFrom({ existingItem: nullItem }));

      vi.spyOn(globalThis, "fetch").mockImplementation(
        async (_url, options) => {
          sentPayload = JSON.parse(options?.body as string);
          return mockGeminiResponse({
            title: "test",
            description: "test",
            condition: null,
            estimate: null,
            category: null,
            measurements: null,
            transcript: null,
          }) as unknown as Response;
        },
      );

      await processAudioWithAi(testAudioId, "item-uuid-1", "session-uuid-1");

      expect(sentPayload).not.toBeNull();
      const payload = sentPayload as Record<string, unknown>;
      const contents = (
        payload.payload as Record<string, unknown>
      ).contents as Array<Record<string, unknown>>;
      const parts = contents[0].parts as Array<Record<string, unknown>>;
      const inlineData = parts[1].inlineData as Record<string, string>;
      expect(inlineData.mimeType).toBe("audio/webm");
      expect(inlineData.mimeType).not.toContain(";");
    });

    it("fails immediately when VITE_GEMINI_PROXY_URL is not configured", async () => {
      vi.stubEnv("VITE_GEMINI_PROXY_URL", "");

      const updateCalls: Array<Record<string, unknown>> = [];
      mockFrom.mockImplementation(createMockFrom({ updateCalls, existingItem: nullItem }));

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        mockGeminiResponse({
          title: "test",
          description: null,
          condition: null,
          estimate: null,
          category: null,
          measurements: null,
          transcript: null,
        }) as unknown as Response,
      );

      await processAudioWithAi(testAudioId, "item-uuid-1", "session-uuid-1");

      // fetch should NOT have been called
      expect(fetchSpy).not.toHaveBeenCalled();

      // ai_status should be 'failed'
      const lastUpdate = updateCalls[updateCalls.length - 1];
      expect(lastUpdate.ai_status).toBe("failed");

      // Restore env
      vi.stubEnv(
        "VITE_GEMINI_PROXY_URL",
        "https://test-proxy.example.com/api",
      );
    });

    it("system prompt includes spoken punctuation rules", async () => {
      let sentPayload: Record<string, unknown> | null = null;

      mockFrom.mockImplementation(() => ({
        update: () => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        select: () => ({
          eq: () => ({
            single: vi.fn().mockResolvedValue({
              data: { transcript: null },
              error: null,
            }),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { transcript: null },
              error: null,
            }),
          }),
        }),
      }));

      vi.spyOn(globalThis, "fetch").mockImplementation(
        async (_url, options) => {
          sentPayload = JSON.parse(options?.body as string);
          return mockGeminiResponse({
            title: "test",
            description: null,
            condition: null,
            estimate: null,
            category: null,
            measurements: null,
            transcript: null,
          }) as unknown as Response;
        },
      );

      await processAudioWithAi(testAudioId, "item-uuid-1", "session-uuid-1");

      expect(sentPayload).not.toBeNull();
      const payload = sentPayload as Record<string, unknown>;
      const geminiPayload = payload.payload as Record<string, unknown>;
      const systemInstruction = geminiPayload.system_instruction as Record<
        string,
        unknown
      >;
      const parts = systemInstruction.parts as Array<
        Record<string, string>
      >;
      const promptText = parts[0].text;

      expect(promptText).toContain("SPOKEN PUNCTUATION:");
      expect(promptText).toContain('"comma" ->');
      expect(promptText).toContain('"parenthesis"');
      expect(promptText).toContain('"dash"');
      expect(promptText).toContain("Apply to ALL fields");
    });

    it("system prompt includes artist-name romanization rule", async () => {
      let sentPayload: Record<string, unknown> | null = null;

      mockFrom.mockImplementation(createMockFrom({ existingItem: nullItem }));

      vi.spyOn(globalThis, "fetch").mockImplementation(
        async (_url, options) => {
          sentPayload = JSON.parse(options?.body as string);
          return mockGeminiResponse({
            title: "test",
            description: null,
            condition: null,
            estimate: null,
            category: null,
            measurements: null,
            transcript: null,
          }) as unknown as Response;
        },
      );

      await processAudioWithAi(testAudioId, "item-uuid-1", "session-uuid-1");

      expect(sentPayload).not.toBeNull();
      const payload = sentPayload as Record<string, unknown>;
      const geminiPayload = payload.payload as Record<string, unknown>;
      const systemInstruction = geminiPayload.system_instruction as Record<
        string,
        unknown
      >;
      const parts = systemInstruction.parts as Array<
        Record<string, string>
      >;
      const promptText = parts[0].text;

      expect(promptText).toContain("ARTIST NAMES:");
      expect(promptText).toContain("standard romanized");
      expect(promptText).toContain("Hokusai");
      expect(promptText).toContain("Cézanne");
    });

    it("system prompt includes merge rules", async () => {
      let sentPayload: Record<string, unknown> | null = null;

      mockFrom.mockImplementation(createMockFrom({ existingItem: nullItem }));

      vi.spyOn(globalThis, "fetch").mockImplementation(
        async (_url, options) => {
          sentPayload = JSON.parse(options?.body as string);
          return mockGeminiResponse({
            title: "test",
            description: null,
            condition: null,
            estimate: null,
            category: null,
            measurements: null,
            transcript: null,
          }) as unknown as Response;
        },
      );

      await processAudioWithAi(testAudioId, "item-uuid-1", "session-uuid-1");

      expect(sentPayload).not.toBeNull();
      const payload = sentPayload as Record<string, unknown>;
      const geminiPayload = payload.payload as Record<string, unknown>;
      const systemInstruction = geminiPayload.system_instruction as Record<
        string,
        unknown
      >;
      const parts = systemInstruction.parts as Array<
        Record<string, string>
      >;
      const promptText = parts[0].text;

      expect(promptText).toContain("MERGE RULES:");
      expect(promptText).toContain("Default behavior: APPEND");
      expect(promptText).toContain("return the existing value unchanged");
    });

    it("on non-200 proxy response, ai_status is 'failed'", async () => {
      const updateCalls: Array<Record<string, unknown>> = [];
      mockFrom.mockImplementation(createMockFrom({ updateCalls, existingItem: nullItem }));

      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
        json: async () => ({}),
      } as unknown as Response);

      await processAudioWithAi(testAudioId, "item-uuid-1", "session-uuid-1");

      const lastUpdate = updateCalls[updateCalls.length - 1];
      expect(lastUpdate.ai_status).toBe("failed");
      expect(lastUpdate.description).toBe(
        "AI processing failed - audio recorded, awaiting manual review",
      );
    });

    it("includes existing field values in Gemini payload text part for re-recordings", async () => {
      let sentPayload: Record<string, unknown> | null = null;
      const updateCalls: Array<Record<string, unknown>> = [];

      const existingItem = {
        title: "OAK TABLE",
        description: "nice oak table",
        condition: "good",
        estimate: "500",
        category: "FRN",
        measurements: "36 x 24 in. (91.4 x 61 cm.)",
        transcript: "nice oak table, good condition",
      };

      mockFrom.mockImplementation(createMockFrom({ updateCalls, existingItem }));

      vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, options) => {
        sentPayload = JSON.parse(options?.body as string);
        return mockGeminiResponse({
          title: "OAK TABLE ROBERT",
          description: "nice oak table",
          condition: "good",
          estimate: "500",
          category: "FRN",
          measurements: "36 x 24 in. (91.4 x 61 cm.)",
          transcript: "nice oak table, good condition\nadd robert to the title",
        }) as unknown as Response;
      });

      await processAudioWithAi(testAudioId, "item-uuid-1", "session-uuid-1");

      expect(sentPayload).not.toBeNull();
      const payload = sentPayload as Record<string, unknown>;
      const contents = (payload.payload as Record<string, unknown>).contents as Array<Record<string, unknown>>;
      const parts = contents[0].parts as Array<Record<string, unknown>>;
      const textPart = parts[0].text as string;
      expect(textPart).toContain("EXISTING VALUES:");
      expect(textPart).toContain("Title: OAK TABLE");
      expect(textPart).toContain("Description: nice oak table");
      expect(textPart).toContain("Extract and MERGE");
    });

    it("uses simple extraction prompt when item has no existing field values", async () => {
      let sentPayload: Record<string, unknown> | null = null;
      const updateCalls: Array<Record<string, unknown>> = [];

      mockFrom.mockImplementation(createMockFrom({ updateCalls, existingItem: nullItem }));

      vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, options) => {
        sentPayload = JSON.parse(options?.body as string);
        return mockGeminiResponse({
          title: "Oak table",
          description: "nice oak table",
          condition: null,
          estimate: null,
          category: null,
          measurements: null,
          transcript: "nice oak table",
        }) as unknown as Response;
      });

      await processAudioWithAi(testAudioId, "item-uuid-1", "session-uuid-1");

      const payload = sentPayload as Record<string, unknown>;
      const contents = (payload.payload as Record<string, unknown>).contents as Array<Record<string, unknown>>;
      const parts = contents[0].parts as Array<Record<string, unknown>>;
      const textPart = parts[0].text as string;
      expect(textPart).toBe("Extract catalog fields from this audio recording.");
      expect(textPart).not.toContain("EXISTING VALUES:");
    });

    it("writes transcript directly from AI response without app-side concatenation", async () => {
      const updateCalls: Array<Record<string, unknown>> = [];

      const existingItem = {
        title: "VASE",
        description: null,
        condition: null,
        estimate: null,
        category: null,
        measurements: null,
        transcript: "blue vase, antique",
      };

      mockFrom.mockImplementation(createMockFrom({ updateCalls, existingItem }));

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        mockGeminiResponse({
          title: "VASE",
          description: null,
          condition: "good",
          estimate: null,
          category: null,
          measurements: null,
          transcript: "blue vase, antique\ngood condition, no chips",
        }) as unknown as Response,
      );

      await processAudioWithAi(testAudioId, "item-uuid-1", "session-uuid-1");

      const lastUpdate = updateCalls[updateCalls.length - 1];
      // AI merged the transcript -- app writes it directly (no double-append)
      expect(lastUpdate.transcript).toBe("blue vase, antique\ngood condition, no chips");
    });
  });
});
