---
phase: 44-visibility-ux-polish
reviewed: 2026-06-04T16:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/components/BlockedQueueBadge.tsx
  - src/pages/NewSession.tsx
  - src/tests/blocked-badge.test.tsx
  - src/tests/new-session-import-rollback.test.tsx
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 44: Code Review Report

**Reviewed:** 2026-06-04T16:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the two phase-44 UX fixes: `BlockedQueueBadge` dropdown (human-readable
labels + mode + tap-to-navigate) and `NewSession` import 23505 duplicate-receipt
naming. The four focus areas hold up:

- **23505 detection** is correct. `createItem` (sessionStore.ts:408) re-throws the
  raw Supabase PostgrestError on non-network failures, so `.code` survives intact;
  `(err as { code?: string } | null)?.code === "23505"` (NewSession.tsx:166) reads
  the right field on the right shape.
- **`lastReceipt` tracking** is correct for the in-loop case. `lastReceipt = receipt`
  is set *before* the `await createBlankItem` (NewSession.tsx:139), so on rejection it
  holds the colliding receipt — no off-by-one. Test `CR-02` confirms `R2` is named.
- **Navigation path** `/session/${session_id}/item/${id}` (BlockedQueueBadge.tsx:99)
  matches the route `session/:sessionId/item/:itemId` (App.tsx:23).
- **Dropdown-close ordering**: `setOpen(false)` precedes `navigate()`
  (BlockedQueueBadge.tsx:98-99); React batches and the component unmounts on nav.

Two robustness gaps and two minor quality items remain. No blockers.

## Warnings

### WR-01: 23505 thrown before the import loop renders "Receipt #undefined"

**File:** `src/pages/NewSession.tsx:129,166-171`
**Issue:** `lastReceipt` is `undefined` until the first loop iteration. The 23505
branch is gated only on `err.code === "23505"`, not on `lastReceipt` being defined.
If any error thrown by `createSession` (NewSession.tsx:131, runs *before* the loop)
carries `code: "23505"`, the user sees `Receipt #undefined is already in use`. A
session-row unique violation is implausible (fresh UUID, no receipt constraint on
`sessions`), but the message is reachable and confusing for any pre-loop error that
happens to surface a `23505` code. The RESEARCH Q2 comment claims "the loop variable
at throw time is the single collider" — that invariant only holds *inside* the loop.
**Fix:** Guard the dup branch on a defined receipt:
```ts
const isDup =
  lastReceipt !== undefined &&
  (err as { code?: string } | null)?.code === "23505";
```

### WR-02: Badge silently disappears when the blocked-items query fails

**File:** `src/components/BlockedQueueBadge.tsx:32,49-53`
**Issue:** `fetchBlockedItems` returns `[]` on any `error` (line 32), and `refresh`
also `.catch(() => setItems([]))` (line 52). A transient query failure therefore
forces `count === 0` and the badge renders nothing (line 73). This is the
user-facing safety signal for stranded/blocked work (per the file's own header
doc); a failed fetch masking real blocked items is the opposite of the intended
"no longer strands silently" guarantee — the signal goes dark exactly when the
backend is flaky. The badge would only recover on the next drain tick or reconnect.
**Fix:** Distinguish "fetched zero" from "fetch failed" — preserve the prior count
on error rather than zeroing it, e.g. keep the last good `items` on a failed refresh:
```ts
const refresh = useCallback(() => {
  fetchBlockedItems()
    .then(setItems)
    .catch(() => { /* keep prior items; do not zero the safety signal */ });
}, []);
```
and have `fetchBlockedItems` reject (or return a sentinel) on `error` instead of
returning `[]`, so a real backend failure does not look identical to "nothing blocked."

## Info

### IN-01: Binary mode label mis-renders any non-"sale" value as "House"

**File:** `src/components/BlockedQueueBadge.tsx:105`
**Issue:** `item.mode === "sale" ? "Sale" : "House"`. `items.mode` is typed `string`
(database.types.ts), not a constrained enum, so any value other than `"sale"`
(including a future mode or a data-quality glitch) silently labels as "House".
Low impact today since modes are app-controlled, but the fallback hides bad data.
**Fix:** Map explicitly and fall through to a neutral label, e.g.
`item.mode === "sale" ? "Sale" : item.mode === "house" ? "House" : item.mode`.

### IN-02: Rollback deletes awaited sequentially with no aggregate visibility

**File:** `src/pages/NewSession.tsx:156-163`
**Issue:** Each compensating delete is `.catch(() => {})` (best-effort, by design,
so cleanup failure never masks the original error — correct). But a partially-failed
rollback (some deletes silently fail) leaves orphan rows with zero signal to the
user or logs. Not a correctness bug for the happy/dup paths, but the "no orphan
session/items remain" claim in the comment (line 123-124) is best-effort only.
**Fix (optional):** Capture failed-delete ids and `trackEvent`/log them so a
partial rollback is observable rather than invisible. No code change required for
correctness.

---

_Reviewed: 2026-06-04T16:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
