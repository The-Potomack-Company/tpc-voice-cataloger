---
phase: 36-ux-visibility-polish
plan: 02
subsystem: error-visibility
tags: [error-handling, notifications, import-rollback, export, login, tdd, D-01, D-08, T-36-02, T-36-04]
requires:
  - "36-01: toUserMessage(err) + notificationStore (single-slot, deduped, sticky-when-retry)"
provides:
  - "Atomic import (client-side compensating rollback, D-01) — no orphan session/items on mid-loop failure (SC2)"
  - "Export failures surface a sticky retry toast (D-08, SC1)"
  - "Login renders friendly copy via toUserMessage — no raw GoTrue text (SC4a, T-36-02)"
affects:
  - "phase-36 plan 03 (shares the toUserMessage + notifyError funnel; no file overlap)"
tech-stack:
  added: []
  patterns:
    - "Client-side compensating rollback: track landed ids, reverse-order best-effort deletes on catch (mirrors migration.ts id-tracking precedent)"
    - "Catch-site rewire: console-only swallow → useNotificationStore.getState().notifyError(copy, retryFn)"
key-files:
  created:
    - src/tests/new-session-import-rollback.test.tsx
    - src/tests/session-export-notify.test.tsx
  modified:
    - src/pages/NewSession.tsx
    - src/pages/SessionDetail.tsx
    - src/pages/Login.tsx
    - src/tests/login-page.test.tsx
decisions:
  - "A3/Q2 resolved: deleteSession/deleteItem are Supabase-backed (FK cascade) operating on zustand+Supabase, not a Dexie idMapping — compensating deletes fully unwind landed rows, so NO explicit Dexie cleanup was added to the catch."
  - "doCreate + export use the fixed UI-SPEC copy strings (not toUserMessage's generic) because the spec prescribes operation-specific copy; tests lock the exact strings. Login uses toUserMessage (the branching credentials/network funnel)."
  - "Two pre-existing login tests asserted the raw 'Invalid login credentials' string (old insecure behavior). Updated to the friendly copy — those assertions encoded the exact oracle this plan closes (T-36-02)."
metrics:
  duration: ~12 min
  tasks: 2
  files: 5
  completed: 2026-06-02
---

# Phase 36 Plan 02: User-Operation Error Wiring Summary

Wired the export, new-session/import, and login handlers into the Phase 36 error-visibility layer: export failures now surface a sticky retry toast, imports are atomic via client-side compensating rollback, and login shows only friendly copy.

## What Was Built

- **Atomic import (SC2, D-01)** — `NewSession.handleImport` tracks `createdSessionId` + `createdItemIds` as it lands rows. On any mid-loop throw it compensates in reverse creation order (`deleteItem` per item, then `deleteSession`), each best-effort `.catch(() => {})` so a failed cleanup never masks the original error, then fires a sticky `notifyError("Import didn't finish — changes were undone. Try again.", () => handleImport(...))`. `navigate()` moved to the success path only — no orphan session/items remain (T-36-03 mitigation).
- **doCreate failure surfacing** — `NewSession.doCreate` (the non-import single-session create) now wraps `createSession` in try/catch and surfaces `notifyError("Couldn't create the session — nothing was saved. Try again.", () => doCreate())` instead of letting the promise reject silently. Navigation only on success.
- **Export failure surfacing (SC1, D-08)** — both `SessionDetail` export catch blocks (`handleExport` JSON, `handleExportSpreadsheet`) replaced their `console.error` swallow with `notifyError("Export failed — your data wasn't downloaded.", () => handleExport()/handleExportSpreadsheet())`. Retry attached ⇒ sticky toast (T-36-04 mitigation; raw err never rendered). `finally` setExporting/setExportingXlsx(false) preserved.
- **Friendly login copy (SC4a, T-36-02)** — `Login.tsx` changed `setError(error.message)` → `setError(toUserMessage(error))`. The existing `role="alert"` paragraph is unchanged; only the source string is now funneled.

## TDD Cycle

Both tasks followed RED → GREEN (no REFACTOR needed):

| Task | RED | GREEN |
|------|-----|-------|
| 1: import rollback + doCreate (`new-session-import-rollback.test.tsx`) | 3 failing (clean-import case already green) | `ffad0c6` |
| 2: export notify + login copy (`session-export-notify.test.tsx`, `login-page.test.tsx` extended) | 5 failing | `2a449aa` |

Each RED run failed for the right reason: Task 1 — no deletes/notify wired; Task 2 — export console-swallow + raw login text.

## Verification

- `npx vitest run src/tests/new-session-import-rollback.test.tsx src/tests/session-export-notify.test.tsx src/tests/login-page.test.tsx` — **19/19 green** (4 + 3 + 12).
- `npx vitest run` (full suite) — **620 passed, 0 failed**, 5 files skipped, 55 todo. (Plan 01 left 611; +9 new tests = 620.)
- `npx tsc --noEmit` — no type errors in NewSession/SessionDetail/Login.
- The 18 pre-existing `localStorage.clear` failures flagged in STATE.md do not appear at HEAD (same as Plan 01); no new failures introduced.

## A3/Q2 Resolution (research open question)

Read `useSessionStore.deleteSession` (sessionStore.ts:259) and `deleteItem` (:492): both operate on zustand state + Supabase (the latter also removes audio Storage blobs and relies on FK `ON DELETE CASCADE`). This app keeps sessions/items in zustand+Supabase, **not** a Dexie idMapping/cache. So the compensating deletes fully unwind every landed row — **no explicit Dexie cleanup was needed** in the import catch.

## Deviations from Plan

- **[Rule 1 - Bug] Updated two pre-existing login tests** that asserted the raw `'Invalid login credentials'` string. That assertion encoded the exact backend-text oracle this plan closes (T-36-02); after the GREEN change they would fail asserting old insecure behavior. Updated both to `'Wrong email or password'` with a WHY-comment. Commit `2a449aa`.
- **Copy source:** plan action text mentioned `notifyError(toUserMessage(err), ...)` for doCreate/export, but the same paragraphs instruct using the fixed UI-SPEC strings where the spec prescribes specific copy. Used the fixed strings (tests lock them); `toUserMessage` is used only at the login call site (its branching funnel). This is the planner-sanctioned override, not a deviation of consequence.

## Known Stubs

None.

## Threat Flags

None — no new security surface beyond the plan's `<threat_model>`. The changes implement the listed mitigations (T-36-02 login funnel, T-36-03 import rollback, T-36-04 export copy).

## Self-Check: PASSED

- FOUND: src/tests/new-session-import-rollback.test.tsx
- FOUND: src/tests/session-export-notify.test.tsx
- FOUND: commit ffad0c6, 2a449aa
