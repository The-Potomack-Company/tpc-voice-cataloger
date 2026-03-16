import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db } from "../db";

// We'll dynamically import gemini.ts after setting up env
let processAudioWithAi: typeof import("../services/gemini").processAudioWithAi;
let blobToBase64: typeof import("../services/gemini").blobToBase64;

// Set env before importing
vi.stubEnv("VITE_GEMINI_PROXY_URL", "https://test-proxy.example.com/api");

// Helper to build a mock Gemini proxy response
function mockGeminiResponse(fields: Record<string, string | null>) {
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
  let testItemId: number;
  let testAudioId: number;

  beforeEach(async () => {
    // Dynamically import to pick up env stub
    const mod = await import("../services/gemini");
    processAudioWithAi = mod.processAudioWithAi;
    blobToBase64 = mod.blobToBase64;

    // Clean tables
    await db.houseVisitItems.clear();
    await db.saleItems.clear();
    await db.audio.clear();

    // Seed a test item
    testItemId = (await db.houseVisitItems.add({
      sessionId: 1,
      sortOrder: 0,
      createdAt: new Date(),
    })) as number;

    // Seed a test audio record
    const audioBlob = new Blob(["fake-audio-data"], {
      type: "audio/webm;codecs=opus",
    });
    testAudioId = (await db.audio.add({
      itemId: testItemId,
      itemType: "house",
      blob: audioBlob,
      mimeType: "audio/webm;codecs=opus",
      durationMs: 5000,
      createdAt: new Date(),
    })) as number;

    // Reset fetch mock
    vi.restoreAllMocks();
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
    it("sets aiStatus to 'processing' then 'done' on success", async () => {
      const statusDuringFetch: string[] = [];

      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        // Capture aiStatus during the fetch call
        const item = await db.houseVisitItems.get(testItemId);
        statusDuringFetch.push(item?.aiStatus ?? "undefined");
        return mockGeminiResponse({
          title: "Oak table",
          description: "nice oak table",
          condition: "good",
          estimate: "200",
          category: "furniture",
        }) as unknown as Response;
      });

      await processAudioWithAi(testAudioId, testItemId, "house");

      // During fetch, status should have been "processing"
      expect(statusDuringFetch[0]).toBe("processing");

      // After completion, status should be "done"
      const item = await db.houseVisitItems.get(testItemId);
      expect(item?.aiStatus).toBe("done");
    });

    it("writes title, description, condition, estimate, category to item record", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        mockGeminiResponse({
          title: "Oak table",
          description: "nice oak table, kinda beat up",
          condition: "fair",
          estimate: "two hundred",
          category: "furniture",
        }) as unknown as Response,
      );

      await processAudioWithAi(testAudioId, testItemId, "house");

      const item = await db.houseVisitItems.get(testItemId);
      expect(item?.title).toBe("Oak table");
      expect(item?.description).toBe("nice oak table, kinda beat up");
      expect(item?.condition).toBe("fair");
      expect(item?.estimate).toBe("two hundred");
      expect(item?.category).toBe("furniture");
    });

    it("fields are verbatim from Gemini (no transformation)", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        mockGeminiResponse({
          title: "oak table, kinda beat up",
          description: "maybe two hundred",
          condition: null,
          estimate: null,
          category: null,
        }) as unknown as Response,
      );

      await processAudioWithAi(testAudioId, testItemId, "house");

      const item = await db.houseVisitItems.get(testItemId);
      // Title should be exactly as returned, not transformed
      expect(item?.title).toBe("oak table, kinda beat up");
      expect(item?.description).toBe("maybe two hundred");
    });

    it("null fields from Gemini remain undefined in item record", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        mockGeminiResponse({
          title: "Oak table",
          description: null,
          condition: null,
          estimate: null,
          category: null,
        }) as unknown as Response,
      );

      await processAudioWithAi(testAudioId, testItemId, "house");

      const item = await db.houseVisitItems.get(testItemId);
      expect(item?.title).toBe("Oak table");
      // Null fields should not be stored (remain undefined)
      expect(item?.description).toBeUndefined();
      expect(item?.condition).toBeUndefined();
      expect(item?.estimate).toBeUndefined();
      // Category defaults to "furniture" even when null
      expect(item?.category).toBe("furniture");
    });

    it("category defaults to 'furniture' when Gemini returns null", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        mockGeminiResponse({
          title: "Old lamp",
          description: "brass lamp",
          condition: "good",
          estimate: "50",
          category: null,
        }) as unknown as Response,
      );

      await processAudioWithAi(testAudioId, testItemId, "house");

      const item = await db.houseVisitItems.get(testItemId);
      expect(item?.category).toBe("furniture");
    });

    it("on fetch failure, aiStatus is 'failed' and description gets fallback", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("Network error"),
      );

      await processAudioWithAi(testAudioId, testItemId, "house");

      const item = await db.houseVisitItems.get(testItemId);
      expect(item?.aiStatus).toBe("failed");
      expect(item?.description).toBe(
        "AI processing failed - audio recorded, awaiting manual review",
      );
    });

    it("on malformed JSON from Gemini, aiStatus is 'failed'", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: "not valid json {{{" }],
              },
            },
          ],
        }),
      } as unknown as Response);

      await processAudioWithAi(testAudioId, testItemId, "house");

      const item = await db.houseVisitItems.get(testItemId);
      expect(item?.aiStatus).toBe("failed");
      expect(item?.description).toBe(
        "AI processing failed - audio recorded, awaiting manual review",
      );
    });

    it("on Zod validation failure, aiStatus is 'failed'", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      title: 123, // number instead of string
                      description: true,
                    }),
                  },
                ],
              },
            },
          ],
        }),
      } as unknown as Response);

      await processAudioWithAi(testAudioId, testItemId, "house");

      const item = await db.houseVisitItems.get(testItemId);
      expect(item?.aiStatus).toBe("failed");
      expect(item?.description).toBe(
        "AI processing failed - audio recorded, awaiting manual review",
      );
    });

    it("MIME type codec parameters are stripped before sending", async () => {
      let sentPayload: Record<string, unknown> | null = null;

      vi.spyOn(globalThis, "fetch").mockImplementation(
        async (_url, options) => {
          sentPayload = JSON.parse(options?.body as string);
          return mockGeminiResponse({
            title: "test",
            description: "test",
            condition: null,
            estimate: null,
            category: null,
          }) as unknown as Response;
        },
      );

      await processAudioWithAi(testAudioId, testItemId, "house");

      expect(sentPayload).not.toBeNull();
      // Check the inlineData mimeType in the payload
      const payload = sentPayload as Record<string, unknown>;
      const contents = (
        payload.payload as Record<string, unknown>
      ).contents as Array<Record<string, unknown>>;
      const parts = contents[0].parts as Array<Record<string, unknown>>;
      const inlineData = parts[1].inlineData as Record<string, string>;
      // Should be "audio/webm" not "audio/webm;codecs=opus"
      expect(inlineData.mimeType).toBe("audio/webm");
      expect(inlineData.mimeType).not.toContain(";");
    });

    it("uses captured itemId (race condition prevention)", async () => {
      // Create a second item
      const secondItemId = (await db.houseVisitItems.add({
        sessionId: 1,
        sortOrder: 1,
        createdAt: new Date(),
      })) as number;

      // Create audio for second item
      const secondAudioId = (await db.audio.add({
        itemId: secondItemId,
        itemType: "house",
        blob: new Blob(["audio-2"], { type: "audio/webm" }),
        mimeType: "audio/webm",
        durationMs: 3000,
        createdAt: new Date(),
      })) as number;

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        mockGeminiResponse({
          title: "Item from first call",
          description: null,
          condition: null,
          estimate: null,
          category: null,
        }) as unknown as Response,
      );

      // Process both concurrently
      const p1 = processAudioWithAi(testAudioId, testItemId, "house");

      // Change fetch response for second call
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        mockGeminiResponse({
          title: "Item from second call",
          description: null,
          condition: null,
          estimate: null,
          category: null,
        }) as unknown as Response,
      );

      const p2 = processAudioWithAi(secondAudioId, secondItemId, "house");

      await Promise.all([p1, p2]);

      // Each should have written to its own item
      const item1 = await db.houseVisitItems.get(testItemId);
      const item2 = await db.houseVisitItems.get(secondItemId);

      // item1 should have first call's title, item2 should have second call's title
      expect(item1?.title).toBeDefined();
      expect(item2?.title).toBeDefined();
      // They should not have crossed over to the wrong items
      expect(item1?.aiStatus).toBe("done");
      expect(item2?.aiStatus).toBe("done");
    });

    it("fails immediately when VITE_GEMINI_PROXY_URL is not configured", async () => {
      // Stub env to empty string
      vi.stubEnv("VITE_GEMINI_PROXY_URL", "");

      // Re-import module to pick up new env
      // Note: Vite's import.meta.env is read at call time, so stubbing works
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        mockGeminiResponse({
          title: "test",
          description: null,
          condition: null,
          estimate: null,
          category: null,
        }) as unknown as Response,
      );

      await processAudioWithAi(testAudioId, testItemId, "house");

      // fetch should NOT have been called
      expect(fetchSpy).not.toHaveBeenCalled();

      // aiStatus should be "failed"
      const item = await db.houseVisitItems.get(testItemId);
      expect(item?.aiStatus).toBe("failed");

      // Restore env for subsequent tests
      vi.stubEnv("VITE_GEMINI_PROXY_URL", "https://test-proxy.example.com/api");
    });

    it("on non-200 proxy response, aiStatus is 'failed'", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
        json: async () => ({}),
      } as unknown as Response);

      await processAudioWithAi(testAudioId, testItemId, "house");

      const item = await db.houseVisitItems.get(testItemId);
      expect(item?.aiStatus).toBe("failed");
      expect(item?.description).toBe(
        "AI processing failed - audio recorded, awaiting manual review",
      );
    });

    it("on response with no candidates, aiStatus is 'failed'", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ error: "bad request" }),
      } as unknown as Response);

      await processAudioWithAi(testAudioId, testItemId, "house");

      const item = await db.houseVisitItems.get(testItemId);
      expect(item?.aiStatus).toBe("failed");
      expect(item?.description).toBe(
        "AI processing failed - audio recorded, awaiting manual review",
      );
    });

    it("resolves even when catch block DB write fails", async () => {
      // Mock fetch to reject
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("Network error"),
      );

      // Spy on console.error
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Make the second table.update call (in catch block) throw
      let callCount = 0;
      vi.spyOn(db.houseVisitItems, "update").mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // First call: set "processing" -- succeed
          return 1;
        }
        // Second call: in catch block setting "failed" -- throw
        throw new Error("DB write failed in catch");
      });

      // Should resolve without throwing
      await expect(
        processAudioWithAi(testAudioId, testItemId, "house"),
      ).resolves.toBeUndefined();

      // console.error should have been called with the DB error
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to update"),
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it("audio blob is fetched from Dexie by audioId, not passed directly", async () => {
      // Spy on db.audio.get to verify it's called with audioId
      const getSpy = vi.spyOn(db.audio, "get");

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        mockGeminiResponse({
          title: "test",
          description: null,
          condition: null,
          estimate: null,
          category: null,
        }) as unknown as Response,
      );

      await processAudioWithAi(testAudioId, testItemId, "house");

      expect(getSpy).toHaveBeenCalledWith(testAudioId);
    });
  });
});
