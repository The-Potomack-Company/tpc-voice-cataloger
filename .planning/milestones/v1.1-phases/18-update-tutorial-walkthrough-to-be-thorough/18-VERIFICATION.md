---
phase: 18-update-tutorial-walkthrough-to-be-thorough
verified: 2026-03-23T10:00:00Z
status: human_needed
score: 5/5 must-haves verified
re_verification: false
human_verification:
  - test: "Log in as specialist user, verify 10-step walkthrough with correct content and navigation behavior"
    expected: "Step 1 shows 'Welcome to TPC Catalog' with no Back button and no Skip link. Step 2 shows Back button and 'Skip tutorial' link. Progress counter shows 'X / 10'. Step 9 shows 'YOUR WORKFLOW' label. Final step shows 'Start Cataloging' button. Completing dismisses walkthrough permanently."
    why_human: "Role-aware step rendering, visual layout, and completion persistence require a live Supabase session with a real authenticated user"
  - test: "Log in as admin user, verify 12-step walkthrough with admin-specific content"
    expected: "Admin sees 12 steps. Step 9 shows 'ADMIN FEATURES' label above the Manage Accounts step. Steps 9-12 show Manage Accounts, Assign Sessions, Review & Export, Import Receipts."
    why_human: "Admin role detection and role-specific step rendering require live Supabase auth with an admin-role profile"
  - test: "Complete walkthrough as specialist, log out, log in again, verify walkthrough does not reappear"
    expected: "Sessions page loads directly without showing the walkthrough, confirming walkthrough_completed=true persisted to Supabase profiles and is read back correctly on second login"
    why_human: "Cross-device persistence requires a real Supabase round-trip that cannot be verified with static code analysis"
  - test: "Go to Settings, tap Reset Walkthrough, navigate to Sessions, verify walkthrough reappears"
    expected: "After reset, Sessions page shows the walkthrough again from step 1"
    why_human: "Reset writes walkthrough_completed=false to Supabase and the gate re-evaluates on next navigation, requires live session"
---

# Phase 18: Update Tutorial Walkthrough to be Thorough — Verification Report

