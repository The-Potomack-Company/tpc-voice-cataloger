---
phase: 37-a11y-foundation
verified: 2026-06-02T11:45:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Keyboard-only authed flow: record → edit → save"
    expected: "Focus always reachable; ⋯ menu opens/closes by keyboard; Escape restores focus to trigger; screen reader announces trigger as 'More actions, menu'. Zero axe violations on authenticated pages."
    why_human: "Authed Playwright test (keyboard-flow.spec.ts test 2) skips without SUPABASE_URL; no authed storage-state fixture exists in repo."
  - test: "meta-viewport user-scalable=no decision (WCAG 1.4.4)"
    expected: "Decision: remove user-scalable=no for a11y win OR accept the axe disableRules exemption and keep current PWA pinch-zoom behavior."
    why_human: "Removing user-scalable=no is a shared-state PWA design change affecting all three TPC surfaces — requires product owner decision, not automated verification."
  - test: "MigrationSplash error-state Escape maps to onSkip"
    expected: "When MigrationSplash is in 'error' state, pressing Escape triggers the 'Skip and Continue' action rather than doing nothing. Focus remains on the modal buttons; keyboard user is not stranded."
    why_human: "MigrationSplash Escape behavior is state-conditional (error vs non-error); verified correct in code review but no focused automated test for the error-state keyboard path. Code change (WR-05 fix, e651dc7) maps onClose: state === 'error' ? onSkip : () => {} — needs human to confirm UX feels correct in-browser."
  - test: "MigrationSplash auto-dismiss does not restart on unstable onComplete ref (IN-03)"
    expected: "During an active migration, if the parent re-renders with a new onComplete closure, the 1500/1800ms dismiss timers do not reset. The splash dismisses on schedule."
    why_human: "onCompleteRef stabilization (2798f97) is correct in code but the timer behavior under parent re-render stress is only testable with real Dexie/migration infrastructure."
---

# Phase 37: a11y-foundation Verification Report

