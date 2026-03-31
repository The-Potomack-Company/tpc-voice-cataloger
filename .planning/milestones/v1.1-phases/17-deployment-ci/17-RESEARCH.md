# Phase 17: Deployment & CI - Research

**Researched:** 2026-03-18
**Domain:** Vercel deployment, GitHub Actions CI, Cloudflare Worker CORS, GitHub branch protection
**Confidence:** HIGH

## Summary

Phase 17 deploys the TPC App to Vercel with automated quality gates and security hardening. The four deliverables are: (1) Vercel deployment with auto-deploy from main, (2) GitHub Actions CI pipeline running lint/typecheck/test/build, (3) CORS lockdown on the Cloudflare Worker, and (4) branch protection on main requiring CI checks. None of these introduce new app features -- this is purely infrastructure and deployment configuration.

The codebase currently has pre-existing issues that must be fixed before CI can enforce quality gates: 25 ESLint errors, 3 TypeScript errors, and 4 failing tests (2 test files). These must be resolved as a prerequisite, otherwise the CI pipeline will immediately block all PRs. The `vite.config.ts` also unconditionally loads `@vitejs/plugin-basic-ssl`, which will cause build failures on Vercel (no local certificate authority available in CI).

**Primary recommendation:** Fix all lint/type/test failures first, then set up CI, Vercel deployment, CORS lockdown, and branch protection in that order. The `vercel.json` SPA rewrite is mandatory since the app uses React Router with `BrowserRouter`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Environment variables via Vercel dashboard only** -- set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PROXY_URL` in Vercel project settings. No env vars or secrets in the repo
- **Preview deploys enabled** -- every PR gets a unique preview URL (Vercel default behavior). Production deploys on push to main
- **Default Vercel URL** -- use auto-generated `*.vercel.app` domain. No custom domain needed
- **Conditionally exclude basicSsl plugin** -- `@vitejs/plugin-basic-ssl` only loads in dev mode. Vercel provides HTTPS natively
- **No `vercel.json` needed unless framework auto-detection requires overrides** (but research shows SPA routing DOES require it -- see Architecture Patterns)
- **Four CI checks on every PR and push to main:** `eslint .`, `tsc -b`, `npx vitest --run`, `vite build`
- **Trigger:** PRs targeting main + pushes to main
- **Scope:** Main app only. Cloudflare Worker deploys independently via wrangler
- **Node version:** 22 LTS
- **Package manager:** npm
- **Add `test` script to `package.json`:** `"test": "vitest --run"`
- **4 tests currently failing -- must be fixed before CI enforcement blocks merges**
- **Wrangler environment variable** -- store `ALLOWED_ORIGINS` as a Wrangler `[vars]` entry (not secret)
- **Allowed origins:** Production Vercel URL, preview deploy pattern (`*.vercel.app` suffix match), `https://localhost:5173`
- **Worker checks Origin header against allowed list, reflects matching origin in ACAO header, rejects non-matches**
- **No review required for PRs** -- CI checks are the quality gate (small team, often solo developer)
- **PRs only** -- no direct pushes to main
- **Configured via GitHub CLI (`gh`)** -- plan includes exact commands
- **Required status checks:** the CI workflow checks (lint, typecheck, test, build)

