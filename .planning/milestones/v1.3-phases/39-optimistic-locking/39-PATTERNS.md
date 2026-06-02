# Phase 39: optimistic-locking - Pattern Map

**Mapped:** 2026-06-02
**Files analyzed:** 8 (3 new, 5 modified) + 4 test files
**Analogs found:** 8 / 8 (every new/modified file has an in-repo analog — this phase is composition, not greenfield)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/db/optimisticUpdate.ts` (NEW) | utility / service | CRUD (precondition-write + reconcile) | `src/services/offlineQueue.ts:119-132` (Phase 33 DB-atomic claim CAS) | exact (same `.eq().eq().select()` 0-row idiom) |
| `supabase/migrations/2026XXXX_add_items_updated_at_trigger.sql` (NEW) | migration | DDL/transform | `supabase/migrations/20260520120000` `crm_threads_updated_at` trigger | exact (only proven `set_updated_at()` attachment) |
| `src/stores/sessionStore.ts` (MODIFY :411-490) | store | request-response (user edit → DB write) | self (current last-writer-wins write at :428-431) | self-modify |
| `src/services/geminiContinuous.ts` (MODIFY :214-257) | service | event-driven (AI chunk → per-field merge) | self (`mergeFieldsIntoItem` loop) + `src/db/items.ts:8-17` CATALOG_FIELDS | self-modify + role-match |
| `src/hooks/useWriteAheadQueue.ts` (MODIFY :87-96) | hook / service | event-driven (FIFO offline flush) | self (update branch :87-96) | self-modify |
| `src/db/types.ts` (MODIFY :105-112) | model / type | — | self (`WriteAheadEntry.payload` is `Record<string,unknown>`) | self-modify (no Dexie bump) |
| `src/db/database.types.ts` (REGEN) | model / type (generated) | — | self (`items.Row` :339-363, currently no `updated_at`) | regen via `npm run db:types` |
| `../_workspace/Schema/schema.md` (MODIFY) | doc / schema-SSoT | — | self (cross-app schema event per D-03) | doc edit |

**Test files** (Wave-0 RED per RESEARCH Validation Architecture):

| Test File | New/Extend | Mock Idiom Analog |
|-----------|-----------|-------------------|
| `src/tests/optimistic-update.test.ts` (NEW) | new | `vi.hoisted` mockFrom — `update-item-field-notify.test.ts:4-25,58-68` |
| `src/tests/continuous-merge-no-clobber.test.ts` (NEW, HEADLINE) | new | `createMockFrom`/hoisted chain — `gemini-no-clobber.test.ts:10-32` |
| `src/tests/write-ahead-queue.test.ts` (EXTEND) | extend | existing |
| `src/tests/supabase-types.test.ts` (EXTEND) | extend | type-level assertion at :1-20 |

## Pattern Assignments

### `src/db/optimisticUpdate.ts` (NEW — utility, precondition-write + reconcile)

**Analog:** `src/services/offlineQueue.ts:119-132` — THE key reusable pattern. Phase 33's claim CAS already does the exact `.update().eq().eq().select()` → 0-row family this phase generalizes. Copy its structure and its WHY comment.

**Core 0-row conflict idiom to copy** (`offlineQueue.ts:119-132`):
```typescript
// REL-2 / D-01: DB-atomic claim. The conditional update only mutates the row
// if it is still 'queued', so across tabs/processes/devices exactly one drain
// can flip a given item to 'processing' and proceed [...].
// WHY .select("id"): PostgREST .update().eq() returns data:null WITHOUT an
// explicit .select(), so winner-detection would silently no-op (RESEARCH
// Pitfall 1). The .select("id") is what makes the row-returned check real.
const { data: claimed } = await supabase
  .from("items")
  .update({ ai_status: "processing", claimed_at: new Date().toISOString() })
  .eq("id", item.id)
  .eq("ai_status", "queued")        // ← the precondition. Phase 39 swaps this for .eq("updated_at", prev)
  .select("id");
