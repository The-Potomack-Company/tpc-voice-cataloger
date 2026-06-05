---
phase: 38-migration-retryability
plan: 02
subsystem: migration-ui
tags: [react-router, outlet-context, banner, migration, tdd, a11y]
requires:
  - "38-01: migrateToSupabase return shape { migrated, alreadyMigrated, failed, partial }"
provides:
  - "useDataMigration surfaces failed + alreadyMigrated split (D-06)"
  - "WarnBanner optional back-compat action slot (UI-SPEC §Component Inventory)"
  - "MigrationRetryBanner — persistent dismissible partial-migration banner reading shared hook via Outlet context (D-07, SC3)"
affects:
  - "ProtectedRoute now passes <Outlet context={migration} />"
  - "AppLayout mounts the banner after PhotoMigrationBanner"
tech-stack:
  added: []
  patterns:
    - "single-hook-instance sharing via react-router useOutletContext (no second useDataMigration → no parallel migration, T-38-04)"
    - "additive back-compat optional prop on a UI primitive (WarnBanner action slot)"
    - "null-render banner mirroring PhotoMigrationBanner precedent, sourcing Outlet context not useLiveQuery"
key-files:
  created:
    - src/components/MigrationRetryBanner.tsx
    - src/tests/migration-retry-banner.test.tsx
  modified:
    - src/hooks/useDataMigration.ts
    - src/components/ProtectedRoute.tsx
    - src/ui/WarnBanner.tsx
    - src/layouts/AppLayout.tsx
    - src/tests/migration-partial.test.tsx
decisions:
  - "busy/Retrying… label is dead code under the partial-only guard (state can't be both partial and in-progress) — dropped the unreachable branch to satisfy tsc; banner hides during in-flight retry, splash owns busy UI (D-08)"
  - "null-guarded the Outlet context read so AppLayout renders in isolated layout tests without a context provider"
metrics:
  duration: ~7m
  completed: 2026-06-02
  tasks: 2
  files: 7
---

# Phase 38 Plan 02: Partial-Migration Retry Banner Summary

Surfaced Plan 01's partial-migration state in the UI (SC3): `useDataMigration` now exposes the `failed`/`alreadyMigrated` split (replacing the legacy `skipped` stopgap), `WarnBanner` gained an optional back-compat `action` slot, and a new persistent dismissible `MigrationRetryBanner` reads the **single shared** hook instance via react-router `Outlet` context — never re-calling `useDataMigration`/`useLiveQuery`, so it cannot spawn a second migration (T-38-04). The banner renders the locked copy `{N} item(s) not yet synced` (N = failed only) with a `Retry sync` CTA that re-runs the idempotent Plan-01 migration.

## What Was Built

- **`useDataMigration`** (`src/hooks/useDataMigration.ts`): `MigrationStatus` now carries `alreadyMigrated` + `failed` (dropped the legacy `skipped` field 38-01 mapped as a stopgap); the success branch maps `result.alreadyMigrated`/`result.failed` directly. `partial` state + `retry: runMigration` unchanged.
- **`WarnBanner`** (`src/ui/WarnBanner.tsx`): optional `action?: { label, onClick, busy? }` rendered between body and dismiss X — a `tpc-btn` 44px (`min-h-11 min-w-11`) `refresh`-glyph button with `aria-busy`, inside the existing `role="status"` container, `warn` family (no accent fill). Omitting `action` renders byte-identically (only existing caller, SessionDetail, unaffected — full suite green).
- **`MigrationRetryBanner`** (`src/components/MigrationRetryBanner.tsx`, NEW): reads `useOutletContext<ReturnType<typeof useDataMigration> | null>()`; returns null when context is null, `state !== "partial"`, locally dismissed, or `failed === 0`. Renders `WarnBanner` with locked UI-SPEC copy (title `${failed} item${s} not yet synced`, body `Your data is safe — retry to finish syncing.`, action `Retry sync` → `m.retry`).
- **`ProtectedRoute`** (`src/components/ProtectedRoute.tsx`): `:71` feeds `migration.failed` to MigrationSplash's existing `skipped` prop (D-08, splash untouched); `:86` now `<Outlet context={migration} />`.
- **`AppLayout`** (`src/layouts/AppLayout.tsx`): mounts `<MigrationRetryBanner />` immediately after `<PhotoMigrationBanner />`.

