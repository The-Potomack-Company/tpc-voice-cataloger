---
phase: 33-offline-reliability
plan: 00
subsystem: database
tags: [supabase, migration, backoff, error-classification, vitest, generated-types]

# Dependency graph
requires:
  - phase: 31-sec-profiles-self-update-hardening
    provides: column-grant discipline + sibling-isolation prod-push gate precedent
  - phase: 32-audio-blob-supabase-persistence
    provides: items table baseline (audio columns, ai_status enum with queued+processing)
provides:
  - "items table on prod has claimed_at (timestamptz null) + ai_attempts (int not null default 0)"
  - "database.types.ts items Row/Insert/Update reflect both new columns"
  - "src/utils/backoff.ts pure helpers (nextEligibleAt, isInBackoff, ATTEMPT_CAP, BACKOFF_BASE_MS, BACKOFF_CAP_MS)"
  - "src/utils/aiErrorClass.ts classifyAiError (D-08 permanent|transient taxonomy)"
  - "Wave-0 RED stub blocked-badge.test.tsx defining the REL-3 D-10 badge contract"
affects: [33-01, 33-02, 33-03, 33-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Full-jitter exponential backoff (D-06): claimedAt + random * min(CAP, BASE*2^attempts)"
    - "Regex-parse AI error classification (D-08) instead of typed-error refactor of gemini.ts"
    - "4-step cross-app schema protocol: schema.md/migrations.md FIRST, then migration SQL, then prod push, then regenerate types"

key-files:
  created:
    - src/utils/backoff.ts
    - src/utils/aiErrorClass.ts
    - src/tests/backoff.test.ts
    - src/tests/error-classify.test.ts
    - src/tests/blocked-badge.test.tsx
    - supabase/migrations/20260601000100_add_items_claim_columns.sql
  modified:
    - src/db/database.types.ts
    - src/tests/supabase-types.test.ts
    - ../_workspace/Schema/schema.md
    - ../_workspace/Schema/migrations.md

key-decisions:
  - "Migration version renamed 20260601000000 -> 20260601000100 to avoid colliding with the already-applied 20260601000000_create_audio (would have been skipped on push)"
  - "No GRANT UPDATE on new columns; they inherit existing items RLS (T-33-01, Phase-31 lesson)"
  - "No enum DDL; ai_status enum already carries queued+processing from Phase 32"
  - "classifyAiError generalizes gemini.ts:146-151 via regex-parse, NOT a typed-error refactor (deferred cleanup, keeps diff tight)"

patterns-established:
  - "Wave-0 contract stub pattern: RED/skipped test file defines a downstream plan's component contract before implementation"
  - "Pure-util module shape (named exports, null-tolerant, no side effects) mirroring formatEstimate.ts"

requirements-completed: [REL-1, REL-2, REL-3]

# Metrics
duration: continuation (Task 3 only)
completed: 2026-06-01
---

# Phase 33 Plan 00: Offline-Reliability Foundation Summary

**Two-column `items` migration (claimed_at, ai_attempts) applied to prod, generated types regenerated + asserted, plus the pure backoff/error-classifier helpers and Wave-0 contract stubs every REL-1..4 drain depends on.**

## Performance

- **Duration:** continuation session (Task 3 / final task only; Tasks 1-2 completed in prior session)
- **Completed:** 2026-06-01
- **Tasks:** 3 (1-2 prior, 3 this session)
- **Files modified:** 10 across the full plan

## Accomplishments
- Applied the additive `claimed_at` + `ai_attempts` migration to the shared prod Supabase project (cataloger + dashboard read items)
- Regenerated `database.types.ts` so items Row/Insert/Update carry the two new columns (3 occurrences each)
- Extended `supabase-types.test.ts` with Row/Insert/Update claim-column assertions — suite GREEN at 9/9
- Pure `backoff.ts` + `aiErrorClass.ts` helpers (Tasks 1) and the blocked-badge RED contract stub (Task 2) are the Nyquist scaffold for REL-1/REL-2/REL-3

## Task Commits

1. **Task 1: pure backoff + AI-error classifier helpers** — `5bca38e` (feat, GREEN)
2. **Task 2: items claim-columns migration + blocked-badge contract stub** — `939ff01` (feat) + `ecd3afe` (fix: version-collision rename)
3. **Task 3 (this session):**
   - `1e5b495` (feat) — regenerate database.types after prod push
   - `fd6f44e` (test) — assert items claim columns in generated types

## Files Created/Modified
- `src/utils/backoff.ts` — full-jitter backoff (D-06): nextEligibleAt / isInBackoff + caps
- `src/utils/aiErrorClass.ts` — classifyAiError D-08 taxonomy (permanent|transient)
- `src/tests/backoff.test.ts`, `src/tests/error-classify.test.ts` — GREEN unit tests
- `src/tests/blocked-badge.test.tsx` — Wave-0 RED stub, REL-3 D-10 badge contract (skipped until REL-3 ships)
- `supabase/migrations/20260601000100_add_items_claim_columns.sql` — additive DDL, no GRANT, no enum DDL
- `src/db/database.types.ts` — regenerated, items gains claimed_at + ai_attempts
- `src/tests/supabase-types.test.ts` — items Row/Insert/Update claim-column assertions
- `../_workspace/Schema/schema.md`, `../_workspace/Schema/migrations.md` — schema-protocol step 1 (updated first)

## Wave-0 Contract (downstream dependency)

Plans **33-01..04** depend on this plan's outputs:
- **REL-1 (33-01):** consumes `backoff.ts` (nextEligibleAt/isInBackoff) + `items.ai_attempts`
- **REL-2 (33-02):** consumes `items.claimed_at` for the DB-atomic claim (structurally prevents duplicate Gemini spend, T-33-02)
- **REL-3 (33-03):** implements the blocked-count badge against the `blocked-badge.test.tsx` contract (tone="err" + count next to OfflineIndicator + click-to-detail)
- All drains consume `classifyAiError` for the D-08 retry-vs-drop decision

## Decisions Made
- **Migration version rename (20260601000000 → 20260601000100):** the original version collided with the already-applied `20260601000000_create_audio`. Supabase would have treated the new file as already-applied and skipped it on push, silently leaving prod without the claim columns. Renamed to a unique later version so the dry-run isolation gate showed it as the ONLY pending migration before apply.
- No GRANT UPDATE on new columns (T-33-01); they inherit items RLS.
- No enum DDL — ai_status already has queued+processing from Phase 32.
- classifyAiError via regex-parse, not a gemini.ts typed-error refactor (deferred cleanup per RESEARCH Open Question 1).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migration version collision**
- **Found during:** Task 3 (prod push, prior session, resolved by orchestrator)
- **Issue:** `20260601000000_add_items_claim_columns.sql` shared the `20260601000000` version with the already-applied `create_audio` migration; push would skip it, leaving prod without the columns.
- **Fix:** Renamed to `20260601000100_add_items_claim_columns.sql`. PLAN frontmatter/acceptance-criteria still reference the old `...000000` filename; the renamed file is canonical and DO-NOT-rename-back per the orchestrator.
- **Files modified:** supabase/migrations/20260601000100_add_items_claim_columns.sql
- **Committed in:** `ecd3afe`

---

**Total deviations:** 1 auto-fixed (1 blocking — migration version collision)
**Impact on plan:** Necessary for the prod push to actually apply the columns. No scope creep.

## Issues Encountered
None this session. The version collision was caught at the dry-run isolation gate and resolved before apply.

## User Setup Required
Supabase CLI auth (login/link) + SUPABASE_DB_PASSWORD were user-only for the prod push (now completed). No further setup required.

## Verification

`npx vitest run src/tests/supabase-types.test.ts` — **9 passed (9)**, 1 file passed. items Row/Insert/Update claim-column assertions GREEN.

A4 schema-drift-checker (Checkpoint G) fired and wrote `../_workspace/Schema/drift.md`.

## Next Phase Readiness
- Prod columns + generated types in place; backoff/classifier helpers and the blocked-badge contract are ready for REL-1..4.
- Known non-blocking drift (pre-existing): prod `profiles.theme` absent, and crm_* tables stale in types — both tracked in STATE.md, NOT introduced here.

## Self-Check: PASSED

All 7 created/modified source files present; all 5 task commits (5bca38e, 939ff01, ecd3afe, 1e5b495, fd6f44e) verified in git log.

---
*Phase: 33-offline-reliability*
*Completed: 2026-06-01*
