import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

const { createRequestHandler } = await import("../../cataloger-api/src/server.js");

type HeaderValue = string | number | readonly string[];
type HeaderMap = Record<string, HeaderValue | undefined>;

function postDraftBatch({
  decoded,
  fetchMock = vi.fn(),
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
  body?: Record<string, unknown>;
}) {
  vi.stubGlobal("fetch", fetchMock);
  const handler = createRequestHandler({
    auth: {
      verifyIdToken: vi.fn().mockResolvedValue(decoded),
    },
    allowedOrigins: ["https://app.potomackco.com"],
    env: { CATALOGER_POSTGREST_URL: "https://postgrest.test" },
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

  it("upserts drafts with a per-page conflict key and replaces duplicates", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: "draft-1" }]),
    });
    const response = await postDraftBatch({
      decoded: {
        uid: "user-1",
        workspace: "potomackco.com",
        workspace_role: "authenticated",
      },
      fetchMock,
    });

    expect(response.status).toBe(201);
    expect(JSON.parse(response.body)).toEqual({ ok: true, draftCount: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "https://postgrest.test/item_drafts?on_conflict=session_id%2Cpage_content_key%2Cpage_segment_index",
    );
    expect(init.headers.prefer).toBe("resolution=merge-duplicates,return=representation");
    expect(JSON.parse(init.body)).toEqual([
      expect.objectContaining({
        session_id: "session-1",
        page_content_key: "sha256:page-1",
        page_segment_index: 0,
      }),
    ]);
  });

  it("reports rows returned by the per-page upsert", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: "draft-1" }]),
    });
    const response = await postDraftBatch({
      decoded: {
        uid: "user-1",
        workspace: "potomackco.com",
        workspace_role: "authenticated",
      },
      fetchMock,
    });

    expect(response.status).toBe(201);
    expect(JSON.parse(response.body)).toEqual({ ok: true, draftCount: 1 });
  });
});
