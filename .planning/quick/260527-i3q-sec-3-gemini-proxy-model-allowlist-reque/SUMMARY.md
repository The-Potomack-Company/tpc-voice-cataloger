---
phase: quick-sec-3-gemini-proxy-hardening
plan: 01
subsystem: gemini-proxy-worker
tags: [security, cloudflare-worker, gemini, hardening]
requires: []
provides: [ALLOWED_MODELS, MAX_BODY_BYTES, model-allowlist-guard, body-size-cap]
affects: [proxy/src/index.ts, proxy/src/index.test.ts]
status: complete
key-files:
  created: []
  modified:
    - proxy/src/index.ts
    - proxy/src/index.test.ts
decisions:
  - "Content-Length is the only body-size check; stream-measuring out of scope (T-sec3-04 accepted)"
  - "verifyAuth runs before the 413 check, so the 413 test asserts no generativelanguage URL was fetched rather than zero fetch calls"
metrics:
  duration: ~6m
  completed: 2026-05-27
  tasks: 3
  files: 2
  tests: 17 passing
---

# Phase quick Plan 01: SEC-3 Gemini Proxy Model Allowlist + Body-Size Cap

Locked the Gemini proxy worker to a single allowlisted model and a 25 MB Content-Length cap, closing arbitrary-model-interpolation and unbounded-body abuse vectors (SEC-3).

## What Was Built

- `ALLOWED_MODELS = new Set(["gemini-2.5-flash"])` and `MAX_BODY_BYTES = 25 * 1024 * 1024`, exported at module scope.
- **413 guard** (`Payload too large`): after verifyAuth 401, before body parse. Reads `Content-Length`; if `> MAX_BODY_BYTES`, returns 413. Missing/non-numeric falls through.
- **400 guard** (`Unsupported model`): after `await request.json()`, before building `geminiUrl`. Rejects `typeof model !== 'string' || !ALLOWED_MODELS.has(model)`.
- Handler order: corsHeaders → OPTIONS 204 → 405 → verifyAuth 401 → 413 → parse → model allowlist 400 → Gemini proxy.
- Tests: ALLOWED_MODELS membership + fetch-handler hardening (413 oversized, 400 evil-model, 200 flash). Existing blocks unchanged.

## Verification

- `cd proxy && npm test` → **17 passed (17)**.

## Notes

- `npx tsc --noEmit` reports pre-existing type errors in the TEST file only (getCorsHeaders env literals missing SUPABASE_* fields after SEC-2; `global` untyped without `@types/node`). proxy has no build script; locked gate is `npm test`. `index.ts` itself type-checks clean. Follow-up candidate: tidy test env typing.
- `npm install` was needed to run the gate (node_modules absent); `package-lock.json` side-effect reverted, not committed.

## Threat Model Coverage

| Threat | Disposition | Status |
|--------|-------------|--------|
| T-sec3-01 model interpolation | mitigate | Done — 400 before URL |
| T-sec3-02 unbounded body | mitigate | Done — 413 before parse |
| T-sec3-03 error info disclosure | accept | No secrets in 400/413 bodies |
| T-sec3-04 missing Content-Length | accept | CF platform body limits apply |

## Commit

- `2a29f60` — `fix(security): allowlist Gemini model + cap proxy body size (SEC-3)`

## Self-Check: PASSED
