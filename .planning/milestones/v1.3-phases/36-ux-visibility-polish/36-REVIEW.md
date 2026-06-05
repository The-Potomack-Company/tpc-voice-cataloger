---
phase: 36-ux-visibility-polish
reviewed: 2026-06-02T00:00:00Z
depth: deep
files_reviewed: 11
files_reviewed_list:
  - src/lib/toUserMessage.ts
  - src/stores/notificationStore.ts
  - src/components/ErrorToast.tsx
  - src/components/MigrationSplash.tsx
  - src/components/ProtectedRoute.tsx
  - src/hooks/useDataMigration.ts
  - src/hooks/useUserRole.ts
  - src/pages/Login.tsx
  - src/pages/NewSession.tsx
  - src/pages/SessionDetail.tsx
  - src/services/offlineQueue.ts
findings:
  critical: 2
  blocker: 2
  warning: 5
  info: 4
  total: 11
status: findings
---

# Phase 36: Code Review Report

**Reviewed:** 2026-06-02
**Depth:** deep (cross-file: import rollback chain, role/migration call graphs)
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 36 wires previously-silent failure paths into the DAT-4 toast layer and adds
client-side import atomicity. The security-critical surfaces in the focus brief
hold up: `toUserMessage` cannot leak raw backend text (it returns one of three
fixed strings), `useUserRole` fails closed (`isAdmin === "admin"` over a non-admin
sentinel), and `ErrorToast` correctly gates its auto-dismiss on `retry !== null`.

However, deep tracing of the **import-rollback call chain** (the phase's flagship
"atomic import" claim, D-01/SC2) reveals the atomicity guarantee is narrower than
advertised: the store actions it depends on **swallow network errors and
receipt-duplicate errors internally and return normally**, so the compensating
rollback never fires for the two most likely real-world failure modes. The import
then navigates to "success" leaving queued/incomplete rows. Separately,
`ProtectedRoute`'s drain/fetch effect was not updated for the new `partial`
migration state, so a partial migration strands the write-ahead queue and skips
the session fetch.

## Critical Issues

### CR-01: Import "atomicity" does not cover network failures — orphan/queued rows on flaky connection

**File:** `src/pages/NewSession.tsx:116-153` (chain → `src/stores/sessionStore.ts:304-408, 411-489`)
**Issue:** `handleImport` assumes any failure throws into its `catch` so the
compensating rollback can run. It does not. The underlying store actions
short-circuit on network errors:

- `createItem` (via `createBlankItem`) on `isNetworkError(err)` **queues an offline
  write and returns `tempId` normally** (`sessionStore.ts:372-390`) — it does not
  throw.
- `updateItemField` on `isNetworkError(err)` likewise **enqueues and returns**
  (`sessionStore.ts:436-443`).