### Claude's Discretion
- Exact GitHub Actions workflow YAML structure (single job vs matrix, caching strategy)
- Whether to use `npm ci` or `npm install` in CI
- Vercel framework preset auto-detection vs explicit config
- Exact CORS origin matching logic (regex vs array includes)
- How to handle the 4 failing tests (fix in this phase or document as prerequisite)
- Whether to add a `vercel.json` for SPA routing fallback or rely on framework detection

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEPLOY-01 | App deployed to Vercel with auto-deploy from main | Vercel auto-detects Vite, needs `vercel.json` for SPA routing, env vars via dashboard, basicSsl conditional loading |
| DEPLOY-02 | CI pipeline: lint, typecheck, test, build via GitHub Actions | GitHub Actions workflow with `actions/setup-node@v4`, `npm ci`, caching, 4 check steps. Pre-existing failures must be fixed first |
| DEPLOY-03 | Cloudflare Worker CORS restricted to production Vercel domain | Worker reads `ALLOWED_ORIGINS` from `[vars]` in wrangler.toml, validates Origin header, reflects or rejects |
| DEPLOY-04 | Branch protection on main: require CI checks before merge | GitHub rulesets API via `gh api` -- `pull_request` rule (0 approvals) + `required_status_checks` rule |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Vite | 7.3.1 (installed) | Build tool | Already configured, Vercel auto-detects |
| Vitest | 4.0.18 (installed) | Test runner | Already configured in vite.config.ts |
| ESLint | 9.39.1 (installed) | Linter | Already configured with flat config |
| TypeScript | 5.9.3 (installed) | Type checker | Already configured with project references |

### CI/CD Infrastructure
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| GitHub Actions | N/A (service) | CI pipeline | Repo is on GitHub, native integration |
| actions/checkout | v4 | Git checkout in CI | Standard, always latest v4 |
| actions/setup-node | v4 | Node.js setup + npm cache | Built-in npm cache support via `cache: 'npm'` |
| Vercel Platform | N/A (service) | Hosting + auto-deploy | Vite is auto-detected, zero-config for builds |
| Cloudflare Workers | N/A (service) | Gemini API proxy | Already deployed, just needs CORS update |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `gh` CLI | Branch protection rulesets | One-time setup command |
| `wrangler` CLI | Worker env var + deploy | CORS config update |

**No new npm packages needed.** This phase is purely configuration.

## Architecture Patterns

### Recommended File Structure (new files only)
```
.github/
  workflows/
    ci.yml              # GitHub Actions CI pipeline
vercel.json             # SPA routing rewrite
proxy/
  wrangler.toml         # Updated with [vars] for ALLOWED_ORIGINS
  src/
    index.ts            # Updated CORS logic
```

### Pattern 1: Conditional Plugin Loading in Vite
**What:** Load `@vitejs/plugin-basic-ssl` only in development mode
**When to use:** Production builds (Vercel CI, GitHub Actions) do not have a local CA
**Why critical:** The current unconditional `basicSsl()` call WILL cause build failures in CI/Vercel

```typescript
// vite.config.ts -- use function-based defineConfig
// Source: https://vite.dev/config/
export default defineConfig(({ command }) => ({
  server: { host: true },
  plugins: [
    // Only include basicSsl during dev server, not during build
    command === 'serve' ? basicSsl() : null,
    react(),
    tailwindcss(),
    VitePWA({ /* ... existing config ... */ }),
  ].filter(Boolean),
  test: { /* ... existing config ... */ },
}));
```

The key insight: Vite's `command` is `'serve'` during `vite dev` and `'build'` during `vite build`. Using `command === 'serve'` is the correct conditional -- it matches dev server usage exactly.

### Pattern 2: Single-Job CI Workflow
**What:** One job with sequential steps (not matrix or parallel jobs)
**When to use:** Small project, all checks run on same Node version
**Why:** Simpler, faster (no job startup overhead), easier to debug. Caching is maximally effective.

**Recommendation:** Use a single job with 4 sequential steps. The total wall time is under 30 seconds based on local test run (6.8s for tests, build is ~5s, lint ~3s, typecheck ~3s). Parallelizing into separate jobs would add ~30s of overhead per job for checkout + install.

```yaml
# .github/workflows/ci.yml
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
          cache: 'npm'
      - run: npm ci
      - name: Lint
        run: npx eslint .
      - name: Typecheck
        run: npx tsc -b
      - name: Test
        run: npx vitest --run
      - name: Build
        run: npx vite build
```

