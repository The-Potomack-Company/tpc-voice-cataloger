# Phase 18: Update Tutorial/Walkthrough to Be Thorough - Research

**Researched:** 2026-03-20
**Domain:** React component UI (walkthrough/onboarding), Supabase schema migration, Zustand state migration
**Confidence:** HIGH

## Summary

This phase replaces the existing 3-step introductory walkthrough with a comprehensive, role-aware tutorial that covers the full app workflow. The technical work splits into three domains: (1) a Supabase schema change to add a `walkthrough_completed` boolean to the `profiles` table, replacing the current localStorage-based completion tracking; (2) expanding the `Walkthrough.tsx` component from 3 static steps to a dynamic, role-aware step system (~8-12 shared steps plus role-specific additions); and (3) updating the integration points in `Sessions.tsx` (the gate) and `Settings.tsx` (the reset button) to read/write from Supabase instead of `useUIStore`.

The existing walkthrough component is well-structured with a slide pattern (icon + title + description + progress dots + Next button). The expansion preserves this pattern while adding Back navigation, role-conditional step arrays, and a final CTA that lands on the Sessions page.

**Primary recommendation:** Keep the existing slide-based architecture, extend it with a step definition array that concatenates shared + role-specific steps, and add a single `walkthrough_completed` column to the profiles table with an RLS-safe update policy.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Full end-to-end walkthrough: create session -> choose mode -> record items -> review/edit -> export -> Chrome extension import
- Both house visit and sale cataloging modes explained
- Offline behavior: brief mention within another step (e.g., recording step), not its own dedicated step
- Export-to-extension: conceptual overview only -- "Export JSON, then import in TPC Chrome extension to fill RFC lots." One step, not step-by-step
- Receipt import is NOT in the general walkthrough -- covered only in admin-specific section
- Target ~8-12 shared steps plus role-specific additions
- Illustrated slide format (enhanced version of current pattern)
- Each step has: icon/illustration, title, description with progress dots
- Navigation via Next/Back buttons with final CTA "Start Cataloging" to dismiss
- Final CTA button lands on Sessions page (does not redirect to New Session)
- Single role-aware walkthrough -- shared base steps for all users, then role-specific steps appended
- Admin additional steps (appended after shared): account management, session assignment, review & export workflow, receipt import
- Specialist additional steps (appended after shared): submitting completed work, viewing admin review notes
- Role determined at walkthrough render time from user's profile/role
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

### Deferred Ideas (OUT OF SCOPE)
- Contextual tooltips on individual pages (first-visit hints) -- could be its own phase
- Dedicated Help page with searchable documentation
- Video/animated walkthrough format
</user_constraints>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.x | Component framework | Already in use |
| Zustand | 5.x | State management (uiStore) | Already in use, walkthrough state currently here |
| Supabase JS | 2.x | Database client | Already in use for profiles table |
| Tailwind CSS | 4.x | Styling | Already in use throughout app |

### Supporting (Already in Project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-router | 7.x | Navigation (post-walkthrough redirect) | Already in use |
| @testing-library/react | 16.x | Component testing | Already in use |
| vitest | 4.x | Test runner | Already in use |

### No New Dependencies Required
This phase requires zero new npm packages. The existing walkthrough component pattern, Supabase client, Zustand store, and Tailwind styling are sufficient for all requirements.

## Architecture Patterns

### Step Definition Pattern
```typescript
// Define steps as a typed array of objects, not inline JSX
interface WalkthroughStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  audience: 'shared' | 'admin' | 'specialist';
}

const SHARED_STEPS: WalkthroughStep[] = [
  { id: 'welcome', title: 'Welcome to TPC Catalog', description: '...', icon: <MicIcon />, audience: 'shared' },
  // ... more steps
];

const ADMIN_STEPS: WalkthroughStep[] = [
  { id: 'admin-accounts', title: 'Manage Accounts', description: '...', icon: <UsersIcon />, audience: 'admin' },
  // ...
];

const SPECIALIST_STEPS: WalkthroughStep[] = [
  { id: 'spec-submit', title: 'Submit Your Work', description: '...', icon: <CheckIcon />, audience: 'specialist' },
  // ...
];

function getStepsForRole(role: string): WalkthroughStep[] {
  if (role === 'admin') return [...SHARED_STEPS, ...ADMIN_STEPS];
  return [...SHARED_STEPS, ...SPECIALIST_STEPS];
}
```

