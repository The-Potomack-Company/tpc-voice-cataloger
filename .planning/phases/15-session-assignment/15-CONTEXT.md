# Phase 15: Session Assignment - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin assigns sessions to specialists when creating them; specialists see only sessions assigned to them or created by themselves; admin can reassign active sessions; admin session list shows all sessions across users grouped by specialist with assignee name and status visible. Session submission, review, return, and export are Phase 16.

</domain>

<decisions>
## Implementation Decisions

### Assignment at creation
- Assigning a specialist is **required** — admin cannot create a session without picking an assignee
- Picker is a native HTML **dropdown (select)** populated with display names of all active accounts (admin + specialists)
- Admin can assign to themselves — they appear in the dropdown alongside specialists
- Specialist-created sessions are **auto-assigned to themselves** (`assigned_to = created_by`) — no picker shown to specialists

### Role-aware session list (Sessions page)
- **Same Sessions.tsx**, made role-aware — no separate admin route needed
- Admin sees all sessions across all users; specialist sees only their scoped sessions (RLS enforces this server-side)
- Admin view retains the 3-section structure: **Active / Completed / Archived**
- Within each section, sessions are **grouped by specialist** with a collapsible specialist-name header
- Specialist groups are **expanded by default** (same toggle behavior as existing Completed/Archived sections)

### Admin session card
- `SessionCard` extended for admin view: shows **assignee name** (e.g., "Assigned to Sarah") and a **status badge** (Active / Submitted / Returned / Exported) alongside existing name, item count, and relative time

### Specialist session view
- Specialist sees Active / Completed / Archived sections with **no distinction** between assigned-to-me and self-created sessions — one merged list per section
- RLS handles scoping server-side; UI doesn't need to explain the source
- Specialist session cards look **identical to today** — no new fields, no assignee or status info

### Reassignment
- Admin can reassign from the **session detail page** — not from the list
- Shown as an **inline editable field** ("Assigned to: Sarah") — tapping opens a dropdown to pick a different active specialist or admin
- Updates **apply immediately** — no confirmation dialog (reassignment is low-risk and easily reversible)
- Only admin sees the assignee field on the detail page; specialist view does not show it

### Claude's Discretion
- Exact visual styling of the specialist-group collapsible header in the admin session list
- Status badge colors (e.g., blue for Active, yellow for Submitted, orange for Returned, green for Exported)
- Where the assignee name appears on SessionCard (below the session name, or inline with the item count row)
- How the specialist list is fetched for the dropdown (reuse listAccounts from adminApi or a lighter query)
- Loading state while the specialist list loads in the New Session form

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §v1.1 Session Assignment — ASGN-01 (admin assigns at creation), ASGN-02 (specialist scoped view), ASGN-03 (admin reassigns active sessions), ASGN-04 (admin sees all sessions with assignee + status)

### Phase scope & success criteria
- `.planning/ROADMAP.md` — Phase 15 goal and 4 success criteria

### Schema reference
- `.planning/phases/11-supabase-foundation/11-CONTEXT.md` — `sessions.assigned_to` (uuid, nullable), `sessions.created_by` (uuid), `sessions.status` ('active'|'submitted'|'returned'|'exported'), `profiles` table (id, display_name, role, is_active)
- `src/db/database.types.ts` — Generated Supabase types for sessions and profiles tables

### Data layer (Phase 14 decisions)
- `.planning/phases/14-data-migration/14-CONTEXT.md` — Zustand session store, write-ahead queue for offline, sessions page hooks (useActiveSessions etc.)

### Admin API patterns (Phase 13)
- `.planning/phases/13-account-management/13-CONTEXT.md` — adminApi service layer (listAccounts), Edge Function pattern, inline expandable form, Settings Admin section
- `src/services/adminApi.ts` — Existing admin API with listAccounts (returns Account[] with id, display_name, email, role, is_active)

### Components to extend
- `src/pages/Sessions.tsx` — Current 3-section layout; add role-aware branching for admin vs specialist
- `src/components/SessionCard.tsx` — Add assignee name + status badge for admin view
- `src/pages/NewSession.tsx` — Add specialist dropdown (required, admin-only)
- `src/pages/SessionDetail.tsx` — Add inline assignee field (admin-only, tap-to-edit dropdown)

No external ADRs or design docs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/services/adminApi.ts` — `listAccounts()` returns `Account[]` with `id`, `display_name`, `role`, `is_active` — reuse to populate the specialist dropdown in NewSession and the reassignment picker in SessionDetail
- `src/stores/authStore.ts` — Provides current user role (`user.role` or profile query) for role-aware rendering; same check used by AdminRouteGuard
- `src/components/AdminRouteGuard.tsx` — Pattern for role checking; Sessions.tsx can use the same profile query to detect admin
- `src/components/EditableField.tsx` — Existing inline-editable field pattern; reassignment picker on SessionDetail should follow this tap-to-edit pattern
- `src/components/ConfirmDialog.tsx` — Available but NOT needed for reassignment (no confirm required per decisions)

### Established Patterns
- **Collapsible sections**: `completedExpanded` / `archivedExpanded` state in Sessions.tsx with chevron toggle — reuse for specialist group headers in admin view
- **Section headers**: `text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3`
- **Card metadata rows**: small text below session name (item count, relative time) — add assignee name + status badge in same row area
- **Status/role badges**: pill shape, `text-xs font-medium px-2 py-0.5 rounded-full` — apply for status badge on admin cards
- **Inline edit pattern**: tap row → input/select appears → save on change/blur — `EditableField.tsx` demonstrates this

### Integration Points
- `src/pages/Sessions.tsx` → branch on admin role: replace simple section lists with specialist-grouped, collapsible sections
- `src/components/SessionCard.tsx` → add optional `assigneeName?: string` and `showStatus?: boolean` props for admin view
- `src/pages/NewSession.tsx` → add `assignedTo` field (required for admin, skipped for specialist)
- `src/pages/SessionDetail.tsx` → add `AssigneeField` (admin-only) that renders the inline editable dropdown
- Supabase `createSession` call → include `assigned_to` UUID from picker selection

</code_context>

<specifics>
## Specific Ideas

- Specialist-group headers in the admin session list should feel like the existing Completed/Archived section toggles — same chevron pattern, same toggle behavior
- The "Assigned to: [name]" inline field on SessionDetail should visually match how the session name (already editable inline) appears — consistent tap-to-edit language

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 15-session-assignment*
*Context gathered: 2026-03-17*
