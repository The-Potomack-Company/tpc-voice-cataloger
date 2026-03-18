# Phase 13: Account Management - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can create, view, and deactivate/reactivate specialist accounts so that specialists exist before session assignment (Phase 15). This phase covers the Account Management UI page, account creation via Supabase Admin API, and the deactivation toggle. Session assignment, scoped session views, and session lifecycle are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Account creation method
- Admin creates specialist accounts using the **Supabase Admin API** (service role key) — not invite email
- Fields required at creation: display name, email, and a temporary password
- No forced password change on first login — specialist is expected to change it via Settings → Change Password (Phase 12 feature)
- Creation form is an **inline expandable form** on the Account Management page, triggered by a "+ Add Specialist" button at the top of the list (consistent with expandable row pattern from ItemCard and export history)

### Navigation placement
- Account Management page lives at `/admin/accounts`
- Accessible from **Settings page → "Admin" section** — a clearly labeled section (same visual style as About/Storage/Actions) that only renders for admin-role users
- Specialist-role users: the Admin section is not rendered in Settings and `/admin/accounts` is server-enforced inaccessible (RLS + route guard)

### Account list design
- Each account row shows: **display name** (primary text), **email** (secondary text), **role badge** (Admin/Specialist pill), **status badge** (Active/Deactivated)
- Actions are **inline buttons on the right side** of each row: "Deactivate" for active accounts, "Reactivate" for deactivated accounts (consistent with the delete/restore button pattern in Settings > Deleted Sessions)
- Admin's own account row is shown in the list (with Admin badge) but **has no deactivate button** — prevents self-lockout

### Deactivate / reactivate UX
- Deactivation is **reversible** — "Reactivate" button replaces "Deactivate" on deactivated rows
- **ConfirmDialog before deactivating** (deactivating blocks login — destructive); no confirmation before reactivating (harmless)
- When an account is deactivated, its sessions **stay as-is** — admin handles reassignment in Phase 15/16; no automatic session changes

### Claude's Discretion
- Supabase Admin API call architecture (edge function vs. server-side route vs. service role client in a secure context)
- Exact role badge and status badge visual styling (colors, size, pill shape)
- Error handling for account creation failures (duplicate email, weak password, etc.)
- Loading states during account creation and deactivation actions
- Empty state for the account list (if somehow no accounts exist)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §v1.1 Account Management — ACCT-01 (create accounts), ACCT-02 (view account list), ACCT-03 (deactivate), ACCT-04 (admin-only page)

### Phase scope & success criteria
- `.planning/ROADMAP.md` — Phase 13 goal and success criteria (4 items)

### Schema reference
- `.planning/phases/11-supabase-foundation/11-CONTEXT.md` — `profiles` table definition: `id` (uuid), `role` ('admin'|'specialist'), `display_name` (required), `is_active` (boolean), `created_at`. RLS policies check `profiles.role`.

### Auth patterns established
- `.planning/phases/12-authentication/12-CONTEXT.md` — Auth session management, Settings page structure (sections pattern), ConfirmDialog usage for destructive actions, expandable row pattern

No external ADRs or design docs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/pages/Settings.tsx`: Existing sections pattern (About/Storage/Deleted Sessions/Actions) — add "Admin" section at top or bottom using same `<section>` + `<h2>` header structure; only render for admin role
- `src/components/ConfirmDialog.tsx`: Already exists with `destructive` prop — reuse for deactivation confirmation
- `src/components/SessionCard.tsx` / `src/pages/Sessions.tsx`: Inline action button pattern with `text-red-600` destructive style and `text-accent` safe style — reuse for Deactivate/Reactivate buttons
- `src/layouts/AppLayout.tsx`: Route wrapper — `/admin/accounts` route should be inside AppLayout (has bottom nav) but guarded for admin role

### Established Patterns
- Section headers: `text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3`
- Card/row containers: `bg-gray-50 dark:bg-gray-800 rounded-lg p-4`
- Inline action buttons: `min-h-12 px-3 py-2 rounded-lg text-sm font-medium` with color variants
- Destructive actions: `text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700`
- Safe/primary actions: `text-accent hover:bg-accent/10`
- Dark mode: `dark:` prefix on all color utilities

### Integration Points
- `src/App.tsx` → add `/admin/accounts` route (inside AppLayout, guarded for admin role)
- `src/pages/Settings.tsx` → add "Admin" section with "Account Management" navigation row (admin role only)
- Supabase Admin API → requires service role key; must NOT be called from the client directly (key must stay server-side)

</code_context>

<specifics>
## Specific Ideas

- No specific UI references cited — open to standard approaches consistent with existing Settings page aesthetic
- The inline expandable form pattern for "+ Add Specialist" should feel like the export history expandable rows or ItemCard expand pattern — same visual language

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 13-account-management*
*Context gathered: 2026-03-17*
