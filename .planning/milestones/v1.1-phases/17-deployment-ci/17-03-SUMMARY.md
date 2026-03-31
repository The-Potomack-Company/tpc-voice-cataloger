---
phase: 17-deployment-ci
plan: 03
subsystem: infra
tags: [github-actions, ci, cors, cloudflare-worker, vitest]

# Dependency graph
requires:
  - phase: 17-01
    provides: ESLint and TypeScript typecheck passing (0 errors)
  - phase: 17-02
    provides: Vite build succeeds, vercel.json SPA catch-all, vitest test script
provides:
  - GitHub Actions CI workflow with lint, typecheck, test, build steps
  - Dynamic CORS origin validation on Cloudflare Worker (replaces wildcard)
  - Behavioral unit tests for CORS logic
  - ALLOWED_ORIGINS env var in wrangler.toml
affects: [17-04]

# Tech tracking
tech-stack:
  added: [vitest (proxy)]
  patterns: [exported pure functions for Worker testability, dynamic CORS origin reflection with Vary header]

key-files:
  created:
    - .github/workflows/ci.yml
    - proxy/src/index.test.ts
    - proxy/vitest.config.ts
  modified:
    - proxy/src/index.ts
    - proxy/wrangler.toml
    - proxy/package.json

key-decisions:
  - "Exported isAllowedOrigin and getCorsHeaders as named exports for direct unit testing"
  - "*.vercel.app suffix match allows all preview deploys without env var updates"
  - "Disallowed origins receive no ACAO header (not a rejected value) for security"

patterns-established:
  - "CORS reflection: allowed origins get their origin reflected back; disallowed get empty headers"
  - "Vary: Origin header on all CORS responses for correct CDN/proxy caching"

requirements-completed: [DEPLOY-02, DEPLOY-03]

# Metrics
duration: 2min
completed: 2026-03-30
---

# Phase 17 Plan 03: CI Workflow & CORS Lockdown Summary

**GitHub Actions CI pipeline (lint/typecheck/test/build) and Cloudflare Worker CORS lockdown replacing wildcard with dynamic origin validation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-30T13:32:01Z
- **Completed:** 2026-03-30T13:33:56Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- CORS wildcard replaced with dynamic origin validation (isAllowedOrigin + getCorsHeaders)
- 8 behavioral tests for CORS logic -- all passing
- GitHub Actions CI workflow with all 4 quality gates (eslint, tsc, vitest, vite build)

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: CORS behavioral tests** - `629b267` (test)
2. **Task 1 GREEN: CORS implementation** - `d4fb9d9` (feat)
3. **Task 2: GitHub Actions CI workflow** - `dd3f52b` (feat)

_TDD task had RED and GREEN commits._

## Files Created/Modified
- `.github/workflows/ci.yml` - CI pipeline: lint, typecheck, test, build on PRs/push to main
- `proxy/src/index.ts` - Dynamic CORS origin validation with isAllowedOrigin and getCorsHeaders
- `proxy/src/index.test.ts` - 8 behavioral tests for origin validation and CORS headers
- `proxy/vitest.config.ts` - Vitest config for proxy project
- `proxy/package.json` - Added vitest dev dependency and test script
- `proxy/wrangler.toml` - Added [vars] section with ALLOWED_ORIGINS

## Decisions Made
- Exported isAllowedOrigin and getCorsHeaders as named exports for direct unit testing (pure functions, no Worker runtime dependency)
- *.vercel.app suffix match allows all Vercel preview deploys automatically without updating env var
- Disallowed origins receive no Access-Control-Allow-Origin header at all (not a rejected value) -- browsers will block the response
- Single CI job (not parallel) per RESEARCH.md: total runtime under 30s, parallelism overhead not justified

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- CI workflow ready for branch protection rules (Plan 17-04 depends on `ci` job name)
- CORS lockdown deployed on next `wrangler deploy` -- production Vercel URL already in ALLOWED_ORIGINS
- ALLOWED_ORIGINS can be updated via wrangler.toml or Cloudflare dashboard without code changes

---
*Phase: 17-deployment-ci*
*Completed: 2026-03-30*
