# Phase 38: migration-retryability - Pattern Map

**Mapped:** 2026-06-02
**Files analyzed:** 9 (7 modified, 1 new component, 2 test files)
**Analogs found:** 9 / 9 (all in-repo; this phase wires existing precedents together, introduces no new infrastructure)

> Every analog is in the same repo. Patterns below are extracted from the
> live source at the cited lines — copy them, don't re-derive. The RESEARCH.md
> Architecture Patterns section already gives target code; this file pins each
> change to the concrete existing line range it mirrors.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/db/idMapping.ts` (modify — add `getNewIdByOldId`) | model / data-access | transform (Dexie reverse lookup) | self — `getDexieItemId`/`getDexieSessionId` at :7-27 | exact (same file, mirror direction) |
| `src/db/index.ts` (modify — add Dexie v12) | config / schema | batch (IndexedDB version bump) | self — `db.version(11)` block at :155-168 | exact (copy block, add one index) |
| `src/db/migration.ts` (modify — predicate + guards + counters + cleanup) | service | batch / CRUD (Dexie→Supabase) | self — current `needsMigration` :5-10, `migrateToSupabase` :12-178 | exact (in-place rework) |
| `src/hooks/useDataMigration.ts` (modify — plumb split counters) | hook | request-response (state) | self — current hook :23-62 | exact (extend return shape) |
| `src/components/ProtectedRoute.tsx` (modify — Outlet context) | route guard | event-driven (auth→migration) | self — bare `<Outlet />` at :86 | exact (one-line context pass) |
| `src/components/MigrationRetryBanner.tsx` (NEW) | component | event-driven (state→retry) | `src/components/PhotoMigrationBanner.tsx` (full) | exact (persistent-banner precedent) |
| `src/ui/WarnBanner.tsx` (modify — additive `action` slot) | ui primitive | request-response | self — current props+render :15-59 | exact (back-compat prop add) |
| `src/layouts/AppLayout.tsx` (modify — mount banner) | layout | — | self — banner cluster :83-86 (`<PhotoMigrationBanner />`) | exact (add sibling line) |
| `src/tests/data-migration.test.ts` (modify) + `src/tests/migration-idempotency.test.ts` (NEW) + `src/tests/migration-partial.test.tsx` (modify) | test | — | DAT-1 preserve test :451-559; harness :1-44; partial test :1-50 | exact (extend existing harness) |

## Resolved Open Questions (verified this session)

- **A1 / item `deletedAt`:** `Session` HAS `deletedAt` (`src/db/types.ts:7`).
  `HouseVisitItem` (`:24`) and `SaleItem` (`:39`) do **NOT** have a `deletedAt`
  field. → In the new `needsMigration`, filter `!s.deletedAt` on **sessions
  only**; query items unconditionally. Matches `migrateToSupabase`'s existing
  session-only filter (`migration.ts:18`). **Do not** add `!i.deletedAt` to item
  queries — it would be a TS error / no-op. Pitfall 5 closed.
- **Dexie version:** current latest is **v11** (`db.version(11)`, userEditedFields,
  `index.ts:155`). New index ships as **v12**. CONTEXT D-03's "v11" is stale.
- **Icons:** `warn` (`icons.tsx:124`), `refresh` (`:189`), `x` (`:60`) all exist.
- **`addIdMapping` is module-mocked** in `data-migration.test.ts:23-25` →
  `getNewIdByOldId` reads an empty real Dexie there. Idempotency test must un-mock
  `../db/idMapping` (or seed `db.idMapping` directly) to exercise the real lookup.

---

## Pattern Assignments

### `src/db/idMapping.ts` — add `getNewIdByOldId` (model, transform) · D-04

**Analog:** same file, `getDexieItemId`/`getDexieSessionId` at :7-27 (reverse direction).

**Mirror this exact shape** (`idMapping.ts:7-14`):
```typescript
export async function getDexieItemId(
  supabaseItemId: string,
): Promise<number | null> {
  const mapping = await db.idMapping
    .where({ newId: supabaseItemId, type: "item" })
    .first();
  return mapping?.oldId ?? null;
}
```

**New helper** — flip the index from `[newId+type]` to `[oldId+type]`, return `newId`:
```typescript
export async function getNewIdByOldId(
  oldId: number,
  type: "session" | "item",
): Promise<string | null> {
  const mapping = await db.idMapping.where({ oldId, type }).first();
  return mapping?.newId ?? null;
}
```
`addIdMapping` (:32-38, uses `.add()`) stays as-is — the D-05 guard prevents
reaching it for an already-mapped row, so no `.put()` upsert needed.

---

### `src/db/index.ts` — Dexie v12 reverse index (config/schema, batch) · D-03

**Analog:** the `db.version(11)` block at :155-168.

**Copy v11 verbatim, change only the `idMapping` line** (append `[oldId+type]`):
```typescript
// v12: Add [oldId+type] reverse index on idMapping for idempotent migration
// retry (Phase 38, D-03). Pure index add — no .upgrade(), Dexie re-indexes.
db.version(12).stores({
  sessions: "++id, mode, status, updatedAt, createdAt, deletedAt",
  houseVisitItems: "++id, sessionId, sortOrder, aiStatus, [sessionId+aiStatus]",
  saleItems: "++id, sessionId, receiptNumber, sortOrder, aiStatus, [sessionId+aiStatus]",
  photos: "++id, itemId, sortOrder",
  audio: "++id, itemId",
  sessionAudio: "sessionId, updatedAt",
  exportHistory: "++id, sessionId, exportedAt",
  idMapping: "++id, oldId, newId, type, [newId+type], [oldId+type]",
  writeAheadQueue: "++id, createdAt",
  photoUploadQueue: "++id, status, dexiePhotoId, itemId, createdAt",
  audioUploadQueue: "++id, status, dexieAudioId, itemId, createdAt",
  userEditedFields: "[itemId+field], itemId",
});
```
The WHY-comment density matches the existing v11 comment (`index.ts:151-154`).

---

### `src/db/migration.ts` — predicate + guards + counters + cleanup (service, batch/CRUD) · D-01/D-02/D-05/D-09/D-10

**Analog:** the whole current file (read in full). Four in-place reworks.

**(1) `needsMigration` per-row predicate** — replaces the count short-circuit at :5-10.

Current (DELETE this):
```typescript
export async function needsMigration(): Promise<boolean> {
  const mappingCount = await db.idMapping.count();
  if (mappingCount > 0) return false; // Already migrated
  const sessionCount = await db.sessions.count();
  return sessionCount > 0;
}
```
Replace with per-row check (sessions filtered on `deletedAt`; items unfiltered — A1):
```typescript
export async function needsMigration(): Promise<boolean> {
  const sessions = await db.sessions.filter((s) => !s.deletedAt).toArray();
  for (const s of sessions) {
    if (!(await getNewIdByOldId(s.id!, "session"))) return true;
  }
  const houseItems = await db.houseVisitItems.toArray();
  for (const i of houseItems) {
    if (!(await getNewIdByOldId(i.id!, "item"))) return true;
  }
  const saleItems = await db.saleItems.toArray();
  for (const i of saleItems) {
    if (!(await getNewIdByOldId(i.id!, "item"))) return true;
  }
  return false;
}
```
Add `import { getNewIdByOldId } from "./idMapping";` (alongside existing
`addIdMapping` import at :2).

**(2) Session-insert guard** — wraps the unconditional insert at :47-57. The
session insert is the dangerous one (a preserved partial session already has a
mapping from run 1). Reverse-lookup before inserting:
```typescript
let newSessionId = await getNewIdByOldId(dexieSession.id!, "session");
if (!newSessionId) {
  const { data: newSession, error: sessError } = await supabase
    .from("sessions")
    .insert({ /* unchanged payload from :49-55 */ })
    .select()
    .single();
  if (sessError || !newSession) {
    // existing skip-whole-session path (:59-72) — now increments `failed`
    failed += hItems.length + sItems.length;
    onProgress(migrated + failed + alreadyMigrated, totalItems);
    continue;
  }
  newSessionId = newSession.id;
  await addIdMapping({ oldId: dexieSession.id!, newId: newSessionId, type: "session" });
}
// else: reuse newSessionId — do NOT re-insert, do NOT count as failed.
// item loops below use newSessionId instead of newSession.id
```

**(3) Item-insert guard** — same shape at both item loops (:86-119 house, :126-159 sale).
Before the insert (mirrors the existing insert+addIdMapping+`migrated++` block):
```typescript
for (const item of houseItems) {
  const existing = await getNewIdByOldId(item.id!, "item");
  if (existing) {
    alreadyMigrated++;
    migratedHouseItemIds.push(item.id!); // dead recovery row → let retry bulkDelete it (SC4)
    continue;
  }
  // ...existing insert + addIdMapping + migratedHouseItemIds.push + migrated++ ...
  // on insert error: failed++ (was skipped++), sessionHadFailure = true
}
```

**(4) Counter split + cleanup** — D-10 + D-09. Rename `skipped`→`failed`, add
`alreadyMigrated`. Replace the counter-gated cleanup at :172-175:

Current:
```typescript
if (skipped === 0) {
  await db.exportHistory.clear();
}
return { migrated, skipped, partial: skipped > 0 };
```
Replace with ground-truth gate + split return shape:
```typescript
if (!(await needsMigration())) {
  await db.exportHistory.clear();
}
return { migrated, alreadyMigrated, failed, partial: failed > 0 };
```
Keep the DAT-1 bulkDelete trio (:169-171) unchanged. `partial = failed > 0`
ONLY — `alreadyMigrated` must never set `partial` or block cleanup.

---

### `src/hooks/useDataMigration.ts` — plumb split counters (hook) · D-06

**Analog:** same file, current hook :23-62.

The `MigrationStatus` interface (:15-21) and the result-mapping (:39-44)
currently expose `migrated`/`skipped`. Extend to carry `failed` +
`alreadyMigrated` (the banner needs `failed` for the "N" copy):
```typescript
interface MigrationStatus {
  state: MigrationState;
  current: number;
  total: number;
  migrated: number;
  alreadyMigrated: number;
  failed: number;
}
// in runMigration's success branch (mirrors :39-44):
setStatus((s) => ({
  ...s,
  state: result.partial ? "partial" : "complete",
  migrated: result.migrated,
  alreadyMigrated: result.alreadyMigrated,
  failed: result.failed,
}));
```
`partial` state + `retry: runMigration` already exist (:11, :61) — no new state.

---

### `src/components/ProtectedRoute.tsx` — Outlet context (route guard) · Pattern 4 (Option A)

**Analog:** same file. `migration` hook already instantiated at :26; bare
`<Outlet />` at :86.

Single-line change — pass the existing hook instance down so the banner reuses
it (NO second `useDataMigration` call → no double-migration):
```typescript
return <Outlet context={migration} />;  // was: return <Outlet />;
```
Everything else (splash wiring :60-84, write-ahead drain :42) unchanged.

---

### `src/components/MigrationRetryBanner.tsx` (NEW) — persistent partial banner (component) · D-07

**Analog:** `src/components/PhotoMigrationBanner.tsx` (full, :1-37) — the
persistent-banner precedent (`return null` when nothing to show, pluralized count).

**Key divergence from the analog:** PhotoMigrationBanner derives its own state via
`useLiveQuery` (:5-18). This banner must NOT re-query — it reads the shared hook
instance from Outlet context (Pattern 4 / D-10: only the run returns the `failed`
count `useLiveQuery` can't reconstruct). Structure follows the precedent; data
source is `useOutletContext`:
```typescript
import { useState } from "react";
import { useOutletContext } from "react-router";
import { WarnBanner } from "../ui/WarnBanner";
import type { useDataMigration } from "../hooks/useDataMigration";

