---
phase: 13-account-management
plan: 01
subsystem: api
tags: [supabase, edge-functions, deno, admin-api, route-guard, rls, cors]

# Dependency graph
requires:
  - phase: 11-supabase-foundation
    provides: profiles table, handle_new_user trigger, RLS policies
  - phase: 12-authentication
    provides: authStore (session/user state), ProtectedRoute pattern
provides:
  - 3 Edge Functions for admin account operations (create, update, list)
  - Database migration adding email column to profiles
  - adminApi.ts client service wrapping Edge Function invocations
  - AdminRouteGuard component for admin-only route protection
affects: [13-02-account-management-ui, admin-routes, settings-page]

# Tech tracking
tech-stack:
  added: [supabase-edge-functions, deno]
  patterns: [edge-function-admin-verify, cors-headers-shared, dual-layer-deactivation, admin-route-guard]

key-files:
  created:
    - supabase/migrations/20260318000006_add_email_to_profiles.sql
    - supabase/functions/_shared/cors.ts
    - supabase/functions/_shared/admin-client.ts
    - supabase/functions/_shared/verify-admin.ts
    - supabase/functions/admin-create-user/index.ts
    - supabase/functions/admin-update-user/index.ts
    - supabase/functions/admin-list-users/index.ts
    - src/services/adminApi.ts
    - src/components/AdminRouteGuard.tsx
    - src/tests/admin-api.test.ts
    - src/tests/admin-route-guard.test.tsx
  modified: []

key-decisions:
  - "Separate Edge Functions per operation (create, update, list) for independent deployability"
  - "Email column added to profiles table for efficient listing (nullable for backward compat)"
  - "AdminRouteGuard queries profiles table directly rather than extending authStore with profile data"
  - "Dual-layer deactivation: ban_duration on auth.users + is_active on profiles for defense in depth"

patterns-established:
  - "Edge Function admin verification: verifyAdmin() shared helper checks JWT + profiles.role + is_active"
  - "CORS headers shared module: all Edge Functions import corsHeaders from _shared/cors.ts"
  - "Admin client shared module: createAdminClient() wraps service_role key client creation"
  - "Self-deactivation prevention: Edge Function rejects userId === adminCheck.userId"
  - "Client service layer: supabase.functions.invoke() wrappers with typed return values"

requirements-completed: [ACCT-01, ACCT-03, ACCT-04]

# Metrics
duration: 4min
completed: 2026-03-18
---

# Phase 13 Plan 01: Admin Backend Infrastructure Summary

**3 Supabase Edge Functions for admin account CRUD, email migration, client service layer, and admin route guard with full test coverage**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-18T17:05:22Z
- **Completed:** 2026-03-18T17:09:48Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- 3 Edge Functions (admin-create-user, admin-update-user, admin-list-users) with shared admin verification, CORS, and Supabase Admin API integration
- Migration adds email column to profiles table and updates handle_new_user trigger to populate it
- Client-side adminApi.ts service with typed wrappers for all 3 Edge Functions
- AdminRouteGuard component queries profiles for admin role, redirects non-admins
- 8 unit tests covering all service functions and route guard behaviors

## Task Commits

Each task was committed atomically:

1. **Task 1: Database migration and Supabase Edge Functions** - `5020bb5` (feat)
2. **Task 2 RED: Failing tests for admin API and route guard** - `8168ade` (test)
3. **Task 2 GREEN: Admin API service layer and AdminRouteGuard** - `3910685` (feat)

## Files Created/Modified
- `supabase/migrations/20260318000006_add_email_to_profiles.sql` - Adds email column to profiles, updates trigger
- `supabase/functions/_shared/cors.ts` - Shared CORS headers for Edge Functions
- `supabase/functions/_shared/admin-client.ts` - Shared admin Supabase client (service_role)
- `supabase/functions/_shared/verify-admin.ts` - Admin verification helper (JWT + role + is_active)
- `supabase/functions/admin-create-user/index.ts` - Create specialist account Edge Function
- `supabase/functions/admin-update-user/index.ts` - Deactivate/reactivate account Edge Function
- `supabase/functions/admin-list-users/index.ts` - List accounts with email enrichment
- `src/services/adminApi.ts` - Client-side admin API wrapper (3 exported functions)
- `src/components/AdminRouteGuard.tsx` - Admin role route guard component
- `src/tests/admin-api.test.ts` - 5 tests for admin API service functions
- `src/tests/admin-route-guard.test.tsx` - 3 tests for admin route guard behaviors

## Decisions Made
- Separate Edge Functions per operation for independent deployability and testing
- Email column added to profiles table (nullable) rather than relying solely on auth.admin.listUsers
- AdminRouteGuard queries profiles directly on mount rather than extending authStore
- Dual-layer deactivation (ban_duration + is_active) for defense in depth

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed route guard test path matching**
- **Found during:** Task 2 (TDD GREEN phase)
- **Issue:** Test MemoryRouter used `initialEntries={['/admin']}` but Route tree had no `path="admin"` -- routes never matched
- **Fix:** Added `path="/admin"` to layout Route wrapping AdminRouteGuard in tests
- **Files modified:** `src/tests/admin-route-guard.test.tsx`
- **Verification:** All 3 route guard tests pass
- **Committed in:** `3910685` (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test structure fix for proper route matching. No scope creep.

## Issues Encountered
None -- plan executed cleanly after test route fix.

## User Setup Required

**External services require manual configuration.** Edge Functions must be deployed to Supabase:
- Deploy edge functions: `npx supabase functions deploy --project-ref <PROJECT_REF>`
- Push new migration: `npx supabase db push --linked`

## Next Phase Readiness
- Backend infrastructure complete for Account Management UI (Plan 02)
- AdminRouteGuard ready for use in App.tsx route configuration
- adminApi.ts service ready for UI components to consume
- Edge Functions ready for deployment after code review

## Self-Check: PASSED

- All 11 created files exist on disk
- All 3 task commits verified in git log (5020bb5, 8168ade, 3910685)

---
*Phase: 13-account-management*
*Completed: 2026-03-18*
