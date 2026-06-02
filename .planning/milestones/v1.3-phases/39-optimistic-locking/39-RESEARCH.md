# Phase 39: optimistic-locking - Research

**Researched:** 2026-06-02
**Domain:** Postgres optimistic concurrency (timestamptz version token) + supabase-js precondition writes + client-side reconcile loops
**Confidence:** HIGH (mechanics verified against authoritative sources + in-repo precedent; LOW only on µs-collision empirics, flagged)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01..D-09 — do NOT relitigate)
- **D-01:** Reuse existing `set_updated_at()` plpgsql fn. New migration: add `items.updated_at timestamptz not null default now()` + attach `BEFORE UPDATE` trigger via `set_updated_at()`. Mirror the `crm_threads_updated_at` trigger as template. No `moddatetime` extension.
- **D-02:** `updated_at` (timestamptz) IS the version token. Accept the rare same-µs-collision edge. No integer `version` column, no `xmin`. (xmin = fallback-only if collisions prove real.)
- **D-03:** Backfill existing rows in the same migration: `coalesce(created_at, now())`. Regenerate `src/db/database.types.ts` via `npm run db:types`. Update `../_workspace/Schema/schema.md` (cross-app event).
- **D-04:** Capture `updated_at` snapshot at **enqueue** time into the Dexie `writeAheadQueue` payload. On flush, apply `.eq("updated_at", <snapshot>)`; 0-row routes through the **same reconcile path** as online writes. Queued user field-edit re-applies (intent-preserving).
- **D-05:** Precondition/reconcile must compose with **Phase 33** (offline-reliability — queue backoff + attempt-cap + cross-tab claim). Sequencing flag only; NOT a blocker for 39. (NOTE — see Open Question O-1: schema/decisions docs say Phase 33 already landed `claimed_at`/`ai_attempts`; CONTEXT.md says "not yet built." Reconcile before planning.)
- **D-06:** AI-merge per-field compare-and-skip. `mergeFieldsIntoItem` records field values read at merge start. On 0-row conflict: re-read, per field compare current DB value to value-at-read — if differs (user changed it) → **skip**; else re-apply with fresh `updated_at` precondition. NO extra Gemini round-trip.
- **D-07:** Bounded read-modify-reapply: up to **3** attempts of (re-read → re-apply → write w/ fresh precondition). Silent on success. On exhaustion → `ErrorToast` via `notifyError(message, retry)`. Same 3× bound caps the AI-merge reconcile loop.
- **D-08:** User-vs-user concurrent edits OUT of scope. Single-field user edit always re-applies (last human intent wins). The guard that matters is AI-yields-to-user (D-06).
- **D-09:** Cross-tab/device version check OUT of scope (Phase 33 owns it). DB precondition already prevents silent loss.

### Claude's Discretion
- Exact migration filename/timestamp, exhaustion-toast copy, and where the value-at-read snapshot is threaded through `mergeFieldsIntoItem` — provided they honor D-01..D-09.

### Deferred Ideas (OUT OF SCOPE)
- Proactive cross-tab/device version check (broadcast / Supabase realtime sub) → Phase 33.
- Dedicated integer `version` column / `xmin` token → only if µs-collisions prove real.
</user_constraints>

## Summary

Phase 39 adds DB-enforced optimistic concurrency to `items` writes. The mechanism is standard and well-trodden: a `timestamptz updated_at` column, a `BEFORE UPDATE` trigger that bumps it on every write, and client writes that carry an `.eq("updated_at", <prev>)` precondition. When the precondition doesn't match (someone else wrote since our read), the row count returned is zero — the client treats that as a conflict and reconciles rather than blindly last-writer-wins.

Two facts are load-bearing and **both are verified**: (1) supabase-js v2 `.update(...).eq(...).select()` matching **zero rows returns `data: []` with `error: null`** — a conflict is detected by `data.length === 0`, NOT by catching an error. (2) A Postgres `BEFORE UPDATE` trigger fires **only on rows that already matched the `WHERE` clause**, so the precondition (`updated_at = prev`) is evaluated against the OLD/pre-trigger value — the optimistic check is correct and the trigger's `now()` bump never races the comparison.

