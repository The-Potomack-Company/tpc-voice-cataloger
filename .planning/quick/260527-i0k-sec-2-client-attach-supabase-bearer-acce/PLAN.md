---
phase: quick-sec-2-client
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/authGuard.ts
  - src/services/gemini.ts
  - src/services/geminiContinuous.ts
  - src/tests/gemini-pipeline.test.ts
  - src/tests/geminiContinuous.test.ts
autonomous: true
requirements: [SEC-2]

must_haves:
  truths:
    - "Both Gemini proxy fetch call sites send Authorization: Bearer <supabase access token>"
    - "ensureFreshSession returns the fresh access token string"
    - "Existing tests stay green with the new return type"
  artifacts:
    - path: "src/lib/authGuard.ts"
      provides: "ensureFreshSession returning Promise<string>"
      contains: "access_token"
    - path: "src/services/gemini.ts"
      provides: "Authorization header on proxy fetch"
      contains: "Bearer"
    - path: "src/services/geminiContinuous.ts"
      provides: "Authorization header on proxy fetch, token threaded into sendChunkToGemini"
      contains: "Bearer"
  key_links:
    - from: "src/services/gemini.ts"
      to: "ensureFreshSession"
      via: "const accessToken = await ensureFreshSession()"
      pattern: "accessToken = await ensureFreshSession"
    - from: "src/services/geminiContinuous.ts"
      to: "sendChunkToGemini"
      via: "accessToken passed as parameter from processContinuousChunk scope to the fetch in sendChunkToGemini"
      pattern: "Bearer \\$\\{accessToken\\}"
---

<objective>
The Gemini proxy worker now REQUIRES a Supabase JWT (`Authorization: Bearer <token>`). Update the client so both proxy call sites send it; without it, prod AI processing 401s. (SEC-2 client half.)

Purpose: Restore working AI processing against the hardened proxy.
Output: ensureFreshSession returns the access token; both proxy fetches carry the Bearer header; tests green; single atomic commit.

Do NOT touch `proxy/`.
</objective>

<context>
@.planning/quick/260527-i0k-sec-2-client-attach-supabase-bearer-acce/PLAN.md

<current-state>
- `src/lib/authGuard.ts` exports `async function ensureFreshSession(): Promise<void>` — getSession(), throws "No active session" if none, refreshSession() if `expires_at` is missing or within 60s. Only 2 callers: gemini.ts:134 and geminiContinuous.ts:273.
- `src/services/gemini.ts`: `await ensureFreshSession()` at line 134 (top of try). Proxy fetch at ~line 224 inside the SAME function (`processAudioWithAi`), headers currently `{ "Content-Type": "application/json" }`. Same-scope — straightforward.
- `src/services/geminiContinuous.ts`: `await ensureFreshSession()` at line 273 inside `processContinuousChunk`. The proxy fetch is at line 171 inside a SEPARATE function `sendChunkToGemini` (signature at line 124), which `processContinuousChunk` calls at line 318. THE TOKEN MUST BE THREADED across this boundary — see Task 3.
</current-state>

