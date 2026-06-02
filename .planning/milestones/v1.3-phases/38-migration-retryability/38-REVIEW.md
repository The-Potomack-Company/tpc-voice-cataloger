---
phase: 38-migration-retryability
reviewed: 2026-06-02T16:32:23Z
depth: deep
files_reviewed: 9
files_reviewed_list:
  - src/db/migration.ts
  - src/db/idMapping.ts
  - src/db/index.ts
  - src/db/types.ts
  - src/hooks/useDataMigration.ts
  - src/components/ProtectedRoute.tsx
  - src/components/MigrationRetryBanner.tsx
  - src/layouts/AppLayout.tsx
  - src/ui/WarnBanner.tsx
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 38: Code Review Report

**Reviewed:** 2026-06-02T16:32:23Z
**Depth:** deep
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 38 makes the Dexie→Supabase migration idempotent/retryable. The core
data-layer design is sound and the high-risk items in the review brief mostly
hold up:

- **Idempotency guard placement is correct.** `getNewIdByOldId` guards the
  session insert (migration.ts:75) and both item loops (migration.ts:123,
  migration.ts:174); a found mapping reuses `newId` and skips the insert in all
  three paths. No duplicate session/item on a clean retry.
- **The house/sale `++id` collision fix is correct.** `itemTable` is written on
  every item idMapping write path (migration.ts:155, migration.ts:206) and is
  threaded into both the reverse guard and `needsMigration`. The forward
  consumers (`getDexieItemId`, `getDexieSessionId`) key on the globally-unique
  `newId`, so the additive field cannot corrupt them — verified.
- **Dexie v12 is a pure index add** (index.ts:174-187), no `.upgrade()`,
  existing idMapping rows survive. Pre-`itemTable` rows have `itemTable ===
  undefined`; the scoped lookup treats them as non-matching → re-migrate
  (idempotent, safe).
- **No Supabase schema change, no new dependencies** — confirmed via git diff
  (`package.json` untouched across all phase-38 commits; D-03 index is
  client-side IndexedDB only).

