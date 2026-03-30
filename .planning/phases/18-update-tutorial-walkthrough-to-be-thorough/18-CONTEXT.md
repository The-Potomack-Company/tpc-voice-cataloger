# Phase 18: Update Tutorial/Walkthrough to Be Thorough - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Expand the existing 3-step intro walkthrough into a comprehensive, role-aware tutorial that teaches users the full app workflow. The current Walkthrough.tsx has 3 brief slides (Welcome, Two Modes, Get Started). This phase replaces it with a thorough end-to-end guide that adapts to admin vs specialist roles, with completion state stored per-user in Supabase.

</domain>

<decisions>
## Implementation Decisions

### Coverage & depth
- Full end-to-end walkthrough: create session -> choose mode -> record items -> review/edit -> export -> Chrome extension import
- Both house visit and sale cataloging modes explained
- Offline behavior: brief mention within another step (e.g., recording step), not its own dedicated step
- Export-to-extension: conceptual overview only -- "Export JSON, then import in TPC Chrome extension to fill RFC lots." One step, not step-by-step
- Receipt import is NOT in the general walkthrough -- covered only in admin-specific section
- Target ~8-12 shared steps plus role-specific additions

### Format & presentation
- Illustrated slide format (enhanced version of current pattern)
- Each step has: icon/illustration, title, description with progress dots
- Navigation via Next/Back buttons with final CTA "Start Cataloging" to dismiss
- Final CTA button lands on Sessions page (does not redirect to New Session)

### Role awareness
- Single role-aware walkthrough -- shared base steps for all users, then role-specific steps appended
- Admin additional steps (appended after shared): account management, session assignment, review & export workflow, receipt import
- Specialist additional steps (appended after shared): submitting completed work, viewing admin review notes
- Role determined at walkthrough render time from user's profile/role
- Admin sees: shared steps + admin steps
- Specialist sees: shared steps + specialist steps
- Admin steps come immediately after shared steps in one continuous flow

### Trigger & storage
- Triggers on first login per user (not per device)
- Walkthrough completion state stored in Supabase (profiles table or preferences) -- follows user across devices
- Current localStorage hasCompletedWalkthrough replaced with server-side per-user flag
- Re-access via existing "Reset Walkthrough" button in Settings page
- No contextual tooltips on individual pages -- walkthrough only

### Claude's Discretion
- Visual approach for step illustrations (SVG icons vs custom illustrations vs screenshots) -- pick what fits best
- Exact number of steps per section (shared, admin, specialist)
- Step content wording and descriptions
- Progress indicator design (dots, bar, step counter)
- Animation/transitions between steps
- Whether to add a "Skip" link for returning users who've already seen it on another device

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing walkthrough code
- `src/components/Walkthrough.tsx` -- Current 3-step walkthrough component to be replaced/expanded
- `src/stores/uiStore.ts` -- Current hasCompletedWalkthrough state (localStorage-persisted, to be migrated to Supabase)
- `src/pages/Sessions.tsx` -- Where walkthrough renders (lines 50-52: conditional on hasCompletedWalkthrough)
- `src/pages/Settings.tsx` -- Reset Walkthrough button (line 379-384)

### Auth and role infrastructure
- `src/components/ProtectedRoute.tsx` -- Auth guard pattern
- `src/components/AdminRouteGuard.tsx` -- Admin role detection pattern (queries profiles table)
- `src/App.tsx` -- Route structure showing all pages

### Supabase schema
- `supabase/migrations/` -- Database migrations for profiles table where completion flag will be stored

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Walkthrough` component (`src/components/Walkthrough.tsx`): Current slide-based walkthrough with step navigation, progress dots, and SVG icons -- structure can be extended
- `useUIStore` (`src/stores/uiStore.ts`): Has `hasCompletedWalkthrough`, `completeWalkthrough()`, `resetWalkthrough()` -- will need migration to Supabase-backed state
- `AdminRouteGuard` (`src/components/AdminRouteGuard.tsx`): Pattern for detecting admin role from profiles table -- same pattern needed to determine which walkthrough steps to show

### Established Patterns
- Zustand stores with persist middleware for client-side state
- Supabase profiles table stores user metadata (role, email, is_active)
- Auth store uses Supabase session (no persist middleware -- Supabase handles its own persistence)
- SVG icons inline in components (Heroicons style)
- Tailwind CSS 4 with @theme blocks for styling

### Integration Points
- `Sessions.tsx` renders `<Walkthrough />` when `!hasCompletedWalkthrough` -- this gate needs to read from Supabase instead of localStorage
- Settings page "Reset Walkthrough" button calls `resetWalkthrough()` -- needs to update Supabase instead
- User role available from profiles table (same query pattern as AdminRouteGuard)

</code_context>

<specifics>
## Specific Ideas

- User wants the walkthrough to feel comprehensive -- "thorough" was the explicit request
- Admin tutorial is not a separate screen/page but additional steps appended to the same walkthrough flow
- The Chrome extension export step should be a light conceptual mention, not a detailed guide

</specifics>

<deferred>
## Deferred Ideas

- Contextual tooltips on individual pages (first-visit hints) -- could be its own phase
- Dedicated Help page with searchable documentation
- Video/animated walkthrough format

</deferred>

---

*Phase: 18-update-tutorial-walkthrough-to-be-thorough*
*Context gathered: 2026-03-18*
