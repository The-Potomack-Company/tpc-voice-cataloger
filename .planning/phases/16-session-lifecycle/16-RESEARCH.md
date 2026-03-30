# Phase 16: Session Lifecycle - Research

**Researched:** 2026-03-18
**Domain:** React UI lifecycle workflows, role-based UI rendering, Supabase status mutations, Zustand optimistic updates
**Confidence:** HIGH

## Summary

Phase 16 adds the session lifecycle workflow: specialist submits completed work, admin reviews (editing items or returning with notes), and admin-only export. The codebase is well-prepared for this phase -- the Postgres schema already supports all four statuses (`active`, `submitted`, `returned`, `exported`) and `review_notes`, the `EditableField` and `ItemCard` components already accept `readOnly` props, the `sessionStore` already has optimistic `updateSession`, and the `ConfirmDialog` is ready for reuse. The primary work is UI composition: wiring existing primitives together with role-aware logic.

The key technical challenge is establishing a reliable role-checking pattern. Currently, role detection is scattered -- `AdminRouteGuard` and `Settings` each independently query the `profiles` table. Phase 16 touches many components that need role context (SessionDetail header buttons, Sessions page sections, SessionCard badges, export visibility). A shared `useUserRole` hook (or adding role to the auth store) will eliminate duplication and prevent drift.

**Primary recommendation:** Create a `useUserRole` hook that caches the profile role, then use `session.status + userRole` as the compound key for all conditional rendering decisions across SessionDetail, Sessions, and SessionCard.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Submit action: "Submit for Review" button in SessionDetail header, visible only to specialist when session is `active`. Pre-submit gate blocks if any items have `ai_status = 'queued'`. ConfirmDialog before submitting. Post-submit stays on SessionDetail with status banner and read-only items.
- Submitted session lock: Fully read-only for specialists -- no editing, adding items, or re-recording. Can still view and play audio. Detect `status === 'submitted'` for specialist role and disable EditableField, RecordButton, + Add Item.
- Admin review interface: "Awaiting Review" section at top of Sessions page for admin. Admin opens submitted session and sees standard SessionDetail with always-editable fields. Export button admin-only in SessionDetail header. "Return to Specialist" button in header when submitted.
- Return flow: Modal with textarea for review notes (optional). On confirm: status changes to `'returned'`, review_notes saved. Specialist sees pinned banner with review notes at top of SessionDetail. Banner stays pinned while scrolling. Cleared on re-submit. Returned sessions are unlocked for specialist.
- Sessions list grouping -- Specialist: Needs Attention (returned), Active, Submitted, Exported. Admin: Awaiting Review (submitted), Active, Returned, Exported.
- SessionCard status display: Status pill only for non-active (Submitted, Returned, Exported). Assignee name on admin view cards. Returned cards get urgency indicator.
- Export gating: Export button hidden entirely from specialist UI. Admin-only in SessionDetail header. Export sets status to 'exported'.

### Claude's Discretion
- Exact visual styling of "Submitted -- awaiting review" status banner (color, icon, wording)
- Exact visual styling of pinned "Returned by Admin" review notes banner (color, icon)
- Status pill colors (e.g., orange for submitted, red/amber for returned, green for exported)
- How EditableField and RecordButton visually communicate read-only state to specialist on submitted sessions
- Whether "Needs Attention" section header uses distinct color/icon
- Empty state messages for each section when no sessions exist in that status

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LIFE-01 | Specialist can submit a completed session to admin for review | Submit button in SessionDetail header calls `updateSession(id, { status: 'submitted' })`. Pre-submit gate checks `ai_status = 'queued'` count. ConfirmDialog confirms. |
| LIFE-02 | Submitted sessions are locked for the specialist (read-only unless returned) | `readOnly` computed from `session.status === 'submitted' && role === 'specialist'`. Already-existing `readOnly` prop on EditableField, ItemCard, ItemList. Hide RecordButton mic icon and Add Item button. |
| LIFE-03 | Admin can edit item fields directly on submitted sessions | Admin role bypasses read-only: `readOnly = session.status === 'submitted' && role !== 'admin'`. EditableField stays editable for admin regardless of status. |
| LIFE-04 | Admin can return a submitted session to the specialist with review notes | ReturnDialog with textarea. Calls `updateSession(id, { status: 'returned', review_notes: text })`. |
| LIFE-05 | Returned sessions show review notes to the specialist | Pinned banner in SessionDetail reads `session.review_notes` when `status === 'returned'`. Sticky positioning via `sticky top-0 z-10`. |
| LIFE-06 | Only admin can export session data as JSON | Export button conditionally rendered: `{role === 'admin' && <ExportButton />}`. Specialist never sees export UI. Export sets `status = 'exported'`. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.2.0 | UI framework | Already installed, project standard |
| Zustand | ^5.0.11 | State management (sessionStore) | Already installed, optimistic update pattern established |
| @supabase/supabase-js | ^2.99.2 | Backend data layer | Already installed, sessions table has all lifecycle columns |
| Tailwind CSS | ^4.2.1 | Styling | Already installed, utility-first approach used throughout |
| react-router | ^7.13.1 | Routing | Already installed, used for session navigation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | ^4.0.18 | Testing | All unit tests for lifecycle logic |
| @testing-library/react | ^16.3.2 | Component testing | UI rendering tests |
| @testing-library/user-event | ^14.6.1 | Interaction testing | Button clicks, form submissions |

