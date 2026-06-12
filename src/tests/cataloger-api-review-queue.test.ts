import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

const { createRequestHandler } = await import("../../cataloger-api/src/server.js");

type HeaderValue = string | number | readonly string[];
type HeaderMap = Record<string, HeaderValue | undefined>;
type Method = "GET" | "POST";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

function profileStore(role: string, isActive = true) {
  return {
    getProfile: vi.fn().mockResolvedValue({
      id: "reviewer-1",
      role,
      is_active: isActive,
    }),
  };
}

function request({
  method,
  path,
  body,
  fetchMock,
  profiles = profileStore("manager"),
}: {
  method: Method;
  path: string;
  body?: unknown;
  fetchMock: ReturnType<typeof vi.fn>;
  profiles?: ReturnType<typeof profileStore>;
}) {
  vi.stubGlobal("fetch", fetchMock);
  const handler = createRequestHandler({
    auth: {
      verifyIdToken: vi.fn().mockResolvedValue({
        uid: "reviewer-1",
        workspace: "potomackco.com",
        workspace_role: "authenticated",
      }),
    },
    profiles,
    allowedOrigins: ["https://app.potomackco.com"],
    env: { CATALOGER_POSTGREST_URL: "https://postgrest.test" },
  });

  return new Promise<{ status: number; body: string; headers: HeaderMap }>((resolve) => {
    const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]) as Readable & {
      method: string;
      url: string;
      headers: Record<string, string>;
    };
    req.method = method;
    req.url = path;
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

function reviewFetch({
  session = { id: "session-1", mode: "sale", status: "submitted", created_by: "specialist-1", assigned_to: "reviewer-1" },
  drafts = [
    {
      id: "draft-1",
      session_id: "session-1",
      status: "draft",
      title: "WALNUT CHAIR",
      receipt_number: "100",
      raw_ocr_text: "Walnut chair",
      source_page_refs: [],
      low_confidence_fields: [],
      created_at: "2026-06-12T12:00:00.000Z",
      updated_at: "2026-06-12T12:00:00.000Z",
    },
  ],
  duplicate = null,
}: {
  session?: Record<string, unknown>;
  drafts?: Array<Record<string, unknown>>;
  duplicate?: Record<string, unknown> | null;
} = {}) {
  const items = [{ id: "item-1", sort_order: 1, receipt_number: "90" }];
  return vi.fn().mockImplementation((url: URL | string, init?: RequestInit) => {
    const requestUrl = new URL(String(url));
    const method = init?.method ?? "GET";
    const path = requestUrl.pathname;

    if (path === "/sessions") return Promise.resolve(jsonResponse([session]));
    if (path === "/item_drafts" && method === "GET") {
      if (requestUrl.searchParams.has("receipt_number")) {
        return Promise.resolve(jsonResponse(duplicate ? [duplicate] : []));
      }
      if (requestUrl.searchParams.has("id")) {
        return Promise.resolve(jsonResponse(drafts.filter((draft) =>
          draft.id === requestUrl.searchParams.get("id")?.replace(/^eq\./, ""),
        )));
      }
      return Promise.resolve(jsonResponse(drafts));
    }
    if (path === "/items" && method === "GET") return Promise.resolve(jsonResponse(items));
    if (path === "/items" && method === "POST") {
      const [row] = JSON.parse(String(init?.body)) as Array<Record<string, unknown>>;
      return Promise.resolve(jsonResponse([{ id: "item-new", ...row }]));
    }
    if (path === "/item_drafts" && method === "PATCH") {
      const id = requestUrl.searchParams.get("id")?.replace(/^eq\./, "");
      const draft = drafts.find((row) => row.id === id && row.status === "draft");
      if (!draft) return Promise.resolve(jsonResponse([]));
      const updated = {
        ...draft,
        ...JSON.parse(String(init?.body)),
        updated_at: "2026-06-12T13:00:00.000Z",
      };
      return Promise.resolve(jsonResponse([updated]));
    }
    return Promise.resolve(jsonResponse({ error: "not found" }, 404));
  });
}

describe("cataloger-api review queue", () => {
  it("promotes a submitted draft and returns promoted_item_id plus an action ack", async () => {
    const fetchMock = reviewFetch();
    const response = await request({
      method: "POST",
      path: "/item-drafts/draft-1/promote",
      body: { fields: { title: "EDITED CHAIR" } },
      fetchMock,
    });

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      ok: true,
      draft_id: "draft-1",
      promoted_item_id: "item-new",
      action_ack: {
        type: "promote",
        draft_id: "draft-1",
        status: "promoted",
        actor_uid: "reviewer-1",
        acted_at: "2026-06-12T13:00:00.000Z",
      },
    });
    const itemInsert = fetchMock.mock.calls.find((call) =>
      String(call[0]) === "https://postgrest.test/items" && call[1]?.method === "POST",
    );
    expect(JSON.parse(String(itemInsert?.[1]?.body))[0]).toEqual(expect.objectContaining({
      title: "EDITED CHAIR",
      sort_order: 2,
      ai_status: "done",
    }));
  });

  it("rejects review actions before the session is submitted", async () => {
    const fetchMock = reviewFetch({
      session: { id: "session-1", mode: "sale", status: "active", created_by: "specialist-1", assigned_to: "reviewer-1" },
    });
    const response = await request({
      method: "POST",
      path: "/item-drafts/draft-1/promote",
      body: { fields: {} },
      fetchMock,
    });

    expect(response.status).toBe(409);
    expect(JSON.parse(response.body)).toEqual({
      error: "Session must be submitted before draft review actions",
    });
    expect(fetchMock.mock.calls.some((call) => String(call[0]) === "https://postgrest.test/items")).toBe(false);
  });

  it("returns the blocking draft id/status when duplicate receipt promotion is blocked", async () => {
    const response = await request({
      method: "POST",
      path: "/item-drafts/draft-1/promote",
      body: { fields: {} },
      fetchMock: reviewFetch({ duplicate: { id: "draft-0", status: "draft" } }),
    });

    expect(response.status).toBe(409);
    expect(JSON.parse(response.body)).toEqual({
      error: "duplicate_blocked",
      duplicate: {
        blocking_draft_id: "draft-0",
        blocking_status: "draft",
      },
    });
  });

  it("lets specialists view their own submitted drafts without review actions", async () => {
    const response = await request({
      method: "GET",
      path: "/sessions/session-1/item-drafts",
      fetchMock: reviewFetch({
        session: { id: "session-1", mode: "sale", status: "submitted", created_by: "reviewer-1", assigned_to: null },
      }),
      profiles: profileStore("specialist"),
    });

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expect.objectContaining({
      can_review: false,
      drafts: [expect.objectContaining({ id: "draft-1", duplicate_block: null })],
    }));
  });
});
