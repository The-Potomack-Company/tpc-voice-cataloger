import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db";
import { addNotePage, getNotePages, reorderNotePages } from "../db/notePages";
import type { NotePage } from "../db/types";
import {
  normalizeModelDrafts,
  notePagesBatchKey,
  processNotesWithAi,
} from "../services/processNotesWithAi";

vi.mock("../lib/authGuard", () => ({
  ensureFreshSession: vi.fn().mockResolvedValue("firebase-token"),
}));

function page(pageUid: string, sortOrder: number, contentHash = "a".repeat(64)): NotePage {
  return {
    pageUid,
    sessionId: "session-1",
    blob: new Blob(["full"], { type: "image/jpeg" }),
    thumbnail: new Blob(["thumb"], { type: "image/jpeg" }),
    contentHash,
    sortOrder,
    status: "captured",
    createdAt: "2026-06-12T00:00:00.000Z",
  };
}

function jpeg(tag: string): Blob {
  return new Blob([tag], { type: "image/jpeg" });
}

function geminiResponse(pageUid: string) {
  return {
    candidates: [
      {
        content: {
          parts: [
            {
              text: JSON.stringify({
                drafts: [
                  {
                    source_page_uids: [pageUid],
                    raw_ocr_text: `Walnut chair ${pageUid}`,
                    fields: {
                      title: { value: `Walnut chair ${pageUid}`, confidence: 0.92 },
                      description: { value: null, confidence: 1 },
                      condition: { value: null, confidence: 1 },
                      estimate: { value: null, confidence: 1 },
                      measurements: { value: null, confidence: 1 },
                      category: { value: "FRN", confidence: 0.91 },
                      transcript: { value: `Walnut chair ${pageUid}`, confidence: 0.88 },
                      receipt_number: { value: null, confidence: 1 },
                    },
                  },
                ],
              }),
            },
          ],
        },
      },
    ],
  };
}

function pageUidFromProxyRequest(init: RequestInit | undefined): string {
  const body = JSON.parse(String(init?.body));
  const text = body.payload.contents[0].parts[0].text as string;
  const match = text.match(/\d+\. ([^\n]+)/);
  if (!match) throw new Error("missing page uid in proxy request");
  return match[1];
}

beforeEach(() => {
  vi.stubEnv("VITE_GEMINI_PROXY_URL", "https://gemini-proxy.test");
  vi.stubEnv("VITE_CATALOGER_API_URL", "https://cataloger-api.test");
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await db.delete();
  await db.open();
});

describe("photo note segmentation normalization", () => {
  it("uses page content hashes as the stable idempotency key", () => {
    const pages = [page("p-b", 0, "b".repeat(64)), page("p-a", 1, "a".repeat(64))];

    expect(notePagesBatchKey("session-1", pages)).toBe(
      `photo-notes:v2:session-1:sha256:${"a".repeat(64)},sha256:${"b".repeat(64)}`,
    );
  });

  it("blanks and flags fields below the confidence threshold", () => {
    const drafts = normalizeModelDrafts([page("p-1", 0)], {
      drafts: [
        {
          source_page_uids: ["p-1"],
          raw_ocr_text: "Walnut chair, maybe 200",
          fields: {
            title: { value: "Walnut chair", confidence: 0.92 },
            description: { value: "maybe a tall back", confidence: 0.4 },
            condition: { value: null, confidence: 1 },
            estimate: { value: "200", confidence: 0.59 },
            measurements: { value: null, confidence: 1 },
            category: { value: "FRN", confidence: 0.91 },
            transcript: { value: "Walnut chair, maybe 200", confidence: 0.88 },
            receipt_number: { value: "12345-1", confidence: 0.3 },
          },
        },
      ],
    });

    expect(drafts[0].fields.title).toBe("WALNUT CHAIR");
    expect(drafts[0].fields.description).toBeNull();
    expect(drafts[0].fields.estimate).toBeNull();
    expect(drafts[0].fields.receipt_number).toBeNull();
    expect(drafts[0].pageContentKey).toBe(`sha256:${"a".repeat(64)}`);
    expect(drafts[0].pageSegmentIndex).toBe(0);
    expect(drafts[0].lowConfidenceFields).toEqual([
      "description",
      "estimate",
      "receipt_number",
    ]);
    expect(drafts[0].sourcePageRefs).toEqual([{
      pageUid: "p-1",
      sortOrder: 0,
      pageContentKey: `sha256:${"a".repeat(64)}`,
    }]);
  });

  it("re-run after add/reorder sends only unprocessed page content", async () => {
    const id0 = await addNotePage({ sessionId: "session-1", blob: jpeg("a"), thumbnail: jpeg("ta") });
    const id1 = await addNotePage({ sessionId: "session-1", blob: jpeg("b"), thumbnail: jpeg("tb") });
    const persistedDraftKeys: string[] = [];
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === "https://gemini-proxy.test") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(geminiResponse(pageUidFromProxyRequest(init))),
        });
      }

      const body = JSON.parse(String(init?.body));
      persistedDraftKeys.push(...body.drafts.map((draft: { pageContentKey: string }) => draft.pageContentKey));
      return Promise.resolve({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ draftCount: body.drafts.length }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(processNotesWithAi("session-1")).resolves.toEqual({ draftCount: 2 });

    await reorderNotePages([id1, id0]);
    await addNotePage({ sessionId: "session-1", blob: jpeg("c"), thumbnail: jpeg("tc") });

    await expect(processNotesWithAi("session-1")).resolves.toEqual({ draftCount: 1 });

    expect(persistedDraftKeys).toHaveLength(3);
    expect(new Set(persistedDraftKeys).size).toBe(3);
    const proxyCalls = fetchMock.mock.calls.filter(([url]) => url === "https://gemini-proxy.test");
    expect(proxyCalls).toHaveLength(3);
    const pages = await getNotePages("session-1");
    expect(pages.every((p) => p.status === "processed")).toBe(true);
    expect(pages.every((p) => p.processedContentHash === p.contentHash)).toBe(true);
  });

  it("partial-failure retry processes only the failed pages", async () => {
    await addNotePage({ sessionId: "session-1", blob: jpeg("ok"), thumbnail: jpeg("tok") });
    await addNotePage({ sessionId: "session-1", blob: jpeg("fail-once"), thumbnail: jpeg("tfail") });
    let apiCalls = 0;
    const processedUids: string[] = [];
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === "https://gemini-proxy.test") {
        const pageUid = pageUidFromProxyRequest(init);
        processedUids.push(pageUid);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(geminiResponse(pageUid)),
        });
      }

      apiCalls += 1;
      if (apiCalls === 2) {
        return Promise.resolve({
          ok: false,
          status: 502,
          json: () => Promise.resolve({ error: "temporary insert failure" }),
        });
      }

      const body = JSON.parse(String(init?.body));
      return Promise.resolve({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ draftCount: body.drafts.length }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(processNotesWithAi("session-1")).rejects.toThrow("Failed to process 1 note page");
    let pages = await getNotePages("session-1");
    expect(pages.map((p) => p.status)).toEqual(["processed", "failed"]);

    processedUids.length = 0;
    await expect(processNotesWithAi("session-1")).resolves.toEqual({ draftCount: 1 });

    pages = await getNotePages("session-1");
    expect(pages.map((p) => p.status)).toEqual(["processed", "processed"]);
    expect(processedUids).toEqual([pages[1].pageUid]);
  });
});
