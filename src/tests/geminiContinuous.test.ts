import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  audio: {
    get: vi.fn(),
  },
}));

const continuousStore = vi.hoisted(() => ({
  markChunkPending: vi.fn(),
  markChunkDone: vi.fn(),
  markChunkFailed: vi.fn(),
  appendTranscript: vi.fn(),
  advanceItem: vi.fn(async () => "next-item"),
}));

const sessionStore = vi.hoisted(() => ({
  updateItemField: vi.fn(async () => {}),
}));

const maybeSingle = vi.hoisted(() => vi.fn());

vi.mock("../db", () => ({ db: dbMock }));
vi.mock("../lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle,
        }),
      }),
    }),
  },
}));
vi.mock("../stores/continuousModeStore", () => ({
  useContinuousModeStore: {
    getState: () => continuousStore,
  },
}));
vi.mock("../stores/sessionStore", () => ({
  useSessionStore: {
    getState: () => sessionStore,
  },
}));
vi.mock("../services/analytics", () => ({
  trackEvent: vi.fn(),
}));

function mockGeminiResponse(fields: Record<string, unknown>) {
  vi.stubGlobal("fetch", vi.fn(async () => ({
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
  })));
}

const baseFields = {
  title: "brass lamp",
  description: "Antique brass lamp",
  condition: null,
  estimate: null,
  category: null,
  measurements: null,
  transcript: "Antique brass lamp",
  receipt_number: null,
};

describe("processContinuousChunk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_GEMINI_PROXY_URL", "https://proxy.test");
    dbMock.audio.get.mockResolvedValue({
      blob: new Blob(["audio"], { type: "audio/webm" }),
      mimeType: "audio/webm;codecs=opus",
    });
    maybeSingle.mockResolvedValue({
      data: {
        title: null,
        description: null,
        condition: null,
        estimate: null,
        category: null,
        measurements: null,
        transcript: null,
        receipt_number: null,
      },
    });
  });

  it("advances when Gemini returns new_item_detected", async () => {
    mockGeminiResponse({
      ...baseFields,
      new_item_detected: {
        triggered: true,
        receipt_number: "12345-2",
      },
    });
    const { processContinuousChunk } = await import("../services/geminiContinuous");

    await processContinuousChunk(1, "item-1", "session-1", 0);

    expect(continuousStore.markChunkPending).toHaveBeenCalledWith(0);
    expect(sessionStore.updateItemField).toHaveBeenCalledWith("item-1", "session-1", "title", "BRASS LAMP");
    expect(continuousStore.appendTranscript).toHaveBeenCalledWith("Antique brass lamp");
    expect(continuousStore.advanceItem).toHaveBeenCalledWith("12345-2");
    expect(continuousStore.markChunkDone).toHaveBeenCalledWith(0);
  });

  it("merges fields without advancing when no wake phrase is present", async () => {
    mockGeminiResponse({
      ...baseFields,
      new_item_detected: null,
    });
    const { processContinuousChunk } = await import("../services/geminiContinuous");

    await processContinuousChunk(1, "item-1", "session-1", 2);

    expect(sessionStore.updateItemField).toHaveBeenCalledWith("item-1", "session-1", "description", "Antique brass lamp");
    expect(continuousStore.advanceItem).not.toHaveBeenCalled();
    expect(continuousStore.markChunkDone).toHaveBeenCalledWith(2);
  });
});