So when the connection drops mid-import, every `createBlankItem`/`updateItemField`
call "succeeds" offline, the loop completes, and `navigate()` runs the success
path. No rollback fires, and a session plus N partially-populated items are left
in the write-ahead queue. This is the exact "not transactional" failure
(Codex #7/#8) the phase was meant to close (SC2/D-01), and it is unhandled in the
most common failure scenario for a mobile cataloger.
**Fix:** Either (a) detect offline before starting the import and refuse
(`if (!navigator.onLine) { notifyError("You're offline — connect to import."); return; }`),
or (b) have the import path use a throwing variant of the create/update calls so a
mid-loop network failure reaches the `catch` and triggers compensation. Document
which semantics are intended; silent offline-queueing during a "transactional"
import contradicts D-01.

### CR-02: Receipt-number duplicate silently produces a blank-receipt item and a false-success import

**File:** `src/pages/NewSession.tsx:124-132` (chain → `src/stores/sessionStore.ts:456-488`)
**Issue:** `updateItemField` catches a Postgres unique-violation on
`receipt_number` (`code 23505` / `items_receipt_unique`), reverts the field, fires
its **own** `notifyError`, and **returns normally without re-throwing**
(`sessionStore.ts:467-470`). Inside `handleImport`'s loop this means:
1. The blank item created by `createBlankItem` is **not** rolled back (no throw).
2. The loop continues to the next receipt.
3. `navigate()` runs the success path and stores `importToast` = "N items
   created".

Result: a duplicate receipt in the imported file silently yields a session with
one or more items that have **no receipt number**, while the UI claims the import
fully succeeded. The user gets a confusing duplicate-receipt toast (from the store)
layered under a success navigation, and orphan blank items persist. This breaks
both the atomicity claim (SC2) and the honesty goal of the phase.
**Fix:** In the import loop, do not rely on `updateItemField`'s internal handling.
Either set `receipt_number` at item-creation time (pass it to `createBlankItem`,
which already accepts `receiptNumber`) and treat any failure as a throw, or make
the import use a throwing update so a duplicate aborts and triggers the
compensating rollback. At minimum, the loop must not reach `navigate()` when any
receipt failed to persist.

## Warnings

### WR-01: Partial migration strands the write-ahead queue and skips session fetch

**File:** `src/components/ProtectedRoute.tsx:29-33` (state added in `src/hooks/useDataMigration.ts:41`)
**Issue:** The drain/fetch effect fires only for `migration.state === 'complete' ||
'not-needed'`. Phase 36 introduced the new `'partial'` terminal state, but this
effect was not updated. On a partial migration the splash auto-dismisses
(`setMigrationDismissed(true)`) and renders `<Outlet />`, yet
`processWriteAheadQueue()` never runs and `fetchSessions()` is never called — the
user lands on a stale/empty session list with un-drained queued writes. The same
gap exists for the `error` → "Skip and Continue" path (pre-existing, but now more
reachable).
**Fix:** Include the terminal states that hand control to the app:
```ts
useEffect(() => {
  if (['complete', 'not-needed', 'partial'].includes(migration.state)) {
    processWriteAheadQueue().then(() => fetchSessions());
  }
}, [migration.state, fetchSessions]);
```
Decide explicitly whether the `error`/skip path should also drain+fetch.

### WR-02: `useUserRole` clears role on every `user` identity change → admin-UI flicker, transient `isAdmin=false`

**File:** `src/hooks/useUserRole.ts:30-57`
**Issue:** The effect's cleanup calls `setRole(undefined)` (line 55) and the effect
depends on `user`. Any time the auth store replaces the `user` object reference
(e.g. token refresh, `onAuthStateChange` re-emit), the cleanup resets role to
`undefined` → `loading` flips true → `isAdmin` momentarily false → admin-only UI
(Assign-To dropdown in `NewSession`, Finalize/assignee controls in `SessionDetail`)
unmounts and the role is refetched. This is a fail-*closed* flicker so it is not a
privilege-escalation bug, but it can drop the admin's in-progress assignee
selection and cause visible churn. The `retry` callback is `useCallback([])`-stable,
so its presence in deps is fine; the churn comes from `user`.
**Fix:** Key the effect on `user?.id` (stable across object replacement) rather than
the whole `user` object, and drop the `setRole(undefined)` from cleanup (use the
`cancelled` flag alone to ignore stale resolutions) so a same-id refresh does not
blank the role.

### WR-03: `MigrationSplash` auto-dismiss timers reset on unstable `onComplete` prop

**File:** `src/components/MigrationSplash.tsx:28-46` (caller `src/components/ProtectedRoute.tsx:62`)
**Issue:** The dismiss effect depends on `[state, onComplete]`. `ProtectedRoute`
passes a fresh inline arrow `onComplete={() => setMigrationDismissed(true)}` on
every render. Any parent re-render during the 1500/1800ms window restarts both
timers, so the splash can linger longer than intended (or, if re-renders are
frequent, never auto-dismiss). It works today only because `ProtectedRoute`
re-renders rarely once migration is terminal — a fragile invariant.
**Fix:** Wrap the handlers in `useCallback` in `ProtectedRoute`, or store
`onComplete` in a ref inside `MigrationSplash` and depend only on `[state]`.

### WR-04: `offlineQueue` read-failure toast can self-suppress real later errors via dedupe

**File:** `src/services/offlineQueue.ts:52-58` + `src/stores/notificationStore.ts:13-14`
**Issue:** `getQueuedItems` funnels every read error through
`toUserMessage(error)`, which collapses to one of three fixed strings (commonly
"Connection problem — try again"). Combined with the single-slot dedupe
(`notifyError` no-ops when the message equals the current one), a persistent queue
read failure shows once, but it can also **mask a different, more important error**
that maps to the same generic string while the toast is still displayed (e.g. an
export failure surfacing "Connection problem" gets deduped away). This is an
accepted trade-off of single-slot + 3-string funnel, but worth flagging: the
dedupe key is the *rendered copy*, not the *source error*, so distinct failures
that share copy are silently coalesced.
**Fix:** Acceptable for v1 given D-04/D-05, but consider keying dedupe on an error
id/source rather than the user-facing string, or exempt retryable toasts from being
overwritten by non-retryable informational ones.

### WR-05: `MigrationSplash` error branch shows `skipped` count, but `error` state never carries one

**File:** `src/components/MigrationSplash.tsx:64-71` + `src/hooks/useDataMigration.ts:45-47`
**Issue:** The `error` body renders `${skipped} items could not be migrated`, but
`error` is only set in the `catch` (`useDataMigration.ts:45-47`), which does **not**
update `skipped` — it stays at its last value (0 on a fresh run that throws before
any skip). So a thrown migration failure displays "0 items could not be migrated.
Your data is safe… retry now," which is misleading (it reads as a clean run). The
`error` copy assumes a `skipped` count that the error path never populates.
**Fix:** Either populate `skipped`/`migrated` in the `catch` from the partial
progress, or change the error copy to not assert a specific count
(e.g. "Migration didn't finish. Your data is safe — retry now or continue.").

## Info

### IN-01: Unused `toUserMessage` import in NewSession

**File:** `src/pages/NewSession.tsx:5`
**Issue:** `toUserMessage` is imported but never used — `doCreate` and
`handleImport` use fixed UI-SPEC strings. Flagged as deferred in 36-03-SUMMARY but
left in place; it is dead and will trip `noUnusedLocals` if enabled.
**Fix:** Remove the import.

### IN-02: `signIn` returns `{ error: null }` while a sign-in is already in flight

**File:** `src/stores/authStore.ts:50` (consumer `src/pages/Login.tsx:23-32`)
**Issue:** The `signingIn` guard makes a concurrent `signIn` resolve `{ error: null }`,
which in `Login.handleSubmit` triggers `navigate('/')` without an authenticated
session for that call. `Login` disables the submit button via `submitting`, so this
is hard to hit from the UI, but the contract (no error == authenticated) is
violated. Pre-existing, not introduced by Phase 36.
**Fix:** Return a sentinel/in-progress marker the caller can ignore, or have the
guard await the in-flight promise instead of resolving success.

### IN-03: `SessionDetail` accounts load still fails silently

**File:** `src/pages/SessionDetail.tsx:135-137`
**Issue:** The admin `listAccounts()` fetch retains a `.catch(() => { /* silent
fail */ })`. The phase's stated goal (Codex #16–20) is to surface silent admin
loads. `NewSession` was wired to show `accountsError`; the equivalent path in
`SessionDetail` was left console-silent, so the assignee dropdown can render empty
with no explanation. Scope-adjacent but inconsistent with the phase intent.
**Fix:** Surface via `notifyError(toUserMessage(err))` or an inline error like
`NewSession` does, for consistency.

### IN-04: `toUserMessage` misclassifies non-network errors as "Connection problem" when offline

**File:** `src/lib/toUserMessage.ts:13`
**Issue:** `navigator.onLine === false` forces the "Connection problem — try again"
string for *any* unmapped error (after the credentials check). A genuine
non-network failure (e.g. a validation/permission error) that happens to occur
while the browser reports offline will be mislabeled as a connectivity issue. Not a
security leak (still no raw text), just potentially misleading copy. Low priority.
**Fix:** Only apply the offline override when the error is otherwise unmapped *and*
plausibly network-shaped, or accept as a deliberate D-09 simplification.

---

## Focus-Brief Verification (passed)

- **`useUserRole` fail-closed:** PASS. On load error it sets `ROLE_ERROR` (a
  non-`"admin"` string), so `isAdmin = role === "admin"` stays `false`; the sentinel
  is scrubbed from the public `role`. Surfaces only on a definite Supabase `error`
  via `toUserMessage`. (`useUserRole.ts:40-48,60-68`)
- **`toUserMessage` no raw leak:** PASS. Returns one of exactly three fixed strings;
  reads only `err.message` for pattern-matching and never echoes it.
  (`toUserMessage.ts:6-18`)
- **`ErrorToast` sticky gating:** PASS. Auto-dismiss effect early-returns on
  `message === null || retry !== null`, so retryable toasts never schedule the 6s
  timer. (`ErrorToast.tsx:13-21`)
- **Import compensating rollback is best-effort:** PASS for the mechanism — deletes
  run reverse-order with `.catch(() => {})` so a failed cleanup can't mask the
  original error (`NewSession.tsx:137-143`). BUT see CR-01/CR-02: the rollback is
  never *reached* for network or receipt-duplicate failures, which is the more
  serious defect.

---

_Reviewed: 2026-06-02_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
