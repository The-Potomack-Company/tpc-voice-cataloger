---
phase: quick-sec-3-gemini-proxy-hardening
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - proxy/src/index.ts
  - proxy/src/index.test.ts
autonomous: true
requirements: [SEC-3]

must_haves:
  truths:
    - "Only gemini-2.5-flash is proxiable; any other model value returns 400 before a Gemini call is made"
    - "A request declaring Content-Length > 25 MB is rejected with 413 before the body is parsed"
    - "A valid authed POST with model gemini-2.5-flash still reaches Gemini and returns its response"
    - "Existing isAllowedOrigin / getCorsHeaders / verifyAuth tests remain green"
  artifacts:
    - path: "proxy/src/index.ts"
      provides: "ALLOWED_MODELS allowlist, MAX_BODY_BYTES cap, 413 + 400 guards in fetch handler"
      contains: "ALLOWED_MODELS"
    - path: "proxy/src/index.test.ts"
      provides: "ALLOWED_MODELS membership test + handler guard tests"
  key_links:
    - from: "proxy/src/index.ts fetch handler"
      to: "ALLOWED_MODELS"
      via: "model allowlist check before URL construction"
      pattern: "ALLOWED_MODELS\\.has"
---

<objective>
Harden the Gemini proxy worker (SEC-3) against two abuse vectors: arbitrary client-supplied model strings interpolated into the upstream URL, and unbounded request bodies.

Purpose: The proxy currently lets any caller request any Gemini model and POST a body of any size. The legit client only ever sends `model: "gemini-2.5-flash"`. Lock to an allowlist and cap body size.
Output: Updated `proxy/src/index.ts` with `ALLOWED_MODELS` + `MAX_BODY_BYTES` guards, plus tests in `proxy/src/index.test.ts`. Single atomic commit on `urgent/sec-proxy-hardening`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
Scope is strictly `proxy/src/index.ts` and `proxy/src/index.test.ts`. Do NOT touch `src/`.

Current handler ordering (after SEC-2): corsHeaders → OPTIONS 204 → non-POST 405 → verifyAuth 401 → `await request.json()` → build Gemini URL with interpolated `model` → fetch → return. The `model` is interpolated straight into the URL (VULN) and the body is unbounded (VULN).

<interfaces>
From proxy/src/index.ts (current, all exported except the handler internals):

```typescript
interface Env {
  GEMINI_API_KEY: string;
  ALLOWED_ORIGINS: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

export function isAllowedOrigin(origin: string, allowedOrigins: string): boolean;
export async function verifyAuth(request: Request, env: Env): Promise<boolean>;
export function getCorsHeaders(request: Request, env: Env): Record<string, string>;
export default { async fetch(request: Request, env: Env): Promise<Response> };
```

verifyAuth calls `fetch(`${env.SUPABASE_URL}/auth/v1/user`, ...)` and returns `response.status === 200`. The existing verifyAuth tests mock fetch with `vi.spyOn(global, 'fetch').mockResolvedValue({ status: 200 } as Response)` — note that mock does NOT supply `.text()`, so handler-level tests need a richer mock (status + text).

Existing test imports: `import { isAllowedOrigin, getCorsHeaders, verifyAuth } from './index';`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add model allowlist + body-size cap to the worker</name>
  <files>proxy/src/index.ts</files>
  <action>
At module scope (after the `Env` interface, before the exported functions), add two exported constants so tests can import them:
- `export const ALLOWED_MODELS = new Set(["gemini-2.5-flash"]);`
- `export const MAX_BODY_BYTES = 25 * 1024 * 1024;` (25 MB).

In the default `fetch` handler, preserve the existing ordering and insert two new guards. Final order MUST be: build corsHeaders → OPTIONS 204 → non-POST 405 → verifyAuth 401 → Content-Length 413 → parse JSON body → model allowlist 400 → Gemini proxy.

413 guard (cheap header pre-check, placed AFTER the verifyAuth 401 block and BEFORE the `try`/body parse): read `request.headers.get('Content-Length')`. If the header is present and `Number(contentLength) > MAX_BODY_BYTES`, return `new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })`. Do NOT attempt to stream-measure the body; Content-Length is the only check. A missing or non-numeric Content-Length falls through (do not block).

