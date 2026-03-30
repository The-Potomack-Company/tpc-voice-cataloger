# Phase 17: Deployment & CI - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

App is deployed to production on Vercel with automated quality gates (GitHub Actions CI) and security hardening (CORS lockdown on the Cloudflare Worker, branch protection on main). This phase does NOT add new features, modify app logic, or change the Cloudflare Worker's functionality — only its CORS policy.

</domain>

<decisions>
## Implementation Decisions

### Vercel deployment
- **Environment variables via Vercel dashboard only** — set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PROXY_URL` in Vercel project settings. No env vars or secrets in the repo
- **Preview deploys enabled** — every PR gets a unique preview URL (Vercel default behavior). Production deploys on push to main
- **Default Vercel URL** — use auto-generated `*.vercel.app` domain. No custom domain needed for this internal team tool
- **Conditionally exclude basicSsl plugin** — `@vitejs/plugin-basic-ssl` only loads in dev mode (`process.env.NODE_ENV !== 'production'` or Vite `mode` check). Vercel provides HTTPS natively
- No `vercel.json` needed unless framework auto-detection requires overrides (Vite is well-supported)

### CI pipeline (GitHub Actions)
- **Four checks on every PR and push to main:**
  1. `eslint .` — lint
  2. `tsc -b` — typecheck
  3. `npx vitest --run` — test (270+ tests)
  4. `vite build` — build verification
- **Trigger:** PRs targeting main + pushes to main
- **Scope:** Main app only. The Cloudflare Worker (proxy/) deploys independently via `wrangler`
- **Node version:** 22 LTS (current stable LTS, reliable in CI runners)
- **Package manager:** npm (matches existing setup)
- A `test` script should be added to `package.json` (`"test": "vitest --run"`) for CI consistency
- Note: 4 tests currently failing — must be fixed before CI enforcement blocks merges

### CORS lockdown
- **Wrangler environment variable** — store `ALLOWED_ORIGINS` as a Wrangler env var (not secret, since origin values aren't sensitive). Worker reads it at runtime
- **Allowed origins:**
  - Production Vercel URL (e.g., `https://tpc-app.vercel.app`)
  - Preview deploy pattern (`*.vercel.app` suffix match)
  - `https://localhost:5173` for local development
- **Implementation:** Worker checks the `Origin` request header against the allowed list. If it matches, reflect that origin in `Access-Control-Allow-Origin`. If not, return a CORS error (no `*` wildcard)
- Replaces the current `"Access-Control-Allow-Origin": "*"` in `proxy/src/index.ts`

### Branch protection
- **No review required** — CI checks are the quality gate (small team, often solo developer)
- **PRs only** — no direct pushes to main. All changes go through a PR that must pass CI
- **Configured via GitHub CLI (`gh`)** — plan includes the exact `gh api` or `gh ruleset` commands to set up protection rules, making it reproducible
- Required status checks: the CI workflow checks (lint, typecheck, test, build)

### Claude's Discretion
- Exact GitHub Actions workflow YAML structure (single job vs matrix, caching strategy)
- Whether to use `npm ci` or `npm install` in CI
- Vercel framework preset auto-detection vs explicit config
- Exact CORS origin matching logic (regex vs array includes)
- How to handle the 4 failing tests (fix in this phase or document as prerequisite)
- Whether to add a `vercel.json` for SPA routing fallback or rely on framework detection

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — DEPLOY-01 (Vercel deploy with auto-deploy from main), DEPLOY-02 (CI pipeline: lint, typecheck, test, build), DEPLOY-03 (CORS restricted to production domain), DEPLOY-04 (branch protection requiring CI checks)

### Phase scope & success criteria
- `.planning/ROADMAP.md` — Phase 17 goal and 4 success criteria

### Cloudflare Worker (CORS target)
- `proxy/src/index.ts` — Current Worker code with `Access-Control-Allow-Origin: "*"` (line 6) that must be restricted
- `proxy/wrangler.toml` — Worker config (name: `tpc-gemini-proxy`, env vars via `wrangler secret`)

### Build & tooling config
- `package.json` — Build scripts (`build`, `lint`), dependencies, devDependencies
- `vite.config.ts` — Vite 7 config with PWA plugin, basicSsl plugin, Vitest config
- `eslint.config.js` — ESLint 9 flat config with TypeScript + React plugins
- `tsconfig.json` — TypeScript project references (tsconfig.app.json, tsconfig.node.json)

### Service worker context
- `vite.config.ts` lines 47-57 — Workbox config with `navigateFallbackDenylist` and `runtimeCaching` for Supabase exclusion (Phase 12 decision)

### Prior phase decisions
- `.planning/phases/11-supabase-foundation/11-CONTEXT.md` — Supabase env var names and client setup
- `.planning/phases/12-authentication/12-CONTEXT.md` — Service worker Supabase exclusion pattern

No external ADRs or design docs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `eslint.config.js`: Fully configured ESLint 9 flat config — CI just runs `eslint .`
- `vite.config.ts`: Build + test config in one file — `tsc -b && vite build` for build, Vitest for tests
- `proxy/wrangler.toml`: Worker deployment config — already supports env vars via `wrangler secret put`

### Established Patterns
- **Build command**: `tsc -b && vite build` — typecheck is already part of the build script, but CI should run them separately for clearer failure messages
- **Test setup**: Vitest with jsdom environment, `src/tests/setup.ts` setup file, `fake-indexeddb` for Dexie mocking
- **Env var pattern**: `VITE_*` prefix for client-side env vars (Vite convention), accessed via `import.meta.env`

### Integration Points
- `vite.config.ts` — basicSsl plugin needs conditional loading for production builds
- `package.json` — needs `test` script added (`vitest --run`)
- `proxy/src/index.ts` — CORS headers need dynamic origin checking
- GitHub repo settings — branch protection rules via `gh` CLI

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 17-deployment-ci*
*Context gathered: 2026-03-18*