<test-mocks>
Both test files mock `../lib/supabase` directly (NOT authGuard), so the real ensureFreshSession runs against mocked auth:
- `src/tests/gemini-pipeline.test.ts`: session mock at lines 94-97 — `getSession` returns `{ data: { session: { expires_at: <now+3600> } } }` (NO access_token), `refreshSession` returns `{ data: { session: {} }, error: null }`.
- `src/tests/geminiContinuous.test.ts`: session mock at lines 145-148 — same shape, no access_token.
Both will FAIL after the signature change unless `access_token` is added to the mocked session objects.
</test-mocks>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: ensureFreshSession returns the fresh access token</name>
  <files>src/lib/authGuard.ts</files>
  <behavior>
    - Returns `session.access_token` (string) for a valid, non-expiring session.
    - When within the 60s refresh window (or expires_at missing), refreshes, then re-reads the session and returns the NEW access_token (refreshSession's returned session is not relied upon; re-call getSession after refresh).
    - Throws "No active session — user must sign in" when getSession yields no session (unchanged).
    - Propagates the refreshSession error (unchanged).
    - Throws a clear error if, after the above, no access_token is available.
  </behavior>
  <action>Change the return type to `Promise<string>`. Keep the existing no-session throw and the refresh-error throw. After the refresh branch, re-read the session via `supabase.auth.getSession()` (refreshSession returns the new session, but re-reading getSession is the reliable source per task spec). Read `access_token` from the current session; if absent/empty, throw a clear error (e.g. "Session has no access token"). Return the token. Do not add comments unless a WHY is non-obvious.</action>
  <verify>
    <automated>npm run typecheck</automated>
  </verify>
  <done>ensureFreshSession signature is `Promise<string>`, returns access_token, throws when token unavailable, existing throws preserved.</done>
</task>

<task type="auto">
  <name>Task 2: Attach Bearer header in gemini.ts (same-scope)</name>
  <files>src/services/gemini.ts</files>
  <action>At line 134 change `await ensureFreshSession();` to `const accessToken = await ensureFreshSession();`. At the proxy fetch (~line 224) add `Authorization: \`Bearer ${accessToken}\`` to the headers object alongside `"Content-Type": "application/json"`. No other changes.</action>
  <verify>
    <automated>npm run typecheck</automated>
  </verify>
  <done>accessToken captured at line ~134; proxy fetch headers include the Authorization Bearer header.</done>
</task>

<task type="auto">
  <name>Task 3: Thread token through geminiContinuous.ts (CARE: cross-function)</name>
  <files>src/services/geminiContinuous.ts</files>
  <action>The token is produced at line 273 (`ensureFreshSession()` in `processContinuousChunk`) but consumed at the fetch in `sendChunkToGemini` (line 171), a different function. Thread it:
1. At line 273 capture `const accessToken = await ensureFreshSession();`.
2. Add an `accessToken: string` parameter to `sendChunkToGemini` (signature at line 124).
3. In `sendChunkToGemini`, add `Authorization: \`Bearer ${accessToken}\`` to the fetch headers (line ~173) alongside Content-Type.
4. At the call site (line ~318) pass `accessToken` through.
Note the `accessToken` captured at line 273 is in the outer scope of `processContinuousChunk`; `sendChunkToGemini` is called inside the `queued` promise chain (line 285+) — the outer `const` is in closure scope and reachable there, so pass it directly. Do not call ensureFreshSession a second time.</action>
  <verify>
    <automated>npm run typecheck</automated>
  </verify>
  <done>sendChunkToGemini takes accessToken and sets the Authorization header; processContinuousChunk captures the token at line ~273 and passes it through; no duplicate ensureFreshSession call.</done>
</task>

<task type="auto">
  <name>Task 4: Update test session mocks and run the suite</name>
  <files>src/tests/gemini-pipeline.test.ts, src/tests/geminiContinuous.test.ts</files>
  <action>Add `access_token: "test-token"` to the mocked session objects so the real ensureFreshSession can return a token:
- gemini-pipeline.test.ts lines 94-97: add access_token to the getSession session AND make refreshSession's session carry it (or rely on getSession re-read returning the token — match whatever Task 1 reads; since Task 1 re-reads getSession after refresh, the getSession mock's session needs access_token).
- geminiContinuous.test.ts lines 145-148: same.
If any test asserts proxy fetch headers, additionally assert the Authorization header is present (`Bearer test-token`). Do NOT weaken any existing assertion beyond what the signature change requires. If no header assertions exist, do not add new ones — just keep the suite green.</action>
  <verify>
    <automated>npm run typecheck && npm run lint && npx vitest run src/tests/gemini-pipeline.test.ts src/tests/geminiContinuous.test.ts</automated>
  </verify>
  <done>All of typecheck, lint, and the two test files pass green. (Fall back to full `npm test` if related-scoping the two files is awkward.)</done>
</task>

<task type="auto">
  <name>Task 5: Single atomic commit</name>
  <files>(git)</files>
  <action>On the current branch `urgent/sec-proxy-hardening`, stage the five in-scope files only and commit. Message exactly:
```
fix(security): send Supabase Bearer token to Gemini proxy (SEC-2 client)

Proxy now requires Authorization: Bearer <supabase jwt>. ensureFreshSession
returns the fresh access token; both proxy call sites send it. Without it
prod AI processing 401s.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```
No PR, no push. Verify branch is `urgent/sec-proxy-hardening` before committing (`git branch --show-current`).</action>
  <verify>
    <automated>git log -1 --pretty=%s | grep -q "fix(security): send Supabase Bearer token to Gemini proxy (SEC-2 client)"</automated>
  </verify>
  <done>One commit on urgent/sec-proxy-hardening with the exact subject, body, and Co-Authored-By trailer; no push, no PR.</done>
</task>

</tasks>

<verification>
From repo root:
`npm run typecheck && npm run lint && npx vitest run src/tests/gemini-pipeline.test.ts src/tests/geminiContinuous.test.ts`
All green. proxy/ untouched (`git status` shows no proxy/ changes).
</verification>

<success_criteria>
- ensureFreshSession returns Promise<string> (access token), with existing throws intact plus a clear throw when no token.
- gemini.ts and geminiContinuous.ts proxy fetches both send `Authorization: Bearer <token>`.
- Test session mocks carry access_token; suite green; no assertions weakened.
- Single atomic commit on urgent/sec-proxy-hardening with the exact message; no PR/push.
</success_criteria>

<output>
No SUMMARY required for quick mode. Report final verification output and commit hash.
</output>
