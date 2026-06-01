# Phase 33: offline-reliability - Pattern Map

**Mapped:** 2026-06-01
**Files analyzed:** 14 (6 modify, 8 new — incl. migration, util, classifier, badge, 3 tests)
**Analogs found:** 14 / 14 (every primitive already exists in-repo — this is wiring, not invention)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/services/offlineQueue.ts` (MODIFY) | service | batch / event-driven | self (`gemini.ts` claim idiom) | exact (self) |
| `src/hooks/useWriteAheadQueue.ts` (MODIFY) | hook/service | batch / FIFO drain | self | exact (self) |
| `src/hooks/useAudioRecorder.ts` (MODIFY) | hook | event-driven / file-I/O | self | exact (self) |
| `src/layouts/AppLayout.tsx` (MODIFY) | layout/component | request-response (UI) | `OfflineIndicator` mount (self) | exact (self) |
| `src/stores/recordingStore.ts` (MODIFY) | store (zustand) | state | self | exact (self) |
| `supabase/migrations/<date>_add_items_claim_columns.sql` (NEW) | migration | DDL | `20260318000002_create_items.sql` + `20260529000000_lock_profiles_self_update.sql` | role-match |
| `src/utils/backoff.ts` (NEW) | utility (pure) | transform | `src/utils/formatEstimate.ts` (pure math util) | role-match |
| error classifier helper (NEW — `src/utils/aiErrorClass.ts` or inline) | utility (pure) | transform | `gemini.ts:146-151 isTransientNetworkError` | exact (seed) |
| blocked-badge component (NEW — `src/components/BlockedQueueBadge.tsx` or inline) | component | request-response (UI) | `src/ui/Badge.tsx` + `OfflineIndicator.tsx` | role-match |
| `src/tests/backoff.test.ts` (NEW) | test (pure) | — | `src/tests/formatEstimate.test.ts` | role-match |
| `src/tests/error-classify.test.ts` (NEW) | test (pure) | — | `src/tests/formatEstimate.test.ts` | role-match |
| blocked-badge test (NEW / extend `layout.test.tsx`) | test (component) | — | `src/tests/layout.test.tsx` | role-match |
| `src/tests/offline-queue.test.ts` (MODIFY) | test (service) | — | self | exact (self) |
| `src/tests/write-ahead-queue.test.ts` (MODIFY) | test (service) | — | self | exact (self) |
| `src/tests/audio-recorder.test.ts` (MODIFY) | test (hook) | — | self | exact (self) |
| `src/db/database.types.ts` (REGEN) | generated artifact | — | n/a — `npm run db:types`, never hand-edit | n/a |

---

## Pattern Assignments

### `supabase/migrations/<date>_add_items_claim_columns.sql` (migration, DDL)

**Analogs:** `supabase/migrations/20260318000002_create_items.sql` (items table + `ai_status` enum already has `queued`/`processing` — NO enum migration needed), and `20260529000000_lock_profiles_self_update.sql` (Phase 31 column-grant discipline + header-comment style).

**The two-column additive DDL (D-04 + D-05, one migration):**
```sql
-- REL-1 (D-05): server-side attempt counter, consistent cross-tab/device.
-- REL-2 (D-04): DB-atomic claim timestamp. claimed_by deliberately omitted (debug-only).
-- Additive, null/default columns: safe on live prod table, no row backfill (research A2).
alter table public.items
  add column if not exists claimed_at timestamptz,
  add column if not exists ai_attempts integer not null default 0;