No new packages needed. This phase is purely UI composition using existing stack.

**Installation:**
```bash
# No new packages required
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  hooks/
    useUserRole.ts           # NEW: shared role hook (replaces ad-hoc profile queries)
  pages/
    Sessions.tsx             # MODIFY: role-aware lifecycle sections
    SessionDetail.tsx        # MODIFY: submit/return/export buttons, banners, read-only logic
  components/
    SessionCard.tsx          # MODIFY: status pills, assignee name
    ReturnDialog.tsx         # NEW: modal with textarea for return notes
    StatusBanner.tsx         # NEW: submitted/returned status banners for SessionDetail
    ConfirmDialog.tsx        # EXISTING: reuse for submit confirmation
    EditableField.tsx        # EXISTING: readOnly prop already works
    ItemCard.tsx             # EXISTING: readOnly prop already works
    ItemList.tsx             # EXISTING: readOnly prop already works
  stores/
    sessionStore.ts          # EXISTING: updateSession already supports status changes
```

### Pattern 1: useUserRole Hook
**What:** A shared hook that queries the user's role from the profiles table once and caches it.
**When to use:** Every component that needs role-based rendering decisions.
**Why:** Currently, `AdminRouteGuard` and `Settings` each independently query profiles. Phase 16 adds 3+ more consumers (SessionDetail, Sessions, SessionCard via parent). A shared hook eliminates N+1 queries and keeps logic DRY.
**Example:**
```typescript
// src/hooks/useUserRole.ts
import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';

export function useUserRole() {
  const user = useAuthStore((s) => s.user);
  const [role, setRole] = useState<'admin' | 'specialist' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setRole((data?.role as 'admin' | 'specialist') ?? null);
        setLoading(false);
      });
  }, [user]);

  return { role, isAdmin: role === 'admin', loading };
}
```

### Pattern 2: Compound Read-Only Derivation
**What:** Compute read-only state from `session.status + userRole` as a single derived value, then pass it through to all child components.
**When to use:** SessionDetail page, which passes readOnly to ItemList, ItemCard, EditableField.
**Example:**
```typescript
// In SessionDetail.tsx
const { role, isAdmin } = useUserRole();
const isSpecialist = role === 'specialist';

// Read-only logic: specialist on submitted session = locked
const isLifecycleLocked = isSpecialist && session.status === 'submitted';
// Existing read-only from completed/archived
const isReadOnly = isLifecycleLocked || isCompleted || isArchived;

// Admin can always edit, even on submitted sessions
// (isAdmin is never locked by status for editing purposes)
```

### Pattern 3: Role-Aware Section Rendering (Sessions Page)
**What:** Sessions page renders different section groupings based on role.
**When to use:** Sessions.tsx restructuring.
**Example:**
```typescript
// Specialist view sections
const needsAttention = sessions.filter(s => s.status === 'returned');
const active = sessions.filter(s => s.status === 'active');
const submitted = sessions.filter(s => s.status === 'submitted');
const exported = sessions.filter(s => s.status === 'exported');

// Admin view sections
const awaitingReview = sessions.filter(s => s.status === 'submitted');
const adminActive = sessions.filter(s => s.status === 'active');
const returned = sessions.filter(s => s.status === 'returned');
const adminExported = sessions.filter(s => s.status === 'exported');
```

