import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

const { createRequestHandler } = await import("../../cataloger-api/src/server.js");

type HeaderValue = string | number | readonly string[];
type HeaderMap = Record<string, HeaderValue | undefined>;
type DraftRow = Record<string, unknown> & {
  session_id: string;
  page_content_key: string;
  page_segment_index: number;
  status: string;
};

function draftRowKey(row: Pick<DraftRow, "session_id" | "page_content_key" | "page_segment_index">) {
  return `${row.session_id}:${row.page_content_key}:${row.page_segment_index}`;
}

function draftStoreFetch(initialRows: DraftRow[] = []) {
  const rowsByKey = new Map(initialRows.map((row) => [draftRowKey(row), { ...row }]));
  const fetchMock = vi.fn().mockImplementation((url: URL, init?: RequestInit) => {
    const requestUrl = new URL(String(url));
    const method = init?.method;

    if (method === "PATCH") {
      const key = [
        requestUrl.searchParams.get("session_id")?.replace(/^eq\./, ""),
        requestUrl.searchParams.get("page_content_key")?.replace(/^eq\./, ""),
        Number(requestUrl.searchParams.get("page_segment_index")?.replace(/^eq\./, "")),
      ].join(":");
      const row = rowsByKey.get(key);
      if (requestUrl.searchParams.get("status") === "eq.draft" && row?.status === "draft") {
        const next = { ...row, ...JSON.parse(String(init?.body)), status: row.status };
        rowsByKey.set(key, next);
        return Promise.resolve({ ok: true, json: () => Promise.resolve([next]) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }

    if (method === "POST") {
      const [row] = JSON.parse(String(init?.body)) as DraftRow[];
      const key = draftRowKey(row);
      if (rowsByKey.has(key)) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      const inserted = { ...row, status: "draft" };
      rowsByKey.set(key, inserted);
      return Promise.resolve({ ok: true, json: () => Promise.resolve([inserted]) });
    }

    return Promise.resolve({ ok: false, status: 405, text: () => Promise.resolve("method not allowed") });
  });

  return { fetchMock, rowsByKey };
}

function postDraftBatch({
  decoded,
  fetchMock = vi.fn(),
  postgrestUrl = "https://postgrest.test",
  body = {
    sessionId: "session-1",
    batchKey: "batch-1",
    pages: [{ pageUid: "page-1", sortOrder: 0 }],
    drafts: [
      {
        sourcePageRefs: [{ pageUid: "page-1", sortOrder: 0 }],
        pageContentKey: "sha256:page-1",
        pageSegmentIndex: 0,
        rawOcrText: "Walnut chair",
        fields: { title: "WALNUT CHAIR" },
        fieldConfidence: { title: 0.9 },
        lowConfidenceFields: [],
      },
    ],
  },
}: {
  decoded: Record<string, unknown>;
  fetchMock?: ReturnType<typeof vi.fn>;
  postgrestUrl?: string;
  body?: Record<string, unknown>;
}) {
  vi.stubGlobal("fetch", fetchMock);
  const handler = createRequestHandler({
    auth: {
      verifyIdToken: vi.fn().mockResolvedValue(decoded),
    },
    allowedOrigins: ["https://app.potomackco.com"],
    env: { CATALOGER_POSTGREST_URL: postgrestUrl },
  });

  return new Promise<{ status: number; body: string; headers: HeaderMap }>((resolve) => {
    const req = Readable.from([JSON.stringify(body)]) as Readable & {
      method: string;
      url: string;
      headers: Record<string, string>;
    };
    req.method = "POST";
    req.url = "/item-draft-batches";
    req.headers = {
      origin: "https://app.potomackco.com",
      authorization: "Bearer firebase-token",
      "content-type": "application/json",
    };
    const response = {
      body: "",
      headers: {} as HeaderMap,
      status: 0,
      writeHead(status: number, headers: HeaderMap) {
        this.status = status;
        this.headers = headers;
      },
      end(responseBody = "") {
        this.body = String(responseBody);
        resolve({ status: this.status, body: this.body, headers: this.headers });
      },
    };
    handler(req, response);
  });
}

describe("cataloger-api item draft batches", () => {
  it("rejects Firebase tokens without the workspace claim before PostgREST", async () => {
    const fetchMock = vi.fn();
    const response = await postDraftBatch({
      decoded: { uid: "user-1", workspace_role: "authenticated" },
      fetchMock,
    });

    expect(response.status).toBe(403);
    expect(JSON.parse(response.body)).toEqual({
      error: "Firebase workspace claim required",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("inserts new drafts with a per-page conflict key", async () => {
    const { fetchMock } = draftStoreFetch();
    const response = await postDraftBatch({
      decoded: {
        uid: "user-1",
        workspace: "potomackco.com",
        workspace_role: "authenticated",
      },
      fetchMock,
    });

    expect(response.status).toBe(201);
    expect(JSON.parse(response.body)).toEqual({ ok: true, draftCount: 1, skippedCount: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [updateUrl, updateInit] = fetchMock.mock.calls[0];
    expect(String(updateUrl)).toBe(
      "https://postgrest.test/item_drafts?session_id=eq.session-1&page_content_key=eq.sha256%3Apage-1&page_segment_index=eq.0&status=eq.draft",
    );
    expect(updateInit.method).toBe("PATCH");
    expect(updateInit.headers.prefer).toBe("return=representation");
    const [insertUrl, insertInit] = fetchMock.mock.calls[1];
    expect(String(insertUrl)).toBe(
      "https://postgrest.test/item_drafts?on_conflict=session_id%2Cpage_content_key%2Cpage_segment_index",
    );
    expect(insertInit.method).toBe("POST");
    expect(insertInit.headers.prefer).toBe("resolution=ignore-duplicates,return=representation");
    expect(JSON.parse(insertInit.body)).toEqual([
      expect.objectContaining({
        session_id: "session-1",
        page_content_key: "sha256:page-1",
        page_segment_index: 0,
      }),
    ]);
  });

  it("normalizes PostgREST env URLs that include the Supabase REST prefix", async () => {
    const { fetchMock } = draftStoreFetch();
    const response = await postDraftBatch({
      decoded: {
        uid: "user-1",
        workspace: "potomackco.com",
        workspace_role: "authenticated",
      },
      fetchMock,
      postgrestUrl: "https://postgrest.test/rest/v1/",
    });

    expect(response.status).toBe(201);
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      "https://postgrest.test/item_drafts?session_id=eq.session-1&page_content_key=eq.sha256%3Apage-1&page_segment_index=eq.0&status=eq.draft",
      "https://postgrest.test/item_drafts?on_conflict=session_id%2Cpage_content_key%2Cpage_segment_index",
    ]);
  });

  it("re-emits update unreviewed draft rows through the guarded write", async () => {
    const existing: DraftRow = {
      session_id: "session-1",
      page_content_key: "sha256:page-1",
      page_segment_index: 0,
      status: "draft",
      title: "OLD TITLE",
      raw_ocr_text: "Old text",
    };
    const { fetchMock, rowsByKey } = draftStoreFetch([existing]);
    const response = await postDraftBatch({
      decoded: {
        uid: "user-1",
        workspace: "potomackco.com",
        workspace_role: "authenticated",
      },
      fetchMock,
    });

    expect(response.status).toBe(201);
    expect(JSON.parse(response.body)).toEqual({ ok: true, draftCount: 1, skippedCount: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
    expect(String(fetchMock.mock.calls[0][0])).toContain("status=eq.draft");
    expect(rowsByKey.get(draftRowKey(existing))).toEqual(expect.objectContaining({
      status: "draft",
      title: "WALNUT CHAIR",
      raw_ocr_text: "Walnut chair",
    }));
  });

  it.each(["promoted", "discarded", "reviewed"])(
    "re-emits against %s rows leave them unchanged and report a skip",
    async (status) => {
      const existing: DraftRow = {
        session_id: "session-1",
        page_content_key: "sha256:page-1",
        page_segment_index: 0,
        status,
        title: "HUMAN TITLE",
        raw_ocr_text: "Human reviewed text",
        field_confidence: { title: 1 },
      };
      const before = JSON.stringify(existing);
      const { fetchMock, rowsByKey } = draftStoreFetch([existing]);
      const response = await postDraftBatch({
        decoded: {
          uid: "user-1",
          workspace: "potomackco.com",
          workspace_role: "authenticated",
        },
        fetchMock,
      });

      expect(response.status).toBe(201);
      expect(JSON.parse(response.body)).toEqual({ ok: true, draftCount: 0, skippedCount: 1 });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls.map((call) => call[1].method)).toEqual(["PATCH", "POST"]);
      expect(JSON.stringify(rowsByKey.get(draftRowKey(existing)))).toBe(before);
    },
  );

  it("uses the atomic status filter on write instead of selecting review state first", async () => {
    const { fetchMock } = draftStoreFetch([{
      session_id: "session-1",
      page_content_key: "sha256:page-1",
      page_segment_index: 0,
      status: "promoted",
      title: "HUMAN TITLE",
    }]);
    const response = await postDraftBatch({
      decoded: {
        uid: "user-1",
        workspace: "potomackco.com",
        workspace_role: "authenticated",
      },
      fetchMock,
    });

    expect(response.status).toBe(201);
    expect(fetchMock.mock.calls.map((call) => call[1].method)).toEqual(["PATCH", "POST"]);
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      "https://postgrest.test/item_drafts?session_id=eq.session-1&page_content_key=eq.sha256%3Apage-1&page_segment_index=eq.0&status=eq.draft",
      "https://postgrest.test/item_drafts?on_conflict=session_id%2Cpage_content_key%2Cpage_segment_index",
    ]);
  });
});