```

**Column-grant discipline to ECHO from Phase 31** (`20260529000000_lock_profiles_self_update.sql:11-13,27-28`): do NOT add any broad `GRANT UPDATE`. New columns inherit `items` table RLS automatically. The migration is DDL-only — no GRANT statements. If the planner mirrors Phase 31's header-comment style, keep it to a short WHY block (see the multiline `--` header in that file). Verify no column-grant regression per research Security Domain.

**Existing enum confirmation** (`20260318000002_create_items.sql:13-14`): `ai_status ... check (ai_status in ('pending','processing','done','failed','queued'))` — `queued` and `processing` already present, so REL-2 rides the existing enum; no enum DDL.

**Migration ordering / drain invariant note:** none in SQL, but the push gate (Phase 31 precedent, research Pitfall 2) must be reproduced: `node_modules/.bin/supabase db push --dry-run` → confirm ONLY this migration pending → `--yes` apply. Per CLAUDE.md schema protocol: update `../_workspace/Schema/schema.md` items column list FIRST, record in `../_workspace/Schema/migrations.md`, then `npm run db:types`.

---

### `src/services/offlineQueue.ts` (service — REL-1 backoff + REL-2 claim)

**Analog:** self + the Supabase conditional-update idiom from `gemini.ts:180-183` / `:346-349`.

**Existing `.update().eq()` idiom to extend into a conditional claim** (`gemini.ts:180-183`):
```typescript
await supabase
  .from("items")
  .update({ ai_status: "processing" })
  .eq("id", itemId);
```
REL-2 (D-01) extends this with a second `.eq("ai_status","queued")` guard plus `.select("id")` so the winning tab is the only one that gets a row back:
```typescript
// CLAIM — only the tab whose update flips queued→processing gets a row.
// .select() is REQUIRED: PostgREST .update().eq() returns data:null without it (research Pitfall 1).
const { data: claimed } = await supabase
  .from("items")
  .update({ ai_status: "processing", claimed_at: new Date().toISOString() })
  .eq("id", item.id)
  .eq("ai_status", "queued")
  .select("id");
if (!claimed || claimed.length === 0) continue; // another tab won
```

**Extend the existing select** (`offlineQueue.ts:24`) — currently `.select("id, mode, session_id, created_at")`; add `claimed_at, ai_attempts` so the drain has backoff inputs without a second query (research A3).

**Replace the `MAX_RETRIES` immediate-retry loop** (`offlineQueue.ts:5-6, 67-83`) with: backoff-window skip (D-06) + attempt cap 5 → `ai_status='failed'` (D-07). Keep the existing offline short-circuits — `if (!navigator.onLine) return;` (`:68`) and `if (!navigator.onLine) break;` (`:98`) — they must survive (research Pitfall 4).

**Keep `draining` boolean** (`offlineQueue.ts:8, 91-92`) as a cheap per-tab short-circuit, but it is NOT the coordination mechanism — the DB claim is (anti-pattern note, research §Anti-Patterns).

**Stale-claim reclaim pass (D-02)** — a `.update().eq().lt()` before the drain:
```typescript
const staleCutoff = new Date(Date.now() - STALE_MS).toISOString(); // STALE_MS = 300_000 (5min)
await supabase.from("items")
  .update({ ai_status: "queued" })
  .eq("ai_status", "processing")
  .lt("claimed_at", staleCutoff);
```

**No-audio path already correct** (`offlineQueue.ts:58-64`) — marks `ai_status='failed'` directly; D-08 classifies this as permanent. Mirror that update shape.

---

### `src/utils/backoff.ts` (NEW — pure utility, transform)

**Analog:** `src/utils/formatEstimate.ts` — nearest pure, dependency-free transform util (pure function, null-tolerant, fully unit-tested). No imports, no side effects, exported named functions. Mirror that module shape.

**Reference: photo-queue backoff** (`photoUploadQueue.ts:134-135`) uses `Math.pow(4, n) * BACKOFF_BASE` + `setTimeout(drain)` — proven sibling pattern, but do NOT modify the photo queue (out of scope). The new util is full-jitter per D-06:
```typescript
const BACKOFF_BASE_MS = 5_000;
const BACKOFF_CAP_MS = 300_000;
const ATTEMPT_CAP = 5; // D-07

