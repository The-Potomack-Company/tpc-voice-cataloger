# Phase 15: Session Assignment - Research

**Researched:** 2026-03-18
**Domain:** Role-aware session CRUD, Supabase RLS, admin/specialist UI branching
**Confidence:** HIGH

## Summary

Phase 15 adds assignment and role-aware visibility to the existing sessions system. The Supabase schema already has `sessions.assigned_to` (nullable uuid FK), `sessions.created_by` (uuid FK), and `sessions.status` (active|submitted|returned|exported). RLS policies already enforce admin-sees-all and specialist-sees-own-or-assigned scoping. The `profiles` table provides display names and roles, and `adminApi.listAccounts()` already returns the account list needed for assignment dropdowns.

The work is entirely UI-layer: (1) add a specialist picker to `NewSession.tsx` for admin users, (2) make `Sessions.tsx` role-aware with specialist-grouped collapsible sections for admins, (3) extend `SessionCard.tsx` with assignee name and status badge props for admin view, (4) add an inline editable assignee field to `SessionDetail.tsx` for admin reassignment. No new database migrations, no new Edge Functions, and no new RLS policies are needed -- all server-side infrastructure is already in place from Phase 11/13.

**Primary recommendation:** Treat this as a pure front-end phase. Fetch active accounts from `listAccounts()` for the dropdown, use the auth store + profiles query to detect admin role, and branch UI rendering conditionally. All Supabase queries (session create with `assigned_to`, session update for reassignment) work within existing RLS policies.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Assigning a specialist is **required** -- admin cannot create a session without picking an assignee
- Picker is a native HTML **dropdown (select)** populated with display names of all active accounts (admin + specialists)
- Admin can assign to themselves -- they appear in the dropdown alongside specialists
- Specialist-created sessions are **auto-assigned to themselves** (`assigned_to = created_by`) -- no picker shown to specialists
- **Same Sessions.tsx**, made role-aware -- no separate admin route needed
- Admin sees all sessions across all users; specialist sees only their scoped sessions (RLS enforces this server-side)
- Admin view retains the 3-section structure: **Active / Completed / Archived**
- Within each section, sessions are **grouped by specialist** with a collapsible specialist-name header
- Specialist groups are **expanded by default** (same toggle behavior as existing Completed/Archived sections)
- `SessionCard` extended for admin view: shows **assignee name** (e.g., "Assigned to Sarah") and a **status badge** (Active / Submitted / Returned / Exported) alongside existing name, item count, and relative time
- Specialist sees Active / Completed / Archived sections with **no distinction** between assigned-to-me and self-created sessions -- one merged list per section
- RLS handles scoping server-side; UI doesn't need to explain the source
- Specialist session cards look **identical to today** -- no new fields, no assignee or status info
- Admin can reassign from the **session detail page** -- not from the list
- Shown as an **inline editable field** ("Assigned to: Sarah") -- tapping opens a dropdown to pick a different active specialist or admin
- Updates **apply immediately** -- no confirmation dialog (reassignment is low-risk and easily reversible)
- Only admin sees the assignee field on the detail page; specialist view does not show it

### Claude's Discretion
- Exact visual styling of the specialist-group collapsible header in the admin session list
- Status badge colors (e.g., blue for Active, yellow for Submitted, orange for Returned, green for Exported)
- Where the assignee name appears on SessionCard (below the session name, or inline with the item count row)
- How the specialist list is fetched for the dropdown (reuse listAccounts from adminApi or a lighter query)
- Loading state while the specialist list loads in the New Session form

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ASGN-01 | Admin can assign a session to a specialist when creating it | NewSession.tsx gets a required `<select>` dropdown populated from `listAccounts()`. Admin user detected via profiles query. `createSession` call includes `assigned_to` UUID. Specialist auto-assigns `assigned_to = created_by`. |
| ASGN-02 | Specialist sees only sessions assigned to them and sessions they created | RLS already enforces this (`created_by = auth.uid() OR assigned_to = auth.uid()`). Sessions.tsx specialist view uses the same data hooks with no additional filtering needed. |
| ASGN-03 | Admin can reassign an active session to a different specialist | SessionDetail.tsx gets an inline editable assignee field (admin-only). Tapping opens dropdown, selecting a different user calls `supabase.from('sessions').update({ assigned_to: newId })`. No confirmation needed. |
| ASGN-04 | Admin can view all sessions with assignee names and status | Sessions.tsx admin view fetches all sessions (RLS returns all for admin). Sessions joined with profiles to get assignee display names. SessionCard extended with `assigneeName` and `showStatus` props. Admin view groups sessions by specialist within each status section. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.99.2 | Database queries, RLS-enforced access | Already installed; typed client singleton at `src/lib/supabase.ts` |
| React | ^19.2.0 | UI components | Already installed; project framework |
| react-router | (installed) | Routing, navigation | Already used for all page routes |
| Zustand | ^5.0.11 | State management | Already used for auth store and UI store |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | ^4.0.18 | Testing | Already configured in vite.config.ts; use for all new tests |
| @testing-library/react | (installed) | Component testing | Already used for component tests in src/tests/ |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `<select>` | Headless UI Listbox / Radix Select | Decision is locked: native HTML select. Simpler, no dependency, sufficient for 2-5 users |
| AdminApi listAccounts | Lighter profiles query | listAccounts is already built and cached; a separate lighter query saves one Edge Function call but adds complexity. Recommend reusing listAccounts |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  pages/
    Sessions.tsx          # Extended with admin role-aware branching
    NewSession.tsx         # Extended with specialist dropdown (admin-only)
    SessionDetail.tsx      # Extended with assignee field (admin-only)
  components/
    SessionCard.tsx        # Extended with assigneeName + status badge props
    AssigneeSelect.tsx     # NEW: reusable specialist dropdown component
  hooks/
    useUserRole.ts         # NEW: hook returning { role, isAdmin, loading }
  services/
    adminApi.ts            # Existing: reuse listAccounts()
