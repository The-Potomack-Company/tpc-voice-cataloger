# Phase 40: ai-proxy-cloud-run-migration - Context

**Gathered:** 2026-06-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Repoint the cataloger's AI calls from the in-repo Cloudflare Worker
(`proxy/` → `tpc-gemini-proxy`) onto the shared **`tpc-ai-proxy`** Cloud Run
service (GCP `gen-lang-client-0662587427`, us-east1), preserving Supabase-JWT
auth, then retire the in-repo Worker. Config-level cutover of
`VITE_GEMINI_PROXY_URL` (request/response contract unchanged: `gemini-2.5-flash`,
25 MB cap) plus net-new proxy-side JWT verify + web-origin allowlist.

**Locked by D-056 / ROADMAP (not re-litigated here):**
- App-side cutover = repoint `VITE_GEMINI_PROXY_URL` (prod →
  `https://tpc-ai-proxy-prod-588770300226.us-east1.run.app/`, dev → `…-dev-…`).
- Request/response contract stays identical — no payload reshape.
- Supabase-JWT enforcement is **preserved** (D-014 pulled forward to this phase).
- Cross-app touch: cataloger + `tpc-ai-proxy` (add web origins to
  `ALLOWED_ORIGINS`, implement bearer-verify on the service).
- Auth plumbing is Claude-owned, **Codex barred** (D-046).

</domain>

<decisions>
## Implementation Decisions

### Execution model
- **D-01:** Drive Phase 40 via **`/tpc-coordinate`** (cross-app), not single-repo
  GSD. The proxy-side JWT verify + `ALLOWED_ORIGINS` work lives in the
  `tpc-ai-proxy` repo, making this a genuine two-repo touch. Ship order:
  proxy-side (JWT + origins) lands and is verified before the cataloger flips
  `VITE_GEMINI_PROXY_URL`.

### Proxy-side JWT verification
- **D-02:** Verify the Supabase JWT by **round-tripping `/auth/v1/user`** on the
  Cloud Run service — port the cataloger Worker's current `verifyAuth` behavior
  ([proxy/src/index.ts:24](proxy/src/index.ts#L24)) onto the proxy. Chosen over
  local JWKS signature verify: simpler, already proven, no dependency on the
  Supabase project having asymmetric (RS256/ES256) signing keys, and the extra
  Supabase hop is negligible against a multi-second Gemini call.
- **Note:** D-014's prose says "JWKS cached in Workers KV" — that mechanism is
  superseded here (host is Cloud Run, no KV; round-trip chosen). D-014's
  *intent* (per-user JWT enforcement on every AI call) is honored.
- This is net-new code on the proxy — 39a stood the service up with
  origin+quota only; JWT verify did not exist there yet.

### Web-origin allowlist
- **D-03:** Port the existing `isAllowedOrigin` logic
  ([proxy/src/index.ts:11](proxy/src/index.ts#L11)) **verbatim** to the Cloud Run
  service: exact-match the configured origins, plus a suffix match for
  `https://tpc-*.vercel.app` preview deploys that rejects bare `vercel.app` and
  non-`tpc-` subdomains. Add the cataloger's prod origin + this preview pattern
  to the service's `ALLOWED_ORIGINS`.

### CF Worker retirement
- **D-04:** Retire `proxy/` **in this phase, as the final step**, gated on the
  Cloud Run path being verified in prod. Keep one rollback commit (rollback =
  repoint `VITE_GEMINI_PROXY_URL` back). Not split to a post-soak follow-up.
- Cleanup in the same retirement step: update `.env.example`, the proxy-URL
  tests (`src/tests/gemini-pipeline.test.ts`, `src/tests/geminiContinuous.test.ts`),
  and drop the `wrangler` / `tpc-gemini-proxy` workspace bits.

### Claude's Discretion
- Exact in-process JWKS/token-cache TTL is moot (round-trip chosen); no caching
  layer required on the proxy beyond what `tpc-ai-proxy` already does.
- Test-file mechanics for repointing the proxy-URL assertions.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Migration decision + auth
- `../_workspace/Decisions/D-056-cataloger-ai-proxy-cloud-run-migration.md` — the
  governing ADR: timing (v1.3, amends D-049), JWT-preserve, mechanics, ship order.
- `../_workspace/Decisions/D-014-tpc-ai-proxy-jwt-auth.md` — JWT-only auth intent
  (note: KV/JWKS mechanism superseded by D-02 round-trip choice).
- `../_workspace/Decisions/D-049-ai-proxy-cloud-run-host.md` — host = Cloud Run.
- `../_workspace/Decisions/D-053-tpc-ai-proxy-deployment-binding.md` — live Cloud
  Run dev+prod services and bindings.
- `../_workspace/Decisions/D-046-claude-owns-schema-auth-codex-barred.md` — auth
  is Claude-owned, Codex barred on this phase.
- `../_workspace/Decisions/D-013-tpc-ai-proxy-rename.md` — one centralized proxy.
- `../_workspace/Decisions/D-052-defer-v3-cutover-mature-apps.md` — policy enabling
  the early (pre-v3.0) move.

### Cross-app coordination
- `../CLAUDE.md` — workspace router; `/tpc-coordinate` workflow surface.
- `../_workspace/Schema/schema.md` — only if any schema touch surfaces (none expected).

### Phase source
- `.planning/ROADMAP.md` — Phase 40 entry (full mechanics + test list + risk).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `proxy/src/index.ts` — `verifyAuth` (`/auth/v1/user` round-trip) and
  `isAllowedOrigin` (`tpc-*.vercel.app` suffix match) are the exact logic to port
  to the Cloud Run service (D-02, D-03).
- `src/services/gemini.ts` + `src/services/geminiContinuous.ts` — sole consumers
  of `VITE_GEMINI_PROXY_URL`; the cataloger-side cutover surface.

### Established Patterns
- Auth contract is "every AI call carries a Supabase Bearer JWT"; the client
  already attaches it — proxy just verifies. No client-side auth change needed.
- Fail-closed on unset proxy URL is an existing, retained guarantee (test:
  `VITE_GEMINI_PROXY_URL`-unset still fails).

### Integration Points
- Cataloger side: `VITE_GEMINI_PROXY_URL` env (prod/dev/preview) in `.env.example`
  + Vercel env vars.
- Proxy side (other repo): `tpc-ai-proxy` `ALLOWED_ORIGINS` + new bearer-verify
  middleware on the Cloud Run service.

</code_context>

<specifics>
## Specific Ideas

- Ship order is load-bearing: proxy-side JWT + origins must be live and verified
  before the cataloger env flip, so the cataloger never hits a proxy that rejects
  its origin or skips auth.
- Rollback is a single env repoint — keep the retirement commit isolated so it can
  be reverted cleanly.

</specifics>

<deferred>
## Deferred Ideas

- Local JWKS signature verification on the proxy (no per-call Supabase hop) —
  considered and rejected for this phase (D-02); revisit only if the
  `/auth/v1/user` round-trip becomes a latency or Supabase-load problem.

None other — discussion stayed within phase scope.

</deferred>

---

*Phase: 40-ai-proxy-cloud-run-migration*
*Context gathered: 2026-06-01*
