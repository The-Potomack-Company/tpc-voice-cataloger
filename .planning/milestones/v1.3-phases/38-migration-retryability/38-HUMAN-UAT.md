---
phase: 38-migration-retryability
created: 2026-06-02T12:42:00Z
source: VERIFICATION.md human_verification section
---

# Phase 38: Human UAT Items

Three items requiring human action before this phase can be fully closed.

---

## UAT-1: Live Retry-After-Partial Against Real Supabase

**Priority:** Must-have for production confidence
**Tester:** Developer / QA

**Setup:**
1. Ensure you have a local Dexie catalog with at least 2 sessions and multiple items.
2. Either: (a) use browser DevTools to intercept and fail one item insert mid-migration, or (b) test against a staging Supabase project with a deliberately broken items table for one row.

**Steps:**
1. Log in. Observe the migration splash. Let it run to partial state.
2. Note the count displayed on the `MigrationRetryBanner` ("N items not yet synced").
3. Click "Retry sync".
4. Let the retry complete.
5. In Supabase Table Editor (or `psql`), run: `SELECT count(*) FROM sessions` and `SELECT count(*) FROM items`.

**Expected:**
- Row counts in Supabase match the original Dexie catalog size exactly.
- No duplicate sessions. No duplicate items.
- The `MigrationRetryBanner` clears after a successful retry.
- `exportHistory` table in Dexie is empty after a fully-clean retry.

**Pass/Fail:** ___________

**Notes:** ___________

---

## UAT-2: WR-04 Cross-Store Atomicity Window — Known Limitation Sign-off

**Priority:** Design sign-off (not a blocker for shipping)
**Owner:** Tech lead / engineering

**Background:**
`src/db/migration.ts:54-65` documents a residual duplicate vector: if the browser tab closes (or `addIdMapping` throws) between a successful Supabase insert and the local idMapping write, the row exists in Supabase with no local mapping. The next retry's `getNewIdByOldId` returns null and re-inserts, creating a duplicate.

Phase 38 mitigates this with:
- CR-01 re-entrancy guard (no concurrent retries)
- `addIdMapping` always awaited immediately after insert (window as small as possible without a real transaction)

Fully closing the window needs a Supabase-side natural key + upsert (schema change, deliberately out of Phase 38 scope).

**Action required:**
- [ ] Confirm the residual risk is accepted for v1 (single-tab app, no cross-tab migration concurrency).
- [ ] Log a follow-up item (roadmap phase or backlog ticket) for the Supabase natural-key/upsert resolution.
- [ ] Add the follow-up reference to the WHY-comment at `migration.ts:64` if a specific ticket/phase number is assigned.

**Accepted by:** ___________ **Date:** ___________

**Follow-up reference (phase/ticket):** ___________

---

## UAT-3: photoMigration.ts House/Sale ++id Collision — Follow-up Phase Flag

**Priority:** Future phase scheduling
**Owner:** Engineering

**Background:**
The code review (38-REVIEW.md, cross-file verification section) noted that `src/services/photoMigration.ts` uses an `oldId + type === "item"` idMapping lookup without the `itemTable` discriminator that Phase 38 added to `migrateToSupabase`. This means `photoMigration.ts` has the same house/sale `++id` keyspace collision that Phase 38 fixed for the primary migration path.

This was explicitly out of Phase 38 scope (commit `f5b4930`, predates this phase, untouched). It is a real bug — a photo belonging to a sale item with the same integer id as an already-migrated house item could resolve to the wrong Supabase item id.

**Action required:**
- [ ] Confirm `photoMigration.ts` has the collision (check the `type === "item"` lookup — no `itemTable` filter).
- [ ] Create a follow-up roadmap phase or backlog ticket: "Fix photoMigration.ts house/sale itemId collision — apply itemTable discriminator matching Phase 38's migrateToSupabase fix."
- [ ] Record the ticket/phase reference here.

**Confirmed by:** ___________ **Date:** ___________

**Follow-up reference (phase/ticket):** ___________
