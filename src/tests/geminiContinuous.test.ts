import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  audio: {
    get: vi.fn(),
  },
}));

const continuousStore = vi.hoisted(() => ({
  active: true,
  finalizing: false,
  epoch: 0,
  sessionId: "session-1",
  currentItemId: "item-1",
  markChunkPending: vi.fn(),
  markChunkDone: vi.fn(),
  markChunkFailed: vi.fn(),
  appendTranscript: vi.fn(),
  advanceItem: vi.fn(async () => {
    continuousStore.currentItemId = "next-item";
    sessionStore.itemsBySession["session-1"] = [
      ...(sessionStore.itemsBySession["session-1"] ?? []),
      { id: "next-item" },
    ];
    return "next-item";
  }),
}));

const sessionStore = vi.hoisted(() => ({
  itemsBySession: {
    "session-1": [{ id: "item-1" }],
  } as Record<string, Array<{ id: string }>>,
  updateItemField: vi.fn(async () => {}),
}));

const maybeSingle = vi.hoisted(() => vi.fn());
const authMock = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
}));

vi.mock("../db", () => ({ db: dbMock }));
vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: authMock,
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

function mockDelayedGeminiResponses(responses: Array<{ fields: Record<string, unknown>; delayMs: number }>) {
  vi.stubGlobal("fetch", vi.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error("Unexpected fetch");
    await new Promise((resolve) => setTimeout(resolve, next.delayMs));
    return {
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(next.fields) }],
            },
          },
        ],
      }),
    };
  }));
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
    continuousStore.active = true;
    continuousStore.finalizing = false;
    continuousStore.epoch = 0;
    continuousStore.sessionId = "session-1";
    continuousStore.currentItemId = "item-1";
    sessionStore.itemsBySession = {
      "session-1": [{ id: "item-1" }],
    };
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
    authMock.getSession.mockReset();
    authMock.refreshSession.mockReset();
    authMock.getSession.mockResolvedValue({
      data: {
        session: {
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          access_token: "test-token",
        },
      },
    });
    authMock.refreshSession.mockResolvedValue({ data: { session: {} }, error: null });
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

  it("sends look-back bytes before the current chunk media payload", async () => {
    dbMock.audio.get.mockResolvedValue({
      blob: new Blob([
        new Uint8Array([0xaa, 0xbb, 0x1f, 0x43, 0xb6, 0x75, 0x01]),
      ], { type: "audio/webm" }),
      mimeType: "audio/webm;codecs=opus",
    });
    mockGeminiResponse({
      ...baseFields,
      new_item_detected: null,
    });
    const { processContinuousChunk } = await import("../services/geminiContinuous");

    await processContinuousChunk(1, "item-1", "session-1", 1, {
      lookBackBytes: new Uint8Array([0x09, 0x08]),
    });

    const body = JSON.parse((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    const base64Audio = body.payload.contents[0].parts[1].inlineData.data;
    expect(Array.from(Uint8Array.from(atob(base64Audio), (char) => char.charCodeAt(0)))).toEqual([
      0xaa, 0xbb, 0x09, 0x08, 0x1f, 0x43, 0xb6, 0x75, 0x01,
    ]);
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

  it("suppresses duplicate wake phrase advancement when detected receipt matches the current item", async () => {
    mockDelayedGeminiResponses([
      {
        fields: {
          ...baseFields,
          new_item_detected: {
            triggered: true,
            receipt_number: "12345-2",
          },
        },
        delayMs: 0,
      },
      {
        fields: {
          ...baseFields,
          title: null,
          description: null,
          transcript: null,
          new_item_detected: {
            triggered: true,
            receipt_number: "12345-2",
          },
        },
        delayMs: 0,
      },
    ]);
    maybeSingle
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce({
        data: {
          title: null,
          description: null,
          condition: null,
          estimate: null,
          category: null,
          measurements: null,
          transcript: null,
          receipt_number: "12345-2",
        },
      })
      .mockResolvedValueOnce({
        data: {
          title: null,
          description: null,
          condition: null,
          estimate: null,
          category: null,
          measurements: null,
          transcript: null,
          receipt_number: "12345-2",
        },
      });
    const { processContinuousChunk } = await import("../services/geminiContinuous");

    await processContinuousChunk(1, "item-1", "session-1", 5);
    await processContinuousChunk(1, "next-item", "session-1", 6, {
      lookBackBytes: new Uint8Array([1, 2, 3]),
    });

    expect(continuousStore.advanceItem).toHaveBeenCalledTimes(1);
    expect(continuousStore.advanceItem).toHaveBeenCalledWith("12345-2");
    expect(continuousStore.markChunkDone).toHaveBeenCalledWith(6);
  });

  it("merges stale snapshot chunks into the live current item", async () => {
    continuousStore.epoch = 1;
    continuousStore.currentItemId = "item-2";
    sessionStore.itemsBySession["session-1"] = [{ id: "item-1" }, { id: "item-2" }];
    mockGeminiResponse({
      ...baseFields,
      new_item_detected: null,
    });
    const { processContinuousChunk } = await import("../services/geminiContinuous");

    await processContinuousChunk(1, "item-1", "session-1", 3, {
      snapshot: { epoch: 0, itemId: "item-1", sessionId: "session-1" },
    });

    expect(continuousStore.appendTranscript).toHaveBeenCalledWith("Antique brass lamp");
    expect(sessionStore.updateItemField).toHaveBeenCalledWith("item-2", "session-1", "title", "BRASS LAMP");
    expect(sessionStore.updateItemField).toHaveBeenCalledWith("item-2", "session-1", "description", "Antique brass lamp");
    expect(sessionStore.updateItemField).not.toHaveBeenCalledWith("item-1", "session-1", "title", "BRASS LAMP");
  });

  it("serializes session chunks with different snapshot item ids so live-item writes stay FIFO", async () => {
    continuousStore.currentItemId = "live-item";
    sessionStore.itemsBySession["session-1"] = [{ id: "old-item-1" }, { id: "old-item-2" }, { id: "live-item" }];
    mockDelayedGeminiResponses([
      { fields: { ...baseFields, title: "first", transcript: "first", new_item_detected: null }, delayMs: 30 },
      { fields: { ...baseFields, title: "second", transcript: "second", new_item_detected: null }, delayMs: 0 },
      { fields: { ...baseFields, title: "third", transcript: "third", new_item_detected: null }, delayMs: 0 },
    ]);
    const { processContinuousChunk } = await import("../services/geminiContinuous");

    await Promise.all([
      processContinuousChunk(1, "old-item-1", "session-1", 10, {
        snapshot: { epoch: 0, itemId: "old-item-1", sessionId: "session-1" },
      }),
      processContinuousChunk(1, "old-item-2", "session-1", 11, {
        snapshot: { epoch: 0, itemId: "old-item-2", sessionId: "session-1" },
      }),
      processContinuousChunk(1, "old-item-1", "session-1", 12, {
        snapshot: { epoch: 0, itemId: "old-item-1", sessionId: "session-1" },
      }),
    ]);

    const titleWrites = sessionStore.updateItemField.mock.calls
      .filter((call) => call[0] === "live-item" && call[2] === "title")
      .map((call) => call[3]);
    expect(titleWrites).toEqual(["FIRST", "SECOND", "THIRD"]);
    expect(sessionStore.updateItemField).not.toHaveBeenCalledWith("old-item-1", "session-1", "title", expect.any(String));
    expect(sessionStore.updateItemField).not.toHaveBeenCalledWith("old-item-2", "session-1", "title", expect.any(String));
  });

  it("processes chunks while finalizing even after recording is inactive", async () => {
    continuousStore.active = false;
    continuousStore.finalizing = true;
    mockGeminiResponse({
      ...baseFields,
      title: "final slice",
      transcript: "final slice",
      new_item_detected: null,
    });
    const { processContinuousChunk } = await import("../services/geminiContinuous");

    await processContinuousChunk(1, "item-1", "session-1", 20);

    expect(continuousStore.appendTranscript).toHaveBeenCalledWith("final slice");
    expect(sessionStore.updateItemField).toHaveBeenCalledWith("item-1", "session-1", "title", "FINAL SLICE");
    expect(continuousStore.markChunkDone).toHaveBeenCalledWith(20);
  });

  it("skips processing when mode ended for the session", async () => {
    continuousStore.active = false;
    continuousStore.finalizing = false;
    mockGeminiResponse({
      ...baseFields,
      new_item_detected: null,
    });
    const { processContinuousChunk } = await import("../services/geminiContinuous");

    await processContinuousChunk(1, "item-1", "session-1", 21);

    expect(fetch).not.toHaveBeenCalled();
    expect(continuousStore.appendTranscript).not.toHaveBeenCalled();
    expect(sessionStore.updateItemField).not.toHaveBeenCalled();
    expect(continuousStore.markChunkDone).toHaveBeenCalledWith(21);
  });

  it("does not mutate fields or transcript after abort", async () => {
    let resolveFetch: (() => void) | null = null;
    vi.stubGlobal("fetch", vi.fn(async () => {
      await new Promise<void>((resolve) => {
        resolveFetch = resolve;
      });
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ ...baseFields, new_item_detected: null }) }],
              },
            },
          ],
        }),
      };
    }));
    const controller = new AbortController();
    const { processContinuousChunk } = await import("../services/geminiContinuous");

    const processing = processContinuousChunk(1, "item-1", "session-1", 4, { signal: controller.signal });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    controller.abort();
    resolveFetch?.();
    await processing;

    expect(continuousStore.appendTranscript).not.toHaveBeenCalled();
    expect(sessionStore.updateItemField).not.toHaveBeenCalledWith("item-1", "session-1", "title", "BRASS LAMP");
    expect(continuousStore.markChunkDone).toHaveBeenCalledWith(4);
  });
});