if (!claimed || claimed.length === 0) return; // another tab won the claim
```

**Phase 39 adaptation** (the second `.eq` becomes the version token; `.select()` returns the fresh row):
```typescript
const { data, error } = await supabase
  .from("items")
  .update(patch)
  .eq("id", id)
  .eq("updated_at", prevUpdatedAt)   // optimistic precondition (was ai_status='queued' in P33)
  .select();                          // REQUIRED — without it data is null, conflict undetectable
if (error) throw error;              // genuine failure → existing handling (do NOT swallow)
if (!data || data.length === 0) return { conflict: true };   // 0-row = conflict / RLS-deny / deleted
return { conflict: false, row: data[0] };  // data[0].updated_at is the FRESH token for next attempt
```

**Bounded reconcile loop** (D-07, 3 attempts; new code — no exact analog, but error-classification reuse below):
- Loop ≤3: build patch → precondition-write → on conflict re-read row → `prev = fresh.updated_at` → rebuild patch.
- Distinguish re-read-returns-nothing (deleted/RLS-deny → stop, don't loop) from re-read-returns-row (real conflict → retry).
- Refresh `prev` between attempts (RESEARCH Pitfall 4 — stale `prev` re-conflicts identically and burns all 3).

**Error classification reuse** (don't hand-roll; from `offlineQueue.ts:5,153` and `useWriteAheadQueue.ts:5`):
```typescript
import { classifyAiError } from "../utils/aiErrorClass";  // permanent vs transient
// isNetworkError is used at the store call site (sessionStore.ts:436) to route to the offline queue
```

---

### `supabase/migrations/2026XXXX_add_items_updated_at_trigger.sql` (NEW — migration, DDL)

**Analog:** `supabase/migrations/20260520120000_create_crm_v05_tables.sql:50-52` (the ONLY proven `set_updated_at()` attachment in the cataloger — schema.md's claim that it's on `sessions` is stale; no migration attaches it there. Fix opportunistically per RESEARCH State-of-the-Art.)

**Trigger template to mirror** (`20260520120000:50-52`):
```sql
create trigger crm_threads_updated_at
  before update on public.crm_threads
  for each row execute function public.set_updated_at();
```

**Reused function — do NOT redefine** (`20260421000000_create_updated_at_trigger.sql:3-11`, attach only):
```sql
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

**Phase 39 migration** (column + D-03 backfill + trigger; mirrors crm_threads):
```sql
alter table public.items
  add column updated_at timestamptz not null default now();

update public.items set updated_at = coalesce(created_at, now());  -- D-03 backfill

create trigger items_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();
```
- Do NOT add `app-side updated_at` to any patch — the trigger owns the bump (RESEARCH Pitfall 2; "Don't Hand-Roll").
- Do NOT disturb RLS on `items` (already `enable row level security`; RESEARCH Security V4).
- **Claude-owned, Codex barred** from `supabase/` + schema (D-046).

---

### `src/stores/sessionStore.ts` (MODIFY :411-490 — store, user edit → DB write)

**Analog:** self. Current last-writer-wins write is the exact code to replace.

**Current write to wrap** (`sessionStore.ts:427-433`):
```typescript
const { error } = await supabase
  .from("items")
  .update({ [field]: value })
  .eq("id", itemId);             // ← no precondition = last-writer-wins. Route through optimisticUpdate.
if (error) throw error;
scheduleFieldEditEvent(itemId, sessionId, field);
```
- Snapshot `prev = originalItem.updated_at` (read off the local item already fetched at :414).
- Reconcile policy for a user edit (D-07/D-08): re-apply the field value (last human intent wins). Silent on success. On 3× exhaustion → `notifyError` with Retry.

**Offline enqueue to extend** (`sessionStore.ts:436-443`) — add `updated_at` snapshot to payload (D-04):
```typescript
if (isNetworkError(err)) {
  await enqueueWrite({
    table: "items",
    operation: "update",
    payload: { id: itemId, [field]: value },   // ← add updated_at: originalItem.updated_at (D-04)
  });
  scheduleFieldEditEvent(itemId, sessionId, field);
  return;
}
```

**Conflict surface already present** (`sessionStore.ts:468-487`) — reuse this exact `notifyError(msg, retry)` shape for exhaustion; the existing Retry callback already guards against clobbering a newer edit (re-checks the field still equals the reverted value before retrying).

