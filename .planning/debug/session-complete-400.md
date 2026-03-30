---
status: diagnosed
trigger: "Marking session complete causes 400 Bad Request on PATCH sessions"
created: 2026-03-20T00:00:00Z
updated: 2026-03-20T00:00:00Z
---

## Current Focus

hypothesis: CHECK constraint on sessions.status rejects 'completed' because the allowed values are ('active','submitted','returned','exported')
test: Compare value sent by frontend vs CHECK constraint in migration
expecting: Mismatch between frontend value and DB constraint
next_action: Return diagnosis

## Symptoms

expected: Clicking "Mark Complete" sets session status to "completed" and UI shows completed state
actual: PATCH returns 400 Bad Request, two consecutive errors in console
errors: PATCH https://wgrknodfxdjtddsirldw.supabase.co/rest/v1/sessions?id=eq.ef26d603-... 400 (Bad Request)
reproduction: Open any active session, click "Mark Complete", confirm
started: After Phase 14 migration to Supabase

## Eliminated

(none)

## Evidence

- timestamp: 2026-03-20T00:00:00Z
  checked: supabase/migrations/20260318000001_create_sessions.sql - CHECK constraint on status column
  found: CHECK constraint is `check (status in ('active', 'submitted', 'returned', 'exported'))` -- does NOT include 'completed'
  implication: Frontend sends status='completed' which violates the DB constraint, causing 400

- timestamp: 2026-03-20T00:00:00Z
  checked: src/pages/SessionDetail.tsx line 179
  found: `await updateSession(session.id, { status: "completed" })` -- sends 'completed'
  implication: Value 'completed' is not in the allowed CHECK constraint values

- timestamp: 2026-03-20T00:00:00Z
  checked: src/pages/SessionDetail.tsx line 125
  found: `const isCompleted = session.status === "completed"` -- UI checks for 'completed'
  implication: Frontend consistently uses 'completed' but DB expects different values

- timestamp: 2026-03-20T00:00:00Z
  checked: Two 400 errors observed
  found: The optimistic update in sessionStore sets status='completed' locally, then the Supabase PATCH fails. The error handler reverts (first call). The second 400 is likely the same call or a retry.
  implication: Confirms the DB rejects the value

## Resolution

root_cause: The Supabase sessions table CHECK constraint allows only ('active', 'submitted', 'returned', 'exported') but the frontend sends status='completed'. The value 'completed' is not in the allowed set, so PostgreSQL rejects it with a 400 Bad Request.
fix: Either (a) change the CHECK constraint to include 'completed' instead of or in addition to 'exported', or (b) change the frontend to send 'exported' or another valid status value. The correct fix depends on the intended workflow semantics.
verification: (pending)
files_changed: []