### Pattern 4: Optimistic Status Transition
**What:** Use the existing `sessionStore.updateSession` for all status changes. It already does optimistic update + Supabase write + revert on error.
**When to use:** Submit, Return, Export actions.
**Example:**
```typescript
// Submit action
await updateSession(sessionId, { status: 'submitted' });

// Return action
await updateSession(sessionId, {
  status: 'returned',
  review_notes: reviewNotesText || null,
});

// Export action (after JSON download)
await updateSession(sessionId, { status: 'exported' });
```

### Anti-Patterns to Avoid
- **Role check in every component independently:** Do NOT query profiles table separately in SessionDetail, Sessions, SessionCard. Use the shared `useUserRole` hook once at the page level and pass role down via props or context.
- **Status string comparisons scattered everywhere:** Do NOT compare `session.status === 'submitted'` in 10 different places. Derive boolean flags once at the top of the component (`isSubmitted`, `isReturned`, etc.) and use those.
- **Mixing edit permissions between role and status:** The rule is simple -- admin can always edit items; specialist can edit only when status is `active` or `returned`. Do not create complex permission matrices; the compound `isReadOnly` derivation handles it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Optimistic status updates | Custom Supabase call + local state sync | `sessionStore.updateSession(id, { status: 'submitted' })` | Store already handles optimistic update, error revert, and Supabase write |
| Read-only form fields | Conditional CSS or event.preventDefault hacks | `EditableField` `readOnly` prop (already implemented) | Component already renders non-interactive text when readOnly=true |
| Swipe-to-delete disabled state | Custom touch handlers to prevent swipe | `SwipeableRow` `disabled` prop (already implemented) | ItemCard already passes `readOnly` as `disabled` to SwipeableRow |
| Confirmation modals | Custom overlay + form | Reuse `ConfirmDialog` for submit; new `ReturnDialog` extending the pattern | Consistent with Phase 13 destructive action confirmations |
| Portal rendering for modals | Manual DOM manipulation | `createPortal` (already used by ConfirmDialog) | ConfirmDialog pattern already handles z-index, backdrop, portal |

**Key insight:** This phase is almost entirely UI composition. The data layer (Supabase schema, Zustand store, RLS policies) already supports the full lifecycle. The work is wiring existing components together with role-aware conditional logic.

## Common Pitfalls

### Pitfall 1: Role Query Race Condition
**What goes wrong:** The `useUserRole` hook fires an async query. If SessionDetail renders before the role resolves, it might flash the wrong UI (e.g., briefly showing edit controls to a specialist on a submitted session before locking them).
**Why it happens:** Supabase profile query is async; first render has `role = null`.
**How to avoid:** Return a `loading` flag from `useUserRole`. Show a minimal skeleton/spinner while loading is true. Never derive permissions from `role = null` -- treat null as "not yet known" (locked, conservative default).
**Warning signs:** Flicker of edit controls on page load.

### Pitfall 2: Export Function Still Writing to Dexie
**What goes wrong:** The current `exportSession` in `src/utils/export.ts` reads items from Dexie and writes export history to Dexie. After Phase 14 (data migration), session/item data lives in Supabase.
**Why it happens:** Phase 14 is supposed to rewrite the export utility, but if it doesn't fully update `export.ts`, Phase 16's export will read stale Dexie data.
**How to avoid:** Verify that Phase 14 has updated `exportSession` to read from Supabase (via sessionStore or direct query) before building Phase 16 export. If not, Phase 16 must include this rewrite.
**Warning signs:** Export produces empty JSON or contains old local-only data.

### Pitfall 3: Submitted Status Not Blocking Item Creation
**What goes wrong:** Specialist on a submitted session can still call `createItem` through the store, even though UI buttons are hidden.
**Why it happens:** UI hides the Add Item button but doesn't guard the store action. Direct store calls (or stale UI) could bypass the visual lock.
**How to avoid:** The UI guard (hiding Add Item button) is the primary defense. RLS on the server allows item inserts for session owners/assignees regardless of status. For this team size (2-5 people), UI-level enforcement is sufficient. If stricter enforcement is needed, add a Postgres trigger or RLS policy condition on session status.
**Warning signs:** Items appearing in submitted sessions without admin involvement.

