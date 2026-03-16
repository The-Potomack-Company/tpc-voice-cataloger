# Phase 10: Vercel Deployment - Research

**Researched:** 2026-03-16
**Domain:** Deployment, CI/CD, Vercel, GitHub Actions
**Confidence:** HIGH

## Summary

This phase deploys the TPC Catalog PWA to Vercel with full CI/CD via GitHub Actions. The app is a static Vite SPA -- no server-side rendering, no Vercel Functions. Vercel auto-detects Vite projects, uses the `build` script from package.json (`tsc -b && vite build`), and serves the `dist/` output directory. The only non-trivial configuration is the SPA catch-all rewrite (so React Router paths work on refresh/direct navigation) and security headers -- both handled in a single `vercel.json`.

The Cloudflare Worker proxy is already deployed and operational. The only integration point is setting `VITE_GEMINI_PROXY_URL` as a Vercel environment variable (injected at build time via Vite's `import.meta.env`) and restricting the Worker's CORS to the production Vercel domain.

**Primary recommendation:** Use Vercel's native GitHub integration for deploy (zero-config), add GitHub Actions for CI checks (lint/typecheck/test/build), and configure branch protection to require CI pass before merge.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Project name: `tpc-catalog` on Vercel subdomain (`tpc-catalog.vercel.app`)
- Open access -- no password protection
- `VITE_GEMINI_PROXY_URL` set via Vercel project environment variables (injected at build time)
- Cloudflare Worker CORS restricted to Vercel production domain only
- Strip `basicSsl()` plugin for production builds (conditional on Vite mode)
- Add `vercel.json` with SPA catch-all rewrite
- Add security headers via vercel.json: X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- Build command: `tsc -b && vite build` (existing, no change needed)
- Full CI pipeline on GitHub Actions: eslint lint, TypeScript typecheck, vitest unit tests, vite build verification
- Auto-deploy to production from `main` branch via Vercel GitHub integration
- Preview deployments for pull requests
- Branch protection rules on `main`: require CI pass before merge

### Claude's Discretion
- PWA workbox caching strategy for production (current config likely sufficient)
- GitHub Actions workflow file structure (single job vs matrix)
- Node.js version and caching strategy in CI
- Exact security header values

### Deferred Ideas (OUT OF SCOPE)
None

</user_constraints>

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Vercel | Platform (latest) | Static hosting + CDN + preview deploys | Native Vite detection, zero-config for SPAs, free tier covers this use case |
| GitHub Actions | v4 actions | CI pipeline (lint/typecheck/test/build) | Already on GitHub, native integration with branch protection |
| Vercel GitHub Integration | Built-in | Auto-deploy on push to main, preview on PRs | Zero-config deploy, no tokens or CLI needed for basic flow |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| actions/checkout | v4 | Clone repo in CI | Every workflow |
| actions/setup-node | v4 | Install Node.js in CI | Every workflow |
| actions/cache | v4 (or setup-node built-in) | Cache npm dependencies | Speed up CI runs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vercel GitHub integration for deploy | `vercel-action` GitHub Action | More control but adds token management; unnecessary for simple static deploy |
| Single CI job | Matrix strategy | Matrix only useful for multi-Node testing; single Node 22 LTS job is sufficient here |
| npm ci | pnpm/yarn | Project uses npm -- no reason to switch |

**No new packages to install.** This phase only adds configuration files.

## Architecture Patterns

### Files to Add/Modify
```
(root)
+-- vercel.json                    # SPA rewrite + security headers
+-- .github/
|   +-- workflows/
|       +-- ci.yml                 # Lint, typecheck, test, build
+-- vite.config.ts                 # Conditional basicSsl (modify)
+-- proxy/src/index.ts             # CORS origin restriction (modify)
```

### Pattern 1: vercel.json for Static SPA
**What:** Single configuration file handling rewrites and headers
**When to use:** Every Vite SPA deployed to Vercel
**Example:**
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```
**Source:** [Vercel official Vite docs](https://vercel.com/docs/frameworks/frontend/vite) and [vercel.json reference](https://vercel.com/docs/project-configuration/vercel-json)

**Key detail from official docs:** Vercel's Vite page explicitly states SPAs need the catch-all rewrite for deep linking to work. The `/(.*)`  source pattern matches all routes. Vercel auto-detects Vite, uses `npm run build`, and serves from `dist/`.

### Pattern 2: Conditional basicSsl Plugin
**What:** Only include basicSsl in development mode, skip for production
**When to use:** When local dev needs self-signed HTTPS but production has real certs
**Example:**
```typescript
import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
// ... other imports

export default defineConfig(({ mode }) => ({
  server: {
    host: true,
    ...(mode === "development" && { https: true }),
  },
  plugins: [
    mode === "development" && basicSsl(),
    react(),
    tailwindcss(),
    VitePWA({ /* ... */ }),
  ].filter(Boolean),
  test: { /* ... */ },
}));
```
**Key insight:** `defineConfig` accepts a function that receives `{ mode }`. In production builds (`vite build`), mode defaults to `"production"`. The `basicSsl()` plugin and `https: true` server option are only needed during `vite dev`.

### Pattern 3: GitHub Actions CI Workflow
**What:** Single workflow file with sequential steps for lint, typecheck, test, build
**When to use:** Every PR and push to main
**Example:**
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npx tsc -b

      - name: Test
        run: npx vitest run

      - name: Build
        run: npm run build
```
**Recommendation (Claude's Discretion):** Use a single job with sequential steps rather than a matrix or parallel jobs. The total CI time for this small project will be under 2 minutes -- parallelism adds complexity without meaningful speedup. Node 22 is the current LTS; the project runs on Node 24 locally, but Node 22 LTS is the safest CI target (Node 24 not yet LTS). Using `actions/setup-node` with `cache: npm` handles caching automatically via built-in support.

### Pattern 4: Cloudflare Worker CORS Restriction
**What:** Change CORS from wildcard `*` to specific production domain
**When to use:** When moving from dev to production
**Example:**
```typescript
const ALLOWED_ORIGINS = [
  "https://tpc-catalog.vercel.app",
];

function corsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
```
**Important consideration:** Preview deployments get unique URLs like `tpc-app-{hash}-{org}.vercel.app`. The CORS must either: (a) only allow the production domain (preview deploys won't use AI), or (b) also allow `*.vercel.app` subdomains. Recommendation: restrict to production domain only. Preview deploys can still be used for UI testing -- AI features just won't work without the proxy, which is acceptable for PR review.

### Anti-Patterns to Avoid
- **Do NOT use `vercel` CLI for deployment:** The Vercel GitHub integration handles everything. Using the CLI would require storing `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` as GitHub secrets -- unnecessary complexity.
- **Do NOT put env vars in vercel.json:** Environment variables belong in Vercel project settings dashboard. vercel.json is committed to git.
- **Do NOT add `framework` to vercel.json:** Vercel auto-detects Vite. Specifying it creates a maintenance burden when upgrading.
- **Do NOT add `buildCommand` or `outputDirectory` to vercel.json:** The defaults (`npm run build` and `dist/`) are correct for this project.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deploy pipeline | Custom deploy scripts | Vercel GitHub integration | Zero-config, handles rollbacks, preview URLs |
| CI caching | Manual tar/restore of node_modules | `actions/setup-node` cache option | Built-in, maintained, handles cache key rotation |
| HTTPS certificates | Manual cert management | Vercel automatic HTTPS | Automatic provisioning and renewal |
| CDN | Self-managed CDN | Vercel Edge Network | Global CDN included in platform |

## Common Pitfalls

### Pitfall 1: SPA Routes Return 404 on Direct Navigation
**What goes wrong:** Navigating directly to `/session/1` or refreshing returns Vercel's 404 page
**Why it happens:** Without rewrites, Vercel looks for a file at `/session/1/index.html` which doesn't exist
**How to avoid:** Add the `/(.*) -> /index.html` rewrite in vercel.json
**Warning signs:** Any React Router path returning 404 on refresh

### Pitfall 2: basicSsl Breaks Production Build
**What goes wrong:** Build fails or produces warnings because basicSsl tries to generate self-signed certs during CI build
**Why it happens:** basicSsl is unconditionally included in plugins array
**How to avoid:** Conditionally include based on `mode === "development"`
**Warning signs:** Build warnings about SSL certificates in CI logs

### Pitfall 3: Environment Variable Not Available at Runtime
**What goes wrong:** `VITE_GEMINI_PROXY_URL` is undefined in the deployed app
**Why it happens:** Vite env vars are replaced at build time, not runtime. If the var isn't set when `vite build` runs, it's baked in as undefined
**How to avoid:** Set `VITE_GEMINI_PROXY_URL` in Vercel project settings for all environments (Production, Preview, Development)
**Warning signs:** AI features silently fail -- proxy URL guard catches it as missing

### Pitfall 4: CORS Blocks Requests from Production Domain
**What goes wrong:** AI processing fails with CORS errors in browser console
**Why it happens:** Cloudflare Worker still has `Access-Control-Allow-Origin: *` (which actually works), OR the origin was restricted but doesn't match the exact deployed domain
**How to avoid:** Verify the exact production URL and update the Worker CORS to match. Test immediately after deploy.
**Warning signs:** Network tab shows preflight OPTIONS failing with CORS error

### Pitfall 5: CI Workflow Name Doesn't Match Branch Protection Check
**What goes wrong:** Branch protection is configured but doesn't enforce CI because the status check name doesn't match
**Why it happens:** GitHub branch protection requires selecting the exact status check name, which is `job_name` from the workflow file
**How to avoid:** After first CI run, go to branch protection settings and select the check by name (e.g., "ci")
**Warning signs:** PRs can be merged even when CI hasn't run

### Pitfall 6: Service Worker Caching Stale Assets After Deploy
**What goes wrong:** Users see the old version even after a new deploy
**Why it happens:** Workbox precaching serves from cache before checking for updates
**How to avoid:** Current config uses `registerType: "autoUpdate"` which automatically activates new service workers -- this is already correct. Vite build hashes all assets, so new deploys get new URLs.
**Warning signs:** Users report seeing old UI; solved by hard refresh (Ctrl+Shift+R)
**Recommendation (Claude's Discretion):** Current workbox config with `autoUpdate` is sufficient. No changes needed to PWA caching strategy.

## Code Examples

### Complete vercel.json
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```
Source: [Vercel vercel.json reference](https://vercel.com/docs/project-configuration/vercel-json)

### Complete CI Workflow (.github/workflows/ci.yml)
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npx tsc -b

      - name: Test
        run: npx vitest run

      - name: Build
        run: npm run build
```

### Conditional basicSsl in vite.config.ts
```typescript
export default defineConfig(({ mode }) => ({
  server: {
    host: true,
    ...(mode === "development" && { https: true }),
  },
  plugins: [
    mode === "development" && basicSsl(),
    react(),
    tailwindcss(),
    VitePWA({
      // ... existing config unchanged
    }),
  ].filter(Boolean),
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["src/tests/setup.ts"],
  },
}));
```

### CORS-Restricted Cloudflare Worker
```typescript
const ALLOWED_ORIGINS = [
  "https://tpc-catalog.vercel.app",
];

function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const origin = requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)
    ? requestOrigin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `vercel.json` routes array | `rewrites` array | Vercel v3+ (2021) | Cleaner syntax, routes is legacy |
| Manual VERCEL_TOKEN deploy | Vercel GitHub integration | Available since 2020 | Zero-config deploy, no secrets needed |
| actions/setup-node + separate cache step | actions/setup-node with `cache: npm` | setup-node v4 | Built-in caching, fewer workflow lines |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vite.config.ts` (test section) |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map

This phase has no formal requirement IDs. Validation is primarily manual/integration:

| Behavior | Test Type | Automated Command | Notes |
|----------|-----------|-------------------|-------|
| Vite builds successfully | CI | `npm run build` | CI workflow step |
| ESLint passes | CI | `npm run lint` | CI workflow step |
| TypeScript typechecks | CI | `npx tsc -b` | CI workflow step |
| Unit tests pass | CI | `npx vitest run` | CI workflow step |
| SPA routes work on refresh | manual | N/A | Visit `/session/1` directly on deployed URL |
| Security headers present | manual | `curl -I https://tpc-catalog.vercel.app` | Check response headers |
| AI proxy works from prod | manual | N/A | Record audio, verify AI processing |
| Preview deploy created on PR | manual | N/A | Open PR, check for preview URL comment |
| Branch protection enforced | manual | N/A | Try merging PR without CI pass |

### Sampling Rate
- **Per task commit:** `npx vitest run` (existing tests still pass)
- **Per wave merge:** `npm run lint && npx tsc -b && npx vitest run && npm run build`
- **Phase gate:** Full CI pipeline green + manual verification of deployed app

### Wave 0 Gaps
- [ ] `.github/workflows/ci.yml` -- CI workflow file (new)
- [ ] `vercel.json` -- Vercel configuration (new)
- No test file gaps -- existing 19 test files cover all app functionality

## Open Questions

1. **Exact production domain**
   - What we know: Project name `tpc-catalog` maps to `tpc-catalog.vercel.app`
   - What's unclear: Vercel may assign a different subdomain if `tpc-catalog` is taken
   - Recommendation: Attempt to create project with name `tpc-catalog`. If taken, use whatever Vercel assigns, then update CORS accordingly.

2. **Cloudflare Worker deployed URL**
   - What we know: Worker is deployed, local dev uses `http://localhost:8787`
   - What's unclear: The production Worker URL (likely `tpc-gemini-proxy.<account>.workers.dev`)
   - Recommendation: Check `wrangler whoami` / `wrangler deployments list` or Cloudflare dashboard to confirm the production URL before setting Vercel env var.

3. **Vercel org/team setup**
   - What we know: GitHub repo is under `The-Potomack-Company` org
   - What's unclear: Whether a Vercel team exists for this org, or if deploying under personal account
   - Recommendation: This is a manual setup step in Vercel dashboard. Document the steps but implementation requires human action.

## Sources

### Primary (HIGH confidence)
- [Vercel Vite docs](https://vercel.com/docs/frameworks/frontend/vite) - SPA rewrite configuration, environment variables
- [Vercel vercel.json reference](https://vercel.com/docs/project-configuration/vercel-json) - Configuration schema, headers, rewrites
- [Vercel GitHub integration docs](https://vercel.com/docs/git/vercel-for-github) - Auto-deploy, preview deployments

### Secondary (MEDIUM confidence)
- [GitHub Actions setup-node](https://github.com/actions/setup-node) - Caching strategy, Node version configuration
- [Vercel security headers article](https://manel-lemin.medium.com/take-your-website-to-an-a-with-vercel-and-security-headers-44d13154eda7) - Header values reference
- Project codebase analysis - vite.config.ts, package.json, proxy/src/index.ts, eslint.config.js

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Vercel + Vite is extremely well-documented, official docs confirm all patterns
- Architecture: HIGH - vercel.json schema is stable, GitHub Actions workflow is straightforward
- Pitfalls: HIGH - Known issues verified through official docs (SPA rewrites, env var timing)
- CORS restriction: MEDIUM - Pattern is clear but exact production URL needs verification at deploy time

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable domain, slow-moving configuration)