400 model guard (inside the existing `try`, immediately AFTER `const { model, payload } = await request.json()` and BEFORE constructing `geminiUrl`): if `typeof model !== 'string' || !ALLOWED_MODELS.has(model)`, return `new Response(JSON.stringify({ error: 'Unsupported model' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })`.

Leave OPTIONS/405/401/500 branches, the Gemini URL construction, the upstream fetch, and the response passthrough otherwise unchanged.
  </action>
  <verify>
    <automated>cd proxy && npx tsc --noEmit && grep -q "ALLOWED_MODELS" src/index.ts && grep -q "MAX_BODY_BYTES" src/index.ts && grep -q "Payload too large" src/index.ts && grep -q "Unsupported model" src/index.ts</automated>
  </verify>
  <done>ALLOWED_MODELS and MAX_BODY_BYTES are exported at module scope; the handler returns 413 on oversized Content-Length before parsing, and 400 on a non-allowlisted model after parsing but before the Gemini fetch. Type-checks clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add tests for allowlist + size cap + handler guards</name>
  <files>proxy/src/index.test.ts</files>
  <behavior>
    - ALLOWED_MODELS contains "gemini-2.5-flash" and does NOT contain "gemini-2.5-pro".
    - Handler: authed POST with Content-Length header > MAX_BODY_BYTES → 413, and global.fetch is NOT called for the Gemini upstream.
    - Handler: authed POST with body {model:"evil-model",payload:{}} → 400.
    - Handler: authed POST with body {model:"gemini-2.5-flash",payload:{}} → 200 (mock fetch returns 200 for both the verifyAuth /auth/v1/user call and the Gemini call).
  </behavior>
  <action>
Update the import to also pull `ALLOWED_MODELS` and `MAX_BODY_BYTES` and the default export: change line 2 to import the named functions plus `ALLOWED_MODELS, MAX_BODY_BYTES` from `'./index'`, and add `import worker from './index';`. Keep all existing describe blocks (isAllowedOrigin / getCorsHeaders / verifyAuth) byte-for-byte unchanged — they must stay green.

Add `describe('ALLOWED_MODELS')` with two `it`s: `expect(ALLOWED_MODELS.has('gemini-2.5-flash')).toBe(true)` and `expect(ALLOWED_MODELS.has('gemini-2.5-pro')).toBe(false)`.

Add `describe('fetch handler hardening')` with an `afterEach(() => vi.restoreAllMocks())`. Use a full env object: `{ GEMINI_API_KEY: 'test', ALLOWED_ORIGINS: ALLOWED, SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon-test-key' }`.

The mocked fetch MUST satisfy BOTH the verifyAuth call (needs `.status`) and the Gemini call (needs `.status` and `.text()`). Use a single mock that returns a richer object for every call: `vi.spyOn(global, 'fetch').mockResolvedValue({ status: 200, text: async () => '{}' } as unknown as Response)`. (verifyAuth only reads `.status`, so this satisfies it too.) Cast through `unknown` to keep tsc happy.

Construct requests against `worker.fetch(req, env)`. Every test request is a POST with `Authorization: 'Bearer good'` so verifyAuth passes, and `Origin: 'https://tpc-cataloging-app.vercel.app'` so corsHeaders are populated (not strictly required for status assertions, but mirrors real calls).

Tests:
1. 413: build a Request with method POST and headers including `'Content-Length': String(MAX_BODY_BYTES + 1)`. Body can be a small string (Content-Length header is what the handler checks). Expect `res.status === 413`. Assert the Gemini upstream was NOT hit — since verifyAuth runs before the 413 check and DOES call fetch, do not assert call count of 0; instead assert fetch was never called with a generativelanguage.googleapis.com URL (e.g. `expect(fetchMock.mock.calls.some(c => String(c[0]).includes('generativelanguage'))).toBe(false)`).
2. 400: POST with `body: JSON.stringify({ model: 'evil-model', payload: {} })` and `'Content-Type': 'application/json'`. Expect `res.status === 400`.
3. 200: POST with `body: JSON.stringify({ model: 'gemini-2.5-flash', payload: {} })`. Expect `res.status === 200`. (The mock returns 200 for the Gemini call.)

