---
phase: 38-migration-retryability
verified: 2026-06-02T12:42:00Z
status: human_needed
human_uat_note: "2026-06-04 milestone-end walk: UAT-1 closed code-verified (migration is a spent one-time path); UAT-2 (atomicity sign-off) and UAT-3 (photoMigration itemId collision) tracked as follow-ups"
score: 4/4
overrides_applied: 0
human_verification:
  - test: "Live retry-after-partial against real Supabase — no duplicate rows"
    expected: "A partial run followed by a retry creates exactly 1 session + correct item count in Supabase; no duplicates in sessions or items tables"
    why_human: "Vitest uses fake-indexeddb + mocked Supabase; cannot prove the real Supabase insert + addIdMapping ordering holds under live network conditions"
  - test: "WR-04 cross-store atomicity window — known limitation acknowledgement"
    expected: "Document that closing the tab between a successful Supabase insert and the subsequent addIdMapping write can leave a row in Supabase with no local mapping; next retry would re-insert (duplicate). Confirm this is accepted as a known limitation until a Supabase natural-key/upsert phase is scheduled."
    why_human: "Non-atomic cross-store writes cannot be verified without a controlled tab-kill harness; requires a human to confirm the limitation is understood and tracked"
  - test: "photoMigration.ts house/sale ++id collision — out-of-scope flag for future phase"
    expected: "Confirm that photoMigration.ts has the same oldId+type lookup without itemTable discrimination (pre-existing, predates Phase 38). Schedule a follow-up phase to add the same itemTable discriminator there."
    why_human: "The collision was explicitly declared out of Phase 38 scope by the code review; needs a human to confirm a follow-up is captured in the roadmap/backlog"
---

# Phase 38: migration-retryability Verification Report