**Phase Goal:** Expand the existing 3-step intro walkthrough into a comprehensive, role-aware tutorial that covers the full app workflow, with completion state stored per-user in Supabase
**Verified:** 2026-03-23T10:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Walkthrough covers the full workflow: create session, choose mode, record items, review/edit, export to Chrome extension | VERIFIED | `walkthroughSteps.tsx` SHARED_STEPS contains 8 steps with ids: welcome, create-session, house-visit, sale-cataloging, record-item, ai-processing, review-edit, export. All required workflow topics present verbatim. |
| 2 | Admin users see shared steps plus admin-specific steps (account management, session assignment, review/export, receipt import) | VERIFIED | `walkthroughSteps.tsx` ADMIN_STEPS contains 4 entries: admin-accounts ("Manage Accounts"), admin-assign ("Assign Sessions"), admin-review ("Review & Export"), admin-import ("Import Receipts"). `getStepsForRole('admin')` returns `[...SHARED_STEPS, ...ADMIN_STEPS]` = 12 steps. |
| 3 | Specialist users see shared steps plus specialist-specific steps (submit work, review notes) | VERIFIED | `walkthroughSteps.tsx` SPECIALIST_STEPS contains 2 entries: specialist-submit ("Submit Your Work"), specialist-returned ("Review Notes"). `getStepsForRole(anything except 'admin')` returns `[...SHARED_STEPS, ...SPECIALIST_STEPS]` = 10 steps. |
| 4 | Walkthrough completion state is stored in Supabase profiles table (not localStorage) and follows user across devices | VERIFIED | Migration `20260320100000_add_walkthrough_completed.sql` adds `walkthrough_completed boolean NOT NULL DEFAULT false` to profiles with self-update RLS policy. `useWalkthroughStatus.ts` reads and writes `walkthrough_completed` via `supabase.from('profiles')`. `uiStore.ts` contains no walkthrough state whatsoever. |
| 5 | Back navigation, skip link, and progress counter work correctly | VERIFIED | `Walkthrough.tsx`: Back button guarded by `{currentStep > 0 && ...}`, calls `Math.max(0, prev - 1)`. Skip link guarded by `{currentStep > 0 && ...}`, calls `onComplete()`. Progress counter renders `{currentStep + 1} / {totalSteps}` plus dots array using `i <= currentStep` fill rule. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/tests/walkthrough.test.tsx` | Stub tests for WT-01, WT-02, WT-03, WT-06, WT-07, WT-08 | VERIFIED | Exists. 15 `it.todo()` tests across 5 describe blocks. Suite runs green (27 todo, 0 failures). |
| `src/tests/walkthrough-status.test.ts` | Stub tests for WT-04, WT-05 | VERIFIED | Exists. 9 `it.todo()` tests across 3 describe blocks. Suite runs green. |
| `supabase/migrations/20260320100000_add_walkthrough_completed.sql` | walkthrough_completed column and self-update RLS policy | VERIFIED | Contains `ADD COLUMN walkthrough_completed boolean NOT NULL DEFAULT false` and `CREATE POLICY "Users can update own walkthrough status"` with correct USING/WITH CHECK clauses. |
| `src/db/database.types.ts` | walkthrough_completed in profiles Row, Insert, Update | VERIFIED | Lines 121, 129, 137: `walkthrough_completed: boolean` (Row), `walkthrough_completed?: boolean` (Insert), `walkthrough_completed?: boolean` (Update). |
| `src/components/walkthrough/walkthroughSteps.tsx` | SHARED_STEPS (8), ADMIN_STEPS (4), SPECIALIST_STEPS (2), getStepsForRole | VERIFIED | Exports all required arrays and function. Step counts match exactly. roleSection property set on first step of each role block (admin-accounts, specialist-submit). |
| `src/components/walkthrough/useWalkthroughStatus.ts` | Hook reading/writing walkthrough_completed from Supabase | VERIFIED | Single `.select('walkthrough_completed, role')` query. Exports: walkthroughCompleted, role, loading, completeWalkthrough, resetWalkthrough. Optimistic local state update on complete/reset. Error fallback to false/'specialist'. |
| `src/components/Walkthrough.tsx` | Complete rewrite, role-aware, back nav, skip, progress counter | VERIFIED | 102 lines (above 80-line minimum). Props-based (role, onComplete). Imports getStepsForRole. Back button, skip link, progress dots+counter, role section labels, "Start Cataloging" CTA. No useUIStore import. |
| `src/pages/Sessions.tsx` | Walkthrough gate reads from useWalkthroughStatus | VERIFIED | Line 5: `import { useWalkthroughStatus }`. Line 203: destructures `walkthroughCompleted, role, loading, completeWalkthrough`. Line 220-222: gate on `!walkthroughLoading && walkthroughCompleted === false`. No `hasCompletedWalkthrough` reference. `useUIStore` kept for `isOnline` only. |
| `src/pages/Settings.tsx` | Reset button calls resetWalkthrough from useWalkthroughStatus | VERIFIED | Line 4: `import { useWalkthroughStatus }`. Line 9: `const { resetWalkthrough } = useWalkthroughStatus()`. Line 295: `onClick={resetWalkthrough}`. No `useUIStore` import in Settings.tsx. |
| `src/stores/uiStore.ts` | Cleaned store without walkthrough state | VERIFIED | UIState interface contains only `recordingSessionId`, `setRecordingSession`, `isOnline`, `setOnline`. No walkthrough state of any kind. partialize includes only `recordingSessionId`. scopeUIStore function intact. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `Walkthrough.tsx` | `walkthroughSteps.tsx` | `import { getStepsForRole }` | WIRED | Line 2: `import { getStepsForRole } from './walkthrough/walkthroughSteps'`. Called at line 11: `const steps = getStepsForRole(role)`. |
| `Sessions.tsx` | `useWalkthroughStatus.ts` | `import { useWalkthroughStatus }` | WIRED | Line 5 import, line 203 destructure, lines 220-221 gate logic with `walkthroughCompleted` and `completeWalkthrough` passed as prop. |
| `Settings.tsx` | `useWalkthroughStatus.ts` | `import { useWalkthroughStatus }` | WIRED | Line 4 import, line 9 destructure, line 295 onClick handler. |
| `useWalkthroughStatus.ts` | Supabase profiles table | `supabase.from('profiles').select('walkthrough_completed, role')` | WIRED | Lines 16-31: SELECT query with single() + error handling. Lines 37-40: UPDATE complete. Lines 45-49: UPDATE reset. |

### Requirements Coverage

The WT-01 through WT-08 requirement IDs are phase-internal identifiers defined in ROADMAP.md and plan frontmatter. They do not appear as named entries in `REQUIREMENTS.md` (REQUIREMENTS.md tracks infrastructure-level IDs like AUTH-01, ACCT-01, etc., and has no walkthrough section). This is consistent with project convention — UX improvement phases use internal requirement IDs.

All 8 WT requirements are covered by the implemented artifacts and key links:

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| WT-01 | 18-01, 18-02 | Shared steps covering full workflow (8 steps) | SATISFIED | SHARED_STEPS array has 8 entries covering welcome through export |
| WT-02 | 18-01, 18-02 | Admin sees 12 steps with admin-specific content | SATISFIED | ADMIN_STEPS (4 entries) + getStepsForRole returns 12 for 'admin' |
| WT-03 | 18-01, 18-02 | Specialist sees 10 steps with specialist-specific content | SATISFIED | SPECIALIST_STEPS (2 entries) + getStepsForRole returns 10 for non-admin |
| WT-04 | 18-01 | completeWalkthrough writes to Supabase profiles | SATISFIED | useWalkthroughStatus.completeWalkthrough calls supabase.from('profiles').update({ walkthrough_completed: true }) |
| WT-05 | 18-01 | resetWalkthrough writes to Supabase profiles; Settings button calls it | SATISFIED | resetWalkthrough in hook; Settings.tsx line 295 wired to button onClick |
| WT-06 | 18-02 | Sessions.tsx gates walkthrough on useWalkthroughStatus (not uiStore) | SATISFIED | Sessions.tsx imports and uses useWalkthroughStatus; no hasCompletedWalkthrough reference |
| WT-07 | 18-02 | Back button hidden on step 1, visible step 2+ | SATISFIED | Walkthrough.tsx: `{currentStep > 0 && <button onClick={handleBack}>Back</button>}` |
| WT-08 | 18-02 | Final CTA is "Start Cataloging"; skip link calls onComplete | SATISFIED | Walkthrough.tsx: `{isLastStep ? 'Start Cataloging' : 'Next'}` and `{currentStep > 0 && <button onClick={handleSkip}>Skip tutorial</button>}` |

**REQUIREMENTS.md orphaned requirements check:** No WT-XX entries exist in REQUIREMENTS.md, confirming these are phase-internal IDs only. No orphaned requirements.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/tests/walkthrough.test.tsx` | All 15 tests are `it.todo()` stubs | Info | Intentional by plan design — tests are scaffolding placeholders. Behavioral verification is covered by human checkpoint (Plan 18-02 Task 3, approved). No test suite gaps for non-stub code. |
| `src/tests/walkthrough-status.test.ts` | All 9 tests are `it.todo()` stubs | Info | Same as above. |