### Supabase Completion Flag Pattern
```typescript
// Add walkthrough_completed column to profiles table
// Migration:
// ALTER TABLE public.profiles ADD COLUMN walkthrough_completed boolean NOT NULL DEFAULT false;

// Read: query profiles when determining if walkthrough should show
const { data } = await supabase
  .from('profiles')
  .select('walkthrough_completed, role')
  .eq('id', user.id)
  .single();

// Write: update on completion
await supabase
  .from('profiles')
  .update({ walkthrough_completed: true })
  .eq('id', user.id);

// Reset: update on reset from Settings
await supabase
  .from('profiles')
  .update({ walkthrough_completed: false })
  .eq('id', user.id);
```

### Integration Point: Sessions.tsx Gate
```typescript
// Current pattern (localStorage via uiStore):
const hasCompletedWalkthrough = useUIStore((s) => s.hasCompletedWalkthrough);
if (!hasCompletedWalkthrough) return <Walkthrough />;

// New pattern (Supabase-backed):
// Option A: Custom hook that queries profiles
function useWalkthroughStatus() {
  const user = useAuthStore((s) => s.user);
  const [completed, setCompleted] = useState<boolean | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase
      .from('profiles')
      .select('walkthrough_completed, role')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setCompleted(data?.walkthrough_completed ?? false);
        setRole(data?.role ?? 'specialist');
        setLoading(false);
      });
  }, [user]);

  return { completed, role, loading };
}
```

### Recommended Component Structure
```
src/
  components/
    Walkthrough.tsx          # Main walkthrough component (expanded)
    walkthrough/
      walkthroughSteps.ts    # Step definitions (shared, admin, specialist)
      useWalkthroughStatus.ts # Hook: reads/writes walkthrough_completed from Supabase
  hooks/
    useUserRole.ts           # Already exists -- can be extended or reused
```

### Anti-Patterns to Avoid
- **Dual state sources:** Do NOT keep both localStorage and Supabase flags. Remove the localStorage `hasCompletedWalkthrough` from `uiStore` entirely once Supabase migration is in place. Having two sources of truth causes desync bugs.
- **Inline step content in JSX:** Do NOT define all step content inside the component render function. Extract step definitions to a separate file for maintainability.
- **Fetching role separately from walkthrough status:** Both `role` and `walkthrough_completed` live in the `profiles` table. Query them together in a single `.select()` call, not two separate queries.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Walkthrough completion persistence | Custom API endpoint | Supabase `.update()` on profiles table | RLS already handles auth, direct update is sufficient |
| Role detection | New role-fetching logic | Existing `useUserRole` hook pattern (or merge into new hook) | Pattern already proven in AdminRouteGuard, Sessions, etc. |
| Step transitions/animations | Custom animation system | CSS transitions (`transition-opacity`, `transition-transform`) via Tailwind | Simple crossfade is sufficient, no animation library needed |
| Progress indicator | Complex multi-segment bar | Simple dot array (existing pattern in current Walkthrough) or step counter text "Step 3 of 12" | Current dots pattern works well, just scale it |

## Common Pitfalls

### Pitfall 1: Race Condition Between Walkthrough Status and Role Fetch
**What goes wrong:** Sessions.tsx fetches `hasCompletedWalkthrough` from one source while the walkthrough component fetches `role` from another, leading to a flash of wrong content.
**Why it happens:** Two separate async calls (one for walkthrough status, one for role) resolve at different times.
**How to avoid:** Create a single `useWalkthroughStatus` hook that fetches BOTH `walkthrough_completed` and `role` from `profiles` in one query. Show loading state until both are resolved.
**Warning signs:** Walkthrough briefly flashes before showing Sessions content, or walkthrough renders without role-specific steps.

### Pitfall 2: Stale localStorage Flag After Supabase Migration
**What goes wrong:** User sees walkthrough again (or never sees it) because old localStorage value conflicts with new Supabase value.
**Why it happens:** If the localStorage `hasCompletedWalkthrough` is not properly cleaned up, the old gate in `useUIStore` may still be read.
**How to avoid:** Remove `hasCompletedWalkthrough` from uiStore's `partialize` config and the store interface entirely. The gate in Sessions.tsx should ONLY read from the new Supabase-backed hook. Optionally seed the Supabase column from existing localStorage value during migration.
**Warning signs:** Walkthrough behavior differs between fresh installs and existing users.

