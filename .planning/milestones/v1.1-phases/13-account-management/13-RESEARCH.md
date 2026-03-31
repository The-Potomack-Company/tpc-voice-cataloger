# Phase 13: Account Management - Research

**Researched:** 2026-03-18
**Domain:** Supabase Admin API, Edge Functions, role-based UI/routing, account lifecycle
**Confidence:** HIGH

## Summary

Phase 13 implements admin account management: creating specialist accounts, viewing an account list, and deactivating/reactivating accounts. The core technical challenge is that account creation and deactivation require the Supabase Admin API (`supabase.auth.admin.*`), which demands the `service_role` key -- a secret that must never reach the browser. This means a server-side intermediary is required.

The recommended approach is **Supabase Edge Functions** deployed alongside the existing Supabase project. Edge Functions automatically have access to `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as environment variables, require no additional infrastructure (no Vercel serverless functions needed yet), and are invokable from the client via `supabase.functions.invoke()` which automatically passes the user's JWT for authentication. The Edge Functions verify the caller is an admin by checking the `profiles` table before executing privileged operations.

The UI side leverages established patterns: the Settings page section structure, ConfirmDialog for destructive actions, inline action buttons matching Deleted Sessions row pattern, and Tailwind dark mode utilities. Route protection for `/admin/accounts` uses both client-side guard (redirect non-admin users) and server-side enforcement (RLS on profiles table already restricts non-admins from reading the full account list).

**Primary recommendation:** Use Supabase Edge Functions (Deno) as the server-side layer for all Admin API calls (`createUser`, `updateUserById`, `listUsers`). Verify admin role inside each function by querying `profiles` table. The existing `profiles` table schema, `handle_new_user` trigger, and RLS policies already support this phase -- no schema changes needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Admin creates specialist accounts using the **Supabase Admin API** (service role key) -- not invite email
- Fields required at creation: display name, email, and a temporary password
- No forced password change on first login -- specialist changes it via Settings > Change Password (Phase 12)
- Creation form is an **inline expandable form** on the Account Management page, triggered by a "+ Add Specialist" button at the top of the list
- Account Management page lives at `/admin/accounts`
- Accessible from **Settings page > "Admin" section** -- only renders for admin-role users
- Specialist-role users: Admin section not rendered in Settings and `/admin/accounts` is server-enforced inaccessible (RLS + route guard)
- Each account row shows: **display name** (primary), **email** (secondary), **role badge** (Admin/Specialist pill), **status badge** (Active/Deactivated)
- Actions are **inline buttons on the right side**: "Deactivate" for active, "Reactivate" for deactivated
- Admin's own account row has **no deactivate button** (prevents self-lockout)
- Deactivation is **reversible** -- "Reactivate" replaces "Deactivate" on deactivated rows
- **ConfirmDialog before deactivating** (destructive); no confirmation before reactivating
- Deactivated account sessions **stay as-is** -- no automatic session changes

### Claude's Discretion
- Supabase Admin API call architecture (edge function vs. server-side route vs. service role client in a secure context)
- Exact role badge and status badge visual styling (colors, size, pill shape)
- Error handling for account creation failures (duplicate email, weak password, etc.)
- Loading states during account creation and deactivation actions
- Empty state for the account list (if somehow no accounts exist)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ACCT-01 | Admin can create new specialist accounts with username and password | Edge Function calling `auth.admin.createUser()` with `email_confirm: true` and `user_metadata` for display_name/role; `handle_new_user` trigger auto-creates profiles row |
| ACCT-02 | Admin can view list of all accounts with roles | Client reads from `profiles` table via Supabase client (RLS "Admins can view all profiles" policy already exists); join with auth user email from Edge Function or store email in user_metadata |
| ACCT-03 | Admin can deactivate a specialist account (blocks login without deleting) | Edge Function calling `auth.admin.updateUserById()` with `ban_duration: '876000h'` to ban, `'none'` to unban; also toggles `profiles.is_active` for RLS enforcement |
| ACCT-04 | Account management page is only accessible to admin role | Client-side route guard checks `profiles.role`; server-side enforced by RLS (profiles SELECT policy requires admin role for listing all profiles) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.99.2 | Client SDK (already installed) | Already in project; provides `supabase.functions.invoke()` and typed DB queries |
| Supabase Edge Functions (Deno) | Supabase CLI 2.81.3 | Server-side admin operations | Built-in to Supabase; auto-injects `SUPABASE_SERVICE_ROLE_KEY`; no extra infra |
| React Router v7 | 7.13.1 | Route protection for `/admin/accounts` | Already in project; nested route with guard element |
| Tailwind CSS v4 | 4.2.1 | UI styling for account list and badges | Already in project; dark mode via `dark:` prefix |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zustand | 5.0.11 | Auth state store (if Phase 12 creates one) | Store current user profile including role for guard checks |
| zod | 4.3.6 | Validate Edge Function request bodies | Validate email format, password strength, display_name presence |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Supabase Edge Functions | Vercel API Routes | Vercel not yet configured (Phase 17); Edge Functions are zero-config with Supabase project |
| Supabase Edge Functions | Direct `service_role` client-side | NEVER -- exposes service role key to browser; catastrophic security risk |
| ban_duration for deactivation | Only `profiles.is_active` flag | ban_duration blocks at auth level (prevents token refresh); is_active alone only blocks at RLS level, user could still have valid JWT until expiry |

**Installation:**
```bash
# No new npm packages needed -- all dependencies already installed
# Edge Functions require Supabase CLI (already in devDependencies as supabase@2.81.3)
npx supabase functions new admin-create-user
npx supabase functions new admin-update-user
npx supabase functions new admin-list-users
```

## Architecture Patterns

### Recommended Project Structure
```
supabase/
  functions/
    _shared/
      cors.ts              # Shared CORS headers
      admin-client.ts      # Shared admin Supabase client (service_role)
      verify-admin.ts      # Shared admin verification helper
    admin-create-user/
      index.ts             # Create specialist account
    admin-update-user/
      index.ts             # Deactivate/reactivate account
    admin-list-users/
      index.ts             # List all accounts with profiles
