# Phase 16: Session Lifecycle - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Sessions flow through a defined lifecycle: specialist submits completed work → admin reviews and either edits/exports or returns with notes → specialist fixes and re-submits. This phase adds the Submit action, read-only lock for submitted sessions, admin review workflow, return-with-notes flow, and admin-only export gating. Session assignment (Phase 15) is a prerequisite — this phase does NOT cover assigning sessions to specialists.

</domain>

<decisions>
## Implementation Decisions

### Submit action
- **Location**: "Submit for Review" button in the SessionDetail **header**, visible only to specialist role when session is `active`
- **Pre-submit gate**: Block submission if any items have `ai_status = 'queued'` — show message "X items are still processing — wait before submitting"
- **Confirmation**: `ConfirmDialog` before submitting — "Spring Sale 2026 will be locked for editing until returned or approved by admin." `[Cancel]` / `[Submit]`
- **Post-submit**: Stay on SessionDetail; show "Submitted — awaiting review" status banner at top; Submit button disappears; item fields become read-only for specialist

### Submitted session lock (specialist)
- Submitted sessions are **fully read-only** for specialists — no editing items, no adding items, no re-recording
- Specialist can still view the session, scroll items, and play back audio
- The SessionDetail page detects `status === 'submitted'` for specialist role and disables all editing interactions (`EditableField`, `RecordButton`, `+ Add Item`)

### Admin review interface
- Sessions page shows a dedicated **"Awaiting Review"** section at the top for admin role — lists all sessions with `status = 'submitted'`
- Admin opens a submitted session → standard SessionDetail page; item fields are **always editable for admin** (no toggle, no mode switch needed — role determines editability)
- **Export button** in SessionDetail header, **admin-only** — hidden entirely from specialist view; clicking export triggers download and marks session `status = 'exported'`
- Admin can also **"Return to Specialist"** button in the header when session is `submitted`

### Return flow
- Admin taps "Return to Specialist" → **modal with textarea** appears for review notes
- Review notes are **optional** — admin can return without notes if desired
- On confirm: session `status` changes to `'returned'`, `review_notes` field saved to Supabase
- **Specialist view of returned session**: a visually distinct **pinned banner** at the top of SessionDetail showing the review notes (e.g., "Returned by Admin — Please re-record item 7 — description is unclear")
- Banner stays pinned while specialist scrolls through items; it is cleared/dismissed only when specialist re-submits
- Returned sessions are **unlocked** for the specialist — all editing and recording restored

### Sessions list grouping

**Specialist view (Sessions page sections, in order):**
1. **Needs Attention** — `status = 'returned'` (sessions sent back by admin; surfaced first for urgency)
2. **Active** — `status = 'active'`
3. **Submitted** — `status = 'submitted'` (locked, awaiting admin review)
4. **Exported** — `status = 'exported'`