**Two significant planning flags surfaced that the touchpoint scout did not mention:**
1. **Continuous mode is gated OFF** (`CONTINUOUS_MODE_ENABLED = false`, D-050). The headline success-criterion test ("live user edit racing an AI continuous-mode chunk write") targets *dormant* code. The reconcile logic still belongs in `mergeFieldsIntoItem`/`updateItemField` (so it's correct when continuous revives), but the test must drive `mergeFieldsIntoItem` **directly**, not through the gated continuous-recorder UI. Plan and UAT copy should say "continuous-merge path (currently dormant)" so verification isn't mis-scoped.
2. **`items` is the cataloger's FIRST real use of the `set_updated_at()` trigger.** Despite schema.md line 356 claiming the trigger is "set on sessions," **no migration actually attaches it to `sessions`** — only the function is defined. The single real attachment in the cataloger's migration history is `crm_threads_updated_at`. Treat crm_threads as the only proven template; fix the stale schema.md claim opportunistically.

**Primary recommendation:** One migration (column + backfill + trigger, mirroring crm_threads). Wrap the two write sites (`sessionStore.updateItemField`, `mergeFieldsIntoItem`'s per-field loop) in a shared precondition-reconcile helper bounded to 3 attempts. Thread `updated_at` through the Dexie `writeAheadQueue` payload for the offline path. The Phase 35 `userEditedFields` provenance set is a *complementary* (not redundant) guard — it gates AI **retry** writes; Phase 39's compare-and-skip gates AI **continuous-merge** writes. Keep both.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `updated_at` version token + bump | Database (trigger) | — | Server-authoritative; must be atomic with the UPDATE, can't be client-trusted |
| Backfill existing rows | Database (migration) | — | One-time DDL/DML; same migration per D-03 |
| Precondition on write (`.eq("updated_at", prev)`) | Client (supabase-js write) | Database (WHERE eval) | The client supplies the snapshot; the DB enforces the match atomically |
| Conflict detection (0-row) | Client (`data.length === 0`) | — | supabase-js returns empty data, not an error; client must inspect |
| Reconcile policy (re-apply vs skip) | Client (store / merge loop) | — | Intent (user vs AI) is client knowledge; DB only enforces the version gate |
| Offline snapshot capture + flush | Client (Dexie + queue) | Database (precondition at flush) | Snapshot taken at enqueue; precondition re-applied on drain |
| Conflict surfacing | Client (notificationStore / ErrorToast) | — | UI concern; reuse DAT-4 surface |

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DAT-3 | (Track-2 quality / no formal REQ-ID) optimistic concurrency on `items` writes; no silent write loss across user-vs-AI races | Migration mechanics (Standard Stack), precondition return-shape (Pitfall 1), reconcile bound (D-07 pattern), test harness (Validation Architecture) |

## Standard Stack

This phase introduces **no new packages**. Everything needed is already in the tree.

### Core (already installed — versions verified in package.json)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | `2.99.2` [VERIFIED: package.json + node resolve] | `.update().eq().eq().select()` precondition writes | Already the app's DB client; `.select()`-returns-rows is the conflict signal |
| `dexie` | (installed, v12 schema) [VERIFIED: src/db/index.ts] | `writeAheadQueue` payload extension for offline snapshot | Existing offline write-ahead store |
| `zustand` | (installed) [VERIFIED: imports] | `sessionStore` mutation site, `notificationStore` conflict surface | Existing state layer |
| `vitest` | `^4.0.18` [VERIFIED: package.json] | Deterministic 0-row race test | Existing test runner; `--run` script |
| `zod` | (installed) | catalog field schema (untouched here, but merge reads it) | Existing AI validation |

### Supporting (DB-side, no install)
| Asset | Purpose | When to Use |
|-------|---------|-------------|
| `public.set_updated_at()` plpgsql fn | Bumps `new.updated_at = now()` on UPDATE | D-01 — reuse as-is, attach to `items` |
| `crm_threads_updated_at` trigger | Template for the `items` trigger | The ONLY proven attachment to mirror |

### Alternatives Considered (all rejected by locked decisions — listed for completeness)
| Instead of | Could Use | Tradeoff (and why rejected) |
|------------|-----------|------------------------------|
| `updated_at` token | integer `version` column | Avoids µs-collision entirely, but D-02 rejects it (extra column, extra migration); deferred fallback only |
| `updated_at` token | `xmin` system column | Zero schema change, monotonic per-row, no µs-collision risk — but opaque, not in `database.types.ts`, harder to thread through the queue payload. D-02 rejects; fallback-only |
| `moddatetime` extension | — | D-01 rejects; custom fn already exists |

**Installation:** none.

**Version verification:**
```bash
node -e "console.log(require('@supabase/supabase-js/package.json').version)"   # → 2.99.2 (confirmed)
```

## Package Legitimacy Audit

> No external packages installed this phase. All assets are in-repo or DB-side.

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none — phase adds no dependencies) | — | N/A |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────────┐
   user inline edit ──────▶ sessionStore.updateItemField(id,sess,f,val)  │
   (InlineEdit UI)        │   1. optimistic local set()                  │
                          │   2. read prev updated_at (from local item)  │
                          └──────────────┬──────────────────────────────┘
                                         │
   AI continuous-merge ──┐               │
   mergeFieldsIntoItem   │               ▼
   (per-field loop,      │   ┌───────────────────────────────────────┐
    DORMANT — D-050)     └──▶│   preconditionUpdate(table,id,prev,    │  ◀── SHARED HELPER
                             │     patch)  →  bounded 3× reconcile    │      (new, both callers)
                             └──────────────┬────────────────────────┘
                                            │
                        supabase.from("items")
                          .update(patch).eq("id",id)
                          .eq("updated_at", prev).select()
                                            │
            ┌───────────────────────────────┼───────────────────────────────┐
            ▼ data.length>=1                ▼ data.length===0               ▼ error!=null
       SUCCESS                         CONFLICT (or RLS-deny)           GENUINE ERROR
       (trigger bumped                 re-read row → reconcile:         throw → existing
        updated_at = now())            • user edit: re-apply field      network/permanent
                                       • AI merge: per-field compare-     handling
                                         and-skip (D-06)
                                       retry w/ fresh prev (≤3, D-07)
                                       exhausted → notifyError + Retry
                                            │
                                       ┌────┴─────┐ offline branch (isNetworkError)
                                       ▼          ▼
                                 enqueueWrite  payload now carries
                                 {table,op,    updated_at snapshot (D-04)
                                  payload,         │
                                  updatedAtSnap}   ▼
                                              processWriteAheadQueue:
                                              .update(rest).eq("id").eq("updated_at",snap)
                                              .select() → 0-row → SAME reconcile path
```

### Recommended Code Structure
```
src/db/optimisticUpdate.ts   # NEW — shared preconditionUpdate() + reconcile loop (≤3, D-07)
src/stores/sessionStore.ts   # MODIFY :411-490 — updateItemField uses helper; snapshot prev
src/services/geminiContinuous.ts # MODIFY :214-257 — mergeFieldsIntoItem records value-at-read; D-06 skip
src/hooks/useWriteAheadQueue.ts  # MODIFY :51-105 — payload carries updatedAt; flush applies precondition
src/db/types.ts              # MODIFY :105-112 — WriteAheadEntry.payload gains updated_at
src/db/index.ts              # NO Dexie version bump needed (payload is untyped Record; see Pitfall 6)
supabase/migrations/2026XXXXXXXXXX_add_items_updated_at_trigger.sql  # NEW
src/db/database.types.ts     # REGEN via npm run db:types
```

### Pattern 1: Precondition update with 0-row conflict detection
**What:** The write carries the version token as a second `.eq()`; conflict = empty returned rows.
**When to use:** Every `items` UPDATE that can race (user edit, AI merge, queue flush).
```typescript
// Source: PostgREST/supabase-js v2 verified return-shape (data:[] on 0-row match, error:null)
// — GitHub supabase/postgrest-js#202; Supabase troubleshooting "empty data array"
const { data, error } = await supabase
  .from("items")
  .update(patch)
  .eq("id", id)
  .eq("updated_at", prevUpdatedAt)   // optimistic precondition
  .select();                          // REQUIRED — without it, data is null and conflict is undetectable

if (error) throw error;              // genuine failure (network/permanent) → existing handling
if (!data || data.length === 0) {    // CONFLICT (precondition miss) OR RLS-deny OR row-deleted
  return { conflict: true };
}
return { conflict: false, row: data[0] };  // data[0].updated_at is the FRESH token for next attempt
```

### Pattern 2: Bounded reconcile loop (D-07, shared by user-edit and AI-merge)
**What:** Re-read → re-apply intent → write with fresh precondition, capped at 3.
```typescript
// D-07: 3-attempt bound prevents livelock under sustained contention.
async function preconditionUpdate(id, buildPatch, prevAt, opts) {
  let prev = prevAt;
  for (let attempt = 0; attempt < 3; attempt++) {
    const patch = buildPatch(/* current row on retries */);
    if (Object.keys(patch).length === 0) return { applied: false, skipped: true }; // D-06 all-skipped
    const r = await preconditionWrite(id, patch, prev);
    if (!r.conflict) return { applied: true, row: r.row };
    const fresh = await reReadItem(id);
    if (!fresh) return { applied: false, deleted: true };   // row gone — distinct from conflict
    prev = fresh.updated_at;                                 // refresh token for next loop
    // caller's buildPatch re-derives intent from `fresh` (user: re-apply value; AI: D-06 compare-skip)
  }
  return { applied: false, exhausted: true };                // → notifyError(msg, retry)
}
```

### Pattern 3: AI-merge per-field compare-and-skip (D-06)
**What:** Snapshot field values at merge start; on conflict, skip any field the user changed since.
```typescript
// mergeFieldsIntoItem records valueAtRead per field BEFORE the write loop (no extra Gemini call).
// On re-read, for each field the merge wants to write:
//   currentDbValue !== valueAtRead  → user touched it → SKIP (AI yields to user, D-06/D-08)
//   currentDbValue === valueAtRead  → safe → include in patch, re-apply
// The Phase 35 userEditedFields provenance set is a SECOND, complementary guard for the
// RETRY path — keep both; they cover different write paths.
```

### Anti-Patterns to Avoid
- **Treating 0-row as an error/throw:** supabase-js returns `error: null` on a precondition miss. A `try/catch` will never see it. You MUST inspect `data.length`. (This is the #1 way to silently reintroduce last-writer-wins.)
- **Omitting `.select()`:** Without it, `data` is `null` and you cannot distinguish "0 matched" from "N matched." Always `.select()` on precondition writes.
- **Reusing the stale `prev` across retry attempts:** After a conflict you MUST re-read and use the *fresh* `updated_at` as the next precondition, or every retry conflicts identically and you burn all 3 attempts for nothing.
- **Unbounded retry:** Without the 3-cap, sustained contention (or a logic bug that never converges) livelocks. D-07 bound is mandatory.
- **Conflating conflict with RLS-deny or row-deleted:** all three yield empty `data`. Re-read disambiguates: a re-read returning a row = real conflict (reconcile); re-read returning nothing = deleted/denied (don't loop, surface or drop).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Version-token bump | App-side `updated_at: new Date()` in every patch | `BEFORE UPDATE` trigger (`set_updated_at()`) | A client-supplied timestamp can be skipped, clock-skewed, or forgotten on one write path → silent gap. Trigger is atomic + universal. |
| Conflict surface UI | New modal/banner | `notificationStore.notifyError(msg, retry)` + `ErrorToast` (DAT-4) | Already wired with a Retry affordance; D-07 mandates it |
| AI no-clobber (retry path) | New provenance tracking | Existing `db.userEditedFields` (Phase 35) | Already records user-edited fields + clears on fresh recording |
| Offline replay ordering | Custom queue | Existing `writeAheadQueue` FIFO drain | Already handles FIFO, head-of-line, permanent-drop (WR-05/06, D-09) |
| Network-vs-permanent error classification | New branching | `classifyAiError` + `isNetworkError` (existing) | Already distinguishes transient/permanent in the queue and store |

**Key insight:** Phase 39 is almost entirely *composition of existing primitives* plus one migration and one shared helper. The risk is not missing libraries — it's getting the 0-row semantics and the retry-token refresh exactly right.

## Runtime State Inventory

> Rename/migration-adjacent: this phase adds a column + backfills + changes write payloads. Inventory of runtime state that a code change alone won't cover:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `items` rows in shared Supabase have NO `updated_at` yet. Dexie `writeAheadQueue` entries in-flight at deploy carry payloads with NO `updated_at` snapshot. | Migration backfills `updated_at = coalesce(created_at, now())` (D-03). Flush code must tolerate a missing `updated_at` on legacy queued entries (fall back to unconditional `.eq("id")` write OR re-read-then-precondition) — see Pitfall 6. |
| Live service config | None — no external service stores this token. | None — verified: only Supabase + Dexie touch `items`. |
| OS-registered state | None. | None — verified: no scheduler/cron references `items.updated_at` (the audio purge keys on `completed_at`, not `updated_at`). |
| Secrets/env vars | None. `CONTINUOUS_MODE_ENABLED` is a code constant, not env. | None. |
| Build artifacts | `src/db/database.types.ts` is generated and will be stale after the migration. | Regenerate via `npm run db:types` (D-03); commit. Dashboard + extension also read the shared schema — cross-app type regen is THEIR concern, but record the migration in `../_workspace/Schema/migrations.md`. |

**Cross-app note:** `items` is read by both cataloger and dashboard (schema.md line 52). Adding a non-null-with-default column is backward-compatible for readers (they ignore the new column). No coordination blocker, but the migration MUST be recorded in the cross-app migration log.

## Common Pitfalls

### Pitfall 1: 0-row precondition miss is NOT an error
**What goes wrong:** Code wraps the precondition write in `try/catch` expecting a conflict to throw; it never does, so the conflict is invisible and last-writer-wins silently returns.
**Why it happens:** supabase-js/PostgREST treats "update matched no rows" as a successful no-op: `data: []`, `error: null`. [VERIFIED: GitHub supabase/postgrest-js#202; Supabase troubleshooting docs "empty data array"]
**How to avoid:** Always `.select()` and branch on `data.length === 0`. Never rely on `error` for conflict detection.
**Warning signs:** A "conflict test" that mocks an *error* return instead of an empty-`data` return — it'll pass while the real path is broken.

### Pitfall 2: Trigger/precondition ordering misunderstanding (it's actually fine)
**What goes wrong:** Fear that the `BEFORE UPDATE` trigger bumping `updated_at = now()` races or invalidates the `.eq("updated_at", prev)` check.
**Why it doesn't:** Postgres evaluates the `WHERE` (including `updated_at = prev`) to select matching rows **first**; the `BEFORE UPDATE` trigger fires **only on already-matched rows**, against the OLD value. The comparison uses the pre-trigger value; the bump applies after the match. [VERIFIED: PostgreSQL trigger semantics — postgresql.org/docs/current/explicit-locking.html + EnterpriseDB read-modify-write guide] The optimistic check is sound.
**How to avoid:** Nothing to do — just don't add app-side `updated_at` to the patch (that would fight the trigger). Let the trigger own the bump.

### Pitfall 3: Same-microsecond collision (D-02 risk quantification)
**What goes wrong:** Two writes to the same row resolve `now()` to the identical timestamptz; a stale second write's precondition spuriously *matches* and clobbers.
**Why it's rare-but-nonzero:** Postgres `now()` / `CURRENT_TIMESTAMP` returns the **transaction start time** and is **constant within a transaction** — so two statements in one txn share a timestamp, but two *separate* UPDATE transactions to the same row are serialized by row-level write locks: the second waits for the first to commit, so its `now()` is a later transaction-start. timestamptz resolves to **microseconds (6 digits)**. For a same-row collision you'd need two transactions to *start* within the same microsecond AND serialize such that the loser's read-snapshot predates the winner's commit — vanishingly unlikely for this app's single-digit concurrent writers per item. `clock_timestamp()` (wall clock, advances within a txn) is NOT what the trigger uses and isn't relevant here.
**Verdict:** D-02's "accept the rare collision" is reasonable for this workload [ASSUMED — based on Postgres `now()` semantics + this app's low per-row write concurrency; not load-tested]. xmin remains the clean fallback if it ever bites.
**Warning signs:** Would manifest as an occasional lost edit with no toast. If reported in practice, escalate to xmin (deferred idea), not integer version.

### Pitfall 4: Stale `prev` reused across retries → guaranteed re-conflict
**What goes wrong:** The reconcile loop keeps passing the original `prev` after a conflict, so all 3 attempts miss identically and exhaust into a toast even though no real contention persists.
**How to avoid:** After every 0-row result, re-read the row and set `prev = fresh.updated_at` before the next attempt (Pattern 2).
**Warning signs:** Exhaustion toasts firing under light load; tests that don't update the mock's `updated_at` between attempts.

### Pitfall 5: Offline snapshot staleness (D-04)
**What goes wrong:** A queued offline edit captured `updated_at` hours ago; on reconnect the row changed server-side, so the precondition 0-rows. If the flush treated 0-row as success+delete, the offline edit silently vanishes.
**How to avoid:** Route the flush's 0-row through the SAME reconcile path (D-04): re-read, re-apply the user's field value (intent-preserving), retry with fresh precondition. Do NOT delete the queue entry on a 0-row until the reconcile resolves.
**Warning signs:** Offline edits disappearing after reconnect with no toast.

### Pitfall 6: Legacy queue entries with no `updated_at` snapshot
**What goes wrong:** `writeAheadQueue` entries enqueued before this deploy have payloads with no `updated_at`. Applying `.eq("updated_at", undefined)` would 0-row everything.
**Why it's low-friction:** `WriteAheadEntry.payload` is `Record<string, unknown>` (src/db/types.ts:109) — **no Dexie schema migration needed** to add `updated_at`; it's just a new payload key. But the flush MUST detect its absence.
**How to avoid:** On flush, if the entry's payload has no `updated_at`, fall back to a re-read-then-precondition (fetch current `updated_at`, then apply precondition) OR an unconditional `.eq("id")` write for legacy entries only. Plan must specify which. (Recommend: re-read-then-precondition so even legacy entries get no-clobber, not a last-writer-wins fallback.)
**Warning signs:** All pending offline writes failing immediately after deploy.

### Pitfall 7: Testing the wrong (live UI) path
**What goes wrong:** The test wires the continuous recorder UI to drive the race, but `CONTINUOUS_MODE_ENABLED = false` (D-050) means that entry point is dead — the test either can't trigger the merge or tests nothing meaningful.
**How to avoid:** Call `mergeFieldsIntoItem` / `processContinuousChunk` directly in the test, mocking the Supabase chain to return `data: []` on the AI write while the user's field differs. Assert the user's field survives (D-06 skip). Label UAT "continuous-merge path (dormant — D-050)."

## Code Examples

### Mock shape for the conflict test (extends the existing harness pattern)
The repo's `update-item-field-notify.test.ts` already mocks `supabase.from` → `{ update, eq }` with `chain.eq.mockResolvedValue({ error })`. For Phase 39 the chain gains a second `.eq()` and a `.select()`, and the resolved value carries `data`:
```typescript
// Source: extends src/tests/update-item-field-notify.test.ts pattern (vi.hoisted mockFrom)
function setupPreconditionChain(result: { data: unknown[]; error: unknown }) {
  const chain = { update: vi.fn(), eq: vi.fn(), select: vi.fn() };
  chain.update.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);          // .eq("id").eq("updated_at") both chain
  chain.select.mockResolvedValue(result);    // { data: [], error: null } = CONFLICT
  mockFrom.mockReturnValue(chain);
  return chain;
}
// Conflict case:  setupPreconditionChain({ data: [], error: null });
// Success case:   setupPreconditionChain({ data: [makeItem({ updated_at: "…fresh…" })], error: null });
```

### Migration (mirror crm_threads — D-01/D-03)
```sql
-- Source: mirrors supabase/migrations/20260520120000 crm_threads_updated_at trigger
-- + reuses public.set_updated_at() from 20260421000000
alter table public.items
  add column updated_at timestamptz not null default now();