src/
  pages/
    AccountManagement.tsx  # The /admin/accounts page
  services/
    adminApi.ts            # Client-side wrappers for supabase.functions.invoke()
  components/
    AccountRow.tsx         # Individual account row with badges and actions
    AdminRouteGuard.tsx    # Route guard component checking admin role
```

### Pattern 1: Edge Function with Admin Verification
**What:** Every Edge Function verifies the calling user is an active admin before executing
**When to use:** All admin-only server operations
**Example:**
```typescript
// supabase/functions/_shared/verify-admin.ts
import { createClient } from 'npm:@supabase/supabase-js@2'

export async function verifyAdmin(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Create a client with the user's JWT to check their role via RLS
  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )

  const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Check profile for admin role (uses RLS -- user can read own profile)
  const { data: profile } = await supabaseUser
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin' || !profile.is_active) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return { userId: user.id }
}
```

### Pattern 2: Dual-Layer Deactivation (Auth + Profile)
**What:** Deactivation sets BOTH `ban_duration` on auth.users (blocks login/token refresh at auth layer) AND `is_active = false` on profiles (blocks data access at RLS layer)
**When to use:** Deactivating/reactivating accounts
**Why both layers:** `ban_duration` prevents new logins and token refreshes. `is_active` prevents data access via existing (not-yet-expired) tokens through RLS. Together they provide defense in depth.
**Example:**
```typescript
// Inside admin-update-user Edge Function
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Deactivate: ban at auth level + set is_active false at profile level
const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(
  targetUserId,
  { ban_duration: '876000h' }  // ~100 years
)
const { error: profileError } = await supabaseAdmin
  .from('profiles')
  .update({ is_active: false })
  .eq('id', targetUserId)

// Reactivate: unban + set is_active true
const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(
  targetUserId,
  { ban_duration: 'none' }
)
const { error: reactivateError } = await supabaseAdmin
  .from('profiles')
  .update({ is_active: true })
  .eq('id', targetUserId)
