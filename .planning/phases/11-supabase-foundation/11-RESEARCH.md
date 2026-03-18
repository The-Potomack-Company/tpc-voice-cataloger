# Phase 11: Supabase Foundation - Research

**Researched:** 2026-03-18
**Domain:** Supabase Postgres schema, RLS policies, client SDK, TypeScript type generation
**Confidence:** HIGH

## Summary

Phase 11 establishes the Supabase backend infrastructure: a Postgres database with tables for users (profiles), sessions, items, and export history; RLS policies enforcing admin/specialist role-based access; and the Supabase JS client installed and configured in the Vite/React app. No UI changes are required -- this is pure infrastructure.

The user has made clear decisions: cloud Supabase from day one (no local Docker), SQL migration files versioned in git, UUID PKs everywhere via `gen_random_uuid()`, a unified `items` table with a `mode` column instead of separate house/sale tables, a `profiles` table in the public schema for role storage (not JWT app_metadata), and Supabase CLI for TypeScript type generation.

**Primary recommendation:** Use `supabase/migrations/` directory with timestamped SQL files, a `private.is_admin()` helper function for RLS policies, check constraints (not Postgres enums) for status/mode columns, and the standard singleton `createClient<Database>()` pattern in `src/lib/supabase.ts`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Items:** Single unified `items` table with a `mode` column ('house' | 'sale') and a nullable `receipt_number`. No separate `house_visit_items` / `sale_items` tables.
- **Sessions status:** Expanded to cover full lifecycle -- `'active' | 'submitted' | 'returned' | 'exported'`. Single source of truth for session state.
- **Review notes:** `review_notes` text column on the `sessions` table. Overwritten each time admin returns a session (not a history/audit trail).
- **Sessions new columns:** `created_by uuid` (FK to auth.users), `assigned_to uuid nullable` (FK to auth.users).
- **Role storage:** `profiles` table in the public schema: `id` (uuid, FK to auth.users), `role` ('admin' | 'specialist'), `display_name` (text, required), `is_active` (boolean), `created_at`. RLS policies join to `profiles` to check the current user's role -- not JWT app_metadata. `display_name` is required at account creation.
- **ID strategy:** All Postgres PKs use UUIDs via `gen_random_uuid()`. Dexie auto-increment integer IDs are NOT preserved -- Phase 14 migration generates fresh UUIDs.
- **Development setup:** Cloud Supabase project from day 1 (no local Docker / Supabase CLI local stack). Credentials in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` (gitignored). SQL migration files checked into git. Supabase CLI used to generate TypeScript types (`supabase gen types typescript`).

### Claude's Discretion
- Exact SQL file naming and directory structure (supabase/migrations/ vs sql/)
- Whether to use `supabase/config.toml` CLI project or just raw SQL files
- Specific RLS policy names and whether to use helper functions (e.g., `is_admin()`)
- Timestamps: `timestamptz` with `now()` defaults (standard Supabase practice)
- Whether to add indexes beyond PKs and FKs in Phase 11 (e.g., on sessions.assigned_to)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Supabase project configured with Postgres database and auth | Standard Stack section covers SDK installation, client configuration, env vars. Architecture Patterns covers migration workflow and schema design. |
| INFRA-02 | Row-level security (RLS) policies enforce role-based data access | Architecture Patterns section covers RLS policy design, helper functions, and per-table policy breakdown for admin/specialist roles. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.99.2 | Supabase client SDK for browser | Official JS client; handles auth, DB queries, realtime. Verified via `npm view` on 2026-03-18. |
| supabase (CLI) | 2.81.3 | Type generation, migrations | Official CLI; `gen types typescript` generates typed Database interface. Verified via `npm view` on 2026-03-18. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | - | - | No additional libraries needed for Phase 11 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| profiles table for roles | JWT app_metadata custom claims | User decided against -- profiles table is simpler to query in RLS and easier to manage from admin UI |
| Postgres ENUMs for status/mode | CHECK constraints on text columns | CHECK constraints recommended -- ENUMs require ACCESS EXCLUSIVE lock to modify, while CHECK constraints can be altered without full table scans |
| supabase/migrations/ | Custom sql/ directory | supabase/migrations/ is standard -- works with `supabase db push`, follows CLI conventions, flat structure with timestamp prefixes |

**Installation:**
```bash
npm install @supabase/supabase-js
npm install -D supabase
```

**Version verification:** Versions confirmed against npm registry on 2026-03-18. `@supabase/supabase-js@2.99.2` and `supabase@2.81.3` are current.

## Architecture Patterns

### Recommended Project Structure
```
supabase/
  migrations/
    20260318000000_create_profiles.sql
    20260318000001_create_sessions.sql
    20260318000002_create_items.sql
    20260318000003_create_export_history.sql
    20260318000004_rls_policies.sql
    20260318000005_helper_functions.sql
