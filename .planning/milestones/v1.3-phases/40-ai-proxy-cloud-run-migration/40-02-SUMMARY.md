---
phase: 40-ai-proxy-cloud-run-migration
plan: 02
status: complete
verified: prod
---

# 40-02 SUMMARY — Cataloger AI traffic cut over to Cloud Run (verified prod + dev)

## What was built

Config-only cutover of the cataloger's `VITE_GEMINI_PROXY_URL` from the in-repo
Cloudflare Worker to the verified `tpc-ai-proxy` Cloud Run service, then live AI
processing verified end-to-end in prod and dev/preview. Request/response contract
unchanged (`gemini-2.5-flash`, 25 MB cap, `Authorization: Bearer` JWT).

## Commit (cataloger repo, branch `gsd/v1.3-maturation`)

- `6aefacf` — feat(40): repoint VITE_GEMINI_PROXY_URL to Cloud Run prod (40-02)
  - `.env.example`: `http://localhost:8787` → `https://tpc-ai-proxy-prod-588770300226.us-east1.run.app/` (dev URL documented). No `src/services/` diff — contract confirmed compatible (both consumers read the env var + attach Bearer; fail-closed-on-unset retained). 24/24 gemini suites green.

## Live Vercel env flip (project `tpc-cataloging-app` / prj_Lpf5EFlqbKjkjU6MW3dYxCJYLBYR, team_TnQZQS2WRWUxXJs6oBWjvnos)

Driven via Vercel REST API (CLI `whoami` is broken in CLI 54.x; token valid via API).

| Vercel target | `VITE_GEMINI_PROXY_URL` |
|---|---|
| production | `https://tpc-ai-proxy-prod-588770300226.us-east1.run.app/` |
| preview | `https://tpc-ai-proxy-dev-588770300226.us-east1.run.app/` |

Redeployed: prod `tpc-cataloging-app.vercel.app` (dpl_RquUhAfQQWPafNYzcMSBuro6TRTb) + a fresh preview (dpl_6mCtMknXeWMDntFDChuPnbXDB8rs).

## Verification

- **Objective:** prod bundle `index-C9MqmcPT.js` at `https://tpc-cataloging-app.vercel.app`
  contains `tpc-ai-proxy-prod-588770300226.us-east1.run.app` and NO `localhost:8787` / `workers.dev`.
- **Live (user, cutover-verified):** AI record-and-process completes end-to-end against the
  Cloud Run path in prod AND dev/preview (`ai_status` → done, fields populate).
- Proxy `ALLOWED_ORIGINS` corrected to the real prod host `https://tpc-cataloging-app.vercel.app`
  on both Cloud Run services (also covered by the `tpc-*.vercel.app` suffix rule).

## CLOUD RUN PATH VERIFIED IN PROD

The Cloud Run proxy is the live AI path for the cataloger in prod + dev. This is the gate
for Plan 03 (Worker retirement) — **met**.

## Notes / follow-ups (non-blocking)

- The cataloger's prod web origin is `https://tpc-cataloging-app.vercel.app` (NOT `tpc-app.vercel.app` —
  the repo's `.vercel/project.json` links a stale `tpc-app` project under an inaccessible company team;
  the real project lives under the personal team). Consider re-linking `.vercel` or updating it.
- 40-01 proxy CI landmine still open: `../tpc-ai-proxy/.github/workflows/deploy.yml` lacks
  `SUPABASE_URL`/`SUPABASE_ANON_KEY` and uses an extension-only `ALLOWED_ORIGINS` secret — must be
  hardened before the proxy commits are pushed to `main` (fail-closed config would crash-loop prod).