update public.items set updated_at = coalesce(created_at, now());  -- D-03 backfill

create trigger items_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Last-writer-wins on `items` UPDATE (`.update().eq("id")`) | Precondition write `.eq("updated_at", prev).select()` + reconcile | This phase | Silent write loss eliminated for user-vs-AI races |
| Phase 35: retry-scoped no-clobber via `userEditedFields` flag set | Phase 39 generalizes to ALL concurrent writers via DB version token | This phase | 35 guarded the AI *retry* write path only; 39 covers continuous-merge + offline-flush + cross-tab silent loss. **Both coexist** — 35's flag is still the retry guard; 39's precondition is the general gate. |

**Deprecated/outdated:**
- schema.md line 356 claims the `updated_at` trigger is "set on `sessions`." **No migration attaches it.** Fix opportunistically while editing schema.md for `items`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | D-02's "accept rare µs-collision" is safe for this app's write concurrency | Pitfall 3 | If two writers per item ever burst concurrently within 1µs, a lost edit slips through with no toast → escalate to xmin (already a deferred fallback). Low probability for a small team. |
| A2 | Recommending re-read-then-precondition for legacy queue entries (vs unconditional write) | Pitfall 6 | If chosen wrong, either legacy offline edits fail (too strict) or clobber (too loose). Planner picks; flag for discuss-phase if uncertain. |

