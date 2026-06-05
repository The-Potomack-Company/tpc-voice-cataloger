# Phase 40 — Deferred Items

## 40-03: residual placeholder proxy-URL stubs (cosmetic)

Three test files still use the old `test-proxy.example.com` placeholder stub for
`VITE_GEMINI_PROXY_URL` (out of Plan 03 scope — not in the isolated rollback commit):
- src/tests/gemini-determinism.test.ts:44
- src/tests/gemini-confab-guard.test.ts:42
- src/tests/gemini-no-clobber.test.ts:54

Harmless (assertion-agnostic stub, references no live Worker). Optional follow-up:
repoint to the Cloud Run URL for consistency.