### Pitfall 4: Sessions Page Empty State per Section
**What goes wrong:** If "Awaiting Review" has 0 sessions, the section header renders with nothing below it, creating visual awkwardness.
**Why it happens:** Sections are always rendered regardless of content.
**How to avoid:** Only render a section if it has at least one session. Use `{awaitingReview.length > 0 && <section>...</section>}` pattern. This matches the current Sessions.tsx pattern where sections only render when arrays are non-empty.
**Warning signs:** Empty section headers with no cards below them.

### Pitfall 5: Review Notes Banner Scroll Behavior
**What goes wrong:** The "Returned by Admin" banner is supposed to stay pinned while the specialist scrolls through items. Using `position: fixed` would overlap the bottom tab bar or header. Using `position: sticky` requires careful parent overflow handling.
**Why it happens:** Sticky positioning doesn't work if any ancestor has `overflow: hidden` or `overflow: auto` on certain axes.
**How to avoid:** Use `sticky top-0 z-20` on the banner div, placed directly inside the main scrollable container (the page div). The current SessionDetail layout uses a single scrollable div with `pb-24` for the fixed bottom button -- the sticky banner should work within this structure. Test on iOS Safari where sticky behavior has historically been finicky.
**Warning signs:** Banner scrolls away on mobile instead of sticking.

### Pitfall 6: Stale Session Status After Status Change
**What goes wrong:** Specialist submits a session, but the Sessions page still shows it under "Active" because the session list wasn't refreshed.
**Why it happens:** The optimistic update in `sessionStore.updateSession` modifies the session in the store array. If the Sessions page reads from Zustand selectors that filter by status, they should pick up the change immediately. But if Sessions page has cached data from a stale fetch, the UI lags.
**How to avoid:** Ensure Sessions page reads from `useSessionStore((s) => s.sessions)` and filters client-side. The optimistic update in `updateSession` replaces the session object in the store array, so derived selectors automatically reflect the new status. Do NOT cache filtered results in component state.
**Warning signs:** Session appears in two sections or doesn't move after status change.

## Code Examples

### Submit Button (Specialist, Active Session)
```typescript
// In SessionDetail.tsx header area
{isSpecialist && session.status === 'active' && (
  <button
    onClick={() => {
      if (queuedCount > 0) {
        // Show message about queued items
        return;
      }
      setConfirmAction('submit');
    }}
    disabled={queuedCount > 0}
    className="min-h-12 rounded-lg bg-accent text-white font-medium px-6
               hover:opacity-90 transition-opacity
               disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {queuedCount > 0
      ? `${queuedCount} items still processing`
      : 'Submit for Review'}
  </button>
)}
```

### Submitted Status Banner
```typescript
// In SessionDetail.tsx, after header, before metadata
{session.status === 'submitted' && isSpecialist && (
  <div className="mb-6 flex items-center gap-3 rounded-lg
                  bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800
                  px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
    <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
    </svg>
    Submitted -- awaiting admin review
  </div>
)}
```

### Pinned Review Notes Banner (Returned Session)
```typescript
// In SessionDetail.tsx, after header -- sticky
{session.status === 'returned' && isSpecialist && session.review_notes && (
  <div className="sticky top-0 z-20 mb-6 rounded-lg
                  bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800
                  px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
    <div className="flex items-start gap-2">
      <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
      </svg>
      <div>
        <p className="font-semibold">Returned by Admin</p>
        <p className="mt-1">{session.review_notes}</p>
      </div>
    </div>
  </div>
)}
```