```

### Pattern 1: Role Detection via Profiles Query
**What:** Hook that queries `profiles` table for the current user's role, caching the result
**When to use:** Any component that needs to branch on admin vs specialist
**Example:**
```typescript
// src/hooks/useUserRole.ts
import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'

export function useUserRole() {
  const user = useAuthStore((s) => s.user)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setRole(data?.role ?? null)
        setLoading(false)
      })
  }, [user])

  return { role, isAdmin: role === 'admin', loading }
}
```
**Note:** This follows the exact same pattern already used in `AdminRouteGuard.tsx` (lines 7-25). Extract to a reusable hook so Sessions.tsx, NewSession.tsx, and SessionDetail.tsx can all use it without duplicating the profiles query.

### Pattern 2: Specialist-Grouped Collapsible Sections (Admin Session List)
**What:** Within each status section (Active/Completed/Archived), group sessions by `assigned_to` and render a collapsible header per specialist
**When to use:** Admin view of Sessions.tsx only
**Example:**
```typescript
// Group sessions by assignee
function groupByAssignee(sessions: SessionWithAssignee[]): Map<string, SessionWithAssignee[]> {
  const groups = new Map<string, SessionWithAssignee[]>()
  for (const session of sessions) {
    const key = session.assigned_to ?? 'unassigned'
    const group = groups.get(key) ?? []
    group.push(session)
    groups.set(key, group)
  }
  return groups
}

