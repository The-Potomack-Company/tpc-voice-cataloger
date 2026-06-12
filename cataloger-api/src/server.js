import { createServer } from "node:http";
import { validateWorkspaceSignIn, workspaceCustomClaims } from "./claimPolicy.js";

const PORT = Number(process.env.PORT ?? 8080);
const PROD_ALLOWED_ORIGINS = [
  "https://app.potomackco.com",
  "https://gen-lang-client-0662587427.web.app",
];
const FIREBASE_ADMIN_APP_MODULE = "firebase-admin/app";
const FIREBASE_ADMIN_AUTH_MODULE = "firebase-admin/auth";
const DEFAULT_ALLOWED_ORIGINS = [
  ...PROD_ALLOWED_ORIGINS,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function parseAllowedOrigins(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return DEFAULT_ALLOWED_ORIGINS;
  }

  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : PROD_ALLOWED_ORIGINS;
}

export function allowedOriginsFromEnv(env = process.env) {
  return parseAllowedOrigins(env.CATALOGER_API_ALLOWED_ORIGINS);
}

function corsHeaders(req, allowedOrigins = allowedOriginsFromEnv()) {
  const origin = req.headers.origin;
  const headers = {
    vary: "Origin",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "Authorization, Content-Type",
    "access-control-max-age": "600",
  };

  if (typeof origin === "string" && allowedOrigins.includes(origin)) {
    headers["access-control-allow-origin"] = origin;
  }

  return headers;
}

function json(res, status, body, headers = {}) {
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
    ...headers,
  });
  res.end(JSON.stringify(body));
}

function bearerToken(req) {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

function hasWorkspaceClaim(decoded) {
  return decoded?.workspace === "potomackco.com" && decoded?.workspace_role === "authenticated";
}

async function requireWorkspaceToken(req, res, auth, cors = {}) {
  const token = bearerToken(req);
  if (!token) {
    json(res, 401, { error: "Bearer Firebase ID token required" }, cors);
    return null;
  }

  try {
    const decoded = await auth.verifyIdToken(token, true);
    if (!hasWorkspaceClaim(decoded)) {
      json(res, 403, { error: "Firebase workspace claim required" }, cors);
      return null;
    }
    return { token, decoded };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid Firebase ID token";
    json(res, 401, { error: message }, cors);
    return null;
  }
}

async function readJsonBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
  }
  if (body.trim() === "") return {};
  return JSON.parse(body);
}

function postgrestUrlFromEnv(env = process.env) {
  return env.CATALOGER_POSTGREST_URL ?? env.POSTGREST_URL ?? "";
}

function postgrestHeaders(token, extra = {}) {
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    ...extra,
  };
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateDraftBatchPayload(body) {
  if (!body || typeof body !== "object") {
    return "JSON body required";
  }
  if (!isNonEmptyString(body.sessionId)) {
    return "sessionId required";
  }
  if (!isNonEmptyString(body.batchKey)) {
    return "batchKey required";
  }
  if (!Array.isArray(body.pages) || body.pages.length === 0) {
    return "pages required";
  }
  if (!Array.isArray(body.drafts) || body.drafts.length === 0) {
    return "drafts required";
  }
  const missingPageKey = body.drafts.some((draft) => !isNonEmptyString(draft?.pageContentKey));
  if (missingPageKey) {
    return "draft pageContentKey required";
  }
  return null;
}

function rowFromDraft(sessionId, batchKey, uid, draft, index) {
  return {
    session_id: sessionId,
    batch_key: batchKey,
    segment_index: index,
    page_content_key: draft.pageContentKey,
    page_segment_index: Number.isInteger(draft.pageSegmentIndex)
      ? draft.pageSegmentIndex
      : index,
    source_page_refs: draft.sourcePageRefs,
    raw_ocr_text: draft.rawOcrText ?? null,
    title: draft.fields?.title ?? null,
    description: draft.fields?.description ?? null,
    condition: draft.fields?.condition ?? null,
    estimate: draft.fields?.estimate ?? null,
    measurements: draft.fields?.measurements ?? null,
    category: draft.fields?.category ?? null,
    transcript: draft.fields?.transcript ?? null,
    receipt_number: draft.fields?.receipt_number ?? null,
    field_confidence: draft.fieldConfidence ?? {},
    low_confidence_fields: draft.lowConfidenceFields ?? [],
    receipt_number_requires_review: Boolean(draft.fields?.receipt_number),
    created_by: uid,
  };
}

function itemDraftConflictUrl(baseUrl) {
  const url = new URL(`${baseUrl}/item_drafts`);
  url.searchParams.set("on_conflict", "session_id,page_content_key,page_segment_index");
  return url;
}

function itemDraftRowUrl(baseUrl, row) {
  const url = new URL(`${baseUrl}/item_drafts`);
  url.searchParams.set("session_id", `eq.${row.session_id}`);
  url.searchParams.set("page_content_key", `eq.${row.page_content_key}`);
  url.searchParams.set("page_segment_index", `eq.${row.page_segment_index}`);
  url.searchParams.set("status", "eq.draft");
  return url;
}

