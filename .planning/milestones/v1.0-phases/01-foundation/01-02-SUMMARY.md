---
phase: 01-foundation
plan: 02
subsystem: ui
tags: [react-router, zustand, tailwindcss, pwa, mobile-first, bottom-tabs, walkthrough]

requires:
  - phase: 01-foundation-01
    provides: Vite scaffold, Dexie schema, Tailwind CSS 4, BrowserRouter, vitest infrastructure
provides:
  - Bottom tab bar navigation with 3 tabs (Sessions/New/Settings)
  - Page stubs for all routes with mobile-optimized layouts
  - PWA install banner with platform-specific behavior (Chrome/iOS)
  - 3-step welcome walkthrough with Zustand-persisted completion state
  - Dark mode support on all components (system preference)
  - 48px+ tap targets on all interactive elements
affects: [03-session-management, 04-cataloging-modes, 06-review-edit-export]

tech-stack:
  added: []
  patterns: [bottom-tab-layout, zustand-persist-localstorage, navlink-active-state, h-dvh-viewport, safe-area-insets]

key-files:
  created: [src/layouts/AppLayout.tsx, src/pages/Sessions.tsx, src/pages/NewSession.tsx, src/pages/Settings.tsx, src/components/InstallBanner.tsx, src/components/Walkthrough.tsx, src/stores/uiStore.ts, src/tests/layout.test.tsx]
  modified: [src/App.tsx, src/tests/setup.ts]

key-decisions:
  - "Used data-testid on root layout div for reliable test targeting"
  - "InstallBanner detects iOS via user agent and shows manual Add to Home Screen instructions"
  - "Walkthrough is 3 steps with progress dots, rendered as full-page replacement (not modal)"
  - "matchMedia mock added to test setup for jsdom compatibility with InstallBanner"

patterns-established:
  - "Bottom tab NavLink pattern: flex flex-col items-center py-3 px-4 min-h-12 min-w-12 with isActive toggle"
  - "Page layout pattern: portrait:px-4 landscape:px-8 landscape:max-w-3xl landscape:mx-auto"
  - "Zustand persist to localStorage for lightweight UI state (walkthrough completion)"

requirements-completed: [UX-02, UX-03, UX-04]

duration: 3min
completed: 2026-03-06
---

# Phase 1 Plan 02: App Shell Summary

**Mobile-first PWA shell with 3-tab bottom nav, welcome walkthrough, install banner, and dark mode via Tailwind CSS 4**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-06T17:15:27Z
- **Completed:** 2026-03-06T17:18:48Z
- **Tasks:** 2 of 2 (Task 2 human-verify approved)
- **Files modified:** 10

## Accomplishments
- Bottom tab bar with Sessions/New/Settings using NavLink active states and SVG icons
- 3-step welcome walkthrough persisted via Zustand with localStorage
- PWA install banner with Chrome beforeinstallprompt and iOS manual instructions
- All 14 tests pass (6 new layout tests + 8 from Plan 01)
- Production build succeeds with service worker generation

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing layout tests** - `04e47d9` (test)
2. **Task 1 GREEN: App shell implementation** - `0be2612` (feat)

3. **Task 2: Verify PWA shell on device** - checkpoint:human-verify (approved)

## Files Created/Modified
- `src/layouts/AppLayout.tsx` - Main app shell with bottom tab bar, InstallBanner, and Outlet
- `src/pages/Sessions.tsx` - Sessions page with walkthrough gate and empty-state CTA
- `src/pages/NewSession.tsx` - Mode picker with House Visit and Sale Cataloging cards
- `src/pages/Settings.tsx` - Settings stub with about, storage, and reset walkthrough
- `src/components/InstallBanner.tsx` - PWA install banner with iOS fallback
- `src/components/Walkthrough.tsx` - 3-step onboarding with progress dots
- `src/stores/uiStore.ts` - Zustand persist store for walkthrough completion
- `src/tests/layout.test.tsx` - 6 tests for layout, nav, and page rendering
- `src/App.tsx` - Updated with React Router routes and layout
- `src/tests/setup.ts` - Added matchMedia mock for jsdom

## Decisions Made
- Used `data-testid="app-layout"` on root div for reliable test targeting of h-dvh class
- InstallBanner detects iOS via user agent check and shows manual "share icon > Add to Home Screen" instructions
- Walkthrough renders as full-page replacement inside Sessions page (not a modal overlay)
- Added `matchMedia` mock to test setup since jsdom doesn't implement it (needed by InstallBanner)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] jsdom missing matchMedia API**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** InstallBanner uses `window.matchMedia("(display-mode: standalone)")` which jsdom doesn't implement, causing test crashes
- **Fix:** Added matchMedia mock to `src/tests/setup.ts`
- **Files modified:** src/tests/setup.ts
- **Verification:** All 14 tests pass
- **Committed in:** 0be2612

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Standard jsdom limitation fix. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- App shell is fully navigable with working tab bar, routing, and page stubs
- PWA verified on device by human (approved) - installs correctly, layout is thumb-friendly
- Phase 1 is complete and Phase 2 (audio capture) can begin

## Self-Check: PASSED

All 10 created/modified files verified present on disk.
Both task commits verified in git history (04e47d9, 0be2612).

---
*Phase: 01-foundation*
*Completed: 2026-03-06*