## Verification

- `npx vitest run src/tests/migration-partial.test.tsx src/tests/migration-retry-banner.test.tsx` — green (4 + 6).
- `npx vitest run` full suite — 696 passed, 0 failed, 49 todo, 4 skipped.
- `npx tsc --noEmit` and `npx tsc --noEmit -p tsconfig.app.json` — clean.
- **No-second-migration gate:** `grep useDataMigration src/components/MigrationRetryBanner.tsx` → only the `import type` + `typeof` in the `useOutletContext` generic + a comment; no runtime call. `useLiveQuery` absent.
- SC3: banner renders "2 items not yet synced" + "Retry sync" for `{ state: "partial", failed: 2 }`; null for `failed: 0` and non-partial; click invokes context `retry`; "1 item" singularizes; dismiss hides for the session.

## TDD Gate Compliance

- Task 1: test edit (`migration-partial.test.tsx` → new shape) drove RED; hook/WarnBanner/ProtectedRoute edits drove GREEN — committed together as `feat(38-02)` `ab0823a` (shape change is one indivisible unit; test+impl coupled).
- Task 2: RED `migration-retry-banner.test.tsx` (component missing) → GREEN `MigrationRetryBanner` + ProtectedRoute/AppLayout wiring, committed `c764044`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `busy = state === "in-progress"` is unreachable under the partial-only guard (tsc TS2367)**
- **Found during:** Task 2 (`tsc -p tsconfig.app.json` after first GREEN).
- **Issue:** The plan's banner computes `busy = m.state === "in-progress"` *after* the `if (m.state !== "partial") return null` guard, which narrows `m.state` to the literal `"partial"`. TypeScript flagged the `=== "in-progress"` comparison as having no overlap (TS2367 — it can never be true). In production a partial banner is never in-flight: while a retry runs the hook is in `"in-progress"`, which hides this banner entirely (the at-login `MigrationSplash` owns the busy UI, D-08).
- **Fix:** Dropped the dead `busy` branch and the `"Retrying…"` label; the action is the locked `{ label: "Retry sync", onClick: m.retry }`. The `WarnBanner` `action.busy` prop still exists generically for other callers. Documented the reasoning in a WHY-comment.
- **Files modified:** `src/components/MigrationRetryBanner.tsx`.
- **Commit:** `c764044`.

**2. [Rule 1 - Bug] null Outlet context crashed isolated AppLayout layout tests**
- **Found during:** Task 2 (full-suite run — 4 failures in `src/tests/layout.test.tsx`).
- **Issue:** `layout.test.tsx` renders `<AppLayout/>` as a route element with no parent `<Outlet context>` provider, so `useOutletContext()` returns `null` and `m.state` threw `Cannot read properties of null`. In production AppLayout is always a child of ProtectedRoute's context Outlet, but the banner must be defensive.
- **Fix:** Typed the context as `ReturnType<typeof useDataMigration> | null` and added `!m ||` to the null-render guard. The banner test always provides a full ctx, so SC3 assertions are unaffected.
- **Files modified:** `src/components/MigrationRetryBanner.tsx`.
- **Commit:** `c764044`.

## Notes

- 38-01's stopgap (hook's `skipped` field mapped to `result.failed`) is fully retired — the hook now exposes the honest `failed`/`alreadyMigrated` split.
- `WarnBanner.action.busy` is a live prop (drives `disabled` + `aria-busy`) even though MigrationRetryBanner never sets it true — kept for the generic primitive contract.

## Self-Check: PASSED

All created/modified files exist on disk; both task commits (`ab0823a`, `c764044`) are in the git log.