export function MigrationRetryBanner() {
  const m = useOutletContext<ReturnType<typeof useDataMigration>>();
  const [dismissed, setDismissed] = useState(false);
  if (m.state !== "partial" || dismissed || m.failed === 0) return null;  // null-render like PhotoMigrationBanner:20
  const busy = m.state === "in-progress";
  return (
    <WarnBanner
      title={`${m.failed} item${m.failed === 1 ? "" : "s"} not yet synced`}
      body="Your data is safe — retry to finish syncing."
      onDismiss={() => setDismissed(true)}
      action={{ label: busy ? "Retrying…" : "Retry sync", onClick: m.retry, busy }}
    />
  );
}
```
Copy is locked by UI-SPEC §Copywriting. `react-router` `useOutletContext` is a
stock export (already a dependency; `Outlet` used app-wide).

---

### `src/ui/WarnBanner.tsx` — additive `action` slot (ui primitive) · UI-SPEC §Component Inventory

**Analog:** same file, props :15-25 + render :40-58.

Back-compat prop add — every current caller (SessionDetail, SessionCard) passes
no `action` and renders identically. Add to `WarnBannerProps` (after `onDismiss` at :23):
```typescript
/** Optional action button rendered after the body, before the dismiss X. */
action?: { label: string; onClick: () => void; busy?: boolean };
```
Render between the body `<div>` (:43-46) and the `onDismiss` button (:47-56):
```typescript
{action && (
  <button
    type="button"
    onClick={action.onClick}
    disabled={action.busy}
    aria-busy={action.busy || undefined}
    className="tpc-btn shrink-0 min-h-11 min-w-11 text-warn underline"
  >
    <Icon name="refresh" size={18} aria-hidden /> {action.label}
  </button>
)}
```
UI-SPEC locks: `warn` family only (no accent fill), 44px target (`min-h-11
min-w-11`), keep `role="status"` (do NOT escalate to `role="alert"`), `refresh`
glyph + text label "Retry sync".

---

### `src/layouts/AppLayout.tsx` — mount banner (layout) · D-07

**Analog:** same file, banner cluster at :83-86.

Add a sibling next to `<PhotoMigrationBanner />` (:86):
```typescript
<PhotoMigrationBanner />
<MigrationRetryBanner />
```
Plus the import. AppLayout is a **child route** of ProtectedRoute
(`App.tsx:17-18`), so `useOutletContext` inside the banner resolves to
ProtectedRoute's `<Outlet context={migration} />`.

---

### Tests · SC1–SC4

**Harness analog:** `data-migration.test.ts:1-44` — `vi.hoisted` mocks,
`setupInsertChain` helper, `vi.mock("../lib/supabase")` + `vi.mock("../db/idMapping")`.
`afterEach` resets via `db.delete()`/`db.open()` (:108-111). `fake-indexeddb/auto`
loaded in `setup.ts`.

**(a) `data-migration.test.ts:120-129` BREAKS under D-01 — rewrite (SC1, TDD driver).**
The test "returns false when idMapping table has entries" encodes the OLD count
short-circuit. Under D-01, adding ONE mapping while sessions/items remain
unmapped must now return **true**. This is the failing test that drives the D-01
predicate. Current (to invert):
```typescript
it("returns false when idMapping table has entries (already migrated)", async () => {
  await db.sessions.add(makeDexieSession());
  await db.idMapping.add({ oldId: 1, newId: "uuid-abc", type: "session" });
  const result = await needsMigration();
  expect(result).toBe(false);  // ← becomes true (session id=1 IS mapped, but...)
});
```
Rewrite to: map the session, leave an item unmapped → expect `true`; fully map
session+items → expect `false`. Note: this block mocks `addIdMapping`
(`:23-25`), so `db.idMapping.add(...)` is a **direct** Dexie write here (real),
but `getNewIdByOldId` reads real Dexie — seed mappings directly in these tests.

**(b) `migration-idempotency.test.ts` (NEW) — SC2 + SC4.**
Template: extend the DAT-1 preserve test (`data-migration.test.ts:451-559`) with
a **second** `migrateToSupabase` call. That test already builds Sessions A/B/C
(partial/fail/clean) and the `mockFrom.mockImplementation` insert dispatcher
(:489-520). **Un-mock `../db/idMapping`** so `addIdMapping`/`getNewIdByOldId` hit
real fake-indexeddb (the honest reverse-lookup test). Assertions:
- Run 1 = partial (FailItem + OrphanItem fail), capture `from("sessions")` /
  `from("items")` insert call counts.
- Run 2 over same Dexie state with FailItem/FailSession now mocked to succeed:
  assert `from("sessions")` insert called **0 times** for the already-mapped
  session (Pitfall 2); total inserts across both runs = total rows, never more.
- Run-2 result: `alreadyMigrated > 0`, `failed === 0`, `partial === false`.
- After retry: `db.sessions.count()` / item counts / `db.exportHistory.count()`
  all `0` (ground-truth `needsMigration()` false → clear fired, D-09).

**(c) `migration-partial.test.tsx` (modify) — SC3.**
Header at :1-50 already mocks `../db/migration` and tests hook→splash partial
honesty via `renderHook`. Extend the hook assertions to the new return shape
(`failed`, `alreadyMigrated` instead of `skipped`). Add a `MigrationRetryBanner`
block: render it with a mocked `useOutletContext` (or an Outlet test wrapper)
returning `{ state: "partial", failed: 2, retry: vi.fn() }`; assert "2 items not
yet synced" + a "Retry sync" button; assert `null` render when `failed: 0`.

---

## Shared Patterns

### Reverse-lookup helper convention
**Source:** `src/db/idMapping.ts:7-27`
**Apply to:** the new `getNewIdByOldId` and every guard call site in `migration.ts`.
`db.idMapping.where({ <indexed-field>, type }).first()` → `mapping?.<other> ?? null`.
The compound index (`[oldId+type]`, v12) makes it an indexed lookup, mirroring
the existing `[newId+type]` helpers.

### Persistent dismissible banner
**Source:** `src/components/PhotoMigrationBanner.tsx:1-37`
**Apply to:** `MigrationRetryBanner`. `return null` when nothing to show;
pluralize counts (`item${n === 1 ? "" : "s"}`). Differs only in data source
(Outlet context, not `useLiveQuery` — must not re-query, D-10).

### DAT-1 recovery-set bulkDelete
**Source:** `src/db/migration.ts:38-42, 161-171`
**Apply to:** the guarded item loops. Push already-migrated rows into
`migratedHouseItemIds`/`migratedSaleItemIds` so a clean retry's bulkDelete
finally clears the dead recovery rows (makes SC4 "Dexie empty after retry" hold).

### Test harness (fake-indexeddb + supabase mock)
**Source:** `data-migration.test.ts:1-44, 108-111`
**Apply to:** the new idempotency test. Reuse `vi.hoisted` mocks,
`setupInsertChain`/`mockFrom.mockImplementation`, and the `db.delete()`/`db.open()`
`afterEach`. Un-mock `../db/idMapping` for the idempotency file only.

---

## No Analog Found

None. Every surface has an in-repo precedent (reverse helpers, persistent
banner, warn primitive, Dexie version chain, DAT-1 bulkDelete, the test harness).
The one non-mechanical decision — sharing the hook instance via react-router
`Outlet` context — uses a stock API not yet used in this repo, but `Outlet`
itself is app-wide (`App.tsx`, `AppLayout`, `ProtectedRoute`). No file should
fall back to RESEARCH.md generic patterns.

## Metadata

**Analog search scope:** `src/db/`, `src/components/`, `src/ui/`, `src/hooks/`,
`src/layouts/`, `src/tests/` — all confirmed in-repo.
**Files scanned/read:** idMapping.ts, migration.ts, index.ts (schema chain),
useDataMigration.ts, ProtectedRoute.tsx, AppLayout.tsx, App.tsx, WarnBanner.tsx,
PhotoMigrationBanner.tsx, icons.tsx, types.ts, data-migration.test.ts,
migration-partial.test.tsx.
**Pattern extraction date:** 2026-06-02