// Collapsible specialist header -- same chevron pattern as Completed/Archived toggles
function SpecialistGroup({ name, sessions, defaultExpanded = true }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  return (
    <div>
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 mb-3">
        <svg className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? 'rotate-90' : ''}`}
             fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {name} ({sessions.length})
        </h3>
      </button>
      {expanded && <div className="space-y-3">{/* render session cards */}</div>}
    </div>
  )
}
```

### Pattern 3: Admin Session Query with Assignee Name Join
**What:** Fetch all sessions with joined assignee display name in a single query
**When to use:** Admin session list rendering
**Example:**
```typescript
// Supabase query joining profiles for assignee name
const { data } = await supabase
  .from('sessions')
  .select(`
    *,
    assignee:profiles!sessions_assigned_to_fkey(display_name)
  `)
  .order('updated_at', { ascending: false })

// data[n].assignee?.display_name gives the assignee's name
```
**Important:** The FK relationship `sessions.assigned_to -> auth.users` does not go through profiles directly. However, since `profiles.id` mirrors `auth.users.id`, we can use a manual join or rely on the Supabase foreign key naming. Alternatively, use a simpler approach: fetch sessions + fetch profiles separately and join client-side. Given 2-5 users, this is trivially efficient.

### Pattern 4: Inline Editable Dropdown for Reassignment
**What:** Tap-to-edit field that switches from text display to `<select>` dropdown
**When to use:** SessionDetail.tsx assignee field (admin-only)
**Example:**
```typescript
// Similar to EditableField.tsx but renders <select> instead of <input>
function AssigneeField({ currentAssigneeId, assigneeName, accounts, onReassign }) {
  const [editing, setEditing] = useState(false)

  if (!editing) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500 dark:text-gray-400">Assigned to</span>
        <span
          onClick={() => setEditing(true)}
          className="text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer
                     hover:text-accent"
        >
          {assigneeName}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500 dark:text-gray-400">Assigned to</span>
      <select
        value={currentAssigneeId}
        onChange={(e) => { onReassign(e.target.value); setEditing(false) }}
        onBlur={() => setEditing(false)}
        autoFocus
        className="text-sm rounded border border-gray-300 dark:border-gray-600
                   bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                   px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent"
      >
        {accounts.map(a => (
          <option key={a.id} value={a.id}>{a.display_name}</option>
        ))}
      </select>
    </div>
  )
}
```

### Anti-Patterns to Avoid
- **Separate admin routes for sessions:** Decision is locked -- same `Sessions.tsx` with role branching, not a separate `/admin/sessions` route
- **Client-side session filtering for specialists:** RLS already handles this server-side. Do not add client-side `filter(s => s.assigned_to === userId)` logic -- it is redundant and can mask RLS bugs
- **Storing role in Zustand/localStorage:** Query profiles on mount instead. The role is authoritative in Postgres, not in client state. AdminRouteGuard already follows this pattern.
- **Confirmation dialog for reassignment:** Decision is locked -- immediate update, no confirmation needed

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Specialist list for dropdown | Custom profiles query | `adminApi.listAccounts()` | Already built, returns Account[] with id, display_name, role, is_active. Filter for `is_active` on the client |
| Role-based access control | Client-side access checks | Supabase RLS policies | Already configured in `20260318000005_rls_policies.sql`. Server enforces; UI just branches visually |
| Session scoping for specialists | Manual WHERE clause in UI | Supabase RLS | `sessions` RLS policy already returns only `created_by` or `assigned_to` sessions for specialists |
| Admin detection | JWT parsing / custom middleware | Profiles table query | Same pattern as AdminRouteGuard -- query `profiles.role` for current user |
| Collapsible section UI | Custom accordion library | useState + chevron pattern | Already implemented in Sessions.tsx for Completed/Archived sections |

**Key insight:** Almost all the infrastructure needed (RLS, schema columns, admin API, collapsible sections, editable field pattern) already exists. This phase is an integration/extension effort, not a greenfield build.

## Common Pitfalls

### Pitfall 1: Supabase FK Join for assigned_to -> profiles
**What goes wrong:** The `sessions.assigned_to` FK references `auth.users`, not `profiles`. A Supabase `.select('*, assignee:profiles(display_name)')` requires PostgREST to know the FK relationship. Since `profiles.id = auth.users.id` but `sessions.assigned_to` references `auth.users.id`, PostgREST may not find the path automatically.
**Why it happens:** PostgREST auto-detects joins only through declared foreign keys. `sessions.assigned_to -> auth.users` is declared, but `sessions.assigned_to -> profiles` is not.
**How to avoid:** Either (a) add an explicit FK from `sessions.assigned_to` to `profiles.id` via a migration, or (b) fetch sessions and profiles separately and join client-side. Option (b) is simpler and works fine for the small data set (2-5 users). Option (a) is cleaner long-term but requires a migration.
**Warning signs:** PostgREST 400 errors with "Could not find a relationship between sessions and profiles" in the browser console.

### Pitfall 2: Specialist Creating Sessions Without assigned_to
**What goes wrong:** If the `createSession` call does not include `assigned_to`, sessions created by specialists will have `assigned_to = null`. The specialist can still see them (RLS checks `created_by`), but the admin's grouped-by-specialist view might show them in an "Unassigned" group.
**Why it happens:** The decision says specialist-created sessions auto-assign `assigned_to = created_by`, but the developer might forget to set this in the create flow.
**How to avoid:** In the specialist path of `NewSession.tsx`, explicitly set `assigned_to: user.id` when creating the session. Add a test that verifies this.
**Warning signs:** Sessions appearing in an "Unassigned" group in the admin view.

### Pitfall 3: listAccounts Returning Deactivated Users in Dropdown
**What goes wrong:** `listAccounts()` returns all accounts including deactivated ones. If the dropdown shows deactivated users, admin might assign sessions to someone who cannot log in.
**Why it happens:** `listAccounts()` does not filter by `is_active`.
**How to avoid:** Filter the accounts list client-side: `accounts.filter(a => a.is_active)` before rendering dropdown options. Keep deactivated accounts visible in the account management page but not in assignment dropdowns.
**Warning signs:** Deactivated specialist names appearing in the assignment picker.

### Pitfall 4: Race Condition When Fetching Role and Accounts Simultaneously
**What goes wrong:** Sessions.tsx needs the user's role to decide which view to render, and (if admin) also needs the accounts list for grouping. If role check and session fetch happen in parallel but role arrives late, the page might flash the specialist view before switching to admin.
**Why it happens:** The profiles query for role detection is async and takes a network round-trip.
**How to avoid:** Show a loading state until the role is resolved. Only then render the appropriate view. The `useUserRole` hook should return `{ loading: true }` initially.
**Warning signs:** Flicker/flash between specialist and admin session layouts on page load.

### Pitfall 5: Admin View Needs Assignee Display Names but Sessions Only Store UUIDs
**What goes wrong:** The session list shows sessions with `assigned_to` UUIDs, but the admin needs display names for grouping headers and card metadata.
**Why it happens:** Sessions table stores the UUID reference, not the name. Names must come from the profiles table.
**How to avoid:** Fetch the accounts/profiles list once (via `listAccounts()` or a profiles query) and create a `Map<string, string>` of `userId -> displayName`. Use this map when rendering session cards and group headers. This is more efficient than per-session joins for a small user base.
**Warning signs:** UUIDs appearing where names should be.

## Code Examples

### Fetching Active Accounts for Dropdown
```typescript
// Reuse existing adminApi
import { listAccounts, type Account } from '../services/adminApi'

// In component:
const [accounts, setAccounts] = useState<Account[]>([])
useEffect(() => {
  listAccounts().then(data => {
    setAccounts(data.filter(a => a.is_active))
  })
}, [])
```

### Creating Session with Assignment (Admin)
```typescript
// Admin creates session -- assigned_to comes from dropdown selection
const { data, error } = await supabase
  .from('sessions')
  .insert({
    name: name.trim(),
    mode,
    notes: notes.trim(),
    created_by: user.id,
    assigned_to: selectedSpecialistId, // from dropdown
  })
  .select()
  .single()
```

### Creating Session with Auto-Assignment (Specialist)
```typescript
// Specialist creates session -- auto-assign to self
const { data, error } = await supabase
  .from('sessions')
  .insert({
    name: name.trim(),
    mode,
    notes: notes.trim(),
    created_by: user.id,
    assigned_to: user.id, // auto-assign to self
  })
  .select()
  .single()
```

### Fetching All Sessions with Assignee Names (Admin View)
```typescript
// Fetch all sessions (RLS returns all for admin)
const { data: sessions } = await supabase
  .from('sessions')
  .select('*')
  .order('updated_at', { ascending: false })

// Fetch profiles for name mapping
const { data: profiles } = await supabase
  .from('profiles')
  .select('id, display_name')

// Build lookup map
const nameMap = new Map(profiles?.map(p => [p.id, p.display_name]) ?? [])

// Use in rendering:
// nameMap.get(session.assigned_to) -> "Sarah"
```

### Reassigning a Session (Admin)
```typescript
// Immediate update, no confirmation dialog
async function reassignSession(sessionId: string, newAssigneeId: string) {
  const { error } = await supabase
    .from('sessions')
    .update({ assigned_to: newAssigneeId, updated_at: new Date().toISOString() })
    .eq('id', sessionId)

  if (error) throw error
}
```

### Status Badge Colors (Recommendation for Claude's Discretion)
```typescript
const statusColors: Record<string, string> = {
  active: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  submitted: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  returned: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  exported: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dexie sessions with auto-increment IDs | Supabase sessions with UUID PKs | Phase 11 (schema), Phase 14 (migration) | Session IDs are strings/UUIDs, not numbers. `NewSession.tsx` and `SessionDetail.tsx` must use string IDs |
| No `assigned_to` column | `assigned_to uuid nullable` on sessions | Phase 11 schema | Column exists but is unused until this phase |
| Single-user session view | Role-aware session view | This phase (15) | Sessions.tsx must branch on admin vs specialist |
| `useLiveQuery` (Dexie) for reactivity | Zustand store + Supabase fetch | Phase 14 data migration | Phase 14 rewrites the hooks; Phase 15 builds on whatever Phase 14 delivers |

**Important dependency note:** This phase depends on Phase 14 (data migration) completing the rewrite of session data access from Dexie to Supabase. The current codebase still uses Dexie (`useLiveQuery`, integer IDs, `db.sessions` calls). Phase 14 will replace these with Supabase queries and Zustand stores. Phase 15 planning must account for the Phase 14 API surface, not the current Dexie-based API.

**Deprecated/outdated:**
- `db/sessions.ts` Dexie CRUD functions: Will be replaced by Phase 14 Supabase equivalents
- `hooks/useSessions.ts` Dexie `useLiveQuery` hooks: Will be replaced by Phase 14 Zustand selectors
- `db/types.ts` Session interface with `id?: number`: Will be replaced by Supabase-typed Session with `id: string`

## Open Questions

1. **Phase 14 API Surface**
   - What we know: Phase 14 will rewrite session CRUD to use Supabase and Zustand stores
   - What's unclear: The exact function signatures, hook names, and store shape after Phase 14 completes
   - Recommendation: Plan Phase 15 tasks to reference the *conceptual* operations (create session, list sessions, update session). Implementation will adapt to whatever API Phase 14 delivers. If Phase 14 changes the `createSession` signature to accept `assigned_to`, great. If not, Phase 15 must add it.

2. **Supabase FK Join for assigned_to -> profiles**
   - What we know: `sessions.assigned_to` FK references `auth.users.id`, not `profiles.id`
   - What's unclear: Whether PostgREST can follow the implicit `auth.users.id = profiles.id` path
   - Recommendation: Use client-side join (fetch sessions + fetch profiles, build Map). Simple, guaranteed to work, and efficient for small user counts. If a migration to add `sessions.assigned_to -> profiles.id` FK is easy, that is also acceptable but not required.

3. **listAccounts vs Direct Profiles Query for Specialist Dropdown**
   - What we know: `listAccounts()` calls an Edge Function that queries both `auth.users` and `profiles`
   - What's unclear: Whether this is heavier than needed (it also returns email, which the dropdown doesn't need)
   - Recommendation: Reuse `listAccounts()`. The overhead is negligible for 2-5 users, and it avoids creating a second query path. Filter `is_active` client-side.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vite.config.ts` (test section at line 61) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ASGN-01 | Admin sees specialist dropdown on NewSession; specialist does not; session created with assigned_to | unit | `npx vitest run src/tests/new-session-assignment.test.tsx -x` | Wave 0 |
| ASGN-02 | Specialist view shows sessions without assignee/status extras; data scoping verified via mock | unit | `npx vitest run src/tests/sessions-specialist-view.test.tsx -x` | Wave 0 |
| ASGN-03 | Admin can reassign from session detail; update call includes new assigned_to | unit | `npx vitest run src/tests/session-reassignment.test.tsx -x` | Wave 0 |
| ASGN-04 | Admin session list groups by specialist, shows assignee name + status badge | unit | `npx vitest run src/tests/sessions-admin-view.test.tsx -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/tests/new-session-assignment.test.tsx` -- covers ASGN-01 (admin dropdown, specialist auto-assign)
- [ ] `src/tests/sessions-specialist-view.test.tsx` -- covers ASGN-02 (specialist scoped view, no extras)
- [ ] `src/tests/session-reassignment.test.tsx` -- covers ASGN-03 (inline reassignment on detail page)
- [ ] `src/tests/sessions-admin-view.test.tsx` -- covers ASGN-04 (grouped by specialist, assignee name, status badge)

## Sources

### Primary (HIGH confidence)
- `src/services/adminApi.ts` -- existing Account interface and listAccounts function
- `supabase/migrations/20260318000001_create_sessions.sql` -- sessions table schema with assigned_to column
- `supabase/migrations/20260318000005_rls_policies.sql` -- existing RLS policies for role-based access
- `supabase/migrations/20260318000004_helper_functions.sql` -- is_admin() and is_active_user() helper functions
- `src/db/database.types.ts` -- generated Supabase types confirming sessions.assigned_to and profiles schema
- `src/components/AdminRouteGuard.tsx` -- established pattern for role detection via profiles query
- `src/components/EditableField.tsx` -- established tap-to-edit inline pattern
- `src/pages/Sessions.tsx` -- current collapsible section pattern (Completed/Archived)
- `src/components/SessionCard.tsx` -- current card props and badge rendering pattern

### Secondary (MEDIUM confidence)
- `.planning/phases/14-data-migration/14-CONTEXT.md` -- Phase 14 decisions on Zustand store, write-ahead queue, and Supabase data access rewrite (not yet implemented; plan must adapt)

### Tertiary (LOW confidence)
- PostgREST auto-join behavior for `sessions.assigned_to -> profiles` (FK goes through `auth.users`, not directly to profiles; needs verification at implementation time)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed and in use
- Architecture: HIGH - patterns directly observed in existing codebase (AdminRouteGuard, collapsible sections, EditableField, listAccounts)
- Pitfalls: HIGH - identified from direct code inspection (FK relationship, null assigned_to, deactivated users in dropdown)
- Phase 14 dependency: MEDIUM - Phase 14 context doc provides decisions but implementation not yet complete; Phase 15 must adapt

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable -- no external library changes expected; internal Phase 14 completion is the main variable)
