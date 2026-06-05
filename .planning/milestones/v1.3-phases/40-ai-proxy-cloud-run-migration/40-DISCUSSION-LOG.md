# Phase 40: ai-proxy-cloud-run-migration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-01
**Phase:** 40-ai-proxy-cloud-run-migration
**Areas discussed:** Execution model, JWT verify mechanism, CF Worker retirement sequencing, Vercel-preview origin handling

---

## Execution model

| Option | Description | Selected |
|--------|-------------|----------|
| /tpc-coordinate (cross-app) | Orchestrate cataloger + tpc-ai-proxy together; proxy-side JWT + ALLOWED_ORIGINS is a real cross-repo touch | ✓ |
| Single-repo GSD here | Plan/execute cataloger side in this repo; handle proxy-side changes separately | |

**User's choice:** /tpc-coordinate (cross-app)
**Notes:** Proxy-side work lives in tpc-ai-proxy; ship order requires proxy verified before cataloger env flip.

---

## JWT verify mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Round-trip /auth/v1/user | Port current Worker behavior. Proven, no key-config dependency. One extra Supabase hop per call (negligible vs Gemini call) | ✓ |
| Local JWKS verify | jose + in-process cache per D-014 intent; no per-call hop but more code, requires asymmetric Supabase signing keys | |

**User's choice:** Round-trip /auth/v1/user
**Notes:** D-014's "JWKS in Workers KV" mechanism is superseded (Cloud Run, no KV); its per-user-enforcement intent is honored. JWT verify is net-new on the proxy (39a was origin+quota only).

---

## CF Worker retirement sequencing

| Option | Description | Selected |
|--------|-------------|----------|
| In-phase, gated on prod verify | Retire proxy/ as last step after Cloud Run path verified in prod; one rollback commit | ✓ |
| Split to follow-up after soak | Ship cutover now, retire proxy/ in a later phase after a soak window | |

**User's choice:** In-phase, gated on prod verify
**Notes:** Rollback = repoint VITE_GEMINI_PROXY_URL. Cleanup (.env.example, proxy-URL tests, wrangler bits) folded into the retirement step.

---

## Vercel-preview origin handling

| Option | Description | Selected |
|--------|-------------|----------|
| Port tpc- suffix-match verbatim | Reuse existing isAllowedOrigin (rejects bare/attacker *.vercel.app, only tpc- prefix passes) | ✓ |
| Revisit allowlist logic | Treat origin allowlist as an open design question | |

**User's choice:** Port tpc- suffix-match verbatim
**Notes:** Existing logic already careful about bare/attacker vercel.app subdomains.

---

## Claude's Discretion

- Test-file mechanics for repointing proxy-URL assertions.
- No proxy-side token-cache TTL needed (round-trip chosen).

## Deferred Ideas

- Local JWKS signature verification on the proxy — considered, rejected for this phase; revisit only if round-trip becomes a latency/Supabase-load problem.