export function nextEligibleAt(claimedAt: Date | null, attempts: number): number {
  if (!claimedAt || attempts <= 0) return 0;
  const exp = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** attempts);
  return claimedAt.getTime() + Math.random() * exp; // full jitter [0, exp)
}
export function isInBackoff(claimedAt: Date | null, attempts: number): boolean {
  return Date.now() < nextEligibleAt(claimedAt, attempts);
}
```
(Constants are Claude's discretion; surface bounds in `backoff.test.ts`.)

---

### error classifier helper (NEW — `src/utils/aiErrorClass.ts` or inline)

**Analog (the seed to generalize):** `gemini.ts:146-151` `isTransientNetworkError`:
```typescript
function isTransientNetworkError(error: unknown): boolean {
  if (!navigator.onLine) return true;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && /abort|Load failed|Failed to fetch|NetworkError/i.test(error.message)) return true;
  return false;
}
```

**D-08 generalizes it to a `"permanent" | "transient"` taxonomy.** Proxy surfaces HTTP status ONLY as text in the thrown `Error.message` (`gemini.ts:285-286`: `` throw new Error(`Proxy returned HTTP ${response.status}: ...`) ``) — so the no-refactor implementation regex-parses the status (research Open Question 1 recommends regex this phase):
```typescript
export function classifyAiError(error: unknown): "permanent" | "transient" {
  if (!navigator.onLine) return "transient";
  if (error instanceof DOMException && error.name === "AbortError") return "transient";
  const msg = error instanceof Error ? error.message : String(error);
  if (/abort|Load failed|Failed to fetch|NetworkError/i.test(msg)) return "transient";
  const m = msg.match(/HTTP (\d{3})/);
  if (m) { const s = Number(m[1]); if (s === 429 || s >= 500) return "transient"; if (s >= 400) return "permanent"; }
  if (/Zod validation failed|unsupported format/i.test(msg)) return "permanent";
  return "transient"; // default: retry not drop
}
```
Zod failure string matches `gemini.ts:298` (`` `Zod validation failed: ...` ``). No-audio is detected upstream (item has no audio record), classified permanent by the caller, not this fn.

---

### `src/hooks/useWriteAheadQueue.ts` (hook/service — REL-3 classify + selective drop/continue)

**Analog:** self.

**Replace the unconditional `break`** (`useWriteAheadQueue.ts:57-67`) — current catch logs + `break`s on first failure:
```typescript
} catch (err) {
  console.error("Write-ahead queue processing failed for entry:", entry.id, err);
  // Do NOT emit analytics here: trackEvent re-enqueues into this same queue (grows on every drain).
  break; // Stop on first failure to maintain FIFO ordering
}
```
D-09 behavior: classify via `classifyAiError(err)`; **permanent →** drop the failing entry + its dependent same-item entries, then `continue`; **transient →** `break` (halt-and-backoff, preserve FIFO). The "do NOT emit analytics" comment MUST be preserved (research Anti-Pattern + Pitfall — `trackEvent` re-enqueue loop).

**Dependent-entry detection reuses the `payload.id` match idiom** already present at `hasPendingForItem` (`useWriteAheadQueue.ts:78-83`):
```typescript
const entries = await db.writeAheadQueue
  .filter((e) => (e.payload as Record<string, unknown>).id === itemId)
  .count();