---

### `src/services/geminiContinuous.ts` (MODIFY :214-257 — service, AI per-field merge, DORMANT)

**Analog:** self (`mergeFieldsIntoItem` loop) + `src/db/items.ts:8-17` (CATALOG_FIELDS allowlist — the complementary Phase 35 guard).

**Current per-field merge loop** (`geminiContinuous.ts:251-254`) — where D-06 compare-and-skip threads in:
```typescript
const sessionStore = useSessionStore.getState();
for (const [field, value] of updates) {
  await sessionStore.updateItemField(itemId, sessionId, field, value);   // ← add value-at-read compare
}
```

**D-06 compare-and-skip pattern** (new logic — no extra Gemini call):
- Capture pre-merge item snapshot in `processContinuousChunk` (already holds the item) and pass into `mergeFieldsIntoItem` (RESEARCH Open Question 2 — don't re-read inside the loop).
- On a write conflict, re-read row; per field the merge wants to write: `currentDbValue !== valueAtRead` → user touched it → SKIP; else re-apply with fresh `updated_at`.
- If all fields skip, the patch is empty → no-op (do not write).

**Complementary guard — keep both** (`db/items.ts:39-45`): Phase 35 `userEditedFields` provenance gates the AI **retry** path; Phase 39 compare-and-skip gates the **continuous-merge** path. They cover different write paths — do not collapse them. Note `mergeFieldsIntoItem` calls `sessionStore.updateItemField` **directly** (not the `db/items.ts` wrapper), so it bypasses the Phase 35 flag-write by design.

**HEADLINE test caveat:** `CONTINUOUS_MODE_ENABLED = false` (SessionDetail.tsx:35, D-050). The race test MUST drive `mergeFieldsIntoItem` directly, not the gated continuous UI. Label UAT "continuous-merge path (dormant — D-050)."

---

### `src/hooks/useWriteAheadQueue.ts` (MODIFY :87-96 — hook, FIFO offline flush)

**Analog:** self (the `update` branch).

**Current flush update branch** (`useWriteAheadQueue.ts:87-96`) — apply precondition + route 0-row through reconcile (D-04):
```typescript
} else if (entry.operation === "update") {
  const { id, ...rest } = entry.payload as { id: string; [key: string]: unknown };
  const { error } = await supabase
    .from(entry.table)
    .update(rest)
    .eq("id", id);              // ← add .eq("updated_at", snapshot).select(); 0-row → reconcile path
  if (error) throw error;
}
```
- Pull `updated_at` snapshot out of `rest` (it is a payload key, not a column to write — exclude it from the patch).
- **Legacy-entry fallback** (RESEARCH Pitfall 6): entries enqueued before this deploy have no `updated_at` in payload. If absent → re-read current `updated_at` then apply precondition (recommended) rather than unconditional write. `WriteAheadEntry.payload` is `Record<string,unknown>` so NO Dexie schema bump is needed.
- Do NOT delete the queue entry on a 0-row until reconcile resolves (Pitfall 5 — silent loss otherwise).

**Error classification already wired** (`useWriteAheadQueue.ts:115-140`): `classifyAiError(toError(err))` permanent/transient branching — the reconcile composes inside the existing try/catch, conflict (0-row) is handled before the catch.

---

### `src/db/types.ts` (MODIFY :105-112 — type, no Dexie bump)

**Analog:** self. `WriteAheadEntry.payload: Record<string, unknown>` (`types.ts:109`) already accepts an extra key.

```typescript
export interface WriteAheadEntry {
  id?: number;
  table: "sessions" | "items" | "analytics_events" | "ui_interactions";
  operation: "insert" | "update" | "delete";
  payload: Record<string, unknown>;   // ← updated_at snapshot lives here; NO new field, NO Dexie version bump
  tempId?: string;
  createdAt: Date;
}
```
Optionally document the `updated_at` payload convention in a comment; no structural change required.

---

### `src/db/database.types.ts` (REGEN :339-363 — generated type)

**Analog:** self. `items.Row` (:340-363) currently has `created_at` but NO `updated_at`. After the migration, `npm run db:types` regenerates it. Expected new line: `updated_at: string` in Row, `updated_at?: string` in Insert/Update. Do NOT hand-edit — regenerate (D-03). Claude-owned (D-046).

---

## Shared Patterns

### 0-row conflict detection (the spine of this phase)
**Source:** `src/services/offlineQueue.ts:119-132` (Phase 33 claim CAS)
**Apply to:** `optimisticUpdate.ts`, `sessionStore.updateItemField`, `mergeFieldsIntoItem`, queue flush
```typescript
// .update(patch).eq("id", id).eq(<precondition>).select()  →  data===[] means conflict (error:null!)
if (!data || data.length === 0) { /* CONFLICT — reconcile, never treat as success */ }
```
Carry over the WHY comment about PostgREST returning `data:null` without `.select()`.

### Conflict surfacing
**Source:** `src/stores/notificationStore.ts:10-15` + `src/stores/sessionStore.ts:468-487` (existing DAT-4 surface) + `src/components/ErrorToast.tsx`
**Apply to:** exhaustion (3×) in both user-edit and AI-merge reconcile paths
```typescript
useNotificationStore.getState().notifyError(message, retry);  // retry?: () => void
```
No new UI. The existing Retry callback already re-checks the field hasn't changed before re-firing — reuse that guard pattern.

### Error classification (transient vs permanent vs conflict)
**Source:** `src/utils/aiErrorClass.ts` (`classifyAiError`), `isNetworkError`, `useWriteAheadQueue.ts:40-49` (`toError`)
**Apply to:** the reconcile loop's genuine-error branch and the offline-routing decision
- `error != null` → classify (existing). `data.length === 0` → conflict (new, not an error). Network → offline queue.

### Trigger / version-token bump (server-authoritative)
**Source:** `set_updated_at()` (`20260421000000`) attached via `crm_threads_updated_at` (`20260520120000:50-52`)
**Apply to:** the `items` migration only. Never bump `updated_at` app-side (RESEARCH "Don't Hand-Roll").

### Test mock chain (extend existing, add second `.eq()` + `.select()`)
**Source:** `vi.hoisted` mockFrom — `update-item-field-notify.test.ts:4-25,58-68`; chain idiom — `gemini-no-clobber.test.ts:10-32`
**Apply to:** all new/extended tests. The chain must now support `.eq().eq().select()` resolving `{ data, error }`:
```typescript
function setupPreconditionChain(result: { data: unknown[]; error: unknown }) {
  const chain = { update: vi.fn(), eq: vi.fn(), select: vi.fn() };
  chain.update.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);        // both .eq("id") and .eq("updated_at") chain
  chain.select.mockResolvedValue(result); // { data: [], error: null } = CONFLICT
  mockFrom.mockReturnValue(chain);
  return chain;
}
```
Warning (RESEARCH Pitfall 1): a "conflict test" that mocks an *error* return instead of empty `data` passes while the real path is broken. Conflict mocks MUST be `{ data: [], error: null }`.

## No Analog Found

None. Every file has an in-repo analog. The only genuinely new logic (bounded 3× reconcile loop) is a thin orchestration over the verified `offlineQueue.ts` 0-row idiom plus existing `classifyAiError`/`notifyError` primitives.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | — | — | Phase 39 is composition of existing primitives + one migration |

## Cross-Phase Flag (O-1, from RESEARCH)

Phase 33 (`offlineQueue.ts`) **already landed** `claimed_at`/`ai_attempts` and a precondition-write claim (`:126-132`) — contradicting CONTEXT.md D-05's "not yet built." Phase 39's `optimisticUpdate.ts` should **mirror** the offlineQueue claim idiom, not author a divergent second implementation. Planner: reconcile D-05 wording before sequencing. The two are compatible (different preconditions: `ai_status='queued'` vs `updated_at=prev`), not conflicting.

## Metadata

**Analog search scope:** `src/services/`, `src/stores/`, `src/hooks/`, `src/db/`, `src/tests/`, `supabase/migrations/`
**Files scanned:** 12 (all VERIFIED via Read this session)
**Pattern extraction date:** 2026-06-02