```

### Pattern 3: Client-Side Admin Route Guard
**What:** Wrapper component that checks user's profile role before rendering protected routes
**When to use:** All `/admin/*` routes
**Example:**
```typescript
// src/components/AdminRouteGuard.tsx
import { Navigate, Outlet } from 'react-router'
import { useAuthStore } from '../stores/authStore' // Phase 12 creates this

export function AdminRouteGuard() {
  const profile = useAuthStore((s) => s.profile)

  if (!profile) return null // loading state
  if (profile.role !== 'admin') return <Navigate to="/" replace />

  return <Outlet />
}
```

### Pattern 4: Edge Function Invocation from Client
**What:** Thin service layer wrapping `supabase.functions.invoke()` calls
**When to use:** All admin operations from the UI
**Example:**
```typescript
// src/services/adminApi.ts
import { supabase } from '../lib/supabase'

export async function createSpecialistAccount(params: {
  email: string
  password: string
  displayName: string
}) {
  const { data, error } = await supabase.functions.invoke('admin-create-user', {
    body: params,
  })
  if (error) throw new Error(error.message)
  return data
}

export async function toggleAccountActive(userId: string, activate: boolean) {
  const { data, error } = await supabase.functions.invoke('admin-update-user', {
    body: { userId, activate },
  })
  if (error) throw new Error(error.message)
  return data
}

export async function listAccounts() {
  // Can query profiles directly (RLS allows admin to see all)
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, role, is_active, created_at')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}
```

### Anti-Patterns to Avoid
- **Service role key in browser:** NEVER use `SUPABASE_SERVICE_ROLE_KEY` in client-side code. It bypasses all RLS and grants full database access. Always use Edge Functions or server-side routes.
- **Relying only on client-side route guards:** The client guard prevents casual access but can be bypassed. RLS policies on the `profiles` table are the real enforcement layer (non-admins can only SELECT their own profile).
- **Calling auth.admin methods from the anon key client:** These methods require the service_role key. They will fail silently or throw auth errors if called with the anon key.
- **Deactivating only at profile level:** If you only set `is_active = false` without `ban_duration`, a deactivated user with an existing JWT can still refresh their token and access the app until the token expires.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| User creation | Custom auth signup flow | `supabase.auth.admin.createUser()` | Handles password hashing, email validation, user ID generation; trigger auto-creates profile row |
| Login blocking | Custom middleware checking is_active on every request | `ban_duration` on auth.users | Blocks at the auth layer -- prevents token refresh, works even with cached JWTs |
| Account list with emails | Join auth.users with profiles manually | `profiles` table query (emails from user_metadata or Edge Function `listUsers`) | RLS handles access control automatically |
| CORS handling | Custom CORS middleware | Supabase CORS headers pattern (`corsHeaders` object) | Well-documented pattern; `supabase.functions.invoke()` handles auth headers automatically |
| Admin role checks | JWT parsing with jose library | Query `profiles` table via Supabase client with user's JWT | RLS policies already enforce role-based access; no manual JWT decoding needed |

**Key insight:** The `handle_new_user` trigger (from Phase 11) automatically creates a `profiles` row when `auth.admin.createUser()` is called, reading `display_name` and `role` from `raw_user_meta_data`. This means account creation is a single API call -- no need to separately insert into profiles.

## Common Pitfalls

### Pitfall 1: Email Not Available in Profiles Table
**What goes wrong:** The `profiles` table has `display_name` and `role` but NOT `email`. To show email in the account list, you either need to: (a) query `auth.admin.listUsers()` via Edge Function, or (b) store email in profiles, or (c) pass email through `user_metadata` at creation time.
**Why it happens:** Supabase stores email in `auth.users` which is not directly queryable via client SDK/RLS. The `profiles` table was designed in Phase 11 without an email column.
**How to avoid:** The recommended approach is a **hybrid**: use the `profiles` table for the list (since RLS handles access control) and enrich with email data from the Edge Function's `auth.admin.listUsers()` call. Alternatively, add an `email` column to `profiles` during this phase's migration, or store email in `user_metadata` during creation and read it from there.
**Warning signs:** Account list shows display names but no emails; admin cannot identify accounts by email.

### Pitfall 2: Self-Deactivation
**What goes wrong:** Admin deactivates their own account and is locked out.
**Why it happens:** Deactivation Edge Function does not check if `targetUserId === callerUserId`.
**How to avoid:** Edge Function MUST reject requests where the target user ID matches the calling admin's user ID. The UI also omits the deactivate button for the admin's own row (defense in depth).
**Warning signs:** Admin cannot log in after managing accounts.

### Pitfall 3: CORS Errors from Edge Functions
**What goes wrong:** Browser blocks Edge Function responses with CORS errors.
**Why it happens:** Unlike Supabase's built-in REST API, Edge Functions do NOT have automatic CORS headers. You must handle OPTIONS preflight and include CORS headers in every response.
**How to avoid:** Create a shared `_shared/cors.ts` module with standard CORS headers. Every Edge Function must check for OPTIONS method and return headers, and include CORS headers in all responses (success and error).
**Warning signs:** Network tab shows preflight OPTIONS requests failing; browser console shows CORS policy errors.

### Pitfall 4: Edge Function Deployment Without Linking
**What goes wrong:** `supabase functions deploy` fails with "project not linked" error.
**Why it happens:** Supabase CLI needs to know which project to deploy to.
**How to avoid:** Run `supabase link --project-ref <PROJECT_ID>` before deploying. The project ref can be found in the Supabase dashboard URL.
**Warning signs:** Deploy command errors; functions not appearing in dashboard.

### Pitfall 5: Duplicate Email on Account Creation
**What goes wrong:** `auth.admin.createUser()` returns a `422 Unprocessable Entity` when an email already exists.
**Why it happens:** Email uniqueness is enforced at the auth.users level.
**How to avoid:** The Edge Function should catch this error and return a user-friendly message. The UI should display the error inline below the form.
**Warning signs:** Generic error message instead of "Email already registered."

### Pitfall 6: Stale Profile Data After Deactivation
**What goes wrong:** After deactivating an account, the account list still shows "Active" status until page refresh.
**Why it happens:** React state is not updated after the Edge Function call succeeds.
**How to avoid:** After successful deactivation/reactivation, re-fetch the profiles list or optimistically update the local state.
**Warning signs:** Status badges lag behind actual state.

## Code Examples

### Edge Function: Create Specialist Account
```typescript
// supabase/functions/admin-create-user/index.ts
// Source: Supabase official docs + CORS guide
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAdmin } from '../_shared/verify-admin.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Verify caller is admin
  const adminCheck = await verifyAdmin(req)
  if (adminCheck instanceof Response) return adminCheck

  const { email, password, displayName } = await req.json()
  if (!email || !password || !displayName) {
    return new Response(
      JSON.stringify({ error: 'email, password, and displayName are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Skip email confirmation for admin-created accounts
    user_metadata: { display_name: displayName, role: 'specialist' },
  })

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ user: { id: data.user.id, email: data.user.email } }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
```

### CORS Headers Shared Module
```typescript
// supabase/functions/_shared/cors.ts
// Source: https://supabase.com/docs/guides/functions/cors
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

### Account Row Component Pattern
```typescript
// Follows established Settings.tsx inline button pattern
// Source: src/pages/Settings.tsx (Deleted Sessions section)
<div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 flex items-center justify-between gap-3">
  <div className="min-w-0 flex-1">
    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
      {account.display_name}
    </p>
    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
      {account.email}
    </p>
    <div className="flex items-center gap-2 mt-1">
      {/* Role badge */}
      <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
        {account.role === 'admin' ? 'Admin' : 'Specialist'}
      </span>
      {/* Status badge */}
      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
        account.is_active
          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
      }`}>
        {account.is_active ? 'Active' : 'Deactivated'}
      </span>
    </div>
  </div>
  {/* Inline action button -- matches Deleted Sessions pattern */}
  {!isCurrentUser && (
    <button
      onClick={account.is_active ? onDeactivate : onReactivate}
      className={`min-h-12 px-3 py-2 rounded-lg text-sm font-medium ${
        account.is_active
          ? 'text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20'
          : 'text-accent hover:bg-accent/10'
      } transition-colors`}
    >
      {account.is_active ? 'Deactivate' : 'Reactivate'}
    </button>
  )}
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `verify_jwt` flag on Edge Functions | Manual JWT verification in function code | 2024-2025 | Supabase deprecated implicit JWT verification; developers must verify auth manually |
| Custom `is_active` checks only | `ban_duration` on auth.users + `is_active` on profiles | 2023+ (GoTrue update) | ban_duration blocks at auth layer, not just RLS; prevents token refresh |
| Edge Functions `serve()` with Deno.serve | Same pattern, still current | Stable | Deno.serve is the standard entry point for Edge Functions |
| corsHeaders from manual definition | `import { corsHeaders } from '@supabase/supabase-js/cors'` | supabase-js 2.95.0+ | Built-in import available; manual definition still works as fallback |

**Deprecated/outdated:**
- `verify_jwt` config flag: No longer implicitly enforced; manual auth verification is the current pattern
- Inviting users via `inviteUserByEmail()` for admin-created accounts: Sends confirmation email; use `createUser()` with `email_confirm: true` instead for admin-managed accounts

## Open Questions

1. **Email storage strategy for account list**
   - What we know: `profiles` table has no `email` column. Email lives in `auth.users`. The `handle_new_user` trigger passes `display_name` and `role` via `user_metadata` but not email itself (email is a top-level field on auth.users).
   - What's unclear: Should we add an `email` column to `profiles` (simple query but data duplication) or fetch emails via Edge Function calling `auth.admin.listUsers()` (no duplication but requires Edge Function for listing)?
   - Recommendation: **Add an `email` column to the `profiles` table** via a small migration. The `handle_new_user` trigger already has access to `new.email` from auth.users and can populate it. This keeps the account list query simple (single table, RLS-enforced) and avoids needing an Edge Function just to list accounts. The duplication is minimal and email changes are rare in this context (admin-managed accounts).

2. **Auth state/profile store dependency from Phase 12**
   - What we know: Phase 12 will create auth session management. The account management page needs to know the current user's role.
   - What's unclear: Whether Phase 12 will use a Zustand store, React context, or direct Supabase SDK calls for auth state.
   - Recommendation: The planner should assume Phase 12 provides a way to access the current user's profile (including role). If it uses Zustand, import the store. If not, create a `useProfile` hook that queries the profiles table for the current user.

3. **Single vs. multiple Edge Functions**
   - What we know: Three operations need Edge Functions: create user, update user (ban/unban), list users (if email enrichment is needed via admin API).
   - What's unclear: Whether to consolidate into one `admin-accounts` function with action routing or keep separate functions.
   - Recommendation: **Separate functions** (one per operation). Each is independently deployable, testable, and follows Supabase's recommended pattern. A single `admin-accounts` function would require internal routing logic that adds complexity.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vite.config.ts` (test section) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ACCT-01 | Admin can create specialist account via Edge Function | unit | `npx vitest run src/tests/admin-api.test.ts -t "create"` | No -- Wave 0 |