### Return Dialog (New Component)
```typescript
// src/components/ReturnDialog.tsx
import { useState } from 'react';
import { createPortal } from 'react-dom';

interface ReturnDialogProps {
  open: boolean;
  sessionName: string;
  onConfirm: (notes: string) => void;
  onCancel: () => void;
}

export function ReturnDialog({ open, sessionName, onConfirm, onCancel }: ReturnDialogProps) {
  const [notes, setNotes] = useState('');

  if (!open) return null;

  const handleConfirm = () => {
    onConfirm(notes);
    setNotes('');
  };

  const handleCancel = () => {
    setNotes('');
    onCancel();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Return to Specialist
        </h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Return "{sessionName}" with notes for the specialist.
        </p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Review notes (optional)"
          rows={3}
          className="mt-3 w-full rounded-lg border border-gray-200 dark:border-gray-700
                     bg-gray-50 dark:bg-gray-900 p-3 text-sm
                     text-gray-900 dark:text-gray-100
                     placeholder:text-gray-400 dark:placeholder:text-gray-500
                     focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent
                     resize-none"
        />
        <div className="mt-4 flex justify-end gap-3">
          <button type="button" onClick={handleCancel}
            className="min-h-12 rounded-lg px-4 py-3 text-gray-700 dark:text-gray-300">
            Cancel
          </button>
          <button type="button" onClick={handleConfirm}
            className="min-h-12 rounded-lg px-4 py-3 font-medium text-white bg-amber-600 hover:bg-amber-700">
            Return Session
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
```

### Status Pill on SessionCard
```typescript
// In SessionCard.tsx, within the badges area
{session.status !== 'active' && (
  <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
    session.status === 'submitted'
      ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
      : session.status === 'returned'
        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
        : session.status === 'exported'
          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
          : ''
  }`}>
    {session.status === 'submitted' ? 'Submitted'
      : session.status === 'returned' ? 'Returned'
      : session.status === 'exported' ? 'Exported'
      : ''}
  </span>
)}
```

### Admin Export with Status Update
```typescript
// In SessionDetail.tsx
const handleExport = async () => {
  setExporting(true);
  try {
    await exportSession(sessionId); // downloads JSON
    await updateSession(sessionId, { status: 'exported' });
  } catch (err) {
    console.error('Export failed:', err);
  } finally {
    setExporting(false);
  }
};

