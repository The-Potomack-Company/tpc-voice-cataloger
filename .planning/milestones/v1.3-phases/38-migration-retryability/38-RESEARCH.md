# Phase 38: migration-retryability - Research

**Researched:** 2026-06-02
**Domain:** Dexie (IndexedDB) → Supabase client migration; idempotency, retry, banner UX
**Confidence:** HIGH (entire surface is in-repo; every claim is grounded in a read file:line)

## Summary

Phase 38 makes the one-shot Dexie→Supabase migration **idempotent and retryable**. Today
`migrateToSupabase` ([src/db/migration.ts:12-178](../../../../src/db/migration.ts#L12)) inserts
every non-deleted session/item unconditionally, writes a fresh `idMapping` row per insert via
`addIdMapping` (which uses Dexie `.add()`), and only `needsMigration()` ([migration.ts:5-10](../../../../src/db/migration.ts#L5))
gates a re-run via a coarse `idMapping.count() > 0 → false` early-return. After a partial run
(DAT-1 / PR #24 preserves the failed recovery set in Dexie), that early-return falsely reports
"already migrated," so the survivors never get a second chance — and if the gate were removed, a
naive retry would duplicate every preserved Supabase session/item because there is no
oldId→newId reverse lookup.

The fix has four mechanical parts, all locked in CONTEXT: (1) replace the count-based
`needsMigration` predicate with a per-row check (D-01/D-02); (2) add an `[oldId+type]` reverse
index and a `getNewIdByOldId` helper (D-03/D-04); (3) lookup-before-insert in `migrateToSupabase`
— including the **session** insert (D-05); (4) split the return counter into `failed` vs
`alreadyMigrated`, drive `partial` off `failed > 0` only, and clear `exportHistory` via a post-run
`needsMigration()` ground-truth check (D-09/D-10). The single UI surface is a persistent
dismissible `WarnBanner`-based `MigrationRetryBanner` hosted in `AppLayout`, plus an additive
`action` slot on `WarnBanner` (D-06/D-07). `MigrationSplash` is untouched (D-08).

**Primary recommendation:** Add Dexie **v12** (not v11 — v11 already exists), add the reverse
index + helper, guard both the session and item inserts with `getNewIdByOldId`, rework the return
shape to `{ migrated, alreadyMigrated, failed, partial }`, gate cleanup on a post-run
`needsMigration()` call, and surface partial state through a new `MigrationRetryBanner` that reads
migration state shared from `ProtectedRoute` via React Router `Outlet` context (the host/hook split
is the one non-mechanical design decision — see Architecture Patterns).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| needsMigration predicate | Database / Storage (Dexie) | — | Pure IndexedDB read; no network |
| Idempotent insert guard | Database / Storage + API (Supabase) | — | Reverse-lookup is Dexie; insert is Supabase |
| `[oldId+type]` reverse index | Database / Storage (Dexie schema) | — | Client-side IndexedDB version bump only |
| Counter split / partial flag | Database / Storage (migration.ts) | Frontend (hook) | Computed in migration, surfaced by hook |
| exportHistory cleanup | Database / Storage (Dexie) | — | Local table; ground-truth gated |
| Partial banner + retry | Frontend (React component) | Frontend Server (none) | Pure client React; no SSR in this Vite SPA |
| Retry trigger | Frontend (hook) | Database/API (re-runs migration) | Banner button → hook → migration.ts |

**No Supabase schema change.** D-03 is explicit and verified: `[oldId+type]` is a **client-side
IndexedDB index**, added via `db.version(N).stores(...)`. Nothing in this phase touches the shared
Supabase schema, so the cross-app schema-drift workflow (`_workspace/Schema/schema.md`) does **not**
apply here. [VERIFIED: CONTEXT D-03 + src/db/index.ts]

## Project Constraints (from CLAUDE.md)

- This repo shares Supabase with cataloger + dashboard. **Phase 38 introduces zero Supabase schema
  changes** — confirmed by D-03 (client IndexedDB index only). No `npm run db:types` regen needed.
- No comments unless WHY-comments (the codebase already follows this; the existing DAT-1 comments
  at migration.ts:38-42, 161-162, 168-175 are exemplary WHY-comments — match that density).
- Atomic commits, one concern per commit.
- TDD mode is ON (`tdd_mode: true` in config) — write the failing idempotency/retry tests first.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `needsMigration()` returns true while **any** non-deleted Dexie session OR item has an
  `oldId` with no `idMapping` row. Replace the current `idMapping.count() > 0 → false` early-return
  (migration.ts:5-10) with a per-row mapping check so a partial migration is no longer treated as complete.
- **D-02:** Only non-deleted rows count (`deletedAt` rows excluded — same filter already used by
  `migrateToSupabase`). Check sessions, houseVisitItems, and saleItems.
- **D-03:** Add Dexie schema with an `[oldId+type]` compound index on `idMapping` (today only
  `[newId+type]` exists, db/index.ts). Reverse lookup oldId→newId must be indexed. *(NOTE: CONTEXT
  says "v11"; v11 already exists — must be v12. See Standard Stack.)*
- **D-04:** Add a `getNewIdByOldId(oldId, type)` helper in idMapping.ts (mirrors the existing
  `getDexieItemId`/`getDexieSessionId` direction).
- **D-05:** Before inserting a session or item in `migrateToSupabase`, look up the existing mapping
  by `oldId`; if present, **skip the Supabase insert and reuse the existing `newId`**. Applies to
  the session insert too.
- **D-06:** Plumb the `partial` flag (already returned by `migrateToSupabase`) through
  `useDataMigration` — the hook currently drops the split-counter detail.
- **D-07:** Add a **persistent, dismissible in-app banner** ("N items not yet synced — Retry") for
  partial state, separate from the login-only full-screen `MigrationSplash`. Retry re-runs the
  migration. Mirror the existing `PhotoMigrationBanner` pattern. A Settings-level retry entry point
  is in scope.
- **D-08:** `MigrationSplash`'s existing `error`-state retry stays as-is for the at-login path; the
  new banner covers the post-dismiss / later-session path. **MigrationSplash unchanged.**
- **D-09:** Clear `exportHistory` iff `needsMigration()` returns **false after the run** (ground-truth
  completeness check), not based on the run's `skipped` counter (migration.ts:172-175).
- **D-10:** **Split the counters.** `partial` (the banner trigger) keys on **failures only**
  (`failures > 0`). Idempotent-skips (rows skipped because a mapping already exists) are tracked in a
  **separate** counter and must NOT set `partial` or block exportHistory cleanup. Rename/repurpose the
  current `skipped` so the return shape distinguishes `failed` vs `alreadyMigrated`.

### Claude's Discretion

- Exact return-shape field names (`failed` / `alreadyMigrated` / `migrated`) and how
  `useDataMigration`'s `MigrationStatus` surfaces them — as long as D-10's semantic split holds.
- Banner component structure and placement in the layout tree, following the `PhotoMigrationBanner`
  precedent.

### Deferred Ideas (OUT OF SCOPE)

- Optimistic locking / `updated_at` triggers → Phase 39.
- AI-proxy migration → Phase 40.
- Broader UX toast work → Phase 36 (only *aligns banner copy* with this phase's banner).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SC1 | `needsMigration()` true while any non-deleted Dexie session/item lacks an idMapping entry | D-01/D-02 predicate rewrite at migration.ts:5-10; reverse lookup via new `[oldId+type]` index |
| SC2 | `migrateToSupabase` idempotent — lookup idMapping by oldId, reuse newId / skip insert, no duplicate Supabase rows | D-05 guards at the session insert (migration.ts:47) and both item inserts (migration.ts:87, 127) using `getNewIdByOldId` |
| SC3 | Partial state surfaces via `partial` flag; banner "N items not yet synced — Retry"; retry re-runs migration | D-06 hook plumbing; D-07 `MigrationRetryBanner` in AppLayout; retry → `migration.retry` |
| SC4 | Retry-after-partial test: migrates only remaining rows, no duplicates, banner reflects partial | Validation Architecture §; fake-indexeddb + supabase mock; assert insert-call count on retry |

This section is required (IDs provided). The planner maps these to plans.
</phase_requirements>

## Standard Stack

### Core (all already installed — no new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| dexie | (installed) | IndexedDB wrapper + versioned schema | Already the app's offline store; v11 is current schema |
| @supabase/supabase-js | (installed) | Insert target | Migration destination |
| dexie-react-hooks (`useLiveQuery`) | (installed) | Reactive banner count | `PhotoMigrationBanner` precedent uses it |
| react-router (`Outlet` context) | (installed) | Share migration state ProtectedRoute→AppLayout | Already the router; `useOutletContext` not yet used in repo but is a stock API |

### No external packages — Package Legitimacy Audit not required

This phase installs **zero** new dependencies. Every primitive (`WarnBanner`, `useLiveQuery`,
`Outlet`, Dexie versioning) is already in the tree. The Package Legitimacy Gate is therefore N/A;
no `slopcheck` / registry verification needed.

### CRITICAL VERSION CORRECTION (supersedes CONTEXT D-03 / Established Patterns)

CONTEXT.md D-03 and the "Established Patterns" block say "Dexie versions go up to **v10**, adding
`[oldId+type]` is a clean **v11** bump." **This is stale.** [VERIFIED: src/db/index.ts:155-168]

- Phase 35 already shipped **`db.version(11)`** adding the `userEditedFields` table
  ([src/db/index.ts:155-168](../../../../src/db/index.ts#L155)).
- The `[oldId+type]` index must therefore be added as **`db.version(12)`**, NOT v11.
- Adding it as v11 would **collide with the existing v11 declaration** and corrupt the upgrade chain.

**The v12 store block** (copy v11's block verbatim, change only the `idMapping` line):

```typescript
// v12: Add [oldId+type] reverse index on idMapping for idempotent migration retry (Phase 38, D-03).
// Pure index addition — no data transform, no .upgrade() needed. Dexie re-indexes existing rows.
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

[CITED: dexie.org/docs/Version/Version.stores() — adding an index to an existing store in a new
version requires re-declaring the full schema for that version; Dexie indexes existing rows
automatically, no `.upgrade()` callback needed for a pure index add.]

**Version verification (Dexie):** the installed Dexie version is whatever the lockfile pins; no
upgrade is needed for this phase — the schema API (`db.version(n).stores()`) is stable across all
Dexie 3.x/4.x. Confirm with `npm view dexie version` only if the planner wants the exact pin; it
does not affect the design. [ASSUMED — exact pin not read; API is version-stable]

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────────┐
  user login ──────▶│ ProtectedRoute                              │
                    │  const migration = useDataMigration(uid)    │
                    │   ├─ needsMigration()  ── per-row check ────┐│
                    │   └─ runMigration() ─▶ migrateToSupabase()  ││
                    │                                             ││
                    │  state in {checking,in-progress,...}        ││
                    │   ├─ at-login splash path → <MigrationSplash>│  (D-08, unchanged)
                    │   └─ <Outlet context={migration} />  ───────┼┼──┐
                    └─────────────────────────────────────────────┘│  │
                                                                    │  │ Outlet context
   ┌────────────────────────────────────────────────────────────┐ │  │ (shared instance)
   │ migrateToSupabase(uid, onProgress)                          │◀┘  ▼
   │  for each non-deleted session:                              │ ┌──────────────────────┐
   │   newId = getNewIdByOldId(s.id,'session')   ◀── D-05 guard  │ │ AppLayout            │
   │   if !newId: insert session → addIdMapping; else reuse      │ │  <MigrationRetryBanner│
   │   for each house/sale item:                                 │ │    partial={...}      │
   │     newId = getNewIdByOldId(item.id,'item') ◀── D-05 guard  │ │    failed={...}       │
   │     if !newId: insert item → addIdMapping(migrated++)       │ │    onRetry={retry} /> │
   │     else: alreadyMigrated++   (NOT failed, NOT partial)     │ │   ↳ WarnBanner + action│
   │   on insert error: failed++  (sets partial)                 │ └──────────────────────┘
   │  bulkDelete migrated rows (DAT-1 recovery preserve)         │
   │  if !(await needsMigration()): exportHistory.clear() ◀ D-09 │
   │  return {migrated, alreadyMigrated, failed, partial:failed>0}│
   └────────────────────────────────────────────────────────────┘
            │                                            ▲
            ▼ insert                                     │ retry re-invokes whole migration
   ┌─────────────────┐                          (idempotent: already-migrated rows skipped)
   │ Supabase        │
   │  sessions/items │
   └─────────────────┘
```

### Pattern 1: Lookup-before-insert (D-05) — applies to session AND items

The session insert is the dangerous one. Today migration.ts:47-72 inserts a session
unconditionally and writes its mapping at :74-79. On a retry over the DAT-1 recovery set, the
preserved partial session **already has a `session` mapping from the first run**, so a naive retry
creates a **duplicate Supabase session** and then re-inserts its survivor items under it. The guard
must wrap the session insert before line 47.

```typescript
// Source: derived from src/db/migration.ts:44-79 + CONTEXT D-04/D-05
for (const dexieSession of dexieSessions) {
  let sessionHadFailure = false;

  // D-05: reuse an existing session mapping instead of inserting a duplicate.
  let newSessionId = await getNewIdByOldId(dexieSession.id!, "session");
  if (!newSessionId) {
    const { data: newSession, error: sessError } = await supabase
      .from("sessions")
      .insert({ /* ...unchanged payload... */ })
      .select()
      .single();
    if (sessError || !newSession) {
      // existing skip-whole-session path (migration.ts:59-72) — now counts as `failed`
      failed += /* items under this session */;
      continue;
    }
    newSessionId = newSession.id;
    await addIdMapping({ oldId: dexieSession.id!, newId: newSessionId, type: "session" });
  } else {
    // session row was preserved for recovery but already in Supabase — reuse, do not re-insert.
    // (do NOT count as failed; if all its items also already-mapped, alreadyMigrated++)
  }
  // ... item loops use newSessionId, each guarded the same way ...
}
```

Item guard (same shape, at migration.ts:86 and :126):

```typescript
for (const item of houseItems) {
  const existing = await getNewIdByOldId(item.id!, "item");
  if (existing) { alreadyMigrated++; migratedHouseItemIds.push(item.id!); continue; }
  // ...existing insert + addIdMapping + migrated++ path...
}
```

**`migratedHouseItemIds.push` on the already-mapped branch:** an already-migrated item's Dexie row
is dead weight in the recovery set; pushing it into the bulkDelete list lets a clean retry finally
remove it (it reached Supabase on the prior run). This is what makes "retry migrates only remaining
rows, then Dexie is empty" (SC4) hold. [VERIFIED: reasoning from migration.ts:169-171 bulkDelete semantics]

### Pattern 2: `getNewIdByOldId` helper (D-04)

Mirror the existing reverse helpers exactly. The `[oldId+type]` index makes `.where({oldId,type})`
an indexed lookup.

```typescript
// Source: mirrors src/db/idMapping.ts:7-27 (getDexieItemId/getDexieSessionId)
export async function getNewIdByOldId(
  oldId: number,
  type: "session" | "item",
): Promise<string | null> {
  const mapping = await db.idMapping.where({ oldId, type }).first();
  return mapping?.newId ?? null;
}
```

[VERIFIED: src/db/idMapping.ts:10-13 uses the identical `.where({...}).first()` shape on `[newId+type]`]

### Pattern 3: Per-row `needsMigration` (D-01/D-02)

Replace the count short-circuit. Predicate: true iff any non-deleted session OR item lacks a mapping.

```typescript
// Source: replaces src/db/migration.ts:5-10
export async function needsMigration(): Promise<boolean> {
  const sessions = await db.sessions.filter((s) => !s.deletedAt).toArray();
  for (const s of sessions) {
    if (!(await getNewIdByOldId(s.id!, "session"))) return true;
  }
  const houseItems = await db.houseVisitItems.filter((i) => !i.deletedAt).toArray();
  for (const i of houseItems) {
    if (!(await getNewIdByOldId(i.id!, "item"))) return true;
  }
  const saleItems = await db.saleItems.filter((i) => !i.deletedAt).toArray();
  for (const i of saleItems) {
    if (!(await getNewIdByOldId(i.id!, "item"))) return true;
  }
  return false;
}
```

**Pitfall:** `houseVisitItems`/`saleItems` types may not carry a `deletedAt` field. Verify against
src/db/types.ts before filtering — `migrateToSupabase` only filters `deletedAt` on **sessions**
(migration.ts:18), and reads items unconditionally under their session. If items have no soft-delete,
drop the `!i.deletedAt` filter for items (D-02 says "same filter already used by migrateToSupabase",
which is the session filter). **Planner: confirm item soft-delete shape.** [ASSUMED — items' deletedAt not verified]

### Pattern 4: Banner host / state sharing (Claude's discretion, D-07)

**The core architectural decision.** `useDataMigration` is instantiated in **ProtectedRoute**
([src/components/ProtectedRoute.tsx:26](../../../../src/components/ProtectedRoute.tsx#L26)). Banners
mount in **AppLayout** ([src/layouts/AppLayout.tsx:86](../../../../src/layouts/AppLayout.tsx#L86)),
which is a **child route** of ProtectedRoute ([src/App.tsx:17-18](../../../../src/App.tsx#L17)).
They are separate components — calling `useDataMigration` again in the banner would create a
**second hook instance** that re-runs the migration. Three options:

| Option | How | Tradeoff | Recommendation |
|--------|-----|----------|----------------|
| **A. Outlet context** | ProtectedRoute passes `migration` via `<Outlet context={migration} />`; banner reads `useOutletContext()` | Single source of truth, single hook instance, idiomatic react-router. No new state lib. Not yet used in repo (mild novelty). | **RECOMMENDED** |
| B. Banner re-derives via `useLiveQuery(needsMigration)` | Banner independently queries partial state, retry calls a shared/store-held `runMigration` | Mirrors PhotoMigrationBanner's `useLiveQuery` precedent exactly; but `needsMigration` alone can't distinguish `failed` vs `alreadyMigrated` (D-10) — banner needs the `failed` count, which only the run returns | Avoid — can't get the failed count |
| C. Lift to a Zustand store | Migration state in a store both components read | Matches app's Zustand usage; heavier change for one banner | Acceptable but over-built |

**Recommend Option A.** It keeps one hook instance (no double-migration), gives the banner the
exact `failed` count it needs for the "N" copy (D-10), and reuses ProtectedRoute's existing
`migration.retry`. `useOutletContext` is a stock react-router export already in the dependency.

```typescript
// ProtectedRoute.tsx — at the <Outlet /> (replaces bare <Outlet /> at line 86)
return <Outlet context={migration} />;

// MigrationRetryBanner.tsx (new, in src/components/, mirrors PhotoMigrationBanner)
import { useOutletContext } from "react-router";
export function MigrationRetryBanner() {
  const m = useOutletContext<ReturnType<typeof useDataMigration>>();
  const [dismissed, setDismissed] = useState(false);
  if (m.state !== "partial" || dismissed || m.failed === 0) return null;
  return (
    <WarnBanner
      title={`${m.failed} item${m.failed === 1 ? "" : "s"} not yet synced`}
      body="Your data is safe — retry to finish syncing."
      onDismiss={() => setDismissed(true)}
      action={{ label: m.state === "in-progress" ? "Retrying…" : "Retry sync", onClick: m.retry }}
    />
  );
}
```

Mount it in AppLayout next to `<PhotoMigrationBanner />` (line 86). [VERIFIED: AppLayout.tsx:83-86 banner cluster]

### Pattern 5: Additive `action` slot on `WarnBanner` (UI-SPEC §Component Inventory)

`WarnBanner` ([src/ui/WarnBanner.tsx](../../../../src/ui/WarnBanner.tsx)) has `icon/title/body/onDismiss`.
Add an **optional** `action?: { label: string; onClick: () => void; busy?: boolean }` prop rendered
as a `tpc-btn` ghost button after the body, before the dismiss X. Back-compatible — every current
caller (SessionDetail, SessionCard) passes no `action`, renders identically. [VERIFIED: WarnBanner.tsx:15-59]

```typescript
// addition to WarnBannerProps + render (Source: src/ui/WarnBanner.tsx:15-59)
action?: { label: string; onClick: () => void; busy?: boolean };
// ...in JSX, between the body div and the onDismiss button:
{action && (
  <button type="button" onClick={action.onClick} disabled={action.busy}
    aria-busy={action.busy || undefined}
    className="tpc-btn shrink-0 min-h-11 min-w-11 text-warn underline">
    <Icon name="refresh" size={18} aria-hidden /> {action.label}
  </button>
)}
```

UI-SPEC locks: `warn` family only (no accent fill), 44px target, `role="status"` retained (do NOT
escalate to `role="alert"`), `refresh` glyph + "Retry sync" text label (not bare "Retry").

### Anti-Patterns to Avoid

- **Removing the `needsMigration` gate without the reverse-lookup guard** — would duplicate every
  preserved row on the next login. The guard (D-05) and predicate (D-01) ship together or not at all.
- **Driving `partial` off `alreadyMigrated`** — a clean idempotent retry skips rows; counting those
  as "not synced" would make the banner never disappear. `partial = failed > 0` ONLY (D-10).
- **Gating exportHistory cleanup on a counter** — D-09 mandates a post-run `needsMigration()` call.
  The current `if (skipped === 0)` at migration.ts:173 must become `if (!(await needsMigration()))`.
- **Re-calling `useDataMigration` in the banner** — spawns a second migration run. Share state instead.
- **`addIdMapping` with `.put`-style upsert** — not needed; the D-05 guard prevents reaching
  `addIdMapping` for an already-mapped row, so the existing `.add()` (idMapping.ts:37) stays.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| oldId→newId lookup | Linear scan of idMapping | `[oldId+type]` index + `.where().first()` | Indexed; mirrors existing `[newId+type]` helpers |
| Partial-state banner | New banner component from scratch | `WarnBanner` + additive `action` slot | UI-SPEC forbids new visual language; back-compat prop |
| Sharing migration state | New context provider / prop drilling | react-router `Outlet` context | Already the router; single hook instance |
| Reactive count in banner | Manual subscription | (state comes from Outlet context, not a fresh query) | Avoids double-migration |
| Schema upgrade transform | `.upgrade()` callback for the index | Bare `db.version(12).stores()` | Pure index add needs no data transform |

**Key insight:** every moving part already has an in-repo precedent — the reverse helpers
(idMapping.ts), the persistent banner (PhotoMigrationBanner), the warn primitive (WarnBanner), the
DAT-1 recovery-set bulkDelete (migration.ts). This phase wires existing patterns together; it does
not introduce new infrastructure.

## Runtime State Inventory

> Rename/refactor inventory is N/A (this is behavior change, not a rename). But the migration
> touches stored data and a client schema version, so the relevant categories:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data (Dexie) | `idMapping` rows written by prior partial runs; preserved DAT-1 recovery set (sessions/items not yet mapped); `exportHistory` rows referencing old session ids | Code: guard inserts (D-05); cleanup gated on post-run `needsMigration()` (D-09). No data migration of existing rows — they remain valid. |
| Stored data (Supabase) | Sessions/items already inserted by a prior partial run | None — the D-05 guard ensures retry reuses them, never duplicates |
| Client schema version | Dexie at **v11** today (userEditedFields, Phase 35) | Bump to **v12** for `[oldId+type]` index. Pure index add, auto-reindex, no `.upgrade()`. |
| Live service config | None — no n8n/Datadog/Task Scheduler state references this | None — verified: this is pure client+Supabase-insert logic |
| Secrets/env vars | None | None |
| Build artifacts | None — no package rename, no egg-info/binary | None |

**Nothing found** in Live service config, Secrets, Build artifacts — verified by scope (in-repo TS only).

## Common Pitfalls

### Pitfall 1: Adding the index as v11 (collision)
**What goes wrong:** CONTEXT says "v11" but v11 already exists (userEditedFields, index.ts:155).
Declaring `db.version(11)` twice corrupts the schema chain; Dexie throws or silently uses the last.
**Why it happens:** CONTEXT was authored against a stale read where v10 was latest.
**How to avoid:** Use **v12**. Copy v11's exact store block, append `[oldId+type]` to the idMapping line.
**Warning signs:** `SchemaError` / `VersionError` on app open; existing tests in data-migration.test.ts failing at `db.open()`.

### Pitfall 2: Session-insert duplication on retry
**What goes wrong:** Only guarding item inserts (not the session insert) — a preserved partial
session re-inserts to Supabase, creating a duplicate session + re-parenting its survivors.
**Why it happens:** The session insert (migration.ts:47) looks "upstream" of items and is easy to miss.
**How to avoid:** D-05 explicitly requires guarding the session insert. Test asserts session insert
call count = 0 on a retry where the session is already mapped.
**Warning signs:** SC4 retry test shows 2 `from('sessions')` insert calls across two runs for one session.

### Pitfall 3: `partial` never clears after a clean retry
**What goes wrong:** Keeping `partial: skipped > 0` where `skipped` now also counts idempotent skips.
**Why it happens:** The current single `skipped` counter conflates fail and already-migrated (D-10's whole point).
**How to avoid:** Split into `failed` (sets partial) and `alreadyMigrated` (does not). `partial = failed > 0`.
**Warning signs:** Banner stays visible after a successful retry; `needsMigration()` returns false but `partial` true.

### Pitfall 4: exportHistory cleared on a still-partial run (or never cleared)
**What goes wrong:** Counter-based gate (`skipped === 0`) either clears too eagerly or, with the new
split, never matches. D-09 wants ground truth.
**How to avoid:** `if (!(await needsMigration())) await db.exportHistory.clear();` after bulkDelete.
**Warning signs:** exportHistory present after a fully-complete retry, or cleared while survivors remain.

### Pitfall 5: items `deletedAt` filter on a field that doesn't exist
**What goes wrong:** Adding `!i.deletedAt` to item queries in `needsMigration` when items have no
soft-delete field → filter no-ops or TS error.
**How to avoid:** Verify src/db/types.ts item shapes; `migrateToSupabase` filters `deletedAt` only
on sessions (migration.ts:18). Match that. [ASSUMED — verify in plan]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `needsMigration` count short-circuit | Per-row mapping check | This phase | Partial runs correctly re-detected |
| Unconditional inserts | Lookup-before-insert (idempotent) | This phase | Retry-safe, no duplicates |
| Single `skipped` counter, `partial = skipped > 0` | Split `failed`/`alreadyMigrated`, `partial = failed > 0` | This phase | Honest partial signal |
| `if (skipped === 0)` cleanup gate | Post-run `needsMigration()` ground truth | This phase (D-09) | Robust against skip/fail conflation |
| Partial only at login splash | Persistent dismissible in-layout banner | This phase (D-07) | Recoverable later-session path |

**Deprecated/outdated:**
- CONTEXT D-03 "v11" reference — superseded; current latest is v11, new index is **v12**.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react + jest-dom |
| IndexedDB | `fake-indexeddb/auto` (imported in [src/tests/setup.ts:2](../../../../src/tests/setup.ts#L2)) |
| Supabase mock | `vi.mock("../lib/supabase")` insert-chain helper ([data-migration.test.ts:17-44](../../../../src/tests/data-migration.test.ts#L17)) |
| Quick run command | `npm test -- src/tests/data-migration.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC1 | needsMigration true while any row unmapped | unit | `npm test -- src/tests/data-migration.test.ts -t needsMigration` | ✅ extend existing (data-migration.test.ts:113-135) |
| SC2 | retry creates no duplicate Supabase rows (assert insert call count) | unit | `npm test -- src/tests/migration-idempotency.test.ts` | ❌ Wave 0 (new file) |
| SC3 | hook surfaces `failed`/`partial`; banner renders count + retry | unit | `npm test -- src/tests/migration-partial.test.tsx` | ✅ extend (migration-partial.test.tsx) |
| SC4 | retry-after-partial migrates only remaining, no dup, banner reflects | unit | `npm test -- src/tests/migration-idempotency.test.ts -t retry-after-partial` | ❌ Wave 0 (new file) |

### Key test assertions (idempotency / retry-after-partial)

The existing suite already builds the exact harness needed: `fake-indexeddb` populates Dexie,
`mockFrom`/`mockInsert`/`mockSingle` mock Supabase, and `afterEach` resets via `db.delete()`/`db.open()`
([data-migration.test.ts:108-111](../../../../src/tests/data-migration.test.ts#L108)). The
"preserves failed records on partial migration (DAT-1)" test (data-migration.test.ts:451-559) is the
template for the retry test — extend it with a **second** `migrateToSupabase` call.

- **No-duplicate assertion:** after run 1 (partial), capture `from('sessions')`/`from('items')`
  insert-call counts. Run 2 over the same Dexie state. Assert run-2 `from('sessions')` insert called
  **0 times** for the already-mapped session, and `from('items')` insert called only for the prior
  survivors — total Supabase inserts across both runs = total rows, never more.
- **`alreadyMigrated` semantics:** run-2 result `alreadyMigrated` > 0, `failed` should reach 0 once
  the previously-failing insert is mocked to succeed; `partial` false.
- **Cleanup:** after the successful retry, `db.sessions.count()` / item counts / `exportHistory.count()`
  all 0 (ground-truth `needsMigration()` returned false → clear fired).
- **Banner reflects partial:** in migration-partial.test.tsx, render `MigrationRetryBanner` (via an
  Outlet-context test wrapper or by mocking `useOutletContext`) with `{state:'partial', failed:2}`;
  assert "2 items not yet synced" + a "Retry sync" button; assert `null` render when `failed:0`.

**IMPORTANT — `addIdMapping` is mocked in data-migration.test.ts** (line 23-25), so `getNewIdByOldId`
reads against an **empty real Dexie idMapping** there. For the idempotency test, EITHER (a) un-mock
`idMapping` so `addIdMapping`/`getNewIdByOldId` hit real fake-indexeddb (preferred — exercises the real
reverse lookup), OR (b) seed `db.idMapping` directly to simulate a prior run. Option (a) is the honest
idempotency test. [VERIFIED: data-migration.test.ts:23-25 mocks the whole idMapping module]

### Sampling Rate
- **Per task commit:** `npm test -- src/tests/data-migration.test.ts src/tests/migration-idempotency.test.ts src/tests/migration-partial.test.tsx`
- **Per wave merge:** `npm test`
- **Phase gate:** full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/tests/migration-idempotency.test.ts` — new file, covers SC2 + SC4 (no-dup, retry-after-partial)
- [ ] Extend `src/tests/data-migration.test.ts` needsMigration block for the per-row predicate (SC1) — and update the now-wrong test at :120-129 ("returns false when idMapping has entries") which asserts the OLD count-based behavior and **will break** under D-01
- [ ] Extend `src/tests/migration-partial.test.tsx` for `MigrationRetryBanner` + `failed` counter (SC3)
- [ ] Framework install: none — Vitest + fake-indexeddb already present

**⚠️ Breaking existing test:** data-migration.test.ts:120-129 "returns false when idMapping table has
entries (already migrated)" encodes the OLD count short-circuit. Under D-01 it must be rewritten:
adding ONE mapping while a session+items remain unmapped should now return **true**. The planner must
include updating this test as part of the SC1 task (TDD: this is the failing test that drives D-01).

## Security Domain

> `security_enforcement` not set in config → treated as enabled. Minimal surface this phase.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | migration runs post-auth in ProtectedRoute (existing guard) |
| V4 Access Control | yes (existing) | `created_by: userId` on session insert (migration.ts:53) scopes rows to the user; RLS enforces — unchanged |
| V5 Input Validation | no | data is the user's own local catalog, no external input |
| V6 Cryptography | no | none |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Duplicate-row injection via retry | Tampering (data integrity) | The D-05 idempotency guard IS the mitigation — no duplicate Supabase rows |
| Cross-user data leak in mapping | Information Disclosure | `idMapping` is local IndexedDB, per-device; `created_by` + RLS scope server rows. Unchanged. |

No new attack surface — no new endpoints, no new external input, no new secrets.

## Environment Availability

> Pure code/config change (TS + Dexie schema + React). No external runtime dependencies beyond the
> already-installed toolchain. **Step 2.6 effectively SKIPPED** — Vitest, fake-indexeddb, Dexie,
> Supabase client all already in the dependency tree and exercised by the existing test suite.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `houseVisitItems`/`saleItems` have no `deletedAt` (only sessions do) | Pattern 3, Pitfall 5 | If items DO soft-delete, needsMigration must filter them — else deleted items block "complete". Verify src/db/types.ts in plan. |
| A2 | Installed Dexie version's `version().stores()` API is version-stable | Standard Stack | Negligible — API stable across Dexie 3.x/4.x |
| A3 | `useOutletContext` is the cleanest state-share (Option A) | Pattern 4 | If planner prefers Zustand (Option C), still valid — D-07 leaves placement to discretion |

**Two `[ASSUMED]` items (A1, A3) need a quick verification in planning** — A1 is a 2-line type read,
A3 is a design pick the planner owns.

## Open Questions

1. **Do item tables have a `deletedAt` field?**
   - What we know: `migrateToSupabase` filters `deletedAt` only on sessions (migration.ts:18).
   - What's unclear: whether items can be soft-deleted independently.
   - Recommendation: read src/db/types.ts `HouseVisitItem`/`SaleItem` in the first plan task; include
     the item `deletedAt` filter in `needsMigration` only if the field exists.

2. **Settings-level retry entry point (D-07) — same banner or a Settings button?**
   - What we know: D-07 says "A Settings-level retry entry point is in scope" and splash copy already
     promises "retry later from Settings."
   - Recommendation: a small "Retry sync" row in SettingsPage that calls the shared `migration.retry`
     (or `migrateToSupabase` directly when not in the ProtectedRoute Outlet tree). Planner scopes;
     can be a thin second consumer of the same retry path. Low effort, satisfies the splash's promise.

## Sources

### Primary (HIGH confidence — read this session)
- src/db/migration.ts (full) — current migrateToSupabase + needsMigration, DAT-1 recovery set, cleanup gate
- src/db/index.ts:32-170 — Dexie version chain; v11 is current (userEditedFields), idMapping `[newId+type]` only
- src/db/idMapping.ts (full) — reverse-helper pattern to mirror; `addIdMapping` uses `.add()`
- src/db/types.ts:13-20, 94-99 — ExportHistoryRecord + IdMapping shapes
- src/hooks/useDataMigration.ts (full) — drops counters today; retry = runMigration
- src/components/ProtectedRoute.tsx (full) — useDataMigration host, splash wiring, Outlet at line 86
- src/layouts/AppLayout.tsx:78-99 — banner cluster mount point (PhotoMigrationBanner at :86)
- src/components/PhotoMigrationBanner.tsx (full) — persistent-banner precedent
- src/ui/WarnBanner.tsx (full) — additive `action` slot target
- src/App.tsx:16-28 — ProtectedRoute wraps AppLayout (parent/child route relationship)
- src/tests/data-migration.test.ts (full) — harness + the test that will break under D-01 (:120-129)
- src/tests/migration-partial.test.tsx (full) — hook+splash partial test to extend
- src/tests/setup.ts — fake-indexeddb/auto + axe setup
- .planning/.../38-CONTEXT.md, 38-UI-SPEC.md — locked decisions + banner contract

### Secondary (MEDIUM)
- dexie.org/docs/Version/Version.stores() — index-add requires full re-declaration of the version's stores, auto-reindex, no `.upgrade()` for pure index add [CITED]

### Tertiary (LOW)
- none

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all in-repo, versions read directly; only correction is CONTEXT's stale v11→v12
- Architecture: HIGH — every integration point read at file:line; one discretion pick (Outlet context) flagged
- Pitfalls: HIGH — derived from actual code (v11 collision, session-insert dup, counter conflation are all real in the current source)
- Validation: HIGH — existing test harness covers the exact pattern; the breaking test is identified

**Research date:** 2026-06-02
**Valid until:** 2026-07-02 (stable internal code; only risk is further Dexie version bumps in parallel phases — re-check `db.version(N)` latest before adding the index)
