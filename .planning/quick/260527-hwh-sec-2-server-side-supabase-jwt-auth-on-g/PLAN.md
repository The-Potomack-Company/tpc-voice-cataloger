---
phase: quick-sec-2
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - proxy/src/index.ts
  - proxy/src/index.test.ts
  - proxy/wrangler.toml
autonomous: true
requirements: [SEC-2]
must_haves:
  truths:
    - "Non-browser clients (curl) without a valid Supabase JWT get 401, not a Gemini response"
    - "Requests with a valid Supabase JWT (Supabase /auth/v1/user returns 200) are proxied to Gemini"
    - "OPTIONS preflight still returns 204 with no auth required"
    - "Only tpc-prefixed *.vercel.app origins pass the wildcard CORS branch"
    - "All existing proxy tests stay green"
  artifacts:
    - path: "proxy/src/index.ts"
      provides: "verifyAuth() + auth gate in fetch handler + narrowed isAllowedOrigin"
      contains: "export async function verifyAuth"
    - path: "proxy/src/index.test.ts"
      provides: "verifyAuth tests + narrowed vercel.app origin tests"
      contains: "verifyAuth"
    - path: "proxy/wrangler.toml"
      provides: "SUPABASE_URL + SUPABASE_ANON_KEY vars"
      contains: "SUPABASE_URL"
  key_links:
    - from: "proxy/src/index.ts fetch handler"
      to: "verifyAuth"
      via: "await verifyAuth(request, env) gate after method checks, before body parse"
      pattern: "await verifyAuth\\(request, env\\)"
    - from: "verifyAuth"
      to: "Supabase /auth/v1/user"
      via: "fetch with Authorization + apikey headers"
      pattern: "/auth/v1/user"
---

<objective>
Add server-side Supabase JWT auth to the Cloudflare Worker Gemini proxy and narrow the
`*.vercel.app` CORS wildcard so only `tpc-`-prefixed preview hosts pass (SEC-2).

Purpose: CORS is browser-only — curl/non-browser clients currently bypass it entirely and
burn the shared GEMINI_API_KEY. The wildcard also accepts any attacker-controlled
`*.vercel.app` subdomain. This closes both holes.

Output: Modified `proxy/src/index.ts`, `proxy/src/index.test.ts`, `proxy/wrangler.toml`,
all tests green, one atomic commit (no push, no PR).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
SCOPE LOCK: touch ONLY the three files in `files_modified`. Do NOT touch `src/` or any
app code. This is a read-modify of an existing, well-structured worker.

Current branch is already `urgent/sec-proxy-hardening` — do not create a new branch.

<interfaces>
Current `proxy/src/index.ts` exports (extracted):

```typescript
interface Env {
  GEMINI_API_KEY: string;
  ALLOWED_ORIGINS: string;
}
export function isAllowedOrigin(origin: string, allowedOrigins: string): boolean
export function getCorsHeaders(request: Request, env: Env): Record<string, string>
export default { async fetch(request: Request, env: Env): Promise<Response> }
```

Current fetch handler order: build `corsHeaders` → OPTIONS (204) → non-POST (405) →
`try { parse {model, payload} → fetch Gemini → return }` `catch { 500 }`.

Current `isAllowedOrigin` `*.vercel.app` branch (lines 11-14): accepts any
`https://<host>.vercel.app` where host !== `vercel.app`.

Test file uses vitest `describe/it/expect`, imports from `./index`, constant
`ALLOWED = 'https://tpc-cataloging-app.vercel.app,https://localhost:5173'`. The
`getCorsHeaders` suite builds an `env` literal `{ GEMINI_API_KEY: 'test', ALLOWED_ORIGINS: ALLOWED }`.

The existing preview-deploy test (line 16) asserts
`https://my-branch-tpc-cataloging-app.vercel.app` is allowed — that host does NOT
start with `tpc-`, so it WILL break under the new rule and must be updated.

