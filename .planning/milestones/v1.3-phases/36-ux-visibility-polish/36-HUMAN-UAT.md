---
status: partial
phase: 36-ux-visibility-polish
source: [36-VERIFICATION.md, 36-REVIEW.md]
started: 2026-06-02T14:30:00Z
updated: 2026-06-02T14:30:00Z
---

## Current Test

[awaiting human testing — deferred to v1.3 milestone-end UAT]

## Tests

### 1. Live duplicate-receipt import triggers rollback, not false success (CR-02 runtime confirmation)

expected: Import a CSV/XLSX where one receipt number already exists in Supabase (violating `items_receipt_unique`). The import must NOT navigate to a success state. A sticky failure toast ("Import didn't finish" / friendly copy) appears, and no orphan session/items remain in Supabase (the compensating reverse-order rollback removed every row created during the attempt). Confirms the assumption that a Postgres `23505` unique violation surfaces as a non-network error at runtime (`sessionStore.createItem` re-throws it into the rollback path rather than the offline-queue path). Unit test `new-session-import-rollback.test.tsx` validates the control flow with a mocked reject; this closes the live-runtime assumption.
result: [pending]

### 2. Offline import is refused up-front (CR-01)

expected: With the browser offline, starting a new-session import shows a friendly "You're offline — reconnect to import." toast and creates nothing (no session, no items, no queued writes). Going back online and retrying imports normally.
result: [pending]

### 3. Partial migration shows honest copy and drains the queue (SC3 / WR-01)

expected: On a migration that completes partially (≥1 item skipped), the MigrationSplash reports honest partial state (never full "success" copy), and after dismissal the app drains the write-ahead queue and fetches sessions (no stranded queued writes, no stale/empty list).
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

None — all 4 success criteria verified in code (4/4). These items confirm runtime/visual behavior that unit tests assert structurally.