No blockers or warnings found. Stub tests are by design and the suite runs green.

### Commit Verification

All four commits documented in summaries verified in git log:
- `3a7def3` — feat(18-01): add walkthrough_completed column, RLS policy, and useWalkthroughStatus hook
- `6d2bb66` — feat(18-01): add role-aware walkthrough step definitions
- `c319c3f` — feat(18-02): rewrite Walkthrough.tsx with role-aware steps, back nav, skip link, progress counter
- `a48298d` — feat(18-02): update Sessions/Settings to use useWalkthroughStatus, clean uiStore

### Human Verification Required

The automated checks confirm all structural correctness. The following behaviors require live Supabase auth to confirm end-to-end:

#### 1. Specialist walkthrough — full navigation flow

**Test:** Log in as a specialist user. Navigate to Sessions. Step through the walkthrough.
**Expected:** Step 1 shows "Welcome to TPC Catalog", no Back button, no Skip link. Step 2 shows Back button and "Skip tutorial" link. Progress counter shows "1 / 10" on step 1, incrementing to "10 / 10" on the last step. Step 9 shows "YOUR WORKFLOW" label. Final step shows "Start Cataloging" button. Tapping it dismisses the walkthrough and loads the Sessions list.
**Why human:** Role-aware rendering and visual layout correctness require a live browser session.

#### 2. Admin walkthrough — role-specific content

**Test:** Log in as an admin user. Navigate to Sessions.
**Expected:** Walkthrough shows 12 steps total. Step 9 shows "ADMIN FEATURES" label. Steps 9-12 show Manage Accounts, Assign Sessions, Review & Export, Import Receipts in that order.
**Why human:** Admin role is determined by Supabase profiles.role which requires a real auth context.

#### 3. Cross-device persistence

**Test:** Complete the walkthrough as any user. Reload the page (or open a new browser tab). Navigate to Sessions.
**Expected:** Walkthrough does not reappear, confirming walkthrough_completed=true persisted to Supabase and was read back on load.
**Why human:** Requires real Supabase round-trip; cannot verify with static analysis.

#### 4. Reset flow

**Test:** Go to Settings. Tap "Reset Walkthrough". Navigate to Sessions.
**Expected:** Walkthrough appears again from step 1.
**Why human:** Requires live Supabase write followed by navigation re-render.

### Gaps Summary

No gaps found. All 5 success criteria are satisfied by the implemented artifacts with correct wiring. The phase goal is structurally achieved. Human verification is required only for confirming live Supabase integration behavior.

---

_Verified: 2026-03-23T10:00:00Z_
_Verifier: Claude (gsd-verifier)_