**Phase Goal:** Make the Dexie→Supabase migration correctly retryable after a partial run — accurate needsMigration(), idempotent migrateToSupabase, and partial-state surfaced in the UI — building on shipped DAT-1 (PR #24).
**Verified:** 2026-06-02T12:42:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | needsMigration() returns true while any non-deleted Dexie session/item lacks an idMapping entry | VERIFIED | `migration.ts:10-24`: per-row loop over sessions (filtered `!s.deletedAt`), houseVisitItems, saleItems; each calls `getNewIdByOldId`; returns true on first miss, false only after all rows pass |
| 2 | migrateToSupabase is idempotent — looks up idMapping by oldId (disambiguated by type + itemTable), reuses existing newId / skips insert; retry over preserved rows creates no duplicate Supabase sessions/items | VERIFIED | `migration.ts:87-143` (session guard), `:150-161` (house guard), `:203-212` (sale guard); `getNewIdByOldId` with `itemTable` discriminator; all post-review fixes committed; `migration-idempotency.test.ts` exercises real fake-indexeddb — 0 duplicate inserts confirmed by insert-count assertions |
| 3 | Partial state surfaces in the UI via persistent banner "N items not yet synced — Retry sync"; retry re-runs the migration | VERIFIED | `MigrationRetryBanner.tsx:10-31`: reads Outlet context, renders `WarnBanner` with locked copy when `m.state === "partial" && m.failed > 0`; `AppLayout.tsx:88`: `<MigrationRetryBanner />` mounted after `<PhotoMigrationBanner />`; `ProtectedRoute.tsx:88`: `<Outlet context={migration} />`; 6 banner tests all green |
| 4 | A retry-after-partial test migrates only the remaining rows, creates no duplicates, and the banner reflects partial state | VERIFIED | `migration-idempotency.test.ts:101-167` (SC2/SC4 retry-after-partial case): run 2 `sessions` insert count = 0, items insert count = 1 (only the failed row); total across both runs = 4 (3 attempts + 1 retry); `result2.partial = false`; `needsMigration() = false`; all Dexie tables drained to 0 |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/migration.ts` | needsMigration() per-row predicate + idempotent migrateToSupabase + D-09 cleanup gate | VERIFIED | 268 lines; all per-SC logic present and substantive |
| `src/db/idMapping.ts` | getNewIdByOldId(oldId, type, itemTable?) reverse helper | VERIFIED | 75 lines; helper at :46-60; addIdMapping at :68-75 |
| `src/db/index.ts` | Dexie v12 with [oldId+type] compound index on idMapping | VERIFIED | `index.ts:174-187`: v12 block with `[oldId+type]` appended to idMapping store; no .upgrade() |
| `src/db/types.ts` | IdMapping type with optional itemTable field | VERIFIED | `types.ts:94-103`: `itemTable?: "house" | "sale"` on IdMapping |
| `src/hooks/useDataMigration.ts` | CR-01 re-entrancy guard + failed/alreadyMigrated split + WR-01 progress clamp | VERIFIED | `useDataMigration.ts:41-68`: `runningRef`, synchronous guard at :44-45, `Math.min` clamp at :53, result mapping at :55-63 |
| `src/components/MigrationRetryBanner.tsx` | Persistent dismissible banner reading Outlet context; no second useDataMigration call | VERIFIED | 31 lines; `useOutletContext` only; no `useDataMigration` or `useLiveQuery` runtime call; null guards correct |
| `src/components/ProtectedRoute.tsx` | Passes `<Outlet context={migration} />`; no dead skipped prop | VERIFIED | `:88`: `<Outlet context={migration} />`; no `skipped` prop passed to MigrationSplash (WR-03 fix confirmed) |
| `src/layouts/AppLayout.tsx` | Mounts MigrationRetryBanner after PhotoMigrationBanner | VERIFIED | `AppLayout.tsx:87-88`: `<PhotoMigrationBanner />` then `<MigrationRetryBanner />` |
| `src/ui/WarnBanner.tsx` | Optional action slot (label, onClick, busy?) | VERIFIED | `WarnBanner.tsx:25`: `action?: { label: string; onClick: () => void; busy?: boolean }` |
| `src/tests/migration-idempotency.test.ts` | SC2/SC4 retry-after-partial test + house/sale collision test | VERIFIED | 277 lines; 4 test cases covering retry-after-partial, already-mapped cleanup, WR-02 interrupted-session edge, and id collision |
| `src/tests/migration-retry-banner.test.tsx` | SC3 banner tests | VERIFIED | 83 lines; 6 tests covering render, singularize, null states, retry CTA, dismiss |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `useDataMigration` | `migrateToSupabase` | direct import + call in runMigration | WIRED | `useDataMigration.ts:2,48` |
| `migrateToSupabase` | `getNewIdByOldId` | import + 4 call sites | WIRED | `migration.ts:2,87,117,125,155,206` — session guard + WR-02 branch + both item loops |
| `migrateToSupabase` | `addIdMapping` | import + 3 write sites | WIRED | `migration.ts:2,137,183,233` — session + house item + sale item |
| `ProtectedRoute` | `useDataMigration` | single hook instance | WIRED | `ProtectedRoute.tsx:6,26` |
| `ProtectedRoute` | `Outlet context={migration}` | react-router Outlet | WIRED | `ProtectedRoute.tsx:88` |
| `MigrationRetryBanner` | `Outlet context` | `useOutletContext<...>` | WIRED | `MigrationRetryBanner.tsx:11` — type-only import of useDataMigration; runtime via useOutletContext |
| `AppLayout` | `MigrationRetryBanner` | JSX mount | WIRED | `AppLayout.tsx:12,88` |
| `MigrationRetryBanner` | `WarnBanner action slot` | prop | WIRED | `MigrationRetryBanner.tsx:27-29`: `action={{ label: "Retry sync", onClick: m.retry }}` |
| `needsMigration` | `db.sessions/houseVisitItems/saleItems` | Dexie queries | WIRED | `migration.ts:11,15,19` |
| Dexie v12 | `[oldId+type]` reverse index | `db.version(12).stores(...)` | WIRED | `index.ts:182` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `MigrationRetryBanner` | `m.failed`, `m.state`, `m.retry` | `useOutletContext` → single `useDataMigration` instance in `ProtectedRoute` | Yes — `failed` is set from `migrateToSupabase` result; `state` transitions through real migration run | FLOWING |
| `useDataMigration` | `status.failed`, `status.state` | `migrateToSupabase` return value (`result.failed`, `result.partial`) | Yes — counters incremented by real Supabase insert errors | FLOWING |
| `migrateToSupabase` | `failed`, `alreadyMigrated`, `migrated` | Dexie queries + Supabase inserts + getNewIdByOldId lookups | Yes — grounded in real DB state; no static returns | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite passes | `npx vitest run` | 699 passed, 0 failed, 49 todo, 4 skipped | PASS |
| TypeScript clean | `npx tsc --noEmit` | No output (exit 0) | PASS |
| Phase-specific migration tests | `npx vitest run src/tests/migration-idempotency.test.ts src/tests/migration-retry-banner.test.tsx` | All 4 + 6 = 10 tests passed (implicit in suite total) | PASS |

### Probe Execution

No probe scripts defined for this phase. Step 7c: SKIPPED (no `scripts/*/tests/probe-*.sh` matching phase 38).

### Requirements Coverage

No formal REQ-IDs in REQUIREMENTS.md mapped to this phase. All four success criteria from ROADMAP.md are verified above as observable truths 1-4.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/db/migration.ts` | 54-65 | `// WR-04: cross-store non-atomicity` comment documenting a known residual duplicate vector | INFO | Document-only; accepted per review disposition (WR-04 out of scope for Phase 38); WHY-comment is intentional |

No `TBD`, `FIXME`, or `XXX` markers found in any Phase 38 modified file. No stub patterns. No empty implementations.

**Debt-marker gate:** PASSED — all WHY-comments are informational; none are unresolved blockers.

### Human Verification Required

#### 1. Live Retry-After-Partial Against Real Supabase

**Test:** Log in to the app with a Dexie catalog that has sessions + items. Simulate or engineer a partial migration (e.g., take offline mid-migration, or set a breakpoint). Let the partial state persist. Then reopen/retry the migration from the partial banner.
**Expected:** After the retry completes, querying `sessions` and `items` tables in Supabase shows exactly the expected row count — no duplicates. The banner clears.
**Why human:** Vitest exercises real fake-indexeddb but mocks Supabase. The lookup-before-insert idempotency is verified in the unit layer. The live scenario proves the real Supabase insert latency + addIdMapping ordering holds under real network conditions.

#### 2. WR-04 Cross-Store Atomicity Window — Known Limitation Sign-off

**Test:** Read the WHY-comment at `src/db/migration.ts:54-65`. Confirm the team understands: a tab close (or `addIdMapping` throw) between a successful Supabase insert and a durable local mapping can leave a duplicate on the next retry.
**Expected:** The limitation is acknowledged as accepted for v1 (single-tab, no concurrent migration, CR-01 guard reduces the concurrent vector). A follow-up item is logged in the roadmap or backlog for a Supabase natural-key/upsert resolution.
**Why human:** The code is correct-as-far-as-it-goes; this is a design limitation that needs a product/engineering sign-off on acceptable residual risk.

#### 3. photoMigration.ts House/Sale ++id Collision — Future Phase Flag

**Test:** Read `src/services/photoMigration.ts`. Confirm the `type === "item"` lookup at the equivalent line does not pass `itemTable`, making it vulnerable to the same house/sale ++id collision Phase 38 fixed for `migrateToSupabase`.
**Expected:** Confirm the collision exists (out of scope for Phase 38 per the code review), and that a follow-up phase is scheduled to apply the same `itemTable` discriminator fix there.
**Why human:** Code review explicitly declared this out of Phase 38 scope. A human needs to confirm it is captured as a follow-up, not silently dropped.

---

_Verified: 2026-06-02T12:42:00Z_
_Verifier: Claude (gsd-verifier)_