### Pitfall 3: RLS Policy Missing for Profile Self-Update
**What goes wrong:** Non-admin users cannot mark their own walkthrough as completed because RLS blocks the update.
**Why it happens:** The existing RLS policies on profiles may only allow admins to update profiles (for account management).
**How to avoid:** Add an RLS policy: `CREATE POLICY "Users can update own walkthrough_completed" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id)` -- but scope it to only the `walkthrough_completed` column if possible, or verify the existing self-update policy covers this.
**Warning signs:** Walkthrough completion silently fails, user sees walkthrough every login.

### Pitfall 4: Progress Dots Becoming Unreadable at Scale
**What goes wrong:** With 12-16 steps (shared + role-specific), a row of tiny dots becomes hard to read and takes up too much horizontal space on mobile.
**Why it happens:** Current design uses 3 dots for 3 steps. Scaling to 12+ makes dots too small or causes wrapping.
**How to avoid:** Switch to a text-based progress indicator like "Step 3 of 12" or use a compact progress bar instead of dots.
**Warning signs:** Dots wrap to second line on narrow screens, or are so tiny they are not useful.

### Pitfall 5: Missing Back Button State Management
**What goes wrong:** Back button goes to step -1 or allows navigating before step 0.
**Why it happens:** Current component only has a Next button, no Back button logic exists.
**How to avoid:** Disable or hide Back button on step 0. Ensure `setCurrentStep(prev => Math.max(0, prev - 1))`.

### Pitfall 6: Generated Types Not Updated After Migration
**What goes wrong:** TypeScript does not know about `walkthrough_completed` column, causing type errors or missing autocomplete.
**Why it happens:** The `database.types.ts` file is generated and must be regenerated after adding the column.
**How to avoid:** Run `supabase gen types typescript --linked > src/db/database.types.ts` after applying the migration. Then append the `Insertable`/`Updatable` type aliases (project convention from decision [11-02]).

## Code Examples

### Current Walkthrough Component Structure (to be extended)
The existing `Walkthrough.tsx` (113 lines) uses:
- `useState` for `currentStep` tracking
- Array of step objects with `title`, `description`, `icon` (inline SVG)
- Single `handleNext` that either advances or calls `completeWalkthrough()`
- Progress dots via `steps.map` with conditional styling
- Full-screen centered layout with Tailwind classes

### Supabase Migration for walkthrough_completed
```sql
-- New migration file
ALTER TABLE public.profiles
  ADD COLUMN walkthrough_completed boolean NOT NULL DEFAULT false;

-- RLS: users can update their own walkthrough_completed
-- Check if existing UPDATE policy on profiles already allows self-update.
-- If not, add:
CREATE POLICY "Users can update own walkthrough status"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```

### Existing RLS Pattern to Check
The existing RLS policies in `20260318000005_rls_policies.sql` must be reviewed. If there is already a self-update policy on profiles, the new column is automatically covered. If the only UPDATE policy is admin-only, a scoped policy is needed.

### useWalkthroughStatus Hook
```typescript
import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';

export function useWalkthroughStatus() {
  const user = useAuthStore((s) => s.user);
  const [walkthroughCompleted, setWalkthroughCompleted] = useState<boolean | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase
      .from('profiles')
      .select('walkthrough_completed, role')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setWalkthroughCompleted(data?.walkthrough_completed ?? false);
        setRole(data?.role ?? 'specialist');
        setLoading(false);
      });
  }, [user]);

  const completeWalkthrough = useCallback(async () => {
    if (!user) return;
    await supabase
      .from('profiles')
      .update({ walkthrough_completed: true })
      .eq('id', user.id);
    setWalkthroughCompleted(true);
  }, [user]);

  const resetWalkthrough = useCallback(async () => {
    if (!user) return;
    await supabase
      .from('profiles')
      .update({ walkthrough_completed: false })
      .eq('id', user.id);
    setWalkthroughCompleted(false);
  }, [user]);

  return { walkthroughCompleted, role, loading, completeWalkthrough, resetWalkthrough };
}
```

### Visual Approach Recommendation (Claude's Discretion)
Use inline SVG icons (Heroicons style) consistent with the existing walkthrough and the rest of the app. The current component already uses this pattern with `w-16 h-16` SVGs. This is the lowest friction approach -- no new assets, no build pipeline changes, consistent visual language.

For the progress indicator, use a text-based "Step X of Y" display instead of dots at this scale. A simple centered text below the navigation buttons is clearer than 12+ tiny dots.

