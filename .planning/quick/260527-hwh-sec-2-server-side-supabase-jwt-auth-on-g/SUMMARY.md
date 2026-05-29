---
phase: quick-sec-2
plan: 01
subsystem: cloudflare-worker-proxy
tags: [security, auth, cors, supabase, gemini-proxy]
requires: []
provides:
  - "Server-side Supabase JWT auth gate on the Gemini proxy worker"
  - "Narrowed *.vercel.app CORS to tpc- prefixed preview hosts"
affects:
  - proxy/src/index.ts
status: complete
tech-stack:
  added: []
  patterns:
    - "verifyAuth() validates a Supabase JWT via /auth/v1/user before proxy egress"
key-files:
  created: []
  modified:
    - proxy/src/index.ts
    - proxy/src/index.test.ts
    - proxy/wrangler.toml
decisions:
  - "SUPABASE_ANON_KEY lives in wrangler.toml [vars] — publishable key is public by design (T-sec2-03 accept)"
metrics:
  duration: ~6m
  completed: 2026-05-27
---

# Phase quick-sec-2 Plan 01: Server-side Supabase JWT Auth on Gemini Proxy Summary

Added a server-side `verifyAuth()` gate to the Cloudflare Worker Gemini proxy that validates a Supabase JWT via `/auth/v1/user` before any Gemini call, and narrowed the `*.vercel.app` CORS wildcard so only `tpc-`-prefixed preview hosts pass (SEC-2).

## What Was Built

- **`verifyAuth(request, env)`** (`proxy/src/index.ts`): reads the `Authorization` header, returns `false` immediately (no fetch) if absent or not matching `Bearer <token>`; otherwise calls `${SUPABASE_URL}/auth/v1/user` with `Authorization: Bearer <token>` + `apikey` headers and returns `true` iff status `200`. Wrapped in try/catch — returns `false` on throw.
- **Auth gate in `fetch` handler**: inserted after the non-POST 405 check, before body parse. Returns `401 {"error":"Unauthorized"}` (with CORS headers) when `verifyAuth` is false. OPTIONS preflight (204) and the existing Gemini proxy logic untouched.
- **Narrowed `isAllowedOrigin`**: the `*.vercel.app` branch now additionally requires the host (after stripping `https://`) to `startsWith('tpc-')`. Bare `vercel.app` still rejected.
- **`Env` extended** with `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
- **`wrangler.toml [vars]`**: added `SUPABASE_URL` and `SUPABASE_ANON_KEY` (publishable key, public by design).
- **Tests** (`proxy/src/index.test.ts`): renamed the preview-deploy test to a `tpc-`-prefixed host, added an `evil-app.vercel.app` rejection test, and a `verifyAuth` describe block with 3 tests (200→true, 401→false, missing header→false + fetch never called).

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Add verifyAuth + auth gate + narrowed CORS | 26c8b70 | proxy/src/index.ts |
| 2 | Update + extend index.test.ts | 26c8b70 | proxy/src/index.test.ts |
| 3 | Add Supabase vars to wrangler.toml + commit | 26c8b70 | proxy/wrangler.toml |

All three tasks landed in a single atomic commit per task instructions (one commit on `urgent/sec-proxy-hardening`, no push, no PR).

## Verification

`npm test` (vitest --run) from `proxy/`: **12 tests passed**. All green.

## Self-Check: PASSED

- proxy/src/index.ts — verifyAuth exported, gate wired
- proxy/src/index.test.ts — 12 tests green
- proxy/wrangler.toml — both SUPABASE_ vars
- Commit 26c8b70 on urgent/sec-proxy-hardening