```
Use the same `payload.id` (and `tempId`, per `WriteAheadEntry` shape) match to find dependent same-item entries to drop alongside a permanent insert failure (research Pitfall 5). `WriteAheadEntry` shape (`src/db/types.ts:91-98`): `{ id?, table, operation: insert|update|delete, payload: Record<string,unknown>, tempId?, createdAt }`.

**FIFO ordering** (`useWriteAheadQueue.ts:29`): `db.writeAheadQueue.orderBy("createdAt").toArray()` — unchanged; transient halt preserves it.

---

### `src/layouts/AppLayout.tsx` + blocked-badge component (component — REL-3 badge mount, D-10)

**Mount anchor:** `OfflineIndicator` at `AppLayout.tsx:81` (between `<InstallBanner />` and `<PhotoMigrationBanner />`). Mount the blocked-count badge adjacent to it.

**Drain-order INVARIANT — DO NOT change** (`AppLayout.tsx:58-63`): writeAhead → fetchSessions → photos → audio. Items must exist server-side before AI updates them (research Anti-Pattern).

**Badge component analog:** `src/ui/Badge.tsx` (LIB-02 primitive) — reuse with `tone="err"` per D-10:
```tsx
<Badge tone="err">{blockedCount}</Badge>
```
`OfflineIndicator.tsx` (returns `null` when nothing to show; `aria-live="polite"`, `role="status"`) is the structural analog for the new badge wrapper — render nothing when `blockedCount === 0`, otherwise a clickable badge → blocked-items detail list (detail-view structure is Claude's discretion). Blocked count = items with `ai_status='failed'` (+ optionally write-ahead permanent drops).

---

### `src/stores/recordingStore.ts` (store — REL-4 retry buffer + error state)

**Analog:** self. Existing zustand slice shape (`recordingStore.ts:23-47`): `create<RecordingState>()((set) => ({ ...fields, ...setters, reset }))`.

**Extend the interface + store** (mirror `setLastSaved` setter shape at `:31-32` and `reset` at `:39-46`):
```typescript
// add to RecordingState:
recorderError: string | null;
retryBuffer: { blob: Blob; itemId: string; durationMs: number } | null; // shape is Claude's discretion
setRecorderError: (msg: string | null) => void;
stashForRetry: (buf: { blob: Blob; itemId: string; durationMs: number } | null) => void;
```
New fields MUST also be cleared in `reset()` (`:39-46`) to match the existing reset contract.

---

### `src/hooks/useAudioRecorder.ts` (hook — REL-4 settle contract, D-12)

**Analog:** self.

**The bug to fix** (`useAudioRecorder.ts:202-204`) — catch only `console.error`s; `stopResolveRef` never fires → `stopRecording()` (`:244-291`) hangs forever:
```typescript
} catch (err) {
  console.error("Failed to save audio:", err);
}
```
**D-12 fix:** in the `onstop` catch, retry `db.audio.add` up to 2× (the add is at `:187-194`); on final failure ALWAYS settle — `stopResolveRef.current?.(undefined)`, null the ref, set recorder error state, stash the blob in `recordingStore`. Keep the signature `Promise<number | undefined>` (D-11; `:13, :244-245`).

**Widen the resolve ref type** (`useAudioRecorder.ts:39`): currently `useRef<((id: number) => void) | null>` — change to `((id: number | undefined) => void) | null` so `undefined` can settle the promise (research Pitfall 3). The success settle path to mirror is `:198-201`:
```typescript
if (stopResolveRef.current) {
  stopResolveRef.current(id as number);
  stopResolveRef.current = null;
}
```

---

### Tests (new + extended)

**Pure-util tests** (`backoff.test.ts`, `error-classify.test.ts`) — analog `src/tests/formatEstimate.test.ts`: `import { describe, it, expect } from "vitest"` + `import { fn } from "../utils/..."`, then a flat table of `it(...)` cases. No mocks. Assert backoff bounds (`isInBackoff` true/false around the window) and the D-08 taxonomy table (offline, AbortError, 4xx, 5xx, 429, Zod, default).

**Supabase-mock convention for service tests** (`offline-queue.test.ts:5-31, 87-105`) — `vi.hoisted()` to declare mock fns, `vi.mock("../lib/supabase", () => ({ supabase: { from: mockFrom } }))`, then `mockFrom.mockImplementation` returning a chainable `{ select: ...mockReturnValue({ eq: ...mockReturnValue({ order: ...mockResolvedValue({ data, error: null }) }) }), update: ...mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }`. For REL-2: extend the `update` chain to `.eq().eq().select()` returning `[{id}]` on first call and `[]` after, asserting `processAudioWithAi` called exactly once across 4 concurrent `drainQueue()`s. `processAudioWithAi` is mocked via `vi.mock("../services/gemini", ...)` (`:29-31`). `navigator.onLine` toggled via `Object.defineProperty` in `beforeEach`/`afterEach` (`:45-76`).

**Write-ahead test convention** (`write-ahead-queue.test.ts:1-40`) — same `vi.hoisted` + `vi.mock("../lib/supabase")`, plus `vi.mock("../stores/uiStore")`; teardown via `await db.delete(); await db.open();`. Add cases: permanent → drop+continue; transient → halt+FIFO-preserved.

**Recorder test convention** (`audio-recorder.test.ts:1-19, 57-117`) — `renderHook` + `act` + `flushPromises` (`setTimeout 50`); `db.audio.clear()` and `useRecordingStore.getState().reset()` in `beforeEach`; `cleanup()` in `afterEach`. For REL-4: make `db.audio.add` reject (mock/spy) and assert `stopRecording()` settles to `undefined` within timeout, recorder error set, blob present in `recordingStore`.

**Component/badge test** — extend `src/tests/layout.test.tsx` (existing component test) or new `blocked-badge.test.tsx`; assert `tone="err"` + count renders next to OfflineIndicator and click → detail.

**Types test** (`supabase-types.test.ts:1-40`) — type-level + runtime; extend the `items` Row/Insert/Update assertions to include `claimed_at` and `ai_attempts` after `npm run db:types`.

---

## Shared Patterns

### Supabase conditional update (claim / reclaim / status writes)
**Source:** `gemini.ts:180-183`, `:346-349`; mock seed `offline-queue.test.ts:87-105`
**Apply to:** `offlineQueue.ts` (REL-2 claim + stale reclaim), all status writes
**Key rule:** `.select()` REQUIRED for winner-detection — PostgREST returns `data:null` without it.
```typescript
const { data } = await supabase.from("items")
  .update({ ... }).eq("id", id).eq("ai_status", "queued").select("id");