| ACCT-02 | Admin can view list of all accounts with roles | unit | `npx vitest run src/tests/account-management.test.tsx -t "list"` | No -- Wave 0 |
| ACCT-03 | Admin can deactivate/reactivate specialist account | unit | `npx vitest run src/tests/admin-api.test.ts -t "deactivate"` | No -- Wave 0 |
| ACCT-04 | Account management page inaccessible to specialists | unit | `npx vitest run src/tests/admin-route-guard.test.tsx -t "specialist"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/tests/admin-api.test.ts` -- covers ACCT-01, ACCT-03 (mock `supabase.functions.invoke` and profile queries)
- [ ] `src/tests/account-management.test.tsx` -- covers ACCT-02 (render account list with mock profile data)
- [ ] `src/tests/admin-route-guard.test.tsx` -- covers ACCT-04 (guard redirects non-admin, renders for admin)
- [ ] Edge Function unit tests (Deno test runner) -- optional, lower priority since Edge Functions are thin wrappers around Supabase Admin API

## Sources

### Primary (HIGH confidence)
- [Supabase auth.admin.createUser docs](https://supabase.com/docs/reference/javascript/auth-admin-createuser) -- createUser API signature, parameters, email_confirm option
- [Supabase auth.admin.updateUserById docs](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid) -- ban_duration parameter for deactivation ('876000h' to ban, 'none' to unban)
- [Supabase auth.admin.listUsers docs](https://supabase.com/docs/reference/javascript/auth-admin-listusers) -- pagination (page/perPage), returns User[] objects
- [Supabase Admin API overview](https://supabase.com/docs/reference/javascript/admin-api) -- service_role client initialization pattern
- [Supabase Edge Functions quickstart](https://supabase.com/docs/guides/functions/quickstart) -- Deno.serve pattern, file structure, deployment
- [Supabase Edge Functions CORS](https://supabase.com/docs/guides/functions/cors) -- corsHeaders pattern, OPTIONS preflight handling
- [Supabase Edge Functions environment variables](https://supabase.com/docs/guides/functions/secrets) -- SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY auto-injected
- [Supabase Edge Functions auth](https://supabase.com/docs/guides/functions/auth) -- JWT verification pattern in Edge Functions
- Existing project SQL: `supabase/migrations/20260318000004_helper_functions.sql` -- `handle_new_user` trigger reads `user_metadata` for display_name and role
- Existing project SQL: `supabase/migrations/20260318000005_rls_policies.sql` -- "Admins can view all profiles" and "Admins can update profiles" policies

### Secondary (MEDIUM confidence)
- [Supabase GitHub Discussion #9239](https://github.com/orgs/supabase/discussions/9239) -- ban_duration best practice for deactivation
- [Supabase GitHub Discussion #26771](https://github.com/orgs/supabase/discussions/26771) -- is_active + ban_duration dual approach

### Tertiary (LOW confidence)
- None -- all findings verified with official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project; Supabase Admin API is well-documented
- Architecture: HIGH -- Edge Functions pattern is official Supabase recommendation; RLS policies already exist
- Pitfalls: HIGH -- CORS, email storage, self-deactivation are well-documented issues in Supabase ecosystem

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable APIs, no breaking changes expected)
