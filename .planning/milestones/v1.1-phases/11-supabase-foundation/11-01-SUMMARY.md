---
phase: 11-supabase-foundation
plan: 01
subsystem: database
tags: [supabase, postgres, rls, sql-migrations, typescript-types, supabase-js]

# Dependency graph
requires: []
provides:
  - Postgres schema with profiles, sessions, items, export_history tables (UUID PKs)
  - RLS policies enforcing admin-full-access and specialist-scoped-access on all 4 tables
  - private.is_admin() and private.is_active_user() SECURITY DEFINER helper functions
  - handle_new_user trigger auto-creating profiles rows on auth signup
  - Typed Supabase client singleton at src/lib/supabase.ts
  - Placeholder database types at src/db/database.types.ts
  - db:push and db:types npm scripts
affects: [12-authentication, 13-account-management, 14-data-migration, 15-session-lifecycle, 16-assignment-review]

# Tech tracking
tech-stack:
  added: ["@supabase/supabase-js@^2.99.2", "supabase@^2.81.3 (devDep)"]
  patterns: [supabase-singleton-client, rls-helper-functions, check-constraints-over-enums, security-definer-bypass-rls]

key-files:
  created:
    - supabase/migrations/20260318000000_create_profiles.sql
    - supabase/migrations/20260318000001_create_sessions.sql
    - supabase/migrations/20260318000002_create_items.sql
    - supabase/migrations/20260318000003_create_export_history.sql
    - supabase/migrations/20260318000004_helper_functions.sql
    - supabase/migrations/20260318000005_rls_policies.sql
    - src/lib/supabase.ts
    - src/db/database.types.ts
    - src/tests/supabase-client.test.ts
    - src/tests/supabase-types.test.ts
  modified:
    - package.json
    - .env.example

key-decisions:
  - "Used vi.stubEnv instead of import.meta.env assignment for Vitest env var mocking (esbuild transform limitation)"
  - "CHECK constraints on text columns for status/mode/role fields (no Postgres ENUMs)"
  - "Indexes on sessions.created_by, sessions.assigned_to, items.session_id for RLS query performance"

patterns-established:
  - "Supabase client singleton: createClient<Database> exported from src/lib/supabase.ts"
  - "RLS helper pattern: private.is_admin() and private.is_active_user() as SECURITY DEFINER functions"
  - "Migration file ordering: tables first, then helper functions, then RLS policies"
  - "Database types: placeholder at src/db/database.types.ts with Tables/Insertable/Updatable helpers"

requirements-completed: [INFRA-01, INFRA-02]

# Metrics
duration: 5min
completed: 2026-03-18
---

# Phase 11 Plan 01: Supabase Foundation Summary

**Postgres schema with 4 tables, RLS policies for admin/specialist roles, SECURITY DEFINER helpers, and typed Supabase JS client singleton**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-18T13:45:02Z
- **Completed:** 2026-03-18T13:49:53Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments
- 6 SQL migration files covering profiles, sessions, items, export_history with UUID PKs, CHECK constraints, and indexes
- RLS policies enforcing admin full access and specialist scoped access on all 4 tables, with private helper functions
- Typed Supabase JS client singleton with env var validation, placeholder database types for all 4 tables
- Wave 0 test scaffold: 9 new tests covering client initialization and type structure (all passing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SQL migration files** - `3ed2b2f` (feat)
2. **Task 2: Install Supabase SDK, create typed client, update env config** - `5a06fb8` (feat)
3. **Task 3: Create Wave 0 test scaffolds** - `aaa883b` (test)

## Files Created/Modified
- `supabase/migrations/20260318000000_create_profiles.sql` - profiles table with role, display_name, is_active
- `supabase/migrations/20260318000001_create_sessions.sql` - sessions table with lifecycle status and assignment columns
- `supabase/migrations/20260318000002_create_items.sql` - unified items table with mode column
- `supabase/migrations/20260318000003_create_export_history.sql` - export history table
- `supabase/migrations/20260318000004_helper_functions.sql` - private schema helpers and handle_new_user trigger
- `supabase/migrations/20260318000005_rls_policies.sql` - RLS policies for all 4 tables
- `src/lib/supabase.ts` - Typed Supabase client singleton with env var validation
- `src/db/database.types.ts` - Placeholder generated types for all 4 tables with Row/Insert/Update
- `src/tests/supabase-client.test.ts` - Client initialization tests (env vars, export shape)
- `src/tests/supabase-types.test.ts` - Type structure tests (all tables, helper types)
- `package.json` - Added @supabase/supabase-js, supabase CLI, db:push and db:types scripts
- `.env.example` - Added VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

## Decisions Made
- Used `vi.stubEnv` instead of direct `import.meta.env` assignment for Vitest env var mocking, because esbuild transforms the assignment into invalid code
- All other decisions followed the plan as specified (CHECK constraints, SECURITY DEFINER, singleton pattern)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Vitest env var mocking approach**
- **Found during:** Task 3 (test scaffold creation)
- **Issue:** Plan specified `import.meta.env = {...}` assignment which esbuild transforms into invalid JavaScript (`Object.assign(...) = value`)
- **Fix:** Used `vi.stubEnv('VITE_SUPABASE_URL', value)` API instead, which is the correct Vitest 4.x pattern
- **Files modified:** src/tests/supabase-client.test.ts
- **Verification:** All 3 client tests pass
- **Committed in:** aaa883b (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary fix for test infrastructure compatibility. No scope creep.

## Issues Encountered
- 2 pre-existing test failures in `gemini-pipeline.test.ts` (category default to 'FRN') -- confirmed these exist on the base branch and are unrelated to Supabase changes

## User Setup Required
None - no external service configuration required at this stage. Users will need to create a Supabase project and add credentials to `.env.local` before running the app (documented in `.env.example`).

## Next Phase Readiness
- Schema migrations ready to push to cloud Supabase via `npm run db:push`
- Typed client ready for use in authentication (Phase 12) and data access layers
- Placeholder types will be replaced by real generated types in Plan 02 after cloud deployment

## Self-Check: PASSED

- All 12 expected files exist
- All 3 task commits verified (3ed2b2f, 5a06fb8, aaa883b)

---
*Phase: 11-supabase-foundation*
*Completed: 2026-03-18*