async function responseRows(response) {
  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

async function writeDraftRow(baseUrl, token, row) {
  const updateResponse = await fetch(itemDraftRowUrl(baseUrl, row), {
    method: "PATCH",
    headers: postgrestHeaders(token, {
      prefer: "return=representation",
    }),
    body: JSON.stringify(row),
  });
  if (!updateResponse.ok) {
    return { ok: false, response: updateResponse };
  }

  const updated = await responseRows(updateResponse);
  if (updated.length > 0) {
    return { ok: true, changedCount: updated.length, skippedCount: 0 };
  }

  const insertResponse = await fetch(itemDraftConflictUrl(baseUrl), {
    method: "POST",
    headers: postgrestHeaders(token, {
      prefer: "resolution=ignore-duplicates,return=representation",
    }),
    body: JSON.stringify([row]),
  });
  if (!insertResponse.ok) {
    return { ok: false, response: insertResponse };
  }

  const inserted = await responseRows(insertResponse);
  return {
    ok: true,
    changedCount: inserted.length,
    skippedCount: inserted.length === 0 ? 1 : 0,
  };
}

async function handleDraftBatch(req, res, auth, cors = {}, env = process.env) {
  const verified = await requireWorkspaceToken(req, res, auth, cors);
  if (!verified) return;

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    json(res, 400, { error: "Invalid JSON body" }, cors);
    return;
  }

  const validationError = validateDraftBatchPayload(body);
  if (validationError) {
    json(res, 400, { error: validationError }, cors);
    return;
  }

  const baseUrl = postgrestUrlFromEnv(env).replace(/\/$/, "");
  if (!baseUrl) {
    json(res, 500, { error: "PostgREST URL is not configured" }, cors);
    return;
  }

  const sessionId = body.sessionId;
  const batchKey = body.batchKey;
  const rows = body.drafts.map((draft, index) =>
    rowFromDraft(sessionId, batchKey, verified.decoded.uid, draft, index),
  );

  let draftCount = 0;
  let skippedCount = 0;
  for (const row of rows) {
    const result = await writeDraftRow(baseUrl, verified.token, row);
    if (!result.ok) {
      const detail = await result.response.text().catch(() => "");
      json(res, result.response.status === 409 ? 409 : 502, {
        error: result.response.status === 409
          ? "Draft batch already processed"
          : "Draft insert failed",
        detail,
      }, cors);
      return;
    }
    draftCount += result.changedCount;
    skippedCount += result.skippedCount;
  }

  json(res, 201, { ok: true, draftCount, skippedCount }, cors);
}

async function handleClaim(req, res, auth, cors = {}) {
  const token = bearerToken(req);
  if (!token) {
    json(res, 401, { error: "Bearer Firebase ID token required" }, cors);
    return;
  }

  try {
    const decoded = await auth.verifyIdToken(token, true);
    if (decoded.workspace === "potomackco.com" && decoded.workspace_role === "authenticated") {
      json(res, 200, { ok: true, refreshRequired: false }, cors);
      return;
    }

    const user = await auth.getUser(decoded.uid);
    const verdict = validateWorkspaceSignIn(decoded, user);
    if (!verdict.ok) {
      json(res, 403, { error: verdict.reason }, cors);
      return;
    }

    await auth.setCustomUserClaims(decoded.uid, workspaceCustomClaims(user.customClaims));
    json(res, 200, { ok: true, refreshRequired: true }, cors);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid Firebase ID token";
    json(res, 401, { error: message }, cors);
  }
}

export function createRequestHandler({
  auth,
  allowedOrigins = allowedOriginsFromEnv(),
  env = process.env,
}) {
  return (req, res) => {
    if (req.method === "GET" && req.url === "/healthz") {
      json(res, 200, { ok: true });
      return;
    }

    if (req.url === "/session/claim") {
      const cors = corsHeaders(req, allowedOrigins);
      if (req.method === "OPTIONS") {
        res.writeHead(204, cors);
        res.end();
        return;
      }
      if (req.method === "POST") {
        void handleClaim(req, res, auth, cors);
        return;
      }
    }

    if (req.url === "/item-draft-batches") {
      const cors = corsHeaders(req, allowedOrigins);
      if (req.method === "OPTIONS") {
        res.writeHead(204, cors);
        res.end();
        return;
      }
      if (req.method === "POST") {
        void handleDraftBatch(req, res, auth, cors, env);
        return;
      }
    }

    json(res, 404, { error: "Not found" });
  };
}

export async function startServer() {
  const [{ initializeApp, applicationDefault }, { getAuth }] = await Promise.all([
    import(/* @vite-ignore */ FIREBASE_ADMIN_APP_MODULE),
    import(/* @vite-ignore */ FIREBASE_ADMIN_AUTH_MODULE),
  ]);

  initializeApp({
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID ?? "gen-lang-client-0662587427",
  });

  const auth = getAuth();
  return createServer(createRequestHandler({ auth })).listen(PORT, "0.0.0.0");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void startServer();
}