If invoking `worker.fetch` proves too fiddly in the harness, at minimum ship the ALLOWED_MODELS membership test green and leave a `// TODO` note; but attempt the handler tests first using the fetch-mock pattern above.
  </action>
  <verify>
    <automated>cd proxy && npm test</automated>
  </verify>
  <done>`npm test` (vitest --run) is all green: original isAllowedOrigin/getCorsHeaders/verifyAuth blocks plus the new ALLOWED_MODELS and fetch-handler-hardening blocks pass.</done>
</task>

<task type="auto">
  <name>Task 3: Atomic commit on urgent/sec-proxy-hardening</name>
  <files>proxy/src/index.ts, proxy/src/index.test.ts</files>
  <action>
Confirm the current branch is `urgent/sec-proxy-hardening` (`git rev-parse --abbrev-ref HEAD`); if not, stop and report — do not switch. Stage only the two in-scope files and commit with this exact subject and a short body + trailer. No PR, no push.

Subject (exact): `fix(security): allowlist Gemini model + cap proxy body size (SEC-3)`

Body (short): note that the proxy now rejects non-allowlisted models with 400 and oversized request bodies (Content-Length > 25 MB) with 413.

Trailer (exact): `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
  </action>
  <verify>
    <automated>cd /home/spoods/Projects/TPC/tpc-voice-cataloger && git log -1 --pretty=%s | grep -qF "fix(security): allowlist Gemini model + cap proxy body size (SEC-3)" && git log -1 --pretty=%b | grep -qF "Co-Authored-By: Claude Opus 4.7 (1M context)" && git status --porcelain proxy/src/index.ts proxy/src/index.test.ts | grep -qv .</automated>
  </verify>
  <done>A single commit on urgent/sec-proxy-hardening with the exact subject and Co-Authored-By trailer; both proxy files staged into it and the working tree clean for those paths. No push, no PR.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → proxy worker | Untrusted JSON body (`model`, `payload`) and headers (Content-Length, Authorization) crosses here |
| proxy worker → Gemini API | Worker constructs upstream URL with the GEMINI_API_KEY; only allowlisted models may reach it |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-sec3-01 | Tampering | `model` field interpolated into Gemini URL in fetch handler | mitigate | Validate `typeof model === 'string' && ALLOWED_MODELS.has(model)`, else 400, before URL construction (Task 1) |
| T-sec3-02 | Denial of Service | unbounded request body in fetch handler | mitigate | Reject Content-Length > MAX_BODY_BYTES (25 MB) with 413 before parsing (Task 1) |
| T-sec3-03 | Information Disclosure | error responses | accept | Existing handler returns generic error strings; no secrets leaked in 400/413 bodies |
| T-sec3-04 | Elevation of Privilege | bypassing model allowlist via missing Content-Length to smuggle large body | accept | Content-Length is a cheap pre-check per scope; CF Workers enforces platform body limits; stream-measuring is explicitly out of scope |
</threat_model>

<verification>
- `cd proxy && npm test` → all green (original 3 describe blocks + ALLOWED_MODELS + fetch handler hardening).
- `cd proxy && npx tsc --noEmit` → clean.
- `git log -1` on `urgent/sec-proxy-hardening` shows the exact subject + trailer; only the two proxy files in the commit.
- No changes outside `proxy/src/index.ts` and `proxy/src/index.test.ts`.
</verification>

<success_criteria>
- Non-allowlisted `model` → 400 before any Gemini call.
- Content-Length > 25 MB → 413 before body parse.
- Allowlisted `gemini-2.5-flash` request still proxies and returns upstream status.
- All vitest tests pass; existing tests untouched.
- Single atomic commit with the exact required message; no push, no PR.
</success_criteria>

<output>
Create `.planning/quick/260527-i3q-sec-3-gemini-proxy-model-allowlist-reque/SUMMARY.md` when done.
</output>
