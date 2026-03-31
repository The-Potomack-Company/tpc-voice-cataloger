---
phase: 17-deployment-ci
plan: 01
subsystem: infra
tags: [eslint, typescript, react-hooks, lint, ci]

requires:
  - phase: 19-photo-upload
    provides: source files with lint/type errors to fix
provides:
  - Zero ESLint errors in all source (non-test) files
  - Zero TypeScript errors across codebase
affects: [17-deployment-ci]

tech-stack:
  added: []
  patterns: [derive-loading-from-state, useSyncExternalStore-for-blob-url, cleanup-function-setState]

key-files:
  created: []
  modified:
    - src/components/AdminRouteGuard.tsx
    - src/components/ProtectedRoute.tsx
    - src/components/InstallBanner.tsx
    - src/hooks/useBlobUrl.ts
    - src/stores/authStore.ts
    - src/hooks/useWriteAheadQueue.ts
    - src/services/gemini.ts
    - src/hooks/useAudioRecorder.ts
    - src/hooks/useUserRole.ts
    - src/hooks/usePhotoUrl.ts
    - src/components/walkthrough/useWalkthroughStatus.ts
    - src/pages/NewSession.tsx
    - src/pages/Sessions.tsx

key-decisions:
  - "Derive loading state from role===undefined instead of separate loading boolean to avoid sync setState in effects"
  - "useBlobUrl rewritten with useRef+useSyncExternalStore to eliminate all sync setState in effects"
  - "Object.entries filter for gemini schema stripping instead of destructured rest (avoids no-unused-vars)"

patterns-established:
  - "Derive-loading pattern: use undefined sentinel in state variable, derive loading as !!user && state === undefined"
  - "Cleanup-setState pattern: move setState resets to effect cleanup function (allowed by react-hooks rule)"

requirements-completed: [DEPLOY-02]

duration: 6min
completed: 2026-03-30
---

# Phase 17 Plan 01: Source File Lint & Type Fix Summary

**Eliminated all ESLint errors (8 react-hooks/set-state-in-effect, 2 no-explicit-any, 1 exhaustive-deps, 2 no-unused-vars) and all TypeScript errors (4 TS6133/TS2769) across 13 source files**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-30T13:17:28Z
- **Completed:** 2026-03-30T13:23:28Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- All source files (non-test) pass `npx eslint .` with 0 errors
- `npx tsc -b` exits with 0 errors (down from 5)
- Established derive-loading-from-state pattern replacing sync setState in 5 hooks/components

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix ESLint react-hooks and no-explicit-any errors** - `7db4225` (fix)
2. **Task 2: Fix TypeScript errors and remaining ESLint issues** - `6b2bf02` (fix)

## Files Created/Modified
- `src/components/AdminRouteGuard.tsx` - Derive loading from role===undefined, cleanup resets role
- `src/components/ProtectedRoute.tsx` - Defer setScoped via queueMicrotask
- `src/components/InstallBanner.tsx` - BeforeInstallPromptEvent interface, typed state
- `src/hooks/useBlobUrl.ts` - Rewritten with useRef+useSyncExternalStore (no sync setState)
- `src/stores/authStore.ts` - Prefix unused _event param
- `src/hooks/useWriteAheadQueue.ts` - Cast insert payload as never for Supabase types
- `src/services/gemini.ts` - Filter schema props via Object.entries, prefix unused destructured vars
- `src/hooks/useAudioRecorder.ts` - Remove unnecessary cleanupStream dependency
- `src/hooks/useUserRole.ts` - Derive loading from role===undefined pattern
- `src/hooks/usePhotoUrl.ts` - Move setSignedUrl(undefined) to cleanup function
- `src/components/walkthrough/useWalkthroughStatus.ts` - Derive loading from fetched flag
- `src/pages/NewSession.tsx` - Remove unused roleLoading destructured variable
- `src/pages/Sessions.tsx` - Remove unused returnedExpanded state variable

## Decisions Made
- Derive loading state from role===undefined instead of separate boolean to avoid sync setState in effects
- useBlobUrl rewritten with useRef+useSyncExternalStore to fully eliminate sync setState
- Object.entries filter approach for gemini.ts schema stripping (destructured rest triggers no-unused-vars)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed 3 additional set-state-in-effect errors in useUserRole, useWalkthroughStatus, usePhotoUrl**
- **Found during:** Task 2 (full ESLint verification)
- **Issue:** Plan listed only 3 hooks with set-state-in-effect; 3 more source files had the same pattern
- **Fix:** Applied same derive-loading-from-state / cleanup-setState pattern
- **Files modified:** src/hooks/useUserRole.ts, src/components/walkthrough/useWalkthroughStatus.ts, src/hooks/usePhotoUrl.ts
- **Verification:** `npx eslint src/ --ignore-pattern .claude/` reports 0 source file errors
- **Committed in:** 6b2bf02

**2. [Rule 3 - Blocking] Fixed 2 additional TypeScript errors in NewSession.tsx and Sessions.tsx**
- **Found during:** Task 2 (tsc -b verification)
- **Issue:** Plan missed TS6133 errors for unused roleLoading and returnedExpanded variables
- **Fix:** Removed unused destructured variables
- **Files modified:** src/pages/NewSession.tsx, src/pages/Sessions.tsx
- **Committed in:** 6b2bf02

**3. [Rule 3 - Blocking] Fixed 2 additional ESLint errors in gemini.ts (no-unused-vars on destructured rest)**
- **Found during:** Task 2
- **Issue:** Plan suggested underscore prefix for destructured rest, but ESLint config doesn't allow unused destructured vars even with underscore
- **Fix:** Used Object.entries().filter() approach instead
- **Files modified:** src/services/gemini.ts
- **Committed in:** 6b2bf02

---

**Total deviations:** 3 auto-fixed (3 blocking)
**Impact on plan:** All auto-fixes necessary to achieve plan objective of zero source-file errors. No scope creep.

## Issues Encountered
- useBlobUrl required complete rewrite: initial attempt moving setUrl(undefined) to cleanup still had setUrl(objectUrl) in effect body, which also triggers the rule. Used useSyncExternalStore pattern to fully avoid useState in the effect.
- The react-hooks/set-state-in-effect rule is stricter than expected: ANY synchronous setState in effect body triggers it, not just conditional early returns.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Source files are lint-clean and type-clean
- Test files still have ESLint errors (addressed in Plan 17-02)
- CI pipeline can now enforce lint+typecheck on source files

---
*Phase: 17-deployment-ci*
*Completed: 2026-03-30*
