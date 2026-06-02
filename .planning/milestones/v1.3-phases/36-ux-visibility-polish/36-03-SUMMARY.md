---
phase: 36-ux-visibility-polish
plan: 03
subsystem: error-visibility
tags: [migration, access-control, offline-queue, fail-closed, tdd, D-07, SC3, SC4, ASVS-V4]
requires:
  - "36-01: toUserMessage(err) + notificationStore.notifyError"
provides:
  - "useDataMigration distinct 'partial' state (honest partial migration, SC3/D-07)"
  - "MigrationSplash 'partial' honest-copy branch (never claims full success)"
  - "useUserRole fail-closed ROLE_ERROR sentinel + surfaced load-error (SC4/ASVS V4)"
  - "getQueuedItems read-failure surfacing via notifyError (informational, T-36-07)"
affects:
  - "ProtectedRoute (wires 'partial' state to the splash so honest copy renders)"
  - "useUserRole consumers (Sessions/NewSession/SessionDetail — additive return fields, no breakage)"
tech-stack:
  added: []
  patterns:
    - "Distinct 'partial' success-path state decoupled from thrown-error 'error' state"
    - "Sentinel-role fail-closed access control: load-error ≠ not-admin, never grants admin"
    - "Visibility-only surfacing: notify on read failure while preserving empty-return contract"
key-files:
  created:
    - src/tests/migration-partial.test.tsx
    - src/tests/offline-queue-notify.test.ts
  modified:
    - src/hooks/useDataMigration.ts
    - src/components/MigrationSplash.tsx
    - src/components/ProtectedRoute.tsx
    - src/hooks/useUserRole.ts
    - src/services/offlineQueue.ts
    - src/tests/use-user-role.test.ts
decisions:
  - "MigrationSplash 'partial' auto-dismisses like 'complete' (no retry button in P36 per D-07) so the modal never traps the user"
  - "ProtectedRoute wired for 'partial' (Rule 2): without it the partial state is dead code and SC3 is unmet at runtime — additive to the plan's 4 files"
  - "useUserRole error surfaced as toUserMessage(error) WITH a retry (refetch via reloadKey bump) — role load is a retryable access-control read; offlineQueue surfaced WITHOUT retry (informational, 6s auto-dismiss per scope guard)"
  - "ROLE_ERROR is a non-'admin' string sentinel so isAdmin (=== 'admin') stays false on error; sentinel is scrubbed from the public `role` field"
metrics:
  duration: ~5 min
  tasks: 2
  files: 8
  completed: 2026-06-02
---

# Phase 36 Plan 03: Remaining Silent Paths Summary

Closed the three remaining silent paths that did not touch Plan 02's pages: migration false-success copy (SC3/D-07), `useUserRole` silent admin-demotion (SC4 / ASVS V4 fail-closed), and the `offlineQueue` silent fetch-read failure (SC4) — all funnelling through Plan 01's `toUserMessage` + `notifyError`.

## What Was Built

### Task 1 — Migration partial honesty (SC3, D-07)
- **`useDataMigration`** gained a distinct `"partial"` state. The success path now branches `result.partial ? "partial" : "complete"`; thrown failures still own `"error"` via the catch. A run that skipped ≥1 item can no longer reach `"complete"`.
- **`MigrationSplash`** props union widened to include `"partial"`, with an honest copy branch rendering `Some items couldn't be migrated. Your data is safe.` (the UI-SPEC-locked partial string, warn family). The full-success string is reachable **only** on a true clean `"complete"` run. Partial auto-dismisses like complete (no Phase-38 retry/Settings flow added).
- **`ProtectedRoute`** wires the new `"partial"` state to the splash (Rule 2 — without it the partial state never renders and SC3 is unmet at runtime).

### Task 2 — useUserRole fail-closed + offlineQueue surfacing (SC4)
- **`useUserRole`** now distinguishes a load **error** from a legitimate not-admin (`null`). A new `ROLE_ERROR` sentinel (a non-`"admin"` string) keeps `isAdmin` false on failure (fail closed, ASVS V4), exposes `error: boolean`, scrubs the sentinel from the public `role`, and surfaces the failure via `notifyError(toUserMessage(error), retry)` where `retry` re-runs the fetch (reloadKey bump). Not-admin / loading / no-user produce no error signal and no toast.
- **`offlineQueue.getQueuedItems`** still returns `[]` on a read error (intentional empty-return contract preserved) but now also fires `notifyError(toUserMessage(error))` with **no** retry → informational, 6s auto-dismiss (T-36-07). Success path does not notify.

## TDD Cycle

| Task | RED commit | GREEN commit |
|------|-----------|--------------|
| 1: migration partial honesty | `b91c81d` | `e3602cb` |
| 2: useUserRole fail-closed + offlineQueue surfacing | `eeeb899` | `befb685` |

Each RED failed for the right reason (Task 1: hook returned `"complete"` not `"partial"`; splash missing partial copy. Task 2: `error` field undefined on all role states; offlineQueue notifyError never called). No REFACTOR needed — implementations were minimal.

## Verification

- `npx vitest run src/tests/data-migration.test.ts src/tests/migration-partial.test.tsx src/tests/use-user-role.test.ts src/tests/offline-queue-notify.test.ts` — **25/25 green**
- Full suite (`npx vitest run`) — **631 passed, 0 failed**, 4 files skipped, 49 todo. No new failures; the 18 pre-existing `localStorage.clear` failures are absent at HEAD (consistent with Plan 01).
- `npx tsc -p tsconfig.app.json` on touched files — clean.

## Deviations from Plan

### Rule 2 — Auto-add missing critical functionality
**1. ProtectedRoute wired for the `"partial"` state**
- **Found during:** Task 1 GREEN
- **Issue:** `ProtectedRoute` only rendered the splash for `in-progress | complete | error`. Adding `"partial"` to the hook/component alone would leave it dead code — the honest partial copy would never reach the user and SC3 would be unmet at runtime.
- **Fix:** Added `"partial"` to both the gating condition and the splash-render condition in `ProtectedRoute.tsx`.
- **Files modified:** src/components/ProtectedRoute.tsx
- **Commit:** `e3602cb`

### Test-mock dedupe note (not a code change)
The `useUserRole` load-error test asserts `notifyError` was called (not exactly once): under StrictMode the effect double-invokes, but the real `notificationStore` dedupes identical messages (D-05), so the user sees one toast. Assertion reflects the deduped contract.

## Out-of-Scope (Deferred)

- `src/pages/NewSession.tsx:5` — unused `toUserMessage` import (TS6133). Verified pre-existing at HEAD before this plan (Plan 02 surface). Not fixed per scope boundary; logged to `deferred-items.md`.

## Known Stubs

None.

## Threat Flags

None — no new security surface beyond the plan's `<threat_model>`. `useUserRole` is the mitigation for T-36-05 (fail-closed) / T-36-06 (toUserMessage funnel); `offlineQueue` is the mitigation for T-36-07. No raw backend text rendered (all error copy routed through `toUserMessage`).

## Self-Check: PASSED
