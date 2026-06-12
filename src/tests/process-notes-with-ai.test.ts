import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db";
import { addNotePage, getNotePages, reorderNotePages } from "../db/notePages";
import type { NotePage } from "../db/types";
import {
  normalizeModelDrafts,
  notePagesBatchKey,
  processNotesWithAi,
} from "../services/processNotesWithAi";
import type { ItemDraftPayload } from "../services/itemDraftsApi";

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

function modelDraft(pageUids: string[], title: string) {
  return {
    source_page_uids: pageUids,
    raw_ocr_text: title,
    fields: {
      title: { value: title, confidence: 0.92 },
      description: { value: null, confidence: 1 },
      condition: { value: null, confidence: 1 },
      estimate: { value: null, confidence: 1 },
      measurements: { value: null, confidence: 1 },
      category: { value: "FRN", confidence: 0.91 },
      transcript: { value: title, confidence: 0.88 },
      receipt_number: { value: null, confidence: 1 },
    },
  };
}

function geminiResponse(drafts: ReturnType<typeof modelDraft>[]) {
  return {
    candidates: [
      {
        content: {
          parts: [
            {
              text: JSON.stringify({
                drafts,
              }),
            },
          ],
        },
      },
    ],
  };
}

function pageUidsFromProxyRequest(init: RequestInit | undefined): string[] {
  const body = JSON.parse(String(init?.body));
  const text = body.payload.contents[0].parts[0].text as string;
  const matches = [...text.matchAll(/^\d+\. ([^\s]+) \(sha256:[^)]+\)$/gm)];
  if (matches.length === 0) throw new Error("missing page uids in proxy request");
  return matches.map((match) => match[1]);
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

  it("attributes an item spanning two pages to one primary page draft", async () => {
    const id0 = await addNotePage({ sessionId: "session-1", blob: jpeg("span-a"), thumbnail: jpeg("ta") });
    const id1 = await addNotePage({ sessionId: "session-1", blob: jpeg("span-b"), thumbnail: jpeg("tb") });
    const persistedDrafts: ItemDraftPayload[] = [];
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === "https://gemini-proxy.test") {
        const pageUids = pageUidsFromProxyRequest(init);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(geminiResponse([
            modelDraft(pageUids, "Walnut chair continued across pages"),
          ])),
        });
      }

      const body = JSON.parse(String(init?.body));
      persistedDrafts.push(...body.drafts as ItemDraftPayload[]);
      return Promise.resolve({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ draftCount: body.drafts.length }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(processNotesWithAi("session-1")).resolves.toEqual({ draftCount: 1, skippedCount: 0 });

    const pages = await getNotePages("session-1");
    expect(pages.map((p) => p.id)).toEqual([id0, id1]);
    expect(persistedDrafts).toHaveLength(1);
    expect(persistedDrafts[0].pageContentKey).toBe(`sha256:${pages[0].contentHash}`);
    expect(persistedDrafts[0].pageSegmentIndex).toBe(0);
    expect(persistedDrafts[0].sourcePageRefs).toEqual([
      {
        pageUid: pages[0].pageUid,
        sortOrder: 0,
        pageContentKey: `sha256:${pages[0].contentHash}`,
      },
      {
        pageUid: pages[1].pageUid,
        sortOrder: 1,
        pageContentKey: `sha256:${pages[1].contentHash}`,
      },
    ]);
    const proxyCalls = fetchMock.mock.calls.filter(([url]) => url === "https://gemini-proxy.test");
    expect(proxyCalls).toHaveLength(1);
    expect(pageUidsFromProxyRequest(proxyCalls[0][1])).toEqual([pages[0].pageUid, pages[1].pageUid]);
  });

  it("re-run after add/reorder sends the full ordered page set without duplicating old page drafts", async () => {
    const id0 = await addNotePage({ sessionId: "session-1", blob: jpeg("a"), thumbnail: jpeg("ta") });
    const id1 = await addNotePage({ sessionId: "session-1", blob: jpeg("b"), thumbnail: jpeg("tb") });
    const persistedDraftsByKey = new Map<string, ItemDraftPayload>();
    const persistBodies: Array<{ drafts: ItemDraftPayload[] }> = [];
    const insertedCounts: number[] = [];
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === "https://gemini-proxy.test") {
        const pageUids = pageUidsFromProxyRequest(init);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(geminiResponse(
            pageUids.map((pageUid) => modelDraft([pageUid], `Walnut chair ${pageUid}`)),
          )),
        });
      }

      const body = JSON.parse(String(init?.body));
      persistBodies.push(body);
      let insertedCount = 0;
      for (const draft of body.drafts as ItemDraftPayload[]) {
        const key = `${draft.pageContentKey}:${draft.pageSegmentIndex}`;
        if (!persistedDraftsByKey.has(key)) insertedCount += 1;
        persistedDraftsByKey.set(key, draft);
      }
      insertedCounts.push(insertedCount);
      return Promise.resolve({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ draftCount: insertedCount }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(processNotesWithAi("session-1")).resolves.toEqual({ draftCount: 2, skippedCount: 0 });

    await reorderNotePages([id1, id0]);
    await addNotePage({ sessionId: "session-1", blob: jpeg("c"), thumbnail: jpeg("tc") });

    await expect(processNotesWithAi("session-1")).resolves.toEqual({ draftCount: 1, skippedCount: 0 });

    expect(insertedCounts).toEqual([2, 1]);
    expect(persistBodies).toHaveLength(2);
    expect(persistBodies[0].drafts).toHaveLength(2);
    expect(persistBodies[1].drafts).toHaveLength(3);
    expect(persistedDraftsByKey.size).toBe(3);
    const firstRunKeys = persistBodies[0].drafts.map((draft) => `${draft.pageContentKey}:${draft.pageSegmentIndex}`);
    const secondRunKeys = persistBodies[1].drafts.map((draft) => `${draft.pageContentKey}:${draft.pageSegmentIndex}`);
    expect(firstRunKeys.every((key) => secondRunKeys.includes(key))).toBe(true);
    const proxyCalls = fetchMock.mock.calls.filter(([url]) => url === "https://gemini-proxy.test");
    expect(proxyCalls).toHaveLength(2);
    const pages = await getNotePages("session-1");
    expect(pages.every((p) => p.status === "processed")).toBe(true);
    expect(pages.every((p) => p.processedContentHash === p.contentHash)).toBe(true);
    expect(pageUidsFromProxyRequest(proxyCalls[1][1])).toEqual(pages.map((page) => page.pageUid));

    await reorderNotePages([id0, id1, pages[2].id as number]);
    await expect(processNotesWithAi("session-1")).resolves.toEqual({ draftCount: 0, skippedCount: 0 });
    expect(fetchMock.mock.calls.filter(([url]) => url === "https://gemini-proxy.test")).toHaveLength(2);
  });

  it("batch-failure retry reprocesses the full ordered page set", async () => {
    await addNotePage({ sessionId: "session-1", blob: jpeg("ok"), thumbnail: jpeg("tok") });
    await addNotePage({ sessionId: "session-1", blob: jpeg("fail-once"), thumbnail: jpeg("tfail") });
    let apiCalls = 0;
    const processedUidSets: string[][] = [];
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === "https://gemini-proxy.test") {
        const pageUids = pageUidsFromProxyRequest(init);
        processedUidSets.push(pageUids);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(geminiResponse(
            pageUids.map((pageUid) => modelDraft([pageUid], `Walnut chair ${pageUid}`)),
          )),
        });
      }

      apiCalls += 1;
      if (apiCalls === 1) {
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

    await expect(processNotesWithAi("session-1")).rejects.toThrow("Failed to process 2 note pages");
    let pages = await getNotePages("session-1");
    expect(pages.map((p) => p.status)).toEqual(["failed", "failed"]);

    await expect(processNotesWithAi("session-1")).resolves.toEqual({ draftCount: 2, skippedCount: 0 });

    pages = await getNotePages("session-1");
    expect(pages.map((p) => p.status)).toEqual(["processed", "processed"]);
    expect(processedUidSets).toEqual([
      pages.map((page) => page.pageUid),
      pages.map((page) => page.pageUid),
    ]);
  });
});