### Skip Link Recommendation (Claude's Discretion)
Add a small "Skip" text link at the top-right of the walkthrough for returning users. This is low-cost to implement and prevents frustration if a user logs in on a new device after already learning the app on another. The skip action calls `completeWalkthrough()` same as finishing.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| localStorage walkthrough flag | Supabase profiles column | This phase | Flag follows user across devices |
| 3 static steps | 8-16 role-aware steps | This phase | Comprehensive coverage of full workflow |
| Next-only navigation | Next + Back navigation | This phase | Users can review previous steps |
| Generic content for all users | Role-conditional steps | This phase | Admin and specialist see relevant content |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x + @testing-library/react 16.x |
| Config file | `vite.config.ts` (test section) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WT-01 | Walkthrough renders shared steps for specialist role | unit | `npx vitest run src/tests/walkthrough.test.tsx -t "shared steps" -x` | No - Wave 0 |
| WT-02 | Walkthrough renders admin steps appended for admin role | unit | `npx vitest run src/tests/walkthrough.test.tsx -t "admin steps" -x` | No - Wave 0 |
| WT-03 | Walkthrough renders specialist steps appended for specialist role | unit | `npx vitest run src/tests/walkthrough.test.tsx -t "specialist steps" -x` | No - Wave 0 |
| WT-04 | Completion writes to Supabase profiles (not localStorage) | unit | `npx vitest run src/tests/walkthrough-status.test.ts -t "complete" -x` | No - Wave 0 |
| WT-05 | Reset walkthrough writes false to Supabase profiles | unit | `npx vitest run src/tests/walkthrough-status.test.ts -t "reset" -x` | No - Wave 0 |
| WT-06 | Sessions.tsx gates on Supabase walkthrough_completed, not uiStore | unit | `npx vitest run src/tests/walkthrough.test.tsx -t "gate" -x` | No - Wave 0 |
| WT-07 | Back button works and is hidden/disabled on first step | unit | `npx vitest run src/tests/walkthrough.test.tsx -t "back" -x` | No - Wave 0 |
| WT-08 | Final CTA "Start Cataloging" calls completeWalkthrough | unit | `npx vitest run src/tests/walkthrough.test.tsx -t "Start Cataloging" -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/tests/walkthrough.test.tsx` -- covers WT-01, WT-02, WT-03, WT-06, WT-07, WT-08
- [ ] `src/tests/walkthrough-status.test.ts` -- covers WT-04, WT-05
- [ ] Existing `src/tests/persist-scoping.test.ts` may need updates if `hasCompletedWalkthrough` is removed from uiStore

## Open Questions

1. **Existing RLS UPDATE policy on profiles**
   - What we know: RLS is enabled on profiles table, policies exist in `20260318000005_rls_policies.sql`
   - What's unclear: Whether an existing policy allows users to update their own profile row (needed for walkthrough_completed)
   - Recommendation: Read the RLS policies migration file during planning. If no self-update policy exists, add one.

2. **Seeding walkthrough_completed from existing localStorage data**
   - What we know: Existing users have `hasCompletedWalkthrough: true` in localStorage (scoped by user ID)
   - What's unclear: Whether we should migrate this value to Supabase or just have existing users see the new walkthrough
   - Recommendation: Since the walkthrough is being completely rewritten with new content, do NOT migrate. Let all users see the new walkthrough once. Set all existing `walkthrough_completed` to `false` (which is the column default).

3. **Database types regeneration**
   - What we know: Types are generated via `supabase gen types typescript --linked`
   - What's unclear: Whether the dev environment has CLI linked and accessible
   - Recommendation: Include type regeneration as an explicit task step. If CLI is not available, manually add the column to `database.types.ts`.

## Sources

### Primary (HIGH confidence)
- `src/components/Walkthrough.tsx` -- Existing walkthrough component (113 lines, read in full)
- `src/stores/uiStore.ts` -- Current walkthrough state management (51 lines, read in full)
- `src/hooks/useUserRole.ts` -- Existing role detection pattern (35 lines, read in full)
- `src/components/AdminRouteGuard.tsx` -- Admin role query pattern (31 lines, read in full)
- `src/pages/Sessions.tsx` -- Walkthrough gate (lines 202-222)
- `src/pages/Settings.tsx` -- Reset walkthrough button (lines 294-301)
- `supabase/migrations/20260318000000_create_profiles.sql` -- Profiles schema
- `src/db/database.types.ts` -- Generated types showing profiles columns

### Secondary (MEDIUM confidence)
- `.planning/phases/18-update-tutorial-walkthrough-to-be-thorough/18-CONTEXT.md` -- All user decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, all existing libraries
- Architecture: HIGH - Extending well-established patterns already in codebase
- Pitfalls: HIGH - Based on direct code analysis of existing integration points

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable -- no external dependencies or fast-moving libraries)
