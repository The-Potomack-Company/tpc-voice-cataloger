---
phase: 40-ai-proxy-cloud-run-migration
plan: 01
status: complete
verified: prod
---

# 40-01 SUMMARY — Proxy-side Supabase-JWT verify + web-origin CORS (deployed + live-verified)

## What was built

Net-new Supabase-JWT bearer verification (D-02) and additive web-origin CORS (D-03)
landed in the shared `tpc-ai-proxy` Cloud Run service (sibling repo `../tpc-ai-proxy`,
branch `main`), then both Cloud Run services were redeployed from source and live-verified
in dev + prod. Extension path unchanged (additive).

## Commits (sibling repo `../tpc-ai-proxy`, NOT pushed)

- `18ef932` — feat: widen proxy origin allowlist to tpc-*.vercel.app suffix (40-01)
- `f52adc4` — feat: add Supabase-JWT verify + CORS to proxy (40-01)

## Files (in `../tpc-ai-proxy`)

- created: `src/auth.js` (`verifyAuth` — Bearer → `/auth/v1/user` round-trip, fail-closed), `test/auth.test.js`
- modified: `src/origin.js` (tpc-*.vercel.app suffix rule), `src/config.js` (SUPABASE_URL/SUPABASE_ANON_KEY, throw-on-missing), `src/index.js` (OPTIONS→204, verifyAuth gate, CORS spread), `test/origin.test.js`, `test/server.test.js`

Proxy suite: 41 tests, 0 fail (origin 12, auth 6, server 16, rateLimit existing).

## Deployed Cloud Run state (project gen-lang-client-0662587427 / 588770300226, us-east1)

| Service | Revision | ALLOWED_ORIGINS | SUPABASE_URL | SUPABASE_ANON_KEY | GEMINI_API_KEY |
|---|---|---|---|---|---|
| tpc-ai-proxy-prod | `tpc-ai-proxy-prod-00011-672` | `chrome-extension://plielbnfpgcjjohnehcnagmlkmhjcpdn,https://tpc-app.vercel.app` | `https://wgrknodfxdjtddsirldw.supabase.co` | set (legacy anon JWT) | secret `gemini-api-key:latest` (preserved) |
| tpc-ai-proxy-dev | `tpc-ai-proxy-dev-00004-tpk` | `chrome-extension://nhpailgcmoimhpgcaaknmglchlkplbig,https://tpc-app.vercel.app` | same | set | secret (preserved) |

Deployed via `gcloud run deploy --source ../tpc-ai-proxy` (builds the Dockerfile via Cloud Build).
The cataloger prod web origin is `https://tpc-app.vercel.app` (confirmed by user); it is added
explicitly AND also matches the `tpc-*.vercel.app` suffix rule. Vercel preview hosts pass via
the suffix rule.

## Live verification (both dev + prod URLs)

- OPTIONS preflight from `https://tpc-app.vercel.app` → **204** + `Access-Control-Allow-Origin` echo + `Vary: Origin`
- POST no Authorization → **401** `{"error":"Unauthorized"}` (fail-closed)
- POST `Authorization: Bearer bogus` → **401** (round-trip non-200, fail-closed)
- POST `Origin: https://evil.vercel.app` → **401** `{"error":"Origin not allowed"}`, NO CORS header
- OPTIONS preview suffix `https://tpc-foo.vercel.app` → **204** + ACAO (suffix rule)
- OPTIONS extension origin → **204** + ACAO (extension path intact)

## Gate for Plan 02

Cloud Run proxy is **VERIFIED IN PROD** — JWT enforced (fail-closed) + cataloger origin
served. Plan 02 (cataloger `VITE_GEMINI_PROXY_URL` flip) is now unblocked.

## ⚠ Known follow-up — CI deploy landmine (NOT yet fixed)

`../tpc-ai-proxy/.github/workflows/deploy.yml` (push-to-main → Cloud Run) does **not** set
`SUPABASE_URL`/`SUPABASE_ANON_KEY` and sets `ALLOWED_ORIGINS` from the GitHub secret
`ALLOWED_ORIGINS` (currently extension-only). Because the new `config.js` throws on missing
`SUPABASE_URL` (fail-closed), the **next push to proxy `main` would crash-loop prod** and
would drop the cataloger origin. The manual `--source` deploys above are correct on the live
services, but the CI pipeline must be hardened BEFORE the proxy commits are pushed:
1. Add `SUPABASE_URL` + `SUPABASE_ANON_KEY` to the workflow env (anon key via a GitHub secret).
2. Update the `ALLOWED_ORIGINS` GitHub secret to `chrome-extension://...,https://tpc-app.vercel.app`.
3. (Optional) the workflow only deploys `-prod`; `-dev` is deployed manually.

The proxy commits are intentionally unpushed for now, so the landmine is not yet live.
