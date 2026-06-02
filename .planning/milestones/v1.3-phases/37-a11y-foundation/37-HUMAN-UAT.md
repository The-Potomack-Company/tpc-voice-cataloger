# Phase 37 (a11y-foundation) — HUMAN-UAT Items

Deferred manual/authenticated verification, per the v1.3 defer-UAT-to-milestone-end
policy. Run these before closing the v1.3 milestone.

## From Plan 37-03 (overflow menu + keyboard e2e)

### UAT-37-01 — Authed keyboard-only record→edit→save axe scan (SC4 remainder)

**Why deferred:** the record→edit→save flow lives behind auth (sessions list →
item detail), and this repo has no authed Playwright storage-state fixture. The
`tests/e2e/keyboard-flow.spec.ts` "authed" test is gated behind `SUPABASE_URL`
and skips cleanly when creds are absent. The unauthenticated-reachable surface
(`/login`) IS covered automatically (keyboard-only + axe-clean), so SC4 is not
dropped — only its authed leg is tracked here.

**How to verify (manual or with creds):**
1. With a real Supabase session available, run:
   `SUPABASE_URL=<url> npx playwright test keyboard-flow`
   — the previously-skipped authed test should run record→edit→save keyboard-only
   and assert zero axe violations.
2. OR manually: keyboard-only (no mouse), Tab to a session → Enter → Tab to an
   item → Enter → edit a field → save. Confirm focus is always reachable, the ⋯
   overflow menu opens/closes by keyboard, Escape restores focus to the trigger,
   and a screen reader announces the ⋯ trigger as "More actions, menu".

### UAT-37-02 — `meta-viewport` (user-scalable=no) WCAG 1.4.4

**Why deferred:** `index.html:5` sets `maximum-scale=1.0, user-scalable=no`,
which axe flags as a moderate WCAG 1.4.4 (resize-text) violation. Removing it
re-enables pinch-zoom app-wide across all three TPC surfaces — a shared-state
PWA design change outside Plan 37-03's scope, so the e2e axe assertion disables
the `meta-viewport` rule rather than silently flipping zoom behavior.

**Decision needed:** confirm whether to drop `user-scalable=no` (a11y win, but
changes mobile pinch-zoom UX for the PWA). If yes, edit `index.html:5` and remove
the `meta-viewport` entry from `.disableRules([...])` in `keyboard-flow.spec.ts`.

## From code review post-fix (WR-05, IN-03)

### UAT-37-03 — MigrationSplash error-state Escape maps to onSkip (WR-05)

**Why deferred:** The WR-05 fix (commit `e651dc7`) correctly wires
`onClose: state === "error" ? onSkip : () => {}` in `MigrationSplash`. No
automated test covers the error-state-specific keyboard path because triggering
the `error` state requires real migration infrastructure.

**How to verify:**
1. Force or observe a migration error (disconnect network mid-migration, or
   temporarily throw in `useDataMigration`).
2. When MigrationSplash is in the error state (shows "Retry Migration" /
   "Skip and Continue" buttons), confirm focus lands on a button.
3. Press Escape. Expected: the "Skip and Continue" action fires and the modal
   dismisses. Focus should not escape the modal before dismissal; keyboard user
   should not be stranded.

### UAT-37-04 — MigrationSplash auto-dismiss timer does not restart on parent re-render (IN-03)

**Why deferred:** The IN-03 fix (commit `2798f97`) stabilizes `onComplete` in a
ref so an unstable parent closure does not re-arm the 1500/1800ms dismiss timers.
Verifying timer-restart behavior requires real Dexie-driven parent re-renders
during an active migration.

**How to verify:**
1. Start a migration that completes successfully (or partial — both trigger the
   timer).
2. Observe the splash behavior: it should begin fading at approximately 1.5s and
   fully dismiss at approximately 1.8s.
3. Confirm it does not restart or delay — the dismiss timing should be consistent
   regardless of Dexie progress events firing during that window.