```

### Error classification (transient vs permanent)
**Source:** `gemini.ts:146-151` (`isTransientNetworkError` seed)
**Apply to:** `offlineQueue.ts` (REL-1 cap decision), `useWriteAheadQueue.ts` (REL-3 drop/halt), classifier util + its test
**Rule:** default to `"transient"` (retry, don't drop); proxy HTTP status is only in `Error.message` text (regex-parse).

### Offline short-circuit
**Source:** `offlineQueue.ts:68, :98`
**Apply to:** any new drain/backoff loop — keep `if (!navigator.onLine) return/break;` AND treat offline as a transient classification. Two pause mechanisms must coexist (research Pitfall 4).

### Badge UI primitive
**Source:** `src/ui/Badge.tsx` (LIB-02); render-nothing pattern from `OfflineIndicator.tsx:6`
**Apply to:** blocked-count badge — `<Badge tone="err">` (D-10), return `null` when count is 0.

### Zustand store slice extension
**Source:** `recordingStore.ts:23-47`
**Apply to:** REL-4 retry buffer + error — add fields + setters mirroring `setLastSaved`/`reset`; clear new fields in `reset()`.

### Vitest Supabase-mock harness
**Source:** `offline-queue.test.ts:5-31, 87-105`; `write-ahead-queue.test.ts:1-24`
**Apply to:** all extended service tests — `vi.hoisted` mock fns + chainable `mockFrom.mockImplementation`.

### Dexie version bump (only if a new store is needed for REL-4)
**Source:** `db/index.ts:119-130` (latest = v9). Adding a store/index = new `db.version(10).stores({...})` block copying v9 + the new line, optional `.upgrade()`. **Likely NOT needed** — D-12 stashes the blob in `recordingStore` (in-memory), and `db.audio` already exists (`audio: "++id, itemId"`). Only bump if planner decides the retry buffer must persist to a Dexie store.

---

## No Analog Found

None. Every file has an in-repo analog. The two genuinely new modules (`backoff.ts`, classifier) are seeded by `formatEstimate.ts` (pure-util shape) and `isTransientNetworkError` (`gemini.ts:146-151`) respectively. `database.types.ts` is generated, not authored.

## Metadata

**Analog search scope:** `src/services/`, `src/hooks/`, `src/stores/`, `src/layouts/`, `src/components/`, `src/ui/`, `src/utils/`, `src/db/`, `src/tests/`, `supabase/migrations/`
**Files scanned:** offlineQueue.ts, useWriteAheadQueue.ts, useAudioRecorder.ts, AppLayout.tsx, recordingStore.ts, gemini.ts, Badge.tsx, OfflineIndicator.tsx, db/index.ts, db/types.ts, photoUploadQueue.ts, itemStatus.ts, formatEstimate.ts, 2 migrations, database.types.ts, 5 test files
**Pattern extraction date:** 2026-06-01