**Why `npm ci` over `npm install`:** `npm ci` is deterministic (uses lockfile exactly), faster in CI (skips resolution), and cleans `node_modules` first. This is the standard CI practice.

**Why NOT separate jobs:** For a project with 303 tests running in 6.8s, the overhead of spinning up additional runners (checkout, install, cache restore) would exceed the time saved by parallelism.

### Pattern 3: Dynamic CORS Origin Validation
**What:** Worker validates `Origin` header against an allow list, reflects matching origin
**When to use:** Replacing `Access-Control-Allow-Origin: *` with specific origin checking

```typescript
// proxy/src/index.ts
interface Env {
  GEMINI_API_KEY: string;
  ALLOWED_ORIGINS: string; // comma-separated: "https://tpc-app.vercel.app,https://localhost:5173"
}

function isAllowedOrigin(origin: string, allowedOrigins: string): boolean {
  const allowed = allowedOrigins.split(',').map(s => s.trim());
  // Exact match for listed origins
  if (allowed.includes(origin)) return true;
  // Suffix match for Vercel preview deploys (*.vercel.app)
  if (origin.endsWith('.vercel.app') && origin.startsWith('https://')) return true;
  return false;
}

function getCorsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  if (isAllowedOrigin(origin, env.ALLOWED_ORIGINS)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };
  }
  // No CORS headers for disallowed origins
  return {};
}
```

**Key details:**
- `Vary: Origin` header is REQUIRED when ACAO is not `*` -- without it, CDN/browser caches may serve wrong CORS headers to different origins
- Suffix match for `*.vercel.app` covers all preview deploys without listing each URL
- Empty headers object (no ACAO header at all) for disallowed origins -- browser enforces the block

### Pattern 4: SPA Routing with vercel.json
**What:** Catch-all rewrite so React Router handles all routes
**Why required:** Without this, direct navigation to `/login`, `/session/123`, etc. returns 404 on Vercel

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

