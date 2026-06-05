# Phase 38: migration-retryability - Context

**Gathered:** 2026-06-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the Dexie→Supabase migration **retryable and idempotent** so a partial
migration is correctly detected, can be safely re-run over the preserved
recovery set without creating duplicate Supabase rows, and surfaces its
partial state in the UI. Builds on the DAT-1 work in PR #24 (partial-delete
recovery + `partial` flag already returned by `migrateToSupabase`).

**In scope:** `needsMigration()` correctness, `migrateToSupabase` idempotency,
partial-state banner + retry, exportHistory cleanup semantics, tests.

**Out of scope (own phases):** optimistic locking / `updated_at` triggers
(Phase 39), AI-proxy migration (Phase 40), broader UX toast work (Phase 36 —
which only *aligns banner copy* with this phase's banner).

</domain>

<decisions>
## Implementation Decisions

### needsMigration detection (locked default — not discussed)
- **D-01:** `needsMigration()` returns true while **any** non-deleted Dexie
  session OR item has an `oldId` with no `idMapping` row. Replace the current
  `idMapping.count() > 0 → false` early-return ([migration.ts:5-10](../../../../src/db/migration.ts#L5-L10))
  with a per-row mapping check so a partial migration is no longer treated as
  complete.
- **D-02:** Only non-deleted rows count (`deletedAt` rows excluded — same
  filter already used by `migrateToSupabase`). Check sessions, houseVisitItems,
  and saleItems.

### Idempotency lookup (locked default — not discussed)
- **D-03:** Add Dexie **v11** schema with an `[oldId+type]` compound index on
  `idMapping` (today only `[newId+type]` exists, [db/index.ts:103](../../../../src/db/index.ts#L103)).
  Reverse lookup oldId→newId must be indexed.
- **D-04:** Add a `getNewIdByOldId(oldId, type)` helper in
  [idMapping.ts](../../../../src/db/idMapping.ts) (mirrors the existing
  `getDexieItemId`/`getDexieSessionId` direction).
- **D-05:** Before inserting a session or item in `migrateToSupabase`, look up
  the existing mapping by `oldId`; if present, **skip the Supabase insert and
  reuse the existing `newId`**. This applies to the session insert too — a
  session preserved for recovery already has a session mapping from the prior
  run, so without this check a retry would create a duplicate Supabase session.

### Partial-state banner surface (locked default — not discussed)
- **D-06:** Plumb the `partial` flag (already returned by `migrateToSupabase`)
  through `useDataMigration` — the hook currently drops it ([useDataMigration.ts:35-40](../../../../src/hooks/useDataMigration.ts#L35-L40)).
- **D-07:** Add a **persistent, dismissible in-app banner** ("N items not yet
  synced — Retry") for partial state, separate from the login-only full-screen
  `MigrationSplash`. Retry re-runs the migration. Mirror the existing
  `PhotoMigrationBanner` pattern. A Settings-level retry entry point is in
  scope (the splash copy already promises "retry later from Settings").
- **D-08:** `MigrationSplash`'s existing `error`-state retry stays as-is for
  the at-login path; the new banner covers the post-dismiss / later-session path.

### exportHistory cleanup + counter semantics (DISCUSSED — user pick)
- **D-09:** Clear `exportHistory` iff `needsMigration()` returns **false after
  the run** (ground-truth completeness check), not based on the run's `skipped`
  counter ([migration.ts:172-175](../../../../src/db/migration.ts#L172-L175)).
  This is robust against the skip/fail conflation a counter-based gate would
  introduce once retries are idempotent.
- **D-10:** **Split the counters.** `partial` (the banner trigger) keys on
  **failures only** (`failures > 0`). Idempotent-skips (rows skipped because a
  mapping already exists) are tracked in a **separate** counter and must NOT
  set `partial` or block exportHistory cleanup — otherwise a clean retry would
  falsely report "not yet synced." Rename/repurpose the current `skipped`
  accordingly so the return shape distinguishes `failed` vs `alreadyMigrated`.

### Claude's Discretion
- Exact return-shape field names (`failed` / `alreadyMigrated` / `migrated`)
  and how `useDataMigration`'s `MigrationStatus` surfaces them — planner/impl
  decides, as long as D-10's semantic split holds.
- Banner component structure and placement in the layout tree, following the
  `PhotoMigrationBanner` precedent.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase definition
- `.planning/ROADMAP.md` §"Phase 38: migration-retryability" — the four
  bullets defining scope (needsMigration fix, idempotency, partial banner,
  tests) and the medium-risk note.

### DAT-1 predecessor (the recovery-set + partial flag this builds on)
- PR #24 (merged) — DAT-1 partial-delete recovery. Already in `migration.ts`:
  the `migratedHouseItemIds`/`migratedSaleItemIds`/`fullyMigratedSessionIds`
  tracking + `partial: skipped > 0` return.

### Cross-phase coordination
- `.planning/ROADMAP.md` §"Phase 36: ux-visibility-polish" line: "Migration
  success copy false (Codex #2) → align banner copy with the DAT-1 `partial`
  flag (use Phase 38's banner from the DAT-1 followup)." Phase 36 consumes this
  phase's banner — keep the banner copy/contract stable for it.

No external ADRs/specs — this is internal migration logic; requirements fully
captured in the decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/db/idMapping.ts` — `getDexieItemId`/`getDexieSessionId` establish the
  query+index pattern; add the reverse `getNewIdByOldId` helper here.
- `src/components/PhotoMigrationBanner.tsx` — precedent for a persistent
  dismissible in-app migration banner (D-07).
- `src/components/MigrationSplash.tsx` — already has `error`-state retry button
  + "retry later from Settings" copy; partial UI is partly built.

### Established Patterns
- Dexie versioned migrations in `src/db/index.ts` go up to v10
  (`audioUploadQueue`); adding `[oldId+type]` is a clean v11 bump.
- `idMapping` compound-index convention: `[newId+type]` already exists; mirror
  it for `[oldId+type]`.

### Integration Points
- `migrateToSupabase` (`src/db/migration.ts`) — core change site.
- `useDataMigration` (`src/hooks/useDataMigration.ts`) — must expose `partial`
  + the split counters; consumed by `ProtectedRoute`.
- `ProtectedRoute.tsx` — renders `MigrationSplash`; the new persistent banner
  needs a host (likely `AppLayout`, where other banners live).

</code_context>

<specifics>
## Specific Ideas

- Banner copy: "N items not yet synced — Retry" (from ROADMAP). Phase 36 will
  reconcile this with the success-copy fix — keep it the single source.
- Cleanup must use a post-run `needsMigration()` ground-truth check rather than
  trusting the run's own counters (user's explicit pick).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 38-migration-retryability*
*Context gathered: 2026-06-01*
