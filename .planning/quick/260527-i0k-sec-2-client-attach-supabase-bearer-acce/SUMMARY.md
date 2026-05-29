---
phase: quick-sec-2-client
plan: 01
subsystem: gemini-client-services
tags: [security, auth, supabase, gemini-proxy]
requires: ["quick-sec-2 worker auth gate"]
provides:
  - "Client sends Supabase Bearer access_token to the Gemini proxy"
affects:
  - src/lib/authGuard.ts
  - src/services/gemini.ts
  - src/services/geminiContinuous.ts
status: complete
key-files:
  created: []
  modified:
    - src/lib/authGuard.ts
    - src/services/gemini.ts
    - src/services/geminiContinuous.ts
    - src/tests/gemini-pipeline.test.ts
    - src/tests/geminiContinuous.test.ts
metrics:
  duration: ~5m
  completed: 2026-05-27
---

# Phase quick-sec-2-client Plan 01: Send Supabase Bearer Token to Gemini Proxy

The proxy worker now requires a Supabase JWT (SEC-2 worker). This change makes both client call sites send `Authorization: Bearer <access_token>` so prod AI processing doesn't 401 on deploy.

## What Was Built

- `src/lib/authGuard.ts` — `ensureFreshSession()` now returns `Promise<string>`: re-reads `getSession()` after any refresh and returns `access_token`, throwing `"Session has no access token"` if absent. Existing no-session and refresh-error throws preserved.
- `src/services/gemini.ts` — captures `const accessToken = await ensureFreshSession()`; proxy fetch sends `Authorization: Bearer ${accessToken}`.
- `src/services/geminiContinuous.ts` — token captured at `processContinuousChunk`, threaded as a new `accessToken: string` param into `sendChunkToGemini`; fetch sends the Bearer header. No second `ensureFreshSession` call.
- Both test files — added `access_token: "test-token"` to mocked `getSession` session objects.

## Verification

- `tsc --noEmit` exit 0 (repo has no `typecheck` script; typecheck is `tsc -b` inside `build`).
- `npm run lint` exit 0.
- `vitest run` gemini-pipeline + geminiContinuous → **2 files / 23 tests passed**.

## Commit

- `3dde42b` — `fix(security): send Supabase Bearer token to Gemini proxy (SEC-2 client)`

## Self-Check: PASSED