**Source:** [Vercel Vite SPA docs](https://vercel.com/docs/frameworks/frontend/vite) -- explicitly states "To enable deep linking in SPA Vite apps, create a `vercel.json` file."

**Discretion resolution:** Despite the user's note that `vercel.json` may not be needed, research confirms it IS required for this SPA. Vercel's Vite auto-detection handles build commands but does NOT auto-configure SPA rewrites.

### Pattern 5: GitHub Rulesets for Branch Protection
**What:** API-first branch protection using the newer rulesets API (preferred over legacy branch protection)
**When to use:** Setting up main branch protection via CLI

```bash
# Create ruleset via gh api
gh api --method POST \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "repos/The-Potomack-Company/tpc-cataloging-app/rulesets" \
  --input - <<'EOF'
{
  "name": "Protect main",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["refs/heads/main"],
      "exclude": []
    }
  },
  "rules": [
    {
      "type": "pull_request",
      "parameters": {
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_approving_review_count": 0,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "do_not_enforce_on_create": true,
        "required_status_checks": [
          { "context": "ci" }
        ]
      }
    }
  ]
}
EOF
```

**Key details:**
- `required_approving_review_count: 0` means PRs are required but no reviews needed (user decision: CI is the quality gate)
- The `context` for required status checks must match the GitHub Actions job name. With the single-job workflow above, the job name is `ci`, so the context is `ci`
- `strict_required_status_checks_policy: false` means branches do NOT need to be up-to-date with main before merging (avoids constant rebasing for solo developer)
- `do_not_enforce_on_create: true` allows initial branch creation without passing checks
- The `pull_request` rule type enforces "no direct pushes" -- all changes must go through a PR

### Anti-Patterns to Avoid
- **Wildcard CORS in production:** The current `Access-Control-Allow-Origin: *` must be replaced. Never ship wildcard CORS for an API proxy.
- **Hardcoding Vercel URLs in Worker code:** Use environment variables (`ALLOWED_ORIGINS` in wrangler.toml `[vars]`), not hardcoded strings in source.
- **Multiple CI jobs for a fast project:** Adding matrix/parallel jobs when total runtime is under 30s just adds overhead.
- **`npm install` in CI:** Always use `npm ci` for deterministic, lockfile-based installs.
- **Skipping `Vary: Origin`:** When ACAO reflects a dynamic origin, omitting `Vary: Origin` causes caching bugs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CI pipeline | Custom shell scripts | GitHub Actions with `actions/setup-node@v4` | Built-in npm caching, Node version management, status check integration |
| SPA routing on Vercel | Custom server-side routing | `vercel.json` rewrites | One declarative config file, maintained by Vercel |
| Branch protection | Manual GitHub UI setup | `gh api` rulesets command | Reproducible, scriptable, documented in plan |
| npm dependency caching | `actions/cache` with manual key | `actions/setup-node` `cache: 'npm'` | setup-node handles cache key generation from lockfile automatically |

## Common Pitfalls

### Pitfall 1: basicSsl Plugin Breaks CI/Vercel Builds
**What goes wrong:** `@vitejs/plugin-basic-ssl` tries to generate a self-signed certificate at build time. In CI (ubuntu-latest) and Vercel, this may fail or produce warnings.
**Why it happens:** Current `vite.config.ts` loads `basicSsl()` unconditionally on line 6/13.
**How to avoid:** Use `defineConfig(({ command }) => ...)` and only include `basicSsl()` when `command === 'serve'`.
**Warning signs:** Build failure with SSL/certificate errors in CI logs.

### Pitfall 2: Pre-existing Lint/Type/Test Failures Block All PRs
**What goes wrong:** CI pipeline immediately fails on every PR because there are already failures in the codebase.
**Why it happens:** Current state: 25 ESLint errors, 3 TypeScript errors, 4 failing tests.
**How to avoid:** Fix all pre-existing failures BEFORE enabling CI enforcement. This is a prerequisite task.
**Warning signs:** First PR after CI setup is blocked.
**Current failures:**
- **ESLint (25 errors):** `set-state-in-effect` in AdminRouteGuard and useBlobUrl, `no-explicit-any` in InstallBanner, `no-unused-vars` in multiple test files, plus others
- **TypeScript (3 errors):** Type comparison mismatches in SessionCard.tsx and SessionDetail.tsx (string|null vs number), unused `event` param in authStore.ts
- **Tests (4 failures, 2 files):** `account-management.test.tsx` (2 failures -- form interaction tests), `gemini-pipeline.test.ts` (2 failures -- null field/category default tests)

### Pitfall 3: SPA Routes Return 404 on Vercel
**What goes wrong:** Navigating directly to `/login`, `/session/123`, or refreshing the page returns a 404.
**Why it happens:** Vercel serves static files. Routes like `/login` don't correspond to actual files in `dist/`.
**How to avoid:** Add `vercel.json` with catch-all rewrite to `/index.html`.
**Warning signs:** 404 errors on any non-root URL after deployment.

### Pitfall 4: CORS Status Check Context Name Mismatch
**What goes wrong:** Branch protection requires a status check named `lint` but the actual GitHub Actions check is named `ci` (the job name).
**Why it happens:** The `context` in rulesets must exactly match the job name in the workflow YAML.
**How to avoid:** Use a single job named `ci` and reference `ci` in the ruleset's `required_status_checks`.
**Warning signs:** PRs show "waiting for status check" indefinitely.

### Pitfall 5: Missing `Vary: Origin` Header
**What goes wrong:** Browsers or CDNs cache a CORS response for one origin and serve it to another origin, causing CORS failures.
**Why it happens:** When `Access-Control-Allow-Origin` is dynamic (reflects the request origin), caches need `Vary: Origin` to know responses differ by origin.
**How to avoid:** Always include `'Vary': 'Origin'` in CORS headers when not using wildcard `*`.
**Warning signs:** Intermittent CORS errors, especially after switching between preview and production URLs.

### Pitfall 6: Vercel Auto-Deploy Without Env Vars
**What goes wrong:** First Vercel deploy succeeds but the app shows blank screen or API errors.
**Why it happens:** Env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PROXY_URL`) must be set in Vercel dashboard BEFORE the first deploy. Vite bakes them into the bundle at build time.
**How to avoid:** Set all three env vars in Vercel project settings before triggering the first deploy.
**Warning signs:** `import.meta.env.VITE_SUPABASE_URL` is `undefined` at runtime.

### Pitfall 7: wrangler.toml [vars] vs Secrets
**What goes wrong:** Accidentally putting `ALLOWED_ORIGINS` as a secret (which requires `wrangler secret put`) instead of a var.
**Why it happens:** Confusion between `[vars]` (plaintext in config, accessible in env) and secrets (encrypted, set via CLI).
**How to avoid:** Origin URLs are not sensitive -- use `[vars]` in `wrangler.toml`. The existing `GEMINI_API_KEY` correctly uses `wrangler secret put` because it IS sensitive.

## Code Examples

### Current vite.config.ts (needs modification)
```typescript
// Current: basicSsl() loaded unconditionally -- breaks in CI
// File: vite.config.ts, line 13
plugins: [
  basicSsl(),  // <-- PROBLEM: fails in CI/Vercel
  react(),
  // ...
]
```

### Fixed vite.config.ts (conditional basicSsl)
```typescript
// Source: https://vite.dev/config/ (function-based defineConfig)
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig(({ command }) => ({
  server: {
    host: true,
  },
  plugins: [
    command === 'serve' ? basicSsl() : null,
    react(),
    tailwindcss(),
    VitePWA({
      // ... existing PWA config unchanged ...
    }),
  ].filter(Boolean),
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["src/tests/setup.ts"],
  },
}));
```

### Updated wrangler.toml with ALLOWED_ORIGINS
```toml
# proxy/wrangler.toml
name = "tpc-gemini-proxy"
main = "src/index.ts"
compatibility_date = "2025-01-01"

