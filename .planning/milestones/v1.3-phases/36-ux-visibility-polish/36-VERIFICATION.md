---
phase: 36-ux-visibility-polish
verified: 2026-06-02T10:32:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Live duplicate-receipt import triggers rollback and no false-success navigation"
    expected: >
      Given a CSV/XLSX with a receipt number already used in Supabase (items_receipt_unique
      violation), the import should: (a) surface a sticky 'Import didn't finish — changes
      were undone. Try again.' ErrorToast, (b) not navigate to the session detail page, and
      (c) leave no orphan session or item rows in Supabase. The duplicate-receipt toast from
      the store (non-rollback path) must NOT fire alongside a success navigation.
    why_human: >
      CR-02's fix (passing receipt to createBlankItem at creation time so a 23505 violation
      throws rather than being swallowed by updateItemField) is unit-tested with a mock that
      rejects createBlankItem. The real-world guarantee depends on Supabase surfacing the
      23505 as a non-network error that propagates through createItem's catch+re-throw path
      (sessionStore.ts:407). The unit test validates control flow; a live import against the
      real DB is needed to confirm the error classification is correct at runtime.
---

# Phase 36: ux-visibility-polish Verification Report

**Phase Goal:** Make currently-silent failure and partial-state paths visible to the user — export failures, non-transactional session/import, false migration-success copy, silent fetch/admin/login errors — by surfacing toasts/states through the DAT-4 ErrorToast path.
**Verified:** 2026-06-02T10:32:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Export failures surface a toast with a retry affordance instead of failing silently | VERIFIED | `SessionDetail.tsx:252-261` (`handleExport`) and `:283-292` (`handleExportSpreadsheet`) both catch and call `notifyError("Export failed — your data wasn't downloaded.", () => ...)`. Retry callback attached → sticky (D-06 auto-dismiss gate verified in `ErrorToast.tsx:13-14`). Tests in `session-export-notify.test.tsx` lock both paths and the retry wire. |
| 2 | New-session / import is transactional — explicit rollback of partial state on failure; import refuses up-front when offline (CR-01) | VERIFIED | `NewSession.tsx:114-119`: offline-check refuses with `notifyError("You're offline — reconnect to import.")` before any row is created. `NewSession.tsx:125-165`: tracks `createdSessionId` + `createdItemIds`; on any throw compensates in reverse order via `deleteItem`/`deleteSession` with `.catch(()=>{})` guard, then fires sticky retry toast. CR-02: receipt passed to `createBlankItem` at creation (`NewSession.tsx:141`); `sessionStore.ts:371-408` confirms non-network errors revert + `throw err`, so a 23505 reaches the import catch. Unit tests (`new-session-import-rollback.test.tsx`) cover CR-01 refusal, CR-02 duplicate-throw rollback, mid-loop rollback, and retry re-run. |
| 3 | Migration success copy aligns with the DAT-1 `partial` flag — no false "success" when state is partial | VERIFIED | `useDataMigration.ts:41`: `result.partial ? "partial" : "complete"` — the `"partial"` state is a distinct success-path outcome. `MigrationSplash.tsx:63-68`: `state === "complete"` is the ONLY path to the full-success string; `state === "partial"` renders `"Some items couldn't be migrated. Your data is safe."`. `ProtectedRoute.tsx:60-63`: `"partial"` is wired into the splash render condition so the honest copy reaches the user. WR-05 also resolved: the error body no longer uses a `skipped` count (`MigrationSplash.tsx:73`). Tests (`migration-partial.test.tsx`) lock both the hook state and the splash copy. |
| 4 | Silent fetch errors, admin role/account load failures, and raw login errors all route to a visible ErrorToast with friendly copy; no console-only failures | VERIFIED | (a) **Login** (`Login.tsx:28`): `setError(toUserMessage(error))` — raw GoTrue text replaced by the three-string funnel. (b) **useUserRole** (`useUserRole.ts:46-49`): load error sets `ROLE_ERROR` sentinel (fail-closed, `isAdmin` stays false) and calls `notifyError(toUserMessage(error), retry)` — toast + retry. (c) **SessionDetail accounts load** (`SessionDetail.tsx:135-144`): `listAccounts()` catch calls `notifyError("Could not load team members...")` — IN-03 was fixed in the same pass (not deferred). (d) **offlineQueue** (`offlineQueue.ts:57`): `notifyError(toUserMessage(error))` with no retry → 6s auto-dismiss. All copy funnelled through `toUserMessage` (D-09 funnel at `toUserMessage.ts:6-18`). Tests cover all four paths. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/toUserMessage.ts` | Central error→friendly-copy funnel (D-09) | VERIFIED | Substantive: returns one of three fixed strings; BAD_CREDENTIALS + NETWORK_TOKENS regex plus navigator.onLine fallback. Wired: imported by `Login.tsx`, `useUserRole.ts`, `offlineQueue.ts`. |
| `src/stores/notificationStore.ts` | Single-slot, deduped (D-05), latest-wins | VERIFIED | Substantive: `set((s) => s.message === message ? s : {...})` dedupe in `notifyError`. Wired: consumed by all four catch sites. |
| `src/components/ErrorToast.tsx` | Retry-sticky auto-dismiss (D-06) | VERIFIED | Substantive: `if (message === null \|\| retry !== null) return;` in useEffect gates the 6s timer. Retry button present when `retry !== null`. `aria-label="Dismiss"` on dismiss button. |
| `src/pages/NewSession.tsx` | Import rollback + doCreate surfacing | VERIFIED | Substantive: CR-01 offline gate, CR-02 receipt-at-creation, compensating deletes in reverse order with `.catch(()=>{})` guard. Navigation only on success path. |
| `src/pages/SessionDetail.tsx` | Export failure toast (both paths) | VERIFIED | Substantive: both `handleExport` and `handleExportSpreadsheet` catch and call `notifyError` with retry. `finally` setExporting/setExportingXlsx preserved. IN-03 (accounts load) also wired. |
| `src/pages/Login.tsx` | Friendly login copy via toUserMessage | VERIFIED | `setError(toUserMessage(error))` replaces `setError(error.message)`. `role="alert"` paragraph unchanged. |
| `src/hooks/useDataMigration.ts` | Distinct `"partial"` state | VERIFIED | `result.partial ? "partial" : "complete"` branch on success path; `"error"` owns the catch. |
| `src/components/MigrationSplash.tsx` | `"partial"` prop + honest copy | VERIFIED | Props union includes `"partial"`. Partial auto-dismisses like complete (D-07). WR-05: error body no longer asserts a `skipped` count. |
| `src/components/ProtectedRoute.tsx` | `"partial"` wired to splash + drain/fetch | VERIFIED | `"partial"` in splash render condition (`ProtectedRoute.tsx:60-66`). `['complete','not-needed','partial'].includes(migration.state)` in drain/fetch effect (WR-01 fix). WR-03: `dismissMigration` wrapped in `useCallback`. |
| `src/hooks/useUserRole.ts` | Fail-closed ROLE_ERROR sentinel + surfaced error | VERIFIED | `ROLE_ERROR` sentinel keeps `isAdmin` false on load failure. Surfaces `notifyError(toUserMessage(error), retry)`. WR-02: keyed on `userId` not `user`; no `setRole(undefined)` in cleanup. |
| `src/services/offlineQueue.ts` | getQueuedItems read-failure surfaced | VERIFIED | `notifyError(toUserMessage(error))` with no retry (informational, 6s auto-dismiss). Empty-return contract preserved. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `Login.tsx` | `toUserMessage` | `import + setError(toUserMessage(error))` | WIRED | `Login.tsx:7,28` |
| `useUserRole.ts` | `notifyError` | `useNotificationStore.getState().notifyError(toUserMessage(error), retry)` | WIRED | `useUserRole.ts:46-49` |
| `offlineQueue.ts` | `notifyError` | `useNotificationStore.getState().notifyError(toUserMessage(error))` | WIRED | `offlineQueue.ts:57` |
| `NewSession.tsx` (doCreate) | `notifyError` | `useNotificationStore.getState().notifyError(...)` | WIRED | `NewSession.tsx:93-97` |
| `NewSession.tsx` (handleImport) | rollback + `notifyError` | `deleteItem`/`deleteSession` in catch, then `notifyError` | WIRED | `NewSession.tsx:148-165` |
| `NewSession.tsx` (CR-01) | offline gate | `if (!navigator.onLine) { notifyError(...); return; }` | WIRED | `NewSession.tsx:114-119` |
| `SessionDetail.tsx` (handleExport) | `notifyError` | `useNotificationStore.getState().notifyError("Export failed...", () => handleExport())` | WIRED | `SessionDetail.tsx:252-261` |
| `SessionDetail.tsx` (handleExportSpreadsheet) | `notifyError` | same pattern | WIRED | `SessionDetail.tsx:283-292` |
| `SessionDetail.tsx` (listAccounts) | `notifyError` | `useNotificationStore.getState().notifyError("Could not load team members...")` | WIRED | `SessionDetail.tsx:135-144` |
| `useDataMigration.ts` | `"partial"` state | `result.partial ? "partial" : "complete"` | WIRED | `useDataMigration.ts:41` |
| `MigrationSplash.tsx` | partial copy | `state === "partial"` branch renders `"Some items couldn't be migrated..."` | WIRED | `MigrationSplash.tsx:63-68` |
| `ProtectedRoute.tsx` | `"partial"` splash | `migration.state === 'partial' && !migrationDismissed` in render condition | WIRED | `ProtectedRoute.tsx:62` |
| `ProtectedRoute.tsx` | drain/fetch on `"partial"` | `['complete','not-needed','partial'].includes(migration.state)` | WIRED | `ProtectedRoute.tsx:42` |
| `ErrorToast.tsx` | sticky-on-retry | `if (message === null \|\| retry !== null) return;` in auto-dismiss effect | WIRED | `ErrorToast.tsx:13-14` |

### Behavioral Spot-Checks

Step 7b: SKIPPED — the app requires a running Vite dev server and Supabase backend for behavioral invocation. The test suite (637 passing) is the runnable equivalent.

### Probe Execution

Step 7c: No probe scripts declared for this phase and no `scripts/*/tests/probe-*.sh` files exist for this subsystem.

### Requirements Coverage

No requirements mapped in ROADMAP.md for Phase 36 (Track-2 quality track). N/A.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/pages/NewSession.tsx` | (import section) | Deferred item `toUserMessage` unused import resolved — no longer present | Info | Closed; deferred-items.md entry is stale |

No `TBD`, `FIXME`, or `XXX` markers found in phase-modified files. No stub implementations. No empty returns in user-visible render paths.

### Human Verification Required

#### 1. Live duplicate-receipt import — CR-02 runtime confirmation

**Test:** In the live app, create a session manually and add an item with receipt number `R001`. Then attempt to import a CSV/XLSX containing `R001` as one of its receipts (along with at least one unique receipt).

**Expected:**
- The import does NOT navigate to the session detail page.
- A sticky ErrorToast appears: "Import didn't finish — changes were undone. Try again."
- No orphan session or blank-receipt item is left in Supabase (check via dashboard or DB query).
- The duplicate-receipt toast from the store (the `"Receipt number 'R001' is already used..."` string) does NOT appear alongside a false success navigation.

**Why human:** CR-02's fix routes receipt persistence through `createBlankItem` at creation time, so a 23505 Postgres unique-violation propagates through `sessionStore.createItem`'s non-network catch and re-throws to `handleImport`'s rollback. The unit test (`new-session-import-rollback.test.tsx:125-152`) validates this with a mocked `createBlankItem` that rejects with `code: "23505"`. The live guarantee depends on Supabase surfacing the unique-constraint violation as a non-network error (code `"23505"`, not classified as `isNetworkError`) at runtime — the unit mock cannot verify Supabase's actual error classification.

---

### Gaps Summary

No gaps. All four success criteria are verified in the codebase.

The single human verification item (CR-02 live duplicate-receipt smoke test) is a runtime confirmation of already-verified control flow, not a code gap. Both the offline-refusal (CR-01) and the duplicate-throw-rollback (CR-02) paths are implemented and unit-tested; the human test closes the integration assumption about Supabase error classification.

Post-review fixes confirmed wired:
- **CR-01** (offline import refusal): `NewSession.tsx:114-119` — implemented and tested.
- **CR-02** (receipt at creation time): `NewSession.tsx:141` passes receipt to `createBlankItem`; `sessionStore.ts:407` confirms non-network errors re-throw.
- **WR-01** (partial drains write-ahead queue): `ProtectedRoute.tsx:42` includes `"partial"` in the state array.
- **WR-02** (userId-stable effect in useUserRole): `useUserRole.ts:62` keys on `userId`; no `setRole(undefined)` in cleanup.
- **WR-03** (stable `onComplete` callback): `ProtectedRoute.tsx:32` uses `useCallback`.
- **WR-05** (error copy no longer asserts skipped count): `MigrationSplash.tsx:73` — fixed copy.
- **IN-03** (SessionDetail accounts load silent): `SessionDetail.tsx:135-144` — `notifyError` wired.

---

_Verified: 2026-06-02T10:32:00Z_
_Verifier: Claude (gsd-verifier)_
