---
status: partial
phase: 39-optimistic-locking
source: [39-VERIFICATION.md]
started: 2026-06-02T18:20:00.000Z
updated: 2026-06-02T18:20:00.000Z
---

## Current Test

[awaiting human testing — deferred to v1.3 milestone-end UAT batch per project policy]

## Tests

### 1. Cross-session live edit race does not silently lose a write
expected: With the migration applied to prod, open the same item's field in two sessions (two tabs or two devices). Edit and save the field in session A, then save a different value for the same field in session B (whose snapshot is now stale). Session B's write must hit a 0-row precondition miss and either reconcile (re-apply B's intent against the fresh row) or, on repeated collision, surface the DAT-4 ErrorToast with a Retry action — never a silent last-writer-wins overwrite. Confirm no write is silently lost and the toast appears on exhaustion.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps

(none — automated verification passed 4/4; this is live-environment confirmation only)

## Notes

- SC-1 live trigger-bump was confirmed empirically during execution (rolled-back transaction: an UPDATE bumped `items.updated_at` to now()) — not pending.
- The AI continuous-merge race (D-06) is proven by automated test (`continuous-merge-no-clobber.test.ts`); the continuous-mode UI itself is dormant (CONTINUOUS_MODE_ENABLED=false, D-050), so the live AI-vs-user race is not reachable in the shipped app and needs no on-device test.
- Branch push + this UAT batch are deferred to the v1.3 milestone close per standing policy.