[vars]
ALLOWED_ORIGINS = "https://tpc-cataloging-app.vercel.app,https://localhost:5173"

# Set GEMINI_API_KEY via: npx wrangler secret put GEMINI_API_KEY
```

Note: The exact production Vercel URL will be determined after the first Vercel deployment. The `*.vercel.app` suffix match in the Worker code handles preview deploys.

### package.json test script addition
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest --run",
    "db:push": "npx supabase db push",
    "db:types": "npx supabase gen types --lang=typescript --schema public > src/db/database.types.ts"
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Branch protection rules (legacy) | Repository rulesets | 2023 | API-first, more flexible, supports required_status_checks rule type |
| `actions/setup-node` + `actions/cache` separate | `actions/setup-node@v4` with `cache: 'npm'` | 2024 | Built-in caching, less config |
| `npm install` in CI | `npm ci` | Long-standing best practice | Deterministic, faster, respects lockfile |
| Manual Vercel config | Vite framework auto-detection | Native | Zero config for build command and output dir |

## Open Questions

1. **Exact Vercel production URL**
   - What we know: It will be `*.vercel.app` based on project name
   - What's unclear: Exact subdomain (likely `tpc-cataloging-app.vercel.app` or similar, determined at first deploy)
   - Recommendation: Deploy first, then update `ALLOWED_ORIGINS` in wrangler.toml with the actual URL. The `*.vercel.app` suffix match handles preview deploys regardless.

2. **GitHub plan limitations for rulesets**
   - What we know: Rulesets are available on all plans for public repos. For private repos, some features require GitHub Pro or Team.
   - What's unclear: The repo is private (`The-Potomack-Company/tpc-cataloging-app`). Rulesets with `required_status_checks` may require a paid plan.
   - Recommendation: Try creating the ruleset via `gh api`. If it fails with a 403/422, fall back to legacy branch protection API (`PUT /repos/{owner}/{repo}/branches/{branch}/protection`) which is available on all plans for private repos.

3. **Handling the 4 failing tests**
   - What we know: 2 in `account-management.test.tsx` (form tests), 2 in `gemini-pipeline.test.ts` (null field handling)
   - Recommendation: Fix in this phase as the first task (prerequisite). These are likely small issues -- the account management tests may need UI component updates, the gemini-pipeline tests need a category default fix.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vite.config.ts` (test section at lines 61-65) |
