---
phase: 44-visibility-ux-polish
plan: 01
subsystem: ui
tags: [ux, react-router, error-handling, postgrest-23505, blocked-queue]
requires:
  - "react-router useNavigate (v7 bare import)"
  - "items.title / items.receipt_number columns (existing schema)"
  - "useNotificationStore.notifyError(message, retry?)"
provides:
  - "Named, tappable, navigating blocked-queue detail rows (SC1)"
  - "23505-aware import-failure toast that names the colliding receipt (SC2)"
affects:
  - "src/components/BlockedQueueBadge.tsx"
  - "src/pages/NewSession.tsx"
tech-stack:
  added: []
  patterns:
    - "useNavigate() inside row onClick (navigate + setOpen(false)) — close-on-nav idiom"
    - "catch (err) narrowed via (err as { code?: string } | null)?.code === '23505'"
    - "display fallback chain: title → #receipt → short id slice (never bare UUID)"
key-files:
  created: []
  modified:
    - "src/components/BlockedQueueBadge.tsx"
    - "src/tests/blocked-badge.test.tsx"
    - "src/pages/NewSession.tsx"
    - "src/tests/new-session-import-rollback.test.tsx"
decisions:
  - "Blocked-row label fallback chain title → #receipt → id.slice(0,8); never the bare UUID (Pitfall 3)"
  - "23505 import collision named singular (#lastReceipt) — in-file dupes pre-filtered to skipped, so exactly one DB collider"
  - "Gate strictly on code === '23505'; every other failure keeps the generic copy + retry (Pitfall 1)"
metrics:
  duration: "2 min"
  completed: "2026-06-04"
  tasks: 2
  files: 4
---

# Phase 44 Plan 01: visibility-ux-polish Summary

Two surgical v1.3 UAT fixes (F1 + F4): the blocked-queue badge dropdown now renders human-readable, tap-to-navigate rows instead of bare UUIDs, and a duplicate-receipt (Postgres 23505) import failure now names the offending receipt instead of showing generic copy.

## What Was Built

### SC1 (F1/U1) — BlockedQueueBadge named, tappable, navigating rows
- Extended `BlockedItem` with `title` / `receipt_number` and added both to the `fetchBlockedItems` select (`.select("id, mode, session_id, title, receipt_number")`).
- Added `blockedItemLabel()` — fallback chain `title` → `#receipt_number` → `id.slice(0,8)`. Never the raw UUID.
- Imported `useNavigate` (react-router v7 bare path); each `<li>` is now a full-width `<button>` that on tap calls `setOpen(false)` then `navigate('/session/${session_id}/item/${id}')`, with a compact `House`/`Sale` mode tag.
- Preserved the `tone="err"` Badge, `data-testid="blocked-queue-detail"`, classes, aria attributes, `key={item.id}`, and count/toggle logic unchanged.

### SC2 (F4/U2) — NewSession import names the colliding receipt
- Added `let lastReceipt` assigned at the top of each loop iteration (the loop variable at throw time is the single collider — RESEARCH Q2).
- Changed `} catch {` to `} catch (err) {`; after the unchanged reverse-order compensating deletes, narrowed `(err as { code?: string } | null)?.code === "23505"`.
- On a 23505: toast `Receipt #${lastReceipt} is already in use — that import was undone. Remove it and try again.` Every other failure keeps the verbatim generic copy. Retry callback `() => handleImport(receipts, skipped)` preserved in both branches.

## How It Was Verified
- `npx vitest --run src/tests/blocked-badge.test.tsx` — 12 pass (7 new RED→GREEN: named rows, #receipt fallback, short-id fallback, mode tag, tap-to-navigate, dropdown-close, plus the rewritten detail test).
- `npx vitest --run src/tests/new-session-import-rollback.test.tsx` — 7 pass (CR-02 now asserts `stringContaining("R2")` + retry; non-23505 "boom" still asserts generic copy).
- `npm test` — full suite 718 passed, 0 failed (4 files skipped, pre-existing).
- `npx tsc -b` — exit 0.

## Tasks Completed

| Task | Name | RED Commit | GREEN Commit | Files |
| ---- | ---- | ---------- | ------------ | ----- |
| 1 | SC1: BlockedQueueBadge named/tappable/navigating rows | d376354 | 2b32fda | BlockedQueueBadge.tsx, blocked-badge.test.tsx |
| 2 | SC2: NewSession import 23505 names receipt | ed2c98e | 3264604 | NewSession.tsx, new-session-import-rollback.test.tsx |

## Deviations from Plan

None — plan executed exactly as written. Stayed strictly on the four scoped files; no schema, deps, refactors, or adjacent changes.

## TDD Gate Compliance

Both tasks followed RED→GREEN with the gate commits present in git log: each task has a `test(44):` commit (RED, verified failing) followed by a `feat(44):` commit (GREEN, verified passing). No REFACTOR commit needed.

## Threat Flags

None. T-44-01 (info disclosure) accepted — renders only already-authorized RLS-gated row fields. T-44-02 (tampering) mitigated — strict `=== "23505"` gate; receipt text is React-escaped in the toast. No new query surface or endpoints.

## Notes
- STATE.md previously tracked 18 pre-existing `localStorage.clear` failures; those test files (`persist-scoping`, `photo-migration`) now pass/skip — no regression introduced by this plan.

## Self-Check: PASSED
All 4 modified files present, SUMMARY.md present, all 4 task commits (d376354, 2b32fda, ed2c98e, 3264604) found in git log.