**Phase Goal:** Add baseline accessibility primitives across the app — modal focus-trap, minimum touch targets, icon-button labels, and a non-swipe delete affordance — so keyboard-only and assistive-tech users can complete core flows.
**Verified:** 2026-06-02T11:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A reusable focus-trap + aria-modal primitive is applied to every modal site (5 modals: ConfirmDialog, ReturnDialog, ItemPeekModal, PhotoLightbox, MigrationSplash) | ✓ VERIFIED | All 4 Modal-based components import and use `<Modal>` from `src/ui/Modal.tsx` (which applies `role="dialog" aria-modal="true"` + `useFocusTrap` via ModalPanel). MigrationSplash folds `useFocusTrap` directly. Code confirmed in source; 22-test modal suite green. |
| 2 | Action buttons meet a 44px minimum touch target; icon-only buttons have tooltips/aria-labels | ✓ VERIFIED | OverflowMenu trigger has `min-h-11 min-w-11` (44px) + `aria-label` + `title`. ItemPeekModal close button has `min-h-11 min-w-11` + `aria-label="Close item preview"`. PhotoLightbox buttons have `min-w-12 min-h-12`. `touch-targets.test.tsx` (1 test) green. |
| 3 | A non-swipe delete affordance (⋯ menu) exists for delete, routing through the existing ConfirmDialog (no new unconfirmed destructive path) | ✓ VERIFIED | `src/ui/OverflowMenu.tsx` exists and is substantive. Wired into ItemCard (`:239` → `setShowDeleteConfirm(true)` → existing `ConfirmDialog`), SessionTile (`:208` → `onDelete` prop w/ WR-06 contract JSDoc), SessionCard (`:175` → `onDelete` prop). `row-overflow-menu.test.tsx` (3 tests) proves each delete path. Swipe gesture preserved alongside. |
| 4 | axe-core scan on representative pages is clean; keyboard-only navigation completes the login flow (authed leg deferred to HUMAN-UAT) | ✓ VERIFIED | `npx playwright test keyboard-flow` → 1 passed (login keyboard + axe-clean), 1 skipped (authed, credential-gated). Login has `<main>` landmark (`:36`). `keyboard-flow.spec.ts` asserts zero axe violations on `/login`. Full suite: 686 passed, 0 failures, `tsc --noEmit` clean. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/hooks/useFocusTrap.ts` | Zero-dep focus trap with CR-01 fix | ✓ VERIFIED | 119 lines; `onCloseRef = useRef(onClose)` pattern confirmed; deps array `[panelRef, initialFocusRef]` — onClose absent. IN-02 forward-Tab guard present. |
| `src/hooks/usePrefersReducedMotion.ts` | Extracted shared hook (IN-01) | ✓ VERIFIED | 24 lines; SSR-safe; imported by Modal, OverflowMenu, MigrationSplash. |
| `src/ui/Modal.tsx` | `<Modal>` + `<ModalPanel>` split (WR-02 fix) | ✓ VERIFIED | 94 lines; `Modal` returns null when `!open`; `ModalPanel` holds the hook call — trap mounts/unmounts with open flag. `createPortal` + `role="dialog"` + `aria-modal="true"`. |
| `src/ui/OverflowMenu.tsx` | APG menu-button, 44px trigger, WR-01 fix | ✓ VERIFIED | 159 lines; `items.length === 0` guard at line 89; `aria-haspopup="menu"` + `aria-expanded`; Escape closes and restores focus; `tpc-btn` ring class on items. |
| `src/components/ConfirmDialog.tsx` | Migrated to `<Modal>`, IN-04 --err token | ✓ VERIFIED | Routes through `<Modal open onClose={onCancel} ariaLabelledBy={titleId}>`. Destructive button uses `var(--err)` via inline style. |
| `src/components/ReturnDialog.tsx` | Migrated to `<Modal>`, textarea initialFocusRef | ✓ VERIFIED | `<Modal ... initialFocusRef={textareaRef}>`. Escape === cancel via onCancel. |
| `src/components/ItemPeekModal.tsx` | Migrated to `<Modal>`, WR-03 sort_order guard | ✓ VERIFIED | `<Modal open onClose={onClose} ariaLabelledBy={titleId} bareOverlay ...>`. Sort_order guard: `typeof item.sort_order === "number" ? item.sort_order + 1 : "?"`. |
| `src/components/PhotoLightbox.tsx` | Migrated to `<Modal bareOverlay>`, WR-04 id guard | ✓ VERIFIED | `<Modal open onClose={onClose} ariaLabel="Photo viewer" bareOverlay ...>`. WR-04: `if (currentPhoto.id == null) { setShowDeleteConfirm(false); return; }` before delete. |
| `src/components/MigrationSplash.tsx` | useFocusTrap direct, WR-05 error Escape, IN-03 ref | ✓ VERIFIED | `useFocusTrap(panelRef, { onClose: state === "error" ? onSkip : () => {} })`. `onCompleteRef` stabilizes auto-dismiss timers. |
| `src/components/ItemCard.tsx` | ⋯ menu in collapsed-row header | ✓ VERIFIED | `import { OverflowMenu }` at :14; `<OverflowMenu` at :239; routes to `setShowDeleteConfirm(true)`. |
| `src/components/SessionTile.tsx` | ⋯ menu before chevron, WR-06 JSDoc | ✓ VERIFIED | `import { OverflowMenu }` at :19; `<OverflowMenu` at :208; `onDelete` JSDoc documents confirm contract. |
| `src/components/SessionCard.tsx` | ⋯ menu in header, WR-06 JSDoc | ✓ VERIFIED | `import { OverflowMenu }` at :6; `<OverflowMenu` at :175; `onDelete` JSDoc documents confirm contract. |
| `src/pages/Login.tsx` | `<main>` landmark (Rule 2 fix) | ✓ VERIFIED | Root `<div>` replaced by `<main className="flex items-center justify-center h-dvh">` at :36. |
| `tests/e2e/keyboard-flow.spec.ts` | keyboard-only + axe gate, authed leg skips | ✓ VERIFIED | Playwright test 1 passes (axe-clean login); test 2 skips cleanly when `SUPABASE_URL` absent. |
| `src/tests/a11y/` (6 files) | Full a11y unit suite | ✓ VERIFIED | 48 tests across 6 files — all passing: use-focus-trap (9), modal (6), modals (22), overflow-menu (7), touch-targets (1), row-overflow-menu (3). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `ConfirmDialog` | `Modal` primitive | `import + <Modal open onClose={onCancel}>` | ✓ WIRED | Confirmed in source |
| `ReturnDialog` | `Modal` primitive | `import + <Modal ... initialFocusRef={textareaRef}>` | ✓ WIRED | Confirmed in source |
| `ItemPeekModal` | `Modal` primitive | `import + <Modal ... bareOverlay>` | ✓ WIRED | Confirmed in source |
| `PhotoLightbox` | `Modal` primitive | `import + <Modal ... bareOverlay>` | ✓ WIRED | Confirmed in source |
| `MigrationSplash` | `useFocusTrap` | direct import + `useFocusTrap(panelRef, {...})` | ✓ WIRED | Confirmed in source |
| `Modal` | `useFocusTrap` | via `ModalPanel` child | ✓ WIRED | ModalPanel calls `useFocusTrap(panelRef, { onClose, initialFocusRef })` |
| `ItemCard` | existing `ConfirmDialog` | `OverflowMenu` → `setShowDeleteConfirm(true)` | ✓ WIRED | No new destructive path |
| `SessionTile` | existing `onDelete` prop | `OverflowMenu` → `onDelete` with contract JSDoc | ✓ WIRED | WR-06 contract documented |
| `SessionCard` | existing `onDelete` prop | `OverflowMenu` → `onDelete` with contract JSDoc | ✓ WIRED | WR-06 contract documented |
| `Login.tsx` | `<main>` landmark | `div → main` element replacement | ✓ WIRED | axe scan passes on `/login` |

### Data-Flow Trace (Level 4)

Not applicable — this phase adds UI primitives and accessibility attributes. No new data fetching or rendering of dynamic database content was introduced. Focus management and ARIA attributes are structural, not data-driven.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All a11y unit tests pass | `npm test -- src/tests/a11y/` | 48 tests, 6 files, 0 failures | ✓ PASS |
| Full suite regression | `npm test` | 686 passed, 0 failures, 4 file-skips | ✓ PASS |
| TypeScript clean | `npx tsc --noEmit -p tsconfig.app.json` | zero errors | ✓ PASS |
| Playwright keyboard + axe gate | `npx playwright test keyboard-flow` | 1 passed (login), 1 skipped (authed) | ✓ PASS |

### Probe Execution

No probe scripts declared for this phase.

### Requirements Coverage

No `requirements:` frontmatter declared in plans. Phase scope is tracked via Codex backlog items (#33/#34/#48 focus-trap; #46 touch targets; #49 icon labels; #32 swipe alternative) — all four are evidenced by the verified artifacts above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | Scan clean across all 12 phase-modified files |

No `TBD`, `FIXME`, or `XXX` markers found in any phase-modified file. No stub returns (`return null`, `return {}`, `return []`) that route to user-visible output. No empty handlers in production paths.

### Human Verification Required

The automated checks are all green. Four items require human or credentialed verification before the phase can be fully closed:

#### 1. Authed Keyboard-Only Flow (UAT-37-01)

**Test:** With a real Supabase session, run `SUPABASE_URL=<url> npx playwright test keyboard-flow` — the previously-skipped authed test should exercise record→edit→save keyboard-only and assert zero axe violations. OR manually: keyboard-only, Tab to a session → Enter → Tab to an item → Enter → edit a field → save.
**Expected:** Focus always reachable; ⋯ overflow menu opens/closes by keyboard; Escape restores focus to the trigger; screen reader announces "More actions, menu". Zero axe violations on all authed pages.
**Why human:** No authed Playwright storage-state fixture in repo. Credential-gated.

#### 2. meta-viewport user-scalable=no (UAT-37-02)

**Test:** Decide whether to remove `user-scalable=no, maximum-scale=1.0` from `index.html:5`.
**Expected:** If removed — pinch-zoom re-enabled app-wide, axe `meta-viewport` rule removed from `.disableRules([...])` in `keyboard-flow.spec.ts`. If kept — current behavior preserved with documented rationale.
**Why human:** Shared-state PWA design decision affecting all three TPC surfaces. Requires product owner sign-off.

#### 3. MigrationSplash Error-State Escape → onSkip (WR-05)

**Test:** Trigger a migration error (e.g., disconnect network mid-migration or force the error state in dev). With keyboard only, attempt to dismiss the error modal via Escape.
**Expected:** Pressing Escape activates the "Skip and Continue" action. Focus does not escape the modal; user is not keyboard-stranded.
**Why human:** Code fix confirmed correct (WR-05, commit e651dc7). No automated test covers the error-state-specific Escape path in the modal test suite. Behavior is conditional on `state === "error"` which requires real migration infrastructure to trigger.

#### 4. MigrationSplash Auto-Dismiss Timer Stability (IN-03)

**Test:** During an active migration on a live device, observe whether the splash auto-dismisses after 1.8s without restarting due to parent re-renders.
**Expected:** Splash fades at ~1.5s and dismisses at ~1.8s regardless of how many times the parent re-renders during that window.
**Why human:** `onCompleteRef` stabilization (IN-03, commit 2798f97) is correct in code. Timer restart under Dexie-driven parent re-render stress is only observable with real migration infrastructure.

### Gaps Summary

No gaps. All four success criteria are met in the shipped code:

1. `useFocusTrap` + `<Modal>` primitive is applied to all 5 modal sites — confirmed in source, proven by 22 modal tests. CR-01 (re-arm bug) fixed before shipping.
2. 44px touch targets on OverflowMenu trigger and ItemPeekModal close button; all icon-only buttons have `aria-label` + `title`. 1 touch-target test green.
3. `OverflowMenu` wired into all 3 row components routing through the existing confirm path. 3 wiring tests green. No new unconfirmed destructive path.
4. axe scan clean on `/login` (the deepest unauthenticated-reachable surface). Playwright gate: 1 passed, 1 skipped (credential-gated — tracked as UAT-37-01).

The `human_needed` status reflects four deferred verification items (two from Plan 03, two from the post-review code fixes) that require real infrastructure or a product decision. All automated checks pass.

---

_Verified: 2026-06-02T11:45:00Z_
_Verifier: Claude (gsd-verifier)_
