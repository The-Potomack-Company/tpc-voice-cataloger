---
phase: 12-authentication
plan: 01
subsystem: auth
tags: [zustand, supabase-auth, react-router, protected-routes, service-worker, workbox]

# Dependency graph
requires:
  - phase: 11-supabase-foundation
    provides: Supabase client singleton at src/lib/supabase.ts
provides:
  - Zustand auth store (useAuthStore) with session/user/loading state and signIn/signOut/updatePassword/initialize actions
  - ProtectedRoute component for route gating based on auth state
  - Route tree restructured with /login outside AppLayout, all other routes inside ProtectedRoute
  - Auth initialization in main.tsx before React render
  - Workbox config excluding Supabase API routes from service worker caching
  - Login page placeholder (src/pages/Login.tsx) for Plan 02 to replace
affects: [12-02 login-page, 12-03 settings-auth, 13-account-management, 14-data-migration]

# Tech tracking
tech-stack:
  added: []
  patterns: [zustand-auth-store, protected-route-layout-wrapper, pre-render-auth-init, workbox-network-only-exclusion]

key-files:
  created:
    - src/stores/authStore.ts
    - src/components/ProtectedRoute.tsx
    - src/pages/Login.tsx
    - src/tests/auth-store.test.ts
    - src/tests/protected-route.test.tsx
    - src/tests/pwa-config.test.ts
  modified:
    - src/App.tsx
    - src/main.tsx
    - vite.config.ts

key-decisions:
  - "vi.hoisted() used for mock variable hoisting in Vitest (required for vi.mock factory pattern)"
  - "PWA config tests placed in separate pwa-config.test.ts file alongside existing pwa-manifest.test.ts"
  - "Auth store uses no persist middleware (Supabase handles its own localStorage session persistence)"

patterns-established:
  - "Zustand auth store pattern: create<AuthState>() without persist, wrapping supabase.auth methods"
  - "ProtectedRoute layout wrapper: checks loading then session, renders Outlet/Navigate/spinner"
  - "Pre-render auth init: useAuthStore.getState().initialize() called before createRoot().render()"
  - "vi.hoisted() pattern for test mock variables that need to be available in vi.mock factories"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, INFRA-04]

# Metrics
duration: 4min
completed: 2026-03-18
---

# Phase 12 Plan 01: Auth Infrastructure Summary

**Zustand auth store wrapping Supabase onAuthStateChange, ProtectedRoute layout wrapper with route gating, pre-render auth initialization, and Workbox NetworkOnly exclusion for Supabase API routes**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-18T15:30:14Z
- **Completed:** 2026-03-18T15:34:13Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Auth store with session/user/loading state and signIn/signOut/updatePassword/initialize actions, fully tested with 7 unit tests
- ProtectedRoute component that redirects unauthenticated users to /login, shows spinner during loading, and renders Outlet for authenticated users
- App.tsx route tree restructured: /login outside AppLayout, all app routes wrapped in ProtectedRoute > AppLayout
- Auth store initializes in main.tsx before React render, preventing flash-of-unauthenticated-content
- Workbox config excludes all *.supabase.co URLs with NetworkOnly handler and /auth navigation routes via denylist

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 1: Create auth store and test scaffold**
   - `90a9844` (test: failing tests for auth store)
   - `93aefeb` (feat: implement Zustand auth store)
2. **Task 2: Create ProtectedRoute, wire App.tsx routes, initialize auth in main.tsx**
   - `c53b28f` (test: failing tests for ProtectedRoute)
   - `277a238` (feat: ProtectedRoute + App.tsx + main.tsx wiring)
3. **Task 3: Add Supabase route exclusion to Workbox config**
   - `8d4c474` (test: failing tests for Workbox Supabase exclusion)
   - `f3a76be` (feat: Workbox runtimeCaching + navigateFallbackDenylist)

## Files Created/Modified
- `src/stores/authStore.ts` - Zustand auth store with session/user/loading state and 4 auth actions
- `src/components/ProtectedRoute.tsx` - Auth gate layout component: loading spinner, redirect, or Outlet
- `src/pages/Login.tsx` - Placeholder login page for Plan 02
- `src/App.tsx` - Route tree with /login outside AppLayout, other routes inside ProtectedRoute
- `src/main.tsx` - Auth store initialization before React render with HMR cleanup
- `vite.config.ts` - Workbox NetworkOnly for supabase.co + navigateFallbackDenylist for /auth
- `src/tests/auth-store.test.ts` - 7 unit tests for auth store (initialize, signIn, signOut, updatePassword, state transitions)
- `src/tests/protected-route.test.tsx` - 3 component tests (authenticated, unauthenticated redirect, loading spinner)
- `src/tests/pwa-config.test.ts` - 2 config tests (runtimeCaching, navigateFallbackDenylist)

## Decisions Made
- Used `vi.hoisted()` for mock variable hoisting in tests (required because Vitest hoists `vi.mock` factories above variable declarations)
- Created separate `pwa-config.test.ts` file for Workbox tests rather than extending existing `pwa-manifest.test.ts` (clearer separation of concerns)
- Auth store uses no `persist` middleware -- Supabase handles its own localStorage session persistence

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed vi.mock hoisting issue in auth store tests**
- **Found during:** Task 1 (auth store TDD GREEN phase)
- **Issue:** `vi.mock` factory couldn't access `mockOnAuthStateChange` etc. because Vitest hoists `vi.mock` above `const` declarations
- **Fix:** Used `vi.hoisted()` to wrap mock variable declarations so they're available when the factory runs
- **Files modified:** `src/tests/auth-store.test.ts`
- **Verification:** All 7 tests pass
- **Committed in:** `93aefeb` (part of Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Standard Vitest mock hoisting fix. No scope creep.

## Issues Encountered
- 2 pre-existing test failures in `gemini-pipeline.test.ts` (null fields and category defaults) -- unrelated to auth changes, out of scope per deviation rules

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Auth infrastructure complete, ready for Plan 02 (Login page implementation)
- Login.tsx placeholder exists at src/pages/Login.tsx for Plan 02 to replace with full implementation
- Auth store provides signIn/signOut/updatePassword actions for Plan 02 and Plan 03
- SERVICE WORKER BLOCKER RESOLVED: Supabase API routes now excluded from caching (was listed in STATE.md blockers)

## Self-Check: PASSED

All 7 created/modified files verified on disk. All 6 task commits verified in git log.

---
*Phase: 12-authentication*
*Completed: 2026-03-18*