However, the idempotency guarantee is **check-then-insert, not atomic**, and
there is **no in-flight guard on `runMigration`**. Two overlapping migration
runs (reachable via a double-click on the splash's Retry button) both read a
null mapping and both insert → the exact duplicate the phase is built to
prevent. That is the one Critical finding. The remaining findings are
robustness/quality issues around progress accounting, the unused splash
`skipped` prop, and a misleading WHY-comment.

---

## Critical Issues

### CR-01: `runMigration` has no in-flight guard; concurrent runs defeat the lookup-before-insert idempotency

**File:** `src/hooks/useDataMigration.ts:34-53` (with `src/db/migration.ts:75-110`, `src/components/MigrationSplash.tsx:131-138`)

**Issue:** The idempotency guard in `migrateToSupabase` is a non-atomic
check-then-act: `getNewIdByOldId(oldId)` reads the mapping, then (much later,
after an `await supabase…insert`) `addIdMapping` writes it. Nothing serializes
two overlapping migration runs. `runMigration` (useDataMigration.ts:34) sets
`state: "in-progress"` via `setStatus`, but React state updates are async and
the function falls straight through to `await migrateToSupabase(...)` — so a
second synchronous invocation passes the `if (!userId) return` check and starts
a **second concurrent migration** before the first writes any mapping.

Reachable path: `MigrationSplash`'s "Retry Migration" button
(MigrationSplash.tsx:131) renders in `error` state and has no
disable-on-click / `aria-busy`. A fast double-click fires `onRetry` (=
`runMigration`) twice before the re-render to `in-progress` unmounts the button.
Both runs call `getNewIdByOldId(session.id)` → both see `null` → both
`insert` → **duplicate Supabase session** (and duplicated items re-parented
under it). This is precisely the duplication the phase exists to prevent
(RESEARCH Pitfall 2 / Threat "Duplicate-row injection via retry"). The banner's
own `Retry sync` is guarded by the `state !== "partial"` render gate, but the
splash path is not, and `runMigration` itself — the shared retry entry point —
is unguarded for every caller.

**Fix:** Add a re-entrancy guard so only one migration runs at a time, and
debounce the trigger button. Minimal guard in the hook:

```typescript
const runningRef = useRef(false);
const runMigration = useCallback(async () => {
  if (!userId || runningRef.current) return;
  runningRef.current = true;
  setStatus((s) => ({ ...s, state: "in-progress" }));
  try {
    const result = await migrateToSupabase(userId, (current, total) =>
      setStatus((s) => ({ ...s, current, total })),
    );
    setStatus((s) => ({
      ...s,
      state: result.partial ? "partial" : "complete",
      migrated: result.migrated,
      alreadyMigrated: result.alreadyMigrated,
      failed: result.failed,
    }));
  } catch {
    setStatus((s) => ({ ...s, state: "error" }));
  } finally {
    runningRef.current = false;
  }
}, [userId]);
```

Also disable the splash Retry button while a retry is dispatching
(`disabled`/`aria-busy`) so a double-click cannot fire two `onRetry`s in the
same tick. (A `useRef` flag is sufficient here because both stores are
single-tab IndexedDB; cross-tab concurrency is out of scope for v1.)

---

## Warnings

### WR-01: `totalItems` denominator is computed once but already-migrated rows skew progress on retry / mid-run

**File:** `src/db/migration.ts:40-52` (used at :100, :127, :163, :178, :214)

**Issue:** `totalItems` counts all house+sale items under non-deleted sessions
at the *start* of the run. On a retry, already-migrated items were bulk-deleted
in the prior run, so the count reflects only survivors — fine. But the progress
*numerator* `migrated + failed + alreadyMigrated` increments for already-migrated
rows too (alreadyMigrated++), so the ratio is internally consistent only within
a single run. The real defect is subtler: if a session's whole insert fails
(:89-102), `failed += hItems.length + sItems.length` is added to the numerator,
but those same items are *also* counted in `totalItems`, so the numerator can
equal `totalItems` while the next session's items are still pending — the
progress bar can read 100% before the run finishes. Cosmetic, but it
contradicts the SC3 "honest progress" intent.

**Fix:** Either compute `totalItems` as "items still needing migration" (skip
those with a mapping), or clamp the reported `current` to `Math.min(current,
total)` in `onProgress`. Lowest-risk: clamp in the hook —
`setStatus((s) => ({ ...s, current: Math.min(current, total), total }))`.

### WR-02: Whole-session insert failure does not count items already mapped under that session, and never reuses a partially-mapped session's items

**File:** `src/db/migration.ts:89-102`

**Issue:** When `getNewIdByOldId(session)` returns null and the session insert
fails, the code marks *every* house+sale item under the session as `failed` and
`continue`s. But if a prior run had already migrated and mapped some of those
items (their Dexie rows survived because the run crashed before bulkDelete),
those mapped items are now counted as `failed` even though they are safely in
Supabase. This inflates the `failed` count (→ banner shows too-high "N"), and
because the loop `continue`s, their dead recovery rows are never pushed into
`migratedHouseItemIds`/`migratedSaleItemIds`, so they are never cleaned up on a
later successful run either. The session-insert-fails branch predates the
item-level guard and was not reconciled with it.

**Fix:** In the session-insert-failure branch, only count items that lack a
mapping as `failed`, and push already-mapped items into the delete lists:

```typescript
if (sessError || !newSession) {
  const hItems = await db.houseVisitItems.where("sessionId").equals(dexieSession.id!).toArray();
  const sItems = await db.saleItems.where("sessionId").equals(dexieSession.id!).toArray();
  for (const it of hItems) {
    if (await getNewIdByOldId(it.id!, "item", "house")) { alreadyMigrated++; migratedHouseItemIds.push(it.id!); }
    else failed++;
  }
  // ...same for sItems with "sale"...
  onProgress(migrated + failed + alreadyMigrated, totalItems);
  continue;
}
```

(In practice the session mapping would normally exist if its items were mapped,
so this is an edge case — but it is a real `failed`-count / cleanup inaccuracy
when a run is interrupted between the item-insert and the session-insert
mapping, which the idempotency design explicitly aims to survive.)

### WR-03: `MigrationSplash` is fed `skipped={migration.failed}` but the prop is unused — dead wiring masks intent

**File:** `src/components/ProtectedRoute.tsx:71` (consumer `src/components/MigrationSplash.tsx:11,24`)

**Issue:** `ProtectedRoute` passes `skipped={migration.failed}` to
`MigrationSplash`, and `MigrationSplashProps` still declares `skipped: number`
(MigrationSplash.tsx:11), but the component destructure (MigrationSplash.tsx:24)
deliberately omits `skipped` and the body copy asserts "no count" for partial/
error states. So the prop is required-but-ignored: it can never be removed
without a type change, and a reader cannot tell whether the splash is supposed
to display the failed count. This is latent dead code that will mislead the
Phase 36 copy-alignment work that consumes this surface.

**Fix:** Drop `skipped` from `MigrationSplashProps` and from the
`ProtectedRoute` call site (the partial/error copy is intentionally
count-free), or actually render it. Given the locked "no count in splash"
decision, remove it.

### WR-04: `migrateToSupabase` issues every Supabase insert and idMapping write outside any transaction — an interrupted run leaves Dexie and Supabase divergent without rollback

**File:** `src/db/migration.ts:68-227`

**Issue:** Each item is `insert`ed to Supabase, then `addIdMapping` writes the
mapping to Dexie as two independent awaits. If the tab closes (or the function
throws) between the Supabase insert succeeding and `addIdMapping` completing,
the row exists in Supabase with **no** local mapping. On the next run,
`getNewIdByOldId` returns null → the item is re-inserted → duplicate. The
design relies on the mapping write being durable immediately after the insert,
but there is no ordering guarantee or compensating lookup (e.g., querying
Supabase by a natural key before insert). This is the inherent
non-atomicity of a cross-store migration; it is mostly mitigated by the
single-threaded run, but combined with CR-01 it is the second duplicate vector.

**Fix:** Out of scope to fully solve in v1 (would need a Supabase-side natural
key or upsert). At minimum, document the window and ensure `addIdMapping`
is awaited *before* the next loop iteration (it already is). Consider wrapping
the per-item `insert`+`addIdMapping` so a throw after insert is caught and the
mapping is still written (retry of the insert would otherwise duplicate). Track
as a follow-up; flag here so it is not assumed solved by the v12 index.

---

## Info

### IN-01: `needsMigration` runs N sequential indexed lookups per row — correctness fine, but O(rows) round-trips

**File:** `src/db/migration.ts:10-24`

**Issue:** `needsMigration` loops every non-deleted session and every house/sale
item, awaiting one `getNewIdByOldId` per row. Correctness is right (returns true
iff any row lacks a mapping; false only when all mapped) and it is called twice
per migration (pre-check in the hook + post-run cleanup gate). Performance is
out of v1 scope, noted only because it is on the login hot path for users with
large local catalogs. Not a defect.

**Fix:** (optional) Bulk-load all idMapping rows once into a
`Set<`${oldId}:${type}:${itemTable}`>` and test membership in-memory. No
behavior change.

### IN-02: WHY-comment at idMapping.ts:32-33 references the index as the reason the lookup is indexed, but the `itemTable` branch uses `.filter()` (in-memory scan)

**File:** `src/db/idMapping.ts:47-52`

**Issue:** The doc comment says "The `[oldId+type]` index (v12) makes this an
indexed lookup." True for the no-`itemTable` branch (:54). But the
`itemTable`-scoped branch (:48-50) does `.where({oldId,type}).filter(m =>
m.itemTable === itemTable)` — the `.filter` is an in-memory scan over the
indexed match set. It is still correct and the match set is tiny (1-2 rows from
a colliding pair), so this is fine, but the comment over-claims for the path
that actually runs during migration. Minor doc drift.

**Fix:** Tweak the comment to note the `itemTable` discriminator is applied as
an in-memory filter over the indexed `[oldId+type]` candidates.

### IN-03: `WarnBanner` uses `role="status"` (polite live region) for a banner with an actionable Retry — screen-reader users may not be alerted

**File:** `src/ui/WarnBanner.tsx:44`

**Issue:** The migration-retry banner announces "N items not yet synced" via a
`role="status"` (aria-live=polite) container. RESEARCH §UI-SPEC explicitly locks
`role="status"` (do NOT escalate to `role="alert"`), so this matches the spec —
flagged only for awareness that the partial-sync warning is announced politely,
not assertively. No change required given the locked decision.

**Fix:** None (spec-locked). Documented for the Phase 36 copy-alignment pass.

---

## Cross-File Verification (deep pass)

Traced the call graph requested in the brief:

- **`migrateToSupabase` ↔ `idMapping` ↔ `needsMigration`:** the `itemTable`
  discriminator is consistently passed (`"house"` / `"sale"`) at every reverse
  lookup (migration.ts:17, :21, :123, :174) and written at every forward write
  (migration.ts:155, :206). No path returns the wrong table's `newId`. ✔
- **Forward consumers unaffected:** `getDexieItemId`/`getDexieSessionId`
  (idMapping.ts:7-27) and `photoMigration.ts:50-54` resolve by `newId`
  (globally-unique UUID) or by `oldId`+`type==="item"` respectively;
  `photoMigration`'s pre-existing oldId-by-type lookup has the same house/sale
  collision the reverse guard fixed, **but it is out of Phase-38 scope**
  (untouched since commit `f5b4930`, predates this phase). Noted for a future
  phase, not a regression here. ✔
- **Dexie v11→v12:** verified v12 (index.ts:174-187) copies the v11 block
  verbatim and only appends `[oldId+type]`; no `.upgrade()`, existing rows
  preserved. ✔
- **Hook → Outlet-context → banner:** `ProtectedRoute` passes the single
  `migration` instance via `<Outlet context={migration} />` (ProtectedRoute.tsx:89);
  `MigrationRetryBanner` reads it via `useOutletContext` and **never** calls
  `useDataMigration`/`useLiveQuery` (confirmed — only `import type`); the
  `!m ||` null-guard (MigrationRetryBanner.tsx:21) is safe for isolated layout
  tests. No second hook instance / parallel migration from the banner. ✔ (The
  concurrency risk is in the shared `runMigration`, CR-01, not in the banner
  wiring.)

---

_Reviewed: 2026-06-02T16:32:23Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
