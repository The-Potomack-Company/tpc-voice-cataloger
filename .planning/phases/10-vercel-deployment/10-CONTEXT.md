# Phase 10: Vercel Deployment - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy the TPC Catalog PWA to Vercel with a full CI/CD pipeline via GitHub Actions. Auctioneers access the app at a production URL instead of running locally. Includes vercel.json configuration, build optimization, GitHub Actions workflow, and branch protection setup.

</domain>

<decisions>
## Implementation Decisions

### Domain & URL
- Project name: `tpc-catalog` → `tpc-catalog.vercel.app`
- Start with Vercel subdomain; custom domain can be added later
- Open access — no password protection (app has no user accounts, Gemini key is proxy-protected)

### Environment & Secrets
- `VITE_GEMINI_PROXY_URL` set via Vercel project environment variables (injected at build time)
- Cloudflare Worker proxy is already deployed — only need the production URL in Vercel env vars
- No other secrets needed by the PWA (Gemini API key lives in Cloudflare Worker)
- Cloudflare Worker CORS should be restricted to the Vercel production domain only

### Build & PWA Config
- Strip `basicSsl()` plugin for production builds (conditional on Vite mode) — Vercel provides real HTTPS
- Add `vercel.json` with SPA catch-all rewrite so React Router paths work on direct navigation/refresh
- Add basic security headers via vercel.json: X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- Build command: `tsc -b && vite build` (existing, no change needed)

### CI/CD Pipeline (GitHub Actions)
- Full CI pipeline on GitHub Actions triggered on PRs and pushes to main
- Pipeline steps: eslint lint → TypeScript typecheck → vitest unit tests → vite build verification
- Auto-deploy to production from `main` branch via Vercel GitHub integration
- Preview deployments enabled for pull requests (each PR gets a unique preview URL)
- Branch protection rules on `main`: require CI pass before merge

### Claude's Discretion
- PWA workbox caching strategy for production (current config likely sufficient)
- GitHub Actions workflow file structure (single job vs matrix)
- Node.js version and caching strategy in CI
- Exact security header values

</decisions>

<specifics>
## Specific Ideas

- User wants the full CI/CD pipeline as part of this phase, not just deployment config
- Branch protection should enforce CI passing — no broken deploys to production

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `vite.config.ts`: PWA manifest, workbox config, basicSsl plugin (needs conditional for prod)
- `proxy/wrangler.toml`: Cloudflare Worker config — already deployed, needs CORS update
- `.env.example`: Documents the single env var `VITE_GEMINI_PROXY_URL`
- `package.json` scripts: `build` (tsc -b && vite build), `lint` (eslint), `dev`, `preview`

### Established Patterns
- Vite 7 build with TypeScript strict checking (`tsc -b`)
- vite-plugin-pwa with autoUpdate register type and workbox caching
- Vitest for unit testing with jsdom environment

### Integration Points
- Vercel GitHub integration connects to the repo and watches `main` branch
- `VITE_GEMINI_PROXY_URL` is read in `src/services/gemini.ts` via `import.meta.env`
- Cloudflare Worker at `proxy/` needs CORS origin update to allow production domain

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-vercel-deployment*
*Context gathered: 2026-03-16*