src/
  lib/
    supabase.ts          # Singleton client export
  db/
    database.types.ts    # Generated types (supabase gen types)
    index.ts             # Existing Dexie client (unchanged)
    types.ts             # Existing Dexie types (unchanged)
.env.local               # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (gitignored)
```

### Pattern 1: Supabase Client Singleton
**What:** Single `createClient<Database>()` instance exported from a dedicated module
**When to use:** Always -- the client is designed to be instantiated once per app
**Example:**
```typescript
// src/lib/supabase.ts
// Source: https://supabase.com/docs/guides/getting-started/quickstarts/reactjs
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../db/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
```

### Pattern 2: Profiles Table with Auth Trigger
**What:** Auto-create a `profiles` row when a user signs up via Supabase Auth
**When to use:** Always -- every auth.users entry needs a corresponding profiles row
**Example:**
```sql
-- Source: https://supabase.com/docs/guides/auth/managing-user-data
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role, is_active)
  values (
    new.id,
    new.raw_user_meta_data ->> 'display_name',
    coalesce(new.raw_user_meta_data ->> 'role', 'specialist'),
    true
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

### Pattern 3: RLS Helper Functions
**What:** `security definer` functions in a `private` schema to encapsulate role checks
**When to use:** When multiple RLS policies need to check the same condition (e.g., is the user an admin?)
**Example:**
```sql
-- Source: https://supabase.com/docs/guides/database/postgres/row-level-security
-- Create private schema for internal helper functions
create schema if not exists private;

create or replace function private.is_admin()
returns boolean
language plpgsql
security definer set search_path = ''
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and is_active = true
  );
end;
$$;

create or replace function private.is_active_user()
returns boolean
language plpgsql
security definer set search_path = ''
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and is_active = true
  );
end;
$$;
```

### Pattern 4: RLS Policy Design per Table
**What:** Separate policies for admin (full access) and specialist (own-data access) on each table
**When to use:** On every table that needs role-based access

**Profiles table:**
```sql
alter table public.profiles enable row level security;

-- Users can read their own profile
create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using ( (select auth.uid()) = id );

-- Admins can view all profiles
create policy "Admins can view all profiles"
  on public.profiles for select
  to authenticated
  using ( (select private.is_admin()) );

-- Admins can update any profile
create policy "Admins can update profiles"
  on public.profiles for update
  to authenticated
  using ( (select private.is_admin()) );
```

**Sessions table:**
```sql
alter table public.sessions enable row level security;

-- Admins can do everything
create policy "Admins full access to sessions"
  on public.sessions for all
  to authenticated
  using ( (select private.is_admin()) )
  with check ( (select private.is_admin()) );

-- Specialists can view sessions assigned to them or created by them
create policy "Specialists view own sessions"
  on public.sessions for select
  to authenticated
  using (
    (select private.is_active_user())
    and (
      created_by = (select auth.uid())
      or assigned_to = (select auth.uid())
    )
  );

-- Specialists can insert sessions they create
create policy "Specialists create own sessions"
  on public.sessions for insert
  to authenticated
  with check (
    (select private.is_active_user())
    and created_by = (select auth.uid())
  );

-- Specialists can update sessions they own (if not locked)
create policy "Specialists update own sessions"
  on public.sessions for update
  to authenticated
  using (
    (select private.is_active_user())
    and (
      created_by = (select auth.uid())
      or assigned_to = (select auth.uid())
    )
  );
```

**Items table:**
```sql
alter table public.items enable row level security;

-- Admins can do everything
create policy "Admins full access to items"
  on public.items for all
  to authenticated
  using ( (select private.is_admin()) )
  with check ( (select private.is_admin()) );

-- Specialists can access items belonging to their sessions
create policy "Specialists access own items"
  on public.items for select
  to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = session_id
        and (s.created_by = (select auth.uid()) or s.assigned_to = (select auth.uid()))
    )
  );
```

### Pattern 5: Check Constraints over Postgres ENUMs
**What:** Use text columns with CHECK constraints instead of native ENUMs for status/mode fields
**When to use:** Always for this project -- status values may expand in future phases
**Example:**
```sql
-- Source: https://www.crunchydata.com/blog/enums-vs-check-constraints-in-postgres
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  -- ...
  mode text not null check (mode in ('house', 'sale')),
  status text not null default 'active'
    check (status in ('active', 'submitted', 'returned', 'exported')),
  -- ...
);
```

### Pattern 6: Type Generation Workflow
**What:** Generate TypeScript types from the cloud Supabase schema after applying migrations
**When to use:** After every schema change
**Example:**
```bash
# Login (one-time)
npx supabase login

# Link to cloud project (one-time)
npx supabase link --project-ref YOUR_PROJECT_REF

# Push migrations to cloud
npx supabase db push

# Generate types
npx supabase gen types --lang=typescript --project-id YOUR_PROJECT_REF --schema public > src/db/database.types.ts
```

Add to package.json scripts:
```json
{
  "scripts": {
    "db:push": "supabase db push",
    "db:types": "supabase gen types --lang=typescript --project-id $PROJECT_REF --schema public > src/db/database.types.ts"
  }
}
```

### Anti-Patterns to Avoid
- **Storing roles in JWT claims only:** JWT claims are cached and not instantly updatable. The profiles table approach avoids stale role data in RLS checks.
- **Creating separate tables for house/sale items:** User explicitly chose unified `items` table with `mode` column. Separate tables create schema duplication.
- **Using Postgres ENUMs for status:** Adding/removing values requires ACCESS EXCLUSIVE lock and full table scan. CHECK constraints are trivially alterable.
- **Multiple Supabase client instances:** Always export a single `createClient()` instance. Multiple instances waste memory and can cause inconsistent auth state.
- **Forgetting `SECURITY DEFINER` on helper functions:** Without it, the function runs as the calling user (anon/authenticated), which cannot access other tables in RLS context.
- **Direct `auth.uid()` without SELECT wrapper:** Using `(select auth.uid())` is more performant than bare `auth.uid()` in policy expressions -- it evaluates once per query instead of per row.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TypeScript types for DB schema | Hand-written interfaces | `supabase gen types typescript` | Generated types stay in sync with actual schema; hand-written types drift |
| Auth user management | Custom user table in public schema | `auth.users` + `profiles` table with trigger | Supabase Auth handles password hashing, token refresh, session management |
| Role checking in RLS | Inline subqueries in every policy | `private.is_admin()` / `private.is_active_user()` helper functions | Single source of truth for role logic; change once, applies everywhere |
| Migration tracking | Manual SQL execution order | `supabase db push` with timestamped migration files | CLI tracks which migrations have been applied; prevents double-execution |
| Client initialization | `new SupabaseClient()` or manual fetch | `createClient<Database>()` singleton | Handles auth token refresh, type inference, request batching automatically |

**Key insight:** Supabase's value is that it provides a fully managed Postgres + Auth + API layer. Every hand-rolled replacement for a Supabase feature adds maintenance burden and loses automatic upgrades.

## Common Pitfalls

### Pitfall 1: Forgetting to Enable RLS on New Tables
**What goes wrong:** Tables without RLS enabled are fully accessible to any authenticated (or even anonymous) user via the auto-generated PostgREST API.
**Why it happens:** RLS is disabled by default when creating tables in Supabase. Easy to forget after a CREATE TABLE.
**How to avoid:** Always pair `CREATE TABLE` with `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` in the same migration file. Add as a checklist item in every schema migration.
**Warning signs:** Data visible to users who should not see it. The Supabase dashboard shows a warning icon on tables without RLS.

### Pitfall 2: Trigger Function Blocking Signups
**What goes wrong:** If the `handle_new_user()` trigger function fails (e.g., NOT NULL constraint violation on display_name), the entire auth.users INSERT is rolled back, blocking user registration.
**Why it happens:** The trigger runs inside the same transaction as the auth signup.
**How to avoid:** Use `COALESCE` and sensible defaults in the trigger function. Ensure all required fields have fallback values. Test the trigger thoroughly before deploying.
**Warning signs:** Signups fail with cryptic "Database error" messages.

### Pitfall 3: RLS Policies That Are Too Permissive
**What goes wrong:** Specialist sees admin data, or data from other specialists.
**Why it happens:** Using `true` as a USING clause placeholder during development, or forgetting to add specialist-scoping conditions.
**How to avoid:** Write policies with the principle of least privilege. Test each policy by connecting as different users (admin vs specialist) and verifying visible rows. Never use `using (true)` except on genuinely public tables.
**Warning signs:** More rows returned than expected for a given user.

### Pitfall 4: Circular Dependency in RLS Policies
**What goes wrong:** `is_admin()` queries `profiles` table, but `profiles` table has RLS policies that call `is_admin()`, creating infinite recursion.
**Why it happens:** The helper function needs to read profiles, but profiles has RLS enabled.
**How to avoid:** Use `SECURITY DEFINER` on the helper function. This causes the function to execute with the privileges of the function creator (postgres role), which bypasses RLS. This is the standard Supabase pattern.
**Warning signs:** "stack depth limit exceeded" errors in Postgres logs.

### Pitfall 5: Missing Environment Variables in Production
**What goes wrong:** App crashes on load with "Missing Supabase environment variables" error.
**Why it happens:** `.env.local` is gitignored (correctly), but deployment platform not configured with the same variables.
**How to avoid:** Document required env vars. Add validation at client creation time (throw early with descriptive error). This is a Phase 17 concern but the client code should be defensive from Phase 11.
**Warning signs:** Blank page or console error on deployment.

### Pitfall 6: Stale Generated Types After Schema Change
**What goes wrong:** TypeScript types don't match actual database schema, causing runtime errors.
**Why it happens:** Developer modifies schema via SQL editor or migration but forgets to re-run type generation.
**How to avoid:** Add `db:types` script to package.json. Run it after every `db:push`. Consider adding a CI check that regenerates types and fails if they differ from committed version.
**Warning signs:** TypeScript compiles but runtime queries return unexpected shapes.

## Code Examples

Verified patterns from official sources:

### Complete Schema: profiles Table
```sql
-- Source: https://supabase.com/docs/guides/auth/managing-user-data
create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  role text not null default 'specialist' check (role in ('admin', 'specialist')),
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (id)
);

alter table public.profiles enable row level security;
```

### Complete Schema: sessions Table
```sql
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mode text not null check (mode in ('house', 'sale')),
  status text not null default 'active'
    check (status in ('active', 'submitted', 'returned', 'exported')),
  notes text not null default '',
  review_notes text,
  created_by uuid not null references auth.users on delete cascade,
  assigned_to uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sessions enable row level security;
```

### Complete Schema: items Table (Unified)
```sql
create table public.items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions on delete cascade,
  mode text not null check (mode in ('house', 'sale')),
  receipt_number text,
  title text,
  description text,
  condition text,
  estimate text,
  measurements text,
  category text,
  transcript text,
  ai_status text not null default 'pending'
    check (ai_status in ('pending', 'processing', 'done', 'failed', 'queued')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.items enable row level security;
```

### Complete Schema: export_history Table
```sql
create table public.export_history (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions on delete cascade,
  session_name text not null,
  session_mode text not null check (session_mode in ('house', 'sale')),
  item_count integer not null,
  exported_at timestamptz not null default now(),
  exported_by uuid not null references auth.users on delete cascade
);

alter table public.export_history enable row level security;
```

### Using Generated Types in Application Code
```typescript
// Source: https://supabase.com/docs/reference/javascript/typescript-support
import type { Tables } from '../db/database.types';

// Clean type aliases
type Session = Tables<'sessions'>;
type Item = Tables<'items'>;
type Profile = Tables<'profiles'>;

// Querying with full type safety
const { data, error } = await supabase
  .from('sessions')
  .select('*, items(*)')
  .eq('created_by', userId);
// data is typed as (Session & { items: Item[] })[] | null
```

### Environment Variable Validation Pattern
```typescript
// src/lib/supabase.ts
// Source: https://supabase.com/docs/guides/getting-started/quickstarts/reactjs
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../db/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error(
    'VITE_SUPABASE_URL is not set. Add it to .env.local'
  );
}
if (!supabaseAnonKey) {
  throw new Error(
    'VITE_SUPABASE_ANON_KEY is not set. Add it to .env.local'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `auth.uid()` directly in USING clause | `(select auth.uid())` wrapped in SELECT | Supabase docs 2024 | Evaluates once per query vs once per row -- significant performance improvement |
| JWT app_metadata for roles | Profiles table with RLS join | Community consensus 2024-2025 | More flexible, instantly updatable, no JWT refresh delay |
| Postgres ENUMs for status fields | Text columns with CHECK constraints | Ongoing best practice | Avoids ACCESS EXCLUSIVE lock on enum modification |
| `supabase gen types typescript --local` | `supabase gen types --lang=typescript --project-id REF` | supabase CLI v1.8+ | Works with cloud projects without local Docker |
| `VITE_SUPABASE_ANON_KEY` env var name | `VITE_SUPABASE_PUBLISHABLE_KEY` (new Supabase naming) | Supabase 2025 | New key format `sb_publishable_xxx`. Both names work; existing projects can keep `ANON_KEY` naming. User decided on `VITE_SUPABASE_ANON_KEY`. |

**Deprecated/outdated:**
- `supabase-js v1`: Completely replaced by v2. Do not reference v1 patterns.
- `supabase.auth.api.*`: Removed in v2. Use `supabase.auth.admin.*` for server-side auth operations.

## Open Questions

1. **Supabase project reference / credentials**
   - What we know: User will create a cloud Supabase project and store credentials in `.env.local`
   - What's unclear: Whether the project already exists or needs to be created as part of Phase 11
   - Recommendation: Plan should include a manual step for the user to create the project and obtain credentials. The plan cannot automate Supabase project creation.

2. **Index strategy for sessions.assigned_to and sessions.created_by**
   - What we know: These columns will be used in RLS policy WHERE clauses on every query
   - What's unclear: Whether to add indexes in Phase 11 or defer to later optimization
   - Recommendation: Add indexes in Phase 11 -- RLS policies execute on every request, so these FK columns should be indexed from the start. The cost is negligible and prevents performance issues.

3. **Migration file granularity**
   - What we know: Supabase CLI requires flat `supabase/migrations/` directory with timestamp prefixes
   - What's unclear: One large migration file vs many small ones
   - Recommendation: Use multiple focused migration files (one per logical concern: tables, helper functions, RLS policies). This makes schema reviewable and individual concerns testable.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vite.config.ts` (test section at line 55-59) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | Supabase client initializes with correct types | unit | `npx vitest run src/tests/supabase-client.test.ts -t "client"` | No -- Wave 0 |
| INFRA-01 | Generated types match expected schema shape | unit | `npx vitest run src/tests/supabase-types.test.ts -t "types"` | No -- Wave 0 |
| INFRA-01 | Migration SQL files are syntactically valid | manual-only | Apply via `npx supabase db push --dry-run` | N/A |
| INFRA-02 | RLS policies exist on all tables | manual-only | Verify via Supabase dashboard or SQL query on `pg_policies` | N/A |
| INFRA-02 | Helper functions (is_admin, is_active_user) exist | manual-only | Verify via SQL query on `pg_proc` | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + manual verification of cloud schema via `supabase db push --dry-run`

### Wave 0 Gaps
- [ ] `src/tests/supabase-client.test.ts` -- covers INFRA-01 (client initialization, env var validation)
- [ ] `src/tests/supabase-types.test.ts` -- covers INFRA-01 (generated types have expected table names)
- [ ] No new framework install needed -- Vitest already configured

**Note on testing limitations:** RLS policies and migration SQL are inherently server-side concerns. Automated unit tests can verify the client SDK setup and type generation output, but verifying that RLS policies actually enforce access control requires either integration tests against a live Supabase instance or manual verification. Phase 11 primarily tests client-side wiring; RLS correctness is verified by manual SQL queries and dashboard inspection.

## Sources

### Primary (HIGH confidence)
- [Supabase RLS Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) -- policy syntax, auth.uid() pattern, SECURITY DEFINER functions, performance tips
- [Supabase User Management Docs](https://supabase.com/docs/guides/auth/managing-user-data) -- profiles table pattern, trigger function, CASCADE delete
- [Supabase TypeScript Support](https://supabase.com/docs/reference/javascript/typescript-support) -- Database type, Tables<> helper, QueryData pattern
- [Supabase Type Generation Docs](https://supabase.com/docs/guides/api/rest/generating-types) -- CLI command, authentication, output format
- [Supabase React Quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/reactjs) -- createClient pattern, env vars, Vite integration
- [Supabase Database Migrations Docs](https://supabase.com/docs/guides/deployment/database-migrations) -- migration new, db push, file naming convention
- [Supabase Custom Claims & RBAC Docs](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) -- authorize() function pattern, role_permissions table

### Secondary (MEDIUM confidence)
- [Crunchy Data: Enums vs Check Constraints](https://www.crunchydata.com/blog/enums-vs-check-constraints-in-postgres) -- tradeoff analysis, ACCESS EXCLUSIVE lock warning
- npm registry -- verified `@supabase/supabase-js@2.99.2` and `supabase@2.81.3` as current versions

### Tertiary (LOW confidence)
- None -- all findings verified against official Supabase documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- versions verified against npm registry, official docs confirm patterns
- Architecture: HIGH -- all schema patterns follow official Supabase documentation; user decisions are clear and well-defined
- Pitfalls: HIGH -- documented pitfalls come from official Supabase docs and well-known community issues (170+ exposed apps in Jan 2025 due to RLS misconfiguration)

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (30 days -- Supabase SDK is stable; minor version bumps expected but no breaking changes)