// Admin-only export button
{isAdmin && (
  <button onClick={handleExport} disabled={exporting}
    className="w-full min-h-12 rounded-lg border border-accent text-accent font-medium
               hover:bg-accent/10 transition-colors flex items-center justify-center gap-2
               disabled:opacity-50 disabled:cursor-not-allowed">
    {exporting ? 'Exporting...' : 'Export Session'}
  </button>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Session status: 'active' / 'completed' | Session status: 'active' / 'submitted' / 'returned' / 'exported' | Phase 11 (schema), Phase 14 (types) | Four lifecycle states replace the two-state model |
| All users see export button | Admin-only export | Phase 16 | Export gated by role, not just available to everyone |
| Dexie-based data | Supabase-based data via sessionStore | Phase 14 | All status mutations go through sessionStore.updateSession |
| No role-based UI | Role determines editability and visibility | Phase 12/13 introduced auth, Phase 16 uses it heavily | Every UI element in SessionDetail is now conditionally rendered |

**Deprecated/outdated:**
- `session.status === 'completed'`: The `completed` status from v1.0 Dexie schema is replaced by the lifecycle flow. Phase 14 should handle any existing `completed` sessions (likely converting them or removing the concept). Phase 16 does not use `completed` at all.
- `session.archivedAt` / soft delete patterns: The v1.0 archive/delete flow may need revisiting. Archiving is orthogonal to the lifecycle flow. For Phase 16, the archive/unarchive buttons and deleted sessions may coexist but should be secondary to the lifecycle sections.

## Open Questions

1. **Phase 14 completion state**
   - What we know: Phase 14 rewrites the data access layer to use Supabase/Zustand. Phase 16 depends on this being complete.
   - What's unclear: The exact state of `exportSession` after Phase 14 -- does it read from Supabase or still from Dexie?
   - Recommendation: Phase 16 planning should verify Phase 14's export rewrite. If export still reads from Dexie, Phase 16 must include a task to update it.

2. **Phase 15 Sessions page structure**
   - What we know: Phase 15 adds session assignment UI including assignee names on cards and possibly restructured sessions grouping for admin.
   - What's unclear: The exact structure of Sessions.tsx after Phase 15 -- will it already have role-aware sections or still use Active/Completed/Archived?
   - Recommendation: Phase 16 should plan to restructure Sessions.tsx sections from whatever Phase 15 leaves. The sections will change from status-agnostic to lifecycle-aware.

3. **Existing `completed` and `archived` statuses**
   - What we know: v1.0 had `active`/`completed` status and `archivedAt` timestamp. The new schema has `active`/`submitted`/`returned`/`exported`.
   - What's unclear: How Phase 14 handles sessions currently in `completed` state. Whether the archive functionality persists.
   - Recommendation: Phase 16 can assume `completed` no longer exists. If archive persists, exported sessions might overlap with archivable sessions -- keep archive as an orthogonal concern handled separately.

4. **RLS enforcement of status transitions**
   - What we know: Current RLS allows specialists to `UPDATE` any field on their sessions. There's no server-side check preventing a specialist from setting `status = 'exported'` directly.
   - What's unclear: Whether we need Postgres-level enforcement of valid status transitions.
   - Recommendation: For a 2-5 person internal team, UI-level enforcement is sufficient. The export button is hidden from specialists, and the submit action only sets valid transitions. Document this as a known gap that could be tightened with a Postgres trigger if the team grows.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + @testing-library/react 16.3.2 |
| Config file | `vite.config.ts` (test section) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIFE-01 | Specialist can submit session (status changes to 'submitted') | unit | `npx vitest run src/tests/session-lifecycle.test.ts -t "submit" -x` | -- Wave 0 |
| LIFE-02 | Submitted sessions are read-only for specialist | unit | `npx vitest run src/tests/session-lifecycle.test.ts -t "read-only" -x` | -- Wave 0 |
| LIFE-03 | Admin can edit items on submitted sessions | unit | `npx vitest run src/tests/session-lifecycle.test.ts -t "admin edit" -x` | -- Wave 0 |
| LIFE-04 | Admin can return session with review notes | unit | `npx vitest run src/tests/session-lifecycle.test.ts -t "return" -x` | -- Wave 0 |
| LIFE-05 | Returned sessions show review notes to specialist | unit | `npx vitest run src/tests/session-lifecycle.test.ts -t "review notes" -x` | -- Wave 0 |
| LIFE-06 | Only admin can export; specialist cannot see export | unit | `npx vitest run src/tests/session-lifecycle.test.ts -t "export" -x` | -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/tests/session-lifecycle.test.ts -x`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/tests/session-lifecycle.test.tsx` -- covers LIFE-01 through LIFE-06 (submit, lock, admin edit, return, notes, export gating)
- [ ] `src/tests/return-dialog.test.tsx` -- covers ReturnDialog component (textarea, confirm, cancel)
- [ ] `src/tests/use-user-role.test.ts` -- covers useUserRole hook (admin detection, specialist detection, loading state)

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of all referenced files (SessionDetail.tsx, Sessions.tsx, SessionCard.tsx, EditableField.tsx, ConfirmDialog.tsx, ItemCard.tsx, authStore.ts, sessionStore.ts, AdminRouteGuard.tsx, RecordButton.tsx, ItemList.tsx)
- Supabase migrations: `20260318000001_create_sessions.sql` (status CHECK constraint confirms four values), `20260318000005_rls_policies.sql` (specialist update policy), `20260318000004_helper_functions.sql` (is_admin helper)
- `src/db/database.types.ts` -- generated types confirm `sessions.status`, `sessions.review_notes`, `sessions.assigned_to` columns exist
- Phase 11, 14 CONTEXT.md files for schema and data layer decisions
- Phase 16 CONTEXT.md for all locked implementation decisions

### Secondary (MEDIUM confidence)
- ROADMAP.md success criteria for Phase 16 verification requirements
- Phase 15 UI-SPEC.md for understanding what Phase 15 delivers to Sessions page structure

### Tertiary (LOW confidence)
- Assumption that Phase 14 will fully rewrite `exportSession` to use Supabase -- not yet implemented, needs verification when Phase 14 completes

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new packages, all existing stack
- Architecture: HIGH -- patterns directly observable in codebase, existing primitives support all requirements
- Pitfalls: HIGH -- identified from direct code analysis of current implementation gaps
- Validation: HIGH -- existing test infrastructure well-established with Vitest + Testing Library

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable -- all dependencies are project-internal, no external API changes expected)
