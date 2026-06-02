---
phase: 36-ux-visibility-polish
plan: 01
subsystem: error-visibility
tags: [error-handling, notifications, toast, a11y, tdd, D-09, D-05, D-06]
requires: []
provides:
  - "toUserMessage(err): central error→friendly-copy mapping (D-09)"
  - "notificationStore dedupe (D-05)"
  - "ErrorToast retry-sticky auto-dismiss gating (D-06)"
affects:
  - "phase-36 plans 02 & 03 (all silent catch sites funnel through toUserMessage + notifyError)"
tech-stack:
  added: []
  patterns:
    - "Single error-copy funnel returning one of three fixed strings (no raw backend text)"
    - "Single-slot latest-wins notification store with identical-message dedupe"
    - "Effect-gated auto-dismiss (retry !== null ⇒ sticky)"
key-files:
  created:
    - src/lib/toUserMessage.ts
    - src/tests/to-user-message.test.ts
    - src/tests/error-toast.test.tsx
  modified:
    - src/stores/notificationStore.ts
    - src/components/ErrorToast.tsx
decisions:
  - "toUserMessage inlines the network-token set (mirrors sessionStore.isNetworkError) rather than importing it — this layer is the new single funnel (per 36-PATTERNS)"
  - "navigator.onLine === false short-circuits to the connection string even for unmapped messages"
  - "ErrorToast aria-label=\"Dismiss\" was already present from v1.2 — no change needed; test locks it"
metrics:
  duration: ~10 min
  tasks: 2
  files: 5
  completed: 2026-06-02
---

# Phase 36 Plan 01: Error-Visibility Contract Layer Summary

Shared error-visibility contract: `toUserMessage(err)` copy-mapping helper plus the two DAT-4 behavior changes (dedupe + retry-sticky auto-dismiss) that every downstream Phase 36 plan consumes.

## What Was Built

- **`toUserMessage(err: unknown): string`** (D-09) — pure funnel returning exactly one of three fixed strings: `Wrong email or password` (bad-credentials, case-insensitive), `Connection problem — try again` (network tokens OR `navigator.onLine === false`), `Something went wrong` (fallback). Raw Supabase/JSON/stack text never escapes this layer (T-36-01, T-36-02 mitigations).
- **`notificationStore` dedupe (D-05)** — `notifyError` no-ops when the new message equals the current message (`set((s) => s.message === message ? s : {...})`), killing flicker/spam from repeated identical fires. Single-slot, latest-wins preserved; `dismiss` unchanged.
- **`ErrorToast` retry-sticky (D-06)** — the 6s auto-dismiss effect now early-returns when `message === null || retry !== null` and includes `retry` in its dep array. Retryable toasts persist until the user taps Try Again or Dismiss; informational toasts keep the 6s timer. Retry-button `onClick` (retry(); dismiss()) untouched.

## TDD Cycle

Both tasks followed RED → GREEN (no REFACTOR needed — implementations were minimal and clean):

| Task | RED commit | GREEN commit |
|------|-----------|--------------|
| 1: toUserMessage | `3246909` test | `2a65edf` feat |
| 2: dedupe + sticky | `d32b30f` test | `086b794` feat |

Each RED run failed for the right reason (Task 1: module absent; Task 2: 2 assertions — store replaced on dup, toast dismissed retryable at 6s).

## Verification

- `npx vitest run src/tests/to-user-message.test.ts src/tests/error-toast.test.tsx` — 10/10 green
- `npx vitest run` (full suite) — **611 passed, 0 failed**, 5 files skipped, 55 todo

Note: the 18 pre-existing `localStorage.clear is not a function` failures flagged in STATE.md / the plan's test_pattern no longer appear — `persist-scoping.test.ts` and `photo-migration.test.ts` are green at HEAD. No new failures introduced regardless.

## Deviations from Plan

None of consequence. The plan's Task 2 step (c) (ensure Dismiss button has `aria-label="Dismiss"`) was already satisfied by the v1.2 ErrorToast — the test now locks it as a regression guard, but no code change was required.

## Known Stubs

None.

## Threat Flags

None — no new security surface beyond the plan's `<threat_model>` (toUserMessage is the mitigation for T-36-01/T-36-02, not new surface).

## Self-Check: PASSED

- FOUND: src/lib/toUserMessage.ts
- FOUND: src/tests/to-user-message.test.ts
- FOUND: src/tests/error-toast.test.tsx
- FOUND: commit 3246909, 2a65edf, d32b30f, 086b794