**Admin view (Sessions page sections, in order):**
1. **Awaiting Review** — `status = 'submitted'` (primary work queue)
2. **Active** — `status = 'active'` (all specialists' active sessions)
3. **Returned** — `status = 'returned'` (sent back, waiting for specialist fix)
4. **Exported** — `status = 'exported'`

### SessionCard status display
- Status pill shown on cards **only when not `active`** (active is the default state — no badge needed for it)
- Pill text: "Submitted", "Returned", "Exported"
- Assignee name shown on all session cards **in admin view** (Phase 15 adds the assignee field)
- "Returned" cards get a visual indicator of urgency (e.g., warning color or icon) in the "Needs Attention" section

### Export gating (LIFE-06)
- Export button **hidden entirely** from specialist UI — not disabled, not grayed out — simply not rendered
- Export is only present in admin's SessionDetail header view
- Exporting marks session `status = 'exported'`; this moves it out of "Awaiting Review" into the "Exported" section

### Claude's Discretion
- Exact visual styling of the "Submitted — awaiting review" status banner (color, icon, wording)
- Exact visual styling of the pinned "Returned by Admin" review notes banner (color, icon)
- Status pill colors (e.g., orange for submitted, red/amber for returned, green for exported)
- How `EditableField` and `RecordButton` visually communicate read-only state to specialist on submitted sessions
- Whether the "Needs Attention" section header is a distinct color/icon to draw the eye
- Empty state messages for each section when no sessions exist in that status

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §v1.1 Session Lifecycle — LIFE-01 through LIFE-06 (submit, lock, admin edit, return with notes, returned view, export gating)

### Phase scope & success criteria
- `.planning/ROADMAP.md` — Phase 16 goal and 5 success criteria

### Schema reference
- `src/db/database.types.ts` — sessions table: `status` (string — values: 'active' | 'submitted' | 'returned' | 'exported'), `review_notes` (string | null), `assigned_to` (uuid | null)
- `.planning/phases/11-supabase-foundation/11-CONTEXT.md` — Postgres schema, RLS policies (admin reads all; specialist reads assigned/created by them)

### Data layer (Phase 14 target)
- `.planning/phases/14-data-migration/14-CONTEXT.md` — Zustand session store, Supabase CRUD patterns, offline write-ahead queue. Phase 16 will call `updateSession({ status: 'submitted', ... })` through this layer.

### Existing components to adapt
- `src/pages/SessionDetail.tsx` — SessionDetail page; export button lives here; must be role-gated and status-aware
- `src/pages/Sessions.tsx` — Sessions list page; sections must be restructured for lifecycle statuses
- `src/components/SessionCard.tsx` — SessionCard; must accept and display status pill and assignee name
- `src/components/EditableField.tsx` — Must respect read-only state when session is submitted + role is specialist
- `src/components/ConfirmDialog.tsx` — Reuse for Submit confirmation and Return modal (or extend for textarea)
- `src/stores/authStore.ts` — Provides `user.id` and role for permission checks in all lifecycle UI

### Prior phase patterns
- `.planning/phases/12-authentication/12-CONTEXT.md` — AdminRouteGuard, role checks, Settings page section pattern
- `.planning/phases/13-account-management/13-CONTEXT.md` — ConfirmDialog for destructive actions, inline action button patterns, role-based rendering

No external ADRs or design docs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ConfirmDialog.tsx`: Existing dialog with `destructive` prop — reuse for Submit confirmation; may need to extend with a `textarea` slot for the Return modal (or create a separate `ReturnDialog` component)
- `src/components/EditableField.tsx`: Inline editing component — must be passed a `readOnly` prop or derive read-only from context (session status + role)
- `src/components/AdminRouteGuard.tsx`: Pattern for role-based rendering/routing — same logic needed for export button and edit permissions in SessionDetail
- `src/components/RecordButton.tsx`: Must be hidden or disabled when session is submitted (specialist view)
- `src/components/SessionCard.tsx`: Needs new props: `statusBadge?: string` and `assigneeName?: string` for admin view

### Established Patterns
- **Section headers**: `text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3` — reuse for new lifecycle status sections
- **Card/row containers**: `bg-gray-50 dark:bg-gray-800 rounded-lg p-4`
- **Status/role-based rendering**: `authStore` provides role; compare `session.status + role` to determine edit/submit/export visibility
- **ConfirmDialog destructive variant**: Used in Phase 13 for deactivation — reuse for Submit (semi-destructive: locks the session)
- **Banner/callout pattern**: No existing pinned banner pattern yet — the "Returned by Admin" note banner will be a new pattern; should be visually consistent with the app's existing warning indicators (`text-amber-600`, `bg-amber-50`)

### Integration Points
- `src/pages/Sessions.tsx` → restructure sections from (Active / Completed / Archived) to role-aware lifecycle sections
- `src/pages/SessionDetail.tsx` → add Submit button (specialist), Return button + Export button (admin), read-only mode, review notes banner
- `src/stores/authStore.ts` → role check (`isAdmin`) consumed by SessionDetail and Sessions for conditional rendering
- Supabase `sessions` table → `UPDATE sessions SET status = 'submitted'` / `'returned'` / `'exported'`, `review_notes` write

</code_context>

<specifics>
## Specific Ideas

- The "Needs Attention" section (returned sessions for specialist) should feel urgent — draw the eye more than "Active". Amber or warning color treatment consistent with the app's existing warning patterns.
- The pinned "Returned by Admin" banner should stay visible while scrolling through items — so specialist knows what to fix while reviewing each item. Not a toast — it stays.
- Status pills on SessionCard should only appear for non-active statuses — active is the normal state and doesn't need a label.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 16-session-lifecycle*
*Context gathered: 2026-03-17*