| Quick run command | `npx vitest --run` |
| Full suite command | `npx vitest --run` (same -- 303 tests in 6.8s) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEPLOY-01 | App builds successfully for Vercel | build | `npx vite build` | N/A (build command, not test file) |
| DEPLOY-02 | CI pipeline runs lint, typecheck, test, build | integration | Manual: push a PR and verify checks run | N/A (GitHub Actions, not local test) |
| DEPLOY-03 | CORS rejects disallowed origins | unit | `cd proxy && npx vitest --run` (if tests added) | No -- Wave 0 |
| DEPLOY-04 | Branch protection blocks merge without CI | manual-only | Manual: attempt direct push to main, verify rejection | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest --run` (verify no regressions, 6.8s)
- **Per wave merge:** `npx eslint . && npx tsc -b && npx vitest --run && npx vite build` (full CI equivalent)
- **Phase gate:** All 4 checks green locally + CI pipeline passing on a test PR

### Wave 0 Gaps
- [ ] Fix 4 failing tests in `src/tests/account-management.test.tsx` and `src/tests/gemini-pipeline.test.ts`
- [ ] Fix 25 ESLint errors across multiple files
- [ ] Fix 3 TypeScript errors in SessionCard.tsx, SessionDetail.tsx, authStore.ts
- [ ] Optional: Add CORS unit tests for the Cloudflare Worker (`proxy/src/index.test.ts`)

## Sources

### Primary (HIGH confidence)
- [Vercel Vite docs](https://vercel.com/docs/frameworks/frontend/vite) -- SPA routing requirement, framework auto-detection, env var handling
- [Vite config docs](https://vite.dev/config/) -- Function-based defineConfig with `command` parameter for conditional plugin loading
- [Cloudflare Workers CORS example](https://developers.cloudflare.com/workers/examples/cors-header-proxy/) -- Dynamic origin header pattern
- [Cloudflare Workers env vars](https://developers.cloudflare.com/workers/configuration/environment-variables/) -- `[vars]` section in wrangler.toml for non-secret values
- [GitHub REST API: branch protection](https://docs.github.com/en/rest/branches/branch-protection) -- PUT endpoint for legacy protection
- [GitHub rulesets available rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets) -- `required_status_checks` and `pull_request` rule types
- [actions/setup-node v4](https://github.com/actions/setup-node) -- Built-in npm caching with `cache: 'npm'`

### Secondary (MEDIUM confidence)
- [GitHub dependency caching docs](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching) -- `npm ci` with cache best practices
- [TurboGeek GitHub CLI rulesets](https://www.turbogeek.co.uk/github-cli-secrets-automate-branch-protection-rulesets/) -- `gh api` command structure for rulesets
- [GitHub community: creating rulesets via REST](https://github.com/orgs/community/discussions/139808) -- `required_status_checks` JSON structure with `context` field

### Tertiary (LOW confidence)
- Exact Vercel production URL subdomain (determined at deploy time)
- GitHub plan-level availability of rulesets for private repos in an organization

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools already in the project, just need configuration
- Architecture: HIGH -- patterns verified against official Vercel, Vite, Cloudflare, and GitHub docs
- Pitfalls: HIGH -- pre-existing failures verified by running lint/typecheck/test locally, SPA routing requirement confirmed by official Vercel docs

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable infrastructure, unlikely to change)