## Open Questions

1. **Phase 33 sequencing (O-1 — needs reconcile before planning).**
   - What we know: CONTEXT.md D-05 says Phase 33 is "not yet built." But `../_workspace/Schema/schema.md` (lines 77-78) records `claimed_at` and `ai_attempts` as **already added by "cataloger v1.3 Phase 33"** on 2026-06-01, and `database.types.ts` already has both columns. The DB-atomic claim pattern (`update … where ai_status='queued' .select()`) Phase 33 reportedly shipped is the SAME precondition idiom Phase 39 generalizes.
   - What's unclear: Did Phase 33 partially land (schema only)? Is the offline-queue rework (D-05's concern) done or pending? This determines whether D-05's "coordinate so the precondition isn't bypassed" is a live integration task or a no-op.
   - Recommendation: Before planning, grep the queue drain for any Phase-33 claim/backoff logic and reconcile the docs. If Phase 33's claim path already does precondition writes on `items`, reuse its helper rather than authoring a parallel one (avoid two divergent precondition implementations).

2. **Where to thread `value-at-read` through `mergeFieldsIntoItem` (Claude's discretion per CONTEXT).**
   - What we know: `mergeFieldsIntoItem` (geminiContinuous.ts:214) builds an `updates` array then loops `updateItemField`. The per-field values it wants to write are known at loop entry; the value-at-read must be captured from the item state the merge read at chunk-processing start.
   - Recommendation: capture the pre-merge item snapshot in `processContinuousChunk` (which already has the item) and pass it into `mergeFieldsIntoItem`, rather than re-reading inside the loop. No extra Gemini call (honors D-06).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@supabase/supabase-js` | precondition writes | ✓ | 2.99.2 | — |
| `supabase` CLI (`npx supabase gen types`) | D-03 type regen | ✓ (via npx, project-id wired in `db:types` script) | — | manual edit of database.types.ts (discouraged) |
| Supabase project (shared) | migration apply | ✓ (project-id `wgrknodfxdjtddsirldw`) | — | — |
| `vitest` | race test | ✓ | 4.0.18 | — |

**Missing dependencies with no fallback:** none.
**Note:** The migration is **Claude-owned; Codex barred from `supabase/` + schema (D-046)**. Type regen, migration SQL, and schema.md edits must NOT be delegated to Codex.

## Validation Architecture

> nyquist_validation assumed enabled (no `workflow.nyquist_validation: false` found). HIGH-RISK phase — strong coverage required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | (vitest config in `vite.config`/`vitest.config`; `setup.ts` at `src/tests/setup.ts`) |
| Quick run command | `npx vitest --run src/tests/<file>.test.ts` |
| Full suite command | `npm test` (`vitest --run`) |

### Phase Requirements → Test Map
| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| 0-row precondition miss detected (data:[], not error) | unit | `npx vitest --run src/tests/optimistic-update.test.ts` | ❌ Wave 0 |
| User edit re-applies on conflict (intent-preserving, ≤3) | unit | same | ❌ Wave 0 |
| Reconcile loop refreshes prev token between attempts | unit | same | ❌ Wave 0 |
| Exhaustion (3×) surfaces notifyError w/ Retry | unit | same (mock notificationStore as in update-item-field-notify) | ❌ Wave 0 |
| **AI continuous-merge skips user-changed field (D-06) — HEADLINE** | unit | `npx vitest --run src/tests/continuous-merge-no-clobber.test.ts` (drive `mergeFieldsIntoItem` directly; continuous UI dormant) | ❌ Wave 0 |
| Offline flush 0-row routes through reconcile, edit survives | unit | `npx vitest --run src/tests/write-ahead-precondition.test.ts` (extend existing write-ahead-queue.test.ts) | ⚠️ extend existing |
| Legacy queue entry (no updated_at) handled | unit | same | ❌ Wave 0 |
| Migration adds column + trigger + backfill | manual/DB | apply migration to a branch DB; assert `updated_at` bumps on UPDATE | manual (Claude-owned, D-046) |
| Types regenerated include `updated_at` | unit | extend `src/tests/supabase-types.test.ts` | ⚠️ extend existing |

### Sampling Rate
- **Per task commit:** `npx vitest --run src/tests/optimistic-update.test.ts` (+ the specific file touched)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green + manual migration-on-branch verification before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/tests/optimistic-update.test.ts` — shared `preconditionUpdate` helper: 0-row detect, re-read, re-apply, 3-cap, exhaustion toast
- [ ] `src/tests/continuous-merge-no-clobber.test.ts` — D-06 compare-and-skip; HEADLINE race (drive `mergeFieldsIntoItem` directly, not via dormant UI)
- [ ] Extend `src/tests/write-ahead-queue.test.ts` — snapshot capture at enqueue + precondition on flush + legacy-entry fallback
- [ ] Extend `src/tests/supabase-types.test.ts` — assert `items.Row.updated_at: string`
- [ ] Reuse existing mock idioms: `vi.hoisted` mockFrom (update-item-field-notify.test.ts), `createMockFrom` (gemini-no-clobber.test.ts) — chain now needs second `.eq()` + `.select()` returning `{data, error}`

## Security Domain

> `security_enforcement` assumed enabled (absent = enabled).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | unchanged; existing Supabase JWT (D-002 auth-of-record) |
| V3 Session Management | no | unchanged |
| V4 Access Control | yes | **RLS on `items` already enabled** (`alter table public.items enable row level security`). The migration must NOT disturb RLS. Note: an RLS-denied UPDATE *also* returns empty `data` — same shape as a precondition miss. The reconcile re-read disambiguates (a denied re-read also returns nothing → don't loop). |
| V5 Input Validation | partial | catalog fields already Zod-validated upstream; `updated_at` precondition is a string from a trusted prior read, not user input |
| V6 Cryptography | no | none |

### Known Threat Patterns for Supabase/Postgres optimistic-lock
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Lost update (the whole point of this phase) | Tampering | DB version token + precondition write + reconcile |
| RLS-deny masquerading as conflict → infinite reconcile | Denial of Service | 3-attempt cap (D-07); re-read-returns-nothing ends the loop, surfaces/drops rather than spinning |
| Client forging a fake `updated_at` to clobber | Tampering | Low risk — token comes from the client's own prior read; even a forged value either matches (legitimate) or 0-rows (safe). RLS still gates row access. |

## Sources

### Primary (HIGH confidence)
- `package.json` + `node` resolve — @supabase/supabase-js 2.99.2, vitest 4.0.18 [VERIFIED]
- In-repo: `supabase/migrations/20260421000000` (set_updated_at fn), `…20260520120000` (crm_threads trigger template), `…20260318000002` (items DDL) [VERIFIED via Read]
- In-repo: `sessionStore.ts:411-490`, `geminiContinuous.ts:214-257`, `useWriteAheadQueue.ts`, `gemini.ts:355-417` (Phase 35 no-clobber), `db/types.ts`, `db/items.ts`, `notificationStore.ts`, `update-item-field-notify.test.ts`, `gemini-no-clobber.test.ts` [VERIFIED via Read]
- PostgreSQL docs — trigger/WHERE ordering: postgresql.org/docs/current/explicit-locking.html [CITED]
- `CONTINUOUS_MODE_ENABLED = false` at SessionDetail.tsx:35 [VERIFIED via grep]

### Secondary (MEDIUM confidence)
- supabase-js 0-row update returns `data: []`, `error: null` — GitHub supabase/postgrest-js#202 + Supabase troubleshooting "empty data array" docs [VERIFIED across two sources]
- EnterpriseDB "PostgreSQL Anti-patterns: Read-Modify-Write Cycles" — optimistic-lock WHERE pattern [CITED]

### Tertiary (LOW confidence — flagged)
- µs-collision practical risk (Pitfall 3 / A1) — reasoned from Postgres `now()` = txn-start semantics + low app concurrency; not load-tested [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; all assets verified in-repo
- Architecture (precondition + reconcile): HIGH — return-shape and trigger-ordering both verified against authoritative sources + in-repo template
- Pitfalls: HIGH on mechanics (1,2,4,5,6,7); LOW on µs-collision empirics (3, flagged A1)
- Phase 33 relationship: MEDIUM — doc inconsistency surfaced (O-1), needs reconcile before planning

**Research date:** 2026-06-02
**Valid until:** 2026-07-02 (stable domain; supabase-js minor bumps unlikely to change 0-row semantics)