`package.json` scripts: `"test": "vitest --run"`. No `build` script. Run `npm test` from `proxy/`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add verifyAuth + auth gate + narrowed CORS to index.ts</name>
  <files>proxy/src/index.ts</files>
  <behavior>
    verifyAuth(request, env):
    - No Authorization header, or header not matching "Bearer <token>" → return false WITHOUT calling fetch.
    - Valid "Bearer <token>" → fetch `${env.SUPABASE_URL}/auth/v1/user` with headers
      { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY }; return true iff status === 200, else false.
    - fetch throws → return false (try/catch).
    isAllowedOrigin *.vercel.app branch: host (after stripping "https://") must start with "tpc-".
    - https://tpc-app-five-abc.vercel.app → allowed
    - https://evil-app.vercel.app → rejected; https://evil.com → rejected; bare vercel.app → rejected.
    fetch handler: OPTIONS (204, no auth) → non-POST (405) → 401 JSON {error:"Unauthorized"} when verifyAuth false → existing Gemini proxy.
  </behavior>
  <action>
    Extend `Env` with `SUPABASE_URL: string` and `SUPABASE_ANON_KEY: string` (per SEC-2 req 1).

    Add exported `export async function verifyAuth(request: Request, env: Env): Promise<boolean>`:
    read `Authorization` header; if absent or it does not match the `Bearer <token>` shape, return
    false immediately (do NOT call fetch). Otherwise extract the token and call
    `${env.SUPABASE_URL}/auth/v1/user` with headers `Authorization: Bearer <token>` and
    `apikey: env.SUPABASE_ANON_KEY`; return `response.status === 200`. Wrap the fetch in try/catch and
    return false on throw (per req 2).

    In `isAllowedOrigin`, keep the exact-match list and localhost behavior unchanged. In the
    `*.vercel.app` branch, after stripping the `https://` prefix, additionally require the host to
    start with `tpc-` before returning true. Keep the bare-`vercel.app` rejection (per req 4).

    In the `fetch` handler, insert the auth gate AFTER the non-POST 405 check and BEFORE the body
    parse: `if (!(await verifyAuth(request, env)))` return a 401 with body
    `JSON.stringify({ error: 'Unauthorized' })` and headers `{ ...corsHeaders, 'Content-Type': 'application/json' }`.
    Leave OPTIONS (204, no auth) and the existing Gemini proxy logic otherwise intact (per req 3).
  </action>
  <verify>
    <automated>cd proxy && grep -q "export async function verifyAuth" src/index.ts && grep -q "/auth/v1/user" src/index.ts && grep -q "startsWith('tpc-')" src/index.ts && grep -q "Unauthorized" src/index.ts</automated>
  </verify>
  <done>verifyAuth exported and called in the fetch handler after the 405 check; Env has both SUPABASE_ vars; *.vercel.app branch requires tpc- prefix.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Update + extend index.test.ts</name>
  <files>proxy/src/index.test.ts</files>
  <behavior>
    - Existing preview-deploy test origin updated to a tpc-prefixed host (e.g. https://tpc-app-five-abc123.vercel.app) → true.
    - New: https://evil-app.vercel.app → false.
    - verifyAuth with mocked global fetch returning {status:200} → true.
    - verifyAuth with mocked global fetch returning {status:401} → false.
    - verifyAuth with no Authorization header → false AND fetch never called (assert mock not called).
  </behavior>
  <action>
    Import `verifyAuth` alongside the existing `isAllowedOrigin, getCorsHeaders` import.

    Update the existing "allows *.vercel.app preview deploys" test: change its origin from
    `https://my-branch-tpc-cataloging-app.vercel.app` to a `tpc-`-prefixed host such as
    `https://tpc-app-five-abc123.vercel.app` (still expects true). Add a new test asserting
    `isAllowedOrigin('https://evil-app.vercel.app', ALLOWED)` is false (per req 6).

    Add a `describe('verifyAuth', ...)` block. Use vitest `vi` to mock `global.fetch`
    (import `vi` from 'vitest'; restore in afterEach with `vi.restoreAllMocks()`). Build a
    minimal `env` literal containing `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Tests:
    (a) fetch mocked to resolve `{ status: 200 }`, request with `Authorization: 'Bearer good'` → expect true;
    (b) fetch mocked to resolve `{ status: 401 }`, request with `Authorization: 'Bearer bad'` → expect false;
    (c) request with NO Authorization header → expect false and assert the fetch mock was not called.
    Use `new Request('https://proxy.example.com', { headers: {...} })` to build requests, matching
    the existing getCorsHeaders test style.
  </action>
  <verify>
    <automated>cd proxy && npm test</automated>
  </verify>
  <done>`npm test` from proxy/ passes with all original tests plus the new evil-app rejection and three verifyAuth tests green.</done>
</task>

<task type="auto">
  <name>Task 3: Add Supabase vars to wrangler.toml + commit</name>
  <files>proxy/wrangler.toml</files>
  <action>
    In `proxy/wrangler.toml` under `[vars]`, add (per req 5; publishable key is public and safe in vars):
    `SUPABASE_URL = "https://wgrknodfxdjtddsirldw.supabase.co"` and
    `SUPABASE_ANON_KEY = "sb_publishable_ebaLYzSqkTcVUONFxwR9kw_22-FfKLM"`.
    Leave the existing ALLOWED_ORIGINS line and the GEMINI_API_KEY secret comment unchanged.

    Then run the proxy test suite once more to confirm green, and create a single atomic commit on
    the current `urgent/sec-proxy-hardening` branch staging ONLY the three in-scope files.
    Commit message exactly:
    `fix(security): require Supabase JWT auth on Gemini proxy worker (SEC-2)`
    followed by a blank line, a short body describing the two fixes (server-side JWT verification
    + narrowed *.vercel.app CORS to tpc- prefix), a blank line, and the trailer
    `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
    Do NOT push. Do NOT open a PR.
  </action>
  <verify>
    <automated>cd proxy && grep -q "wgrknodfxdjtddsirldw.supabase.co" wrangler.toml && npm test && git -C .. log -1 --pretty=%s | grep -q "fix(security): require Supabase JWT auth on Gemini proxy worker (SEC-2)"</automated>
  </verify>
  <done>wrangler.toml has both SUPABASE_ vars; tests green; one commit exists on urgent/sec-proxy-hardening with the exact subject and Co-Authored-By trailer; nothing pushed, no PR.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| any client → Worker | Untrusted HTTP requests (browser and non-browser/curl) cross here |
| Worker → Supabase Auth | Token validation call |
| Worker → Gemini | Authenticated proxy egress with shared API key |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-sec2-01 | Spoofing/Elevation | fetch handler | mitigate | verifyAuth gate validates a real Supabase JWT via /auth/v1/user before any Gemini proxy; non-browser clients without a valid token get 401 |
| T-sec2-02 | Spoofing | isAllowedOrigin *.vercel.app branch | mitigate | require `tpc-` host prefix so attacker-controlled *.vercel.app subdomains fail CORS |
| T-sec2-03 | Information disclosure | SUPABASE_ANON_KEY in wrangler.toml [vars] | accept | publishable anon key is designed to be public; RLS on Supabase is the real guard (no secret exposed) |
| T-sec2-04 | DoS | unauthenticated 401 path | accept | low-cost reject before Gemini call; no key spend on rejected requests |
</threat_model>

<verification>
From `proxy/`: `npm test` (vitest --run) — all tests green, including 3 new verifyAuth tests
and the evil-app.vercel.app rejection. No `build` script exists, so no build step.
Confirm `git log -1` on `urgent/sec-proxy-hardening` shows the exact commit subject and the
Co-Authored-By trailer, and `git status` shows a clean tree with nothing pushed.
</verification>

<success_criteria>
- verifyAuth exported, validates Supabase JWT via /auth/v1/user, returns false on missing/malformed header (no fetch) and on throw.
- fetch handler order: OPTIONS (204, no auth) → 405 → 401 Unauthorized when unauthenticated → Gemini proxy.
- isAllowedOrigin only passes tpc-prefixed *.vercel.app; rejects evil-app.vercel.app, evil.com, bare vercel.app.
- wrangler.toml [vars] has SUPABASE_URL and SUPABASE_ANON_KEY.
- All proxy tests green; one atomic commit on urgent/sec-proxy-hardening; no push, no PR.
- Only the three in-scope files changed.
</success_criteria>

<output>
Create `.planning/quick/260527-hwh-sec-2-server-side-supabase-jwt-auth-on-g/SUMMARY.md` when done.
</output>
