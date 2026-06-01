# Phase 33: offline-reliability - Research

**Researched:** 2026-06-01
**Domain:** Offline/sync queue hardening — exponential backoff, DB-atomic cross-tab claim, error taxonomy, recorder lifecycle (React 19 + Supabase + Dexie + Zustand)
**Confidence:** HIGH (all findings are first-hand reads of the actual touchpoint files; no external library research needed — this is correctness work on existing code)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (REL-2):** DB-atomic claim is the single source of truth. Claim via conditional Supabase update — `update items set ai_status='processing', claimed_at=now() where id=? and ai_status='queued'` using `.select()`; only the row-returning tab proceeds. Chosen over BroadcastChannel leader-election.
- **D-02 (REL-2):** Stale-claim recovery — an item in `ai_status='processing'` with `claimed_at` older than ~5 min is reclaimable (treated as `queued`). Threshold ≈ 2× expected max processing time — tune in planning.
- **D-03 (REL-2):** No BroadcastChannel layer. DB claim alone makes duplicate Gemini calls structurally impossible.
- **D-04 (schema):** ADD `claimed_at timestamptz null` to `items`. Cross-app schema event. `claimed_by` deliberately NOT added.
- **D-05 (REL-1):** ADD `ai_attempts int not null default 0` to `items`. Server-side, not Dexie-local. Same migration as D-04 → one migration, two columns.
- **D-06 (REL-1):** Backoff window = `claimed_at + base·2^ai_attempts` with full jitter; base 5s, cap 5min. Drain skips items still inside backoff window.
- **D-07 (REL-1):** Attempt cap = 5. On exceed → mark `ai_status='failed'`. Replaces current `MAX_RETRIES=2`.
- **D-08 (REL-3):** Taxonomy — **permanent:** no-audio-for-item, 4xx validation/auth from Gemini, unsupported format. **transient:** offline, 5xx, 429, request timeout.
- **D-09 (REL-3):** Write-ahead — on **permanent** failure drop the failing entry + dependent same-item entries, continue; on **transient** halt-and-backoff (preserve FIFO). Replaces unconditional `break`.
- **D-10 (REL-3):** Blocked-count badge in AppLayout header next to `OfflineIndicator`; reuse `Badge` primitive (`tone="err"`); click → detail list.
- **D-11 (REL-4):** Keep `stopRecording(): Promise<number | undefined>` signature — rejecting rejected (caller blast radius).
- **D-12 (REL-4):** On `db.audio.add` reject: retry 2×, then ALWAYS settle — resolve `undefined`, set recorder error state, stash blob in `recordingStore` for manual re-save.

### Claude's Discretion
- Exact backoff constants (base/cap/jitter shape) + stale-claim threshold value — pick sensible defaults, surface in tests.
- Internal structure of blocked-items detail view (list vs expandable) and the retry-buffer shape inside `recordingStore`.
- Whether offline-queue drain and write-ahead drain share a common backoff/classification helper module (DRY) or stay separate.

### Deferred Ideas (OUT OF SCOPE)
- `claimed_by` per-instance identifier (debug-only).
- Photo-upload-queue applying the same backoff/classification hardening.
- Shared backoff/error-classification helper module extracted across both queues (allowed but not required this phase).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REL-1 | Backoff + persisted attempt cap on offline (audio→AI) queue drain; kill the retry storm | `offlineQueue.ts:5-6` constants, `:67-83` retry loop, `:90-105` drain loop. Backoff math §3. Migration §4 for `ai_attempts`. |
| REL-2 | Atomic `queued→processing` claim + cross-tab coordination via DB | Supabase update idiom in `gemini.ts:180-183`; claim pattern §2. Migration §4 for `claimed_at`. Existing per-tab `draining` mutex `offlineQueue.ts:8`. |
| REL-3 | Permanent/transient classification in write-ahead queue; stop one failure blocking all; blocked badge | `useWriteAheadQueue.ts:57-67` (the `break`), `:31` FIFO ordering, `WriteAheadEntry` shape §5. Badge `src/ui/Badge.tsx`. Mount in `AppLayout.tsx:81`. |
| REL-4 | `stopRecording()` always settles even on `db.audio.add` reject; keep blob for retry | `useAudioRecorder.ts:180-205` (`onstop`/`stopResolveRef`), `:244-291` (`stopRecording`). `recordingStore.ts` extension §6. |
</phase_requirements>

## Summary

This is pure robustness work on the existing offline pipeline — four defects with locked architectures (D-01..D-12). No new libraries, no architecture exploration. The research job is a **code reality check** so the planner can write precise, line-anchored tasks.

Three of the four reqs touch one Supabase migration (REL-1 `ai_attempts` + REL-2 `claimed_at`, one migration, two columns). The `items.ai_status` enum **already contains `queued` and `processing`** — confirmed in both the live migration (`20260318000002_create_items.sql:13-14`) and the canonical schema (`schema.md:65`) — so **no enum migration is needed**, only the two new nullable/defaulted columns. This is the single highest-risk task (cross-app schema, prod push) and should be its own plan/wave, gated like Phase 31 was.

The code already has all the primitives needed: Supabase `.update().eq()` idioms (`gemini.ts:180`, `:346`, `:380`), a per-tab `draining` mutex to replace with the DB claim, a transient-vs-permanent classifier (`isTransientNetworkError` at `gemini.ts:146-151`) that D-08 generalizes, a `Badge` primitive with `tone="err"`, and an `OfflineIndicator` mount anchor. Test infrastructure is strong: vitest with established Supabase-mock patterns in `offline-queue.test.ts`, `write-ahead-queue.test.ts`, and `audio-recorder.test.ts`.

**Primary recommendation:** Plan as 4 waves — (W0) the two-column migration + schema.md/database.types.ts regen, gated like Phase 31; (W1) REL-1+REL-2 in `offlineQueue.ts` (they share `claimed_at`/`ai_attempts` and the claim, so co-plan); (W2) REL-3 write-ahead classification + badge UI; (W3) REL-4 recorder settle. W1 depends on W0. W2/W3 are independent of the migration and of each other.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cross-tab/process claim (REL-2) | Database (Supabase `items`) | Client (offlineQueue) | DB conditional-update is the only tier that coordinates across tabs/processes/devices — D-01 locks this. |
| Attempt count + backoff state (REL-1) | Database (`ai_attempts`, `claimed_at`) | Client (drain reads + computes window) | Server-persisted so counts stay consistent cross-device — D-05. |
| Backoff window computation (REL-1) | Client (offlineQueue) | — | Pure function of server-read `claimed_at`+`ai_attempts`; no DB logic needed. |
| Error classification (REL-3, REL-1 cap) | Client (queue services) | — | Classifies JS error objects / HTTP status from the proxy; no server change. |
| Blocked-count badge + detail (REL-3) | Client (React/AppLayout) | Database (read blocked count) | UI surface; reads `ai_status='failed'` count + write-ahead failures. |
| Recorder settle + blob retain (REL-4) | Client (hook + Zustand store + Dexie) | — | Entirely client-side MediaRecorder/IndexedDB lifecycle. |

## Standard Stack

No new packages. This phase uses only what is already installed and in use.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | (installed) | DB-atomic claim, status updates | Already the items-table client (`src/lib/supabase.ts`). |
| `dexie` | (installed) | `db.audio` / `db.writeAheadQueue` stores | Already the offline cache. |
| `zustand` | (installed) | `recordingStore` retry-buffer + error | Already holds recorder state. |
| `vitest` | ^4.0.18 | Unit tests | Existing test runner; `"test": "vitest --run"` in package.json. |
| `@testing-library/react` | (installed) | `renderHook` for recorder tests | Used in `audio-recorder.test.ts`. |

**Installation:** none.

## Package Legitimacy Audit

Not applicable — this phase installs **zero** external packages. All work is against already-installed, already-in-use dependencies. No registry lookups, no slopcheck needed.

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────────────┐
  online event /         │            AppLayout.handleReconnect         │
  mount (navigator.onLine)│  (AppLayout.tsx:57-73)                       │
        │                │  order: writeAhead → fetchSessions →         │
        ▼                │         photos → audio   (INVARIANT)         │
  ┌───────────┐          └──────┬───────────────────────────┬──────────┘
  │  window   │                 │                            │
  │  'online' │                 ▼                            ▼
  └───────────┘     ┌────────────────────┐       ┌──────────────────────┐
                    │ processWriteAhead   │       │     drainQueue        │
                    │ Queue (REL-3)       │       │   (REL-1 + REL-2)     │
                    │                     │       │                       │
                    │ FIFO Dexie entries  │       │ getQueuedItems()      │
                    │ classify err D-08:  │       │  ↓ Supabase select    │
                    │  permanent→drop+    │       │ for each item:        │
                    │   dependents,cont.  │       │  ┌─ backoff window? ─┐│
                    │  transient→halt     │       │  │ skip if inside    ││
                    │   (no more `break`) │       │  └───────────────────┘│
                    └─────────┬───────────┘       │  ┌─ DB-ATOMIC CLAIM ─┐│
                              │                    │  │ update items set  ││
                              ▼                    │  │ ai_status=        ││
                   ┌────────────────────┐          │  │  'processing',    ││
                   │ Supabase items     │◀─────────┤  │ claimed_at=now()  ││
                   │ (.update().eq())   │  claim   │  │ where id=? and    ││
                   │                    │  .select │  │ ai_status='queued'││
                   │ +claimed_at        │──────────▶  │ .select()         ││
                   │ +ai_attempts (NEW) │  winner  │  │ row? → proceed    ││
                   │ ai_status enum     │  rows    │  │ empty? → skip     ││
                   │ (queued/processing │          │  └─────────┬─────────┘│
                   │  /done/failed)     │          │            ▼          │
                   └─────────┬──────────┘          │  processAudioWithAi   │
                             │                      │  (gemini.ts)          │
            blocked-count    │                      │  on fail: classify,   │
            badge reads      ▼                      │   ai_attempts++,      │
       ┌──────────────────────────┐                 │   cap 5 → 'failed'    │
       │ Badge tone="err" (D-10)  │                 └───────────────────────┘
       │ next to OfflineIndicator │
       │ click → blocked detail   │      ┌─────────────────────────────────┐
       └──────────────────────────┘      │  useAudioRecorder (REL-4)       │
                                          │  onstop → db.audio.add          │
                                          │   reject → retry 2× → ALWAYS    │
                                          │   settle(undefined) + set error │
                                          │   + stash blob in recordingStore│
                                          └─────────────────────────────────┘
```

### Component Responsibilities

| File | Current role | Phase 33 change |
|------|--------------|-----------------|
| `src/services/offlineQueue.ts` | Audio→AI drain; `draining` per-tab mutex (`:8`), `CONCURRENCY=4`/`MAX_RETRIES=2` (`:5-6`), `processWithRetry` (`:56-83`), `drainQueue` (`:90-105`) | REL-1 backoff + `ai_attempts`; REL-2 DB-atomic claim replacing per-tab dedup. Remove `MAX_RETRIES` immediate loop. |
| `src/hooks/useWriteAheadQueue.ts` | Write-ahead drain; `break` on first failure (`:66`), FIFO `orderBy("createdAt")` (`:29`) | REL-3 classify D-08; permanent→drop entry+same-item dependents+continue; transient→halt. |
| `src/hooks/useAudioRecorder.ts` | MediaRecorder lifecycle; `onstop` add (`:187`), catch only console.errors (`:202-204`), `stopResolveRef` settle (`:198-201`) | REL-4 retry add 2× then always settle + stash blob. |
| `src/layouts/AppLayout.tsx` | `handleReconnect` drain order (`:58-63`); `online` listener (`:70-72`); header region (`:80-82`) | REL-3 mount blocked badge next to `OfflineIndicator` (`:81`). |
| `src/stores/recordingStore.ts` | Recorder Zustand state | REL-4 add retry-buffer (blob) + recorder-error field. |
| `src/db/database.types.ts` | Generated Supabase types | Regenerate after migration (new `claimed_at`, `ai_attempts`). |

### Pattern 1: DB-atomic conditional claim (D-01)
**What:** Conditional update that only succeeds for the tab that "wins" the row.
**When to use:** Before any tab calls `processAudioWithAi` for an item.
**Example (idiom confirmed from existing `gemini.ts:180-183` + `:346-349`):**
```typescript
// CLAIM — only the tab whose update flips queued→processing gets a row back.
const { data: claimed } = await supabase
  .from("items")
  .update({ ai_status: "processing", claimed_at: new Date().toISOString() })
  .eq("id", item.id)
  .eq("ai_status", "queued")   // ← conditional: structurally prevents double-claim
  .select("id");               // ← .select() so we can detect winner vs empty
if (!claimed || claimed.length === 0) continue; // another tab won; skip
```
**Stale-claim reclaim (D-02)** — a separate pass before/within the drain re-queues stuck rows:
```typescript
// Reclaim items stuck in 'processing' past the stale threshold.
const staleCutoff = new Date(Date.now() - STALE_MS).toISOString(); // STALE_MS ≈ 5min
await supabase
  .from("items")
  .update({ ai_status: "queued" })
  .eq("ai_status", "processing")
  .lt("claimed_at", staleCutoff);
```
> NOTE: Supabase PostgREST `.update().eq()` returns `data` only when `.select()` is chained — without it the response `data` is `null` even on success. The winner-detection in D-01 REQUIRES `.select()`.

### Pattern 2: Full-jitter exponential backoff window (D-06)
See §3 for the helper. Drain reads `claimed_at` + `ai_attempts` from the same `getQueuedItems` select and skips any item still inside its window.

### Anti-Patterns to Avoid
- **Keeping the per-tab `draining` boolean as the only guard (REL-2):** it dedupes *within one tab*; cross-tab needs the DB claim. Keep the boolean as a cheap local short-circuit, but it is NOT the coordination mechanism.
- **Writing status text into `description` on failure:** explicitly forbidden by DAT-2 (see `gemini.ts:377` comment). Use `ai_status` only.
- **Re-enqueueing analytics on drain failure (REL-3):** `useWriteAheadQueue.ts:63-65` already warns `trackEvent` re-enqueues into the same queue and grows it on every failed drain. Do NOT emit analytics from the write-ahead failure path.
- **Removing the `handleReconnect` drain order (`AppLayout.tsx:58-63`):** write-ahead MUST run before audio drain so items exist server-side before AI updates them. Preserve.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-tab leader election | BroadcastChannel election loop | DB-atomic claim (D-01/D-03) | Locked; survives multi-process/device + leader-death. |
| Transient-vs-permanent network check | New classifier from scratch | Generalize existing `isTransientNetworkError` (`gemini.ts:146-151`) | Already handles offline/AbortError/Failed-to-fetch; D-08 extends it with 5xx/429/4xx/timeout. |
| Backoff scheduling for write-ahead | `setTimeout` chains | The photo-queue pattern (`photoUploadQueue.ts:134-135` `Math.pow(4, n)*BASE` + `setTimeout(drain)`) is a reference for transient halt-and-retry | Proven sibling pattern; do not modify the photo queue itself (out of scope). |
| Badge UI | Hand-rolled span | `Badge` primitive `tone="err"` (`src/ui/Badge.tsx`) | LIB-02 primitive; D-10 mandates reuse. |

**Key insight:** Almost every primitive REL-1..4 needs already exists in the codebase — the work is wiring + the two new columns, not invention.

## Runtime State Inventory

This phase adds two DB columns and changes client drain logic. It is **not** a rename/migration of existing identifiers, but it touches stored data, so the relevant categories:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `items.ai_status` rows currently in `pending/processing/done/failed/queued`. New columns `claimed_at` (null default) + `ai_attempts` (0 default) backfill safely with no data migration — existing rows get `null`/`0`. Any row currently stuck in `processing` (from a pre-deploy crash) becomes reclaimable once D-02 stale-recovery ships. | DDL only; no row migration. The stale-reclaim pass will self-heal pre-existing stuck `processing` rows. |
| Live service config | None — no external service config embeds these names. | None. |
| OS-registered state | None. | None — verified, this is in-app queue logic only. |
| Secrets/env vars | None — no new env vars. `VITE_GEMINI_PROXY_URL` unchanged. | None. |
| Build artifacts | `src/db/database.types.ts` is a generated artifact — stale after the migration until `npm run db:types` regenerates it. | Run `npm run db:types`; expect a 2-column diff (`claimed_at`, `ai_attempts` added to items Row/Insert/Update). |

**The canonical question — after the migration, what still has the old shape cached?** Only `database.types.ts` (regenerate) and any in-flight `processing` rows (self-healed by stale-reclaim). No multi-device cache concern because attempt state is server-side by design (D-05).

## Common Pitfalls

### Pitfall 1: `.update()` without `.select()` returns null data
**What goes wrong:** The D-01 winner-detection silently never fires; every tab thinks it lost (or won), defeating the claim.
**Why it happens:** PostgREST `.update().eq()` returns `data: null` unless `.select()` is chained. The existing code (`gemini.ts:180`) never reads the update result, so this idiom is new to this codebase.
**How to avoid:** Always `.select("id")` on the claim update and branch on `data?.length`.
**Warning signs:** A 4-tab concurrent-drain test shows >1 `processAudioWithAi` call for the same item.

### Pitfall 2: Migration sibling-isolation on prod push
**What goes wrong:** `supabase db push` applies ALL pending migrations, not just the new one — could apply unintended siblings to prod.
**Why it happens:** Phase 31's plan (`31-02-PLAN.md:132`) documents exactly this: the `--dry-run` MUST show the new migration as the ONLY pending one before `--yes` apply.
**How to avoid:** Reproduce the Phase 31 gate: `node_modules/.bin/supabase db push --dry-run` → confirm only the Phase-33 migration is pending → `SUPABASE_DB_PASSWORD=*** node_modules/.bin/supabase db push --yes`. User pushes to prod autonomously.
**Warning signs:** `--dry-run` lists any migration other than the new two-column one.

### Pitfall 3: Recorder settle race — resolving twice or never
**What goes wrong:** `onstop` either never resolves (current bug, catch only `console.error`s at `:203`) or, if naively patched, resolves twice.
**Why it happens:** `stopResolveRef.current` is the single settle slot (`:198-201`); on `db.audio.add` reject the current code falls through without calling it → the promise from `stopRecording` (`:245`) hangs forever.
**How to avoid (D-12):** In the `onstop` catch, retry `db.audio.add` up to 2×; on final failure call `stopResolveRef.current?.(/* resolve undefined */)`, null the ref, set recorder error state, and stash the blob in `recordingStore`. Note current resolve type is `((id: number) => void)` (`:39`) — widen to allow `undefined` to settle the `Promise<number | undefined>`.
**Warning signs:** A test that makes `db.audio.add` reject and asserts `stopRecording()` settles within a timeout currently hangs.

### Pitfall 4: Backoff must integrate with existing `navigator.onLine` short-circuits
**What goes wrong:** New backoff loop ignores the existing offline pauses (`offlineQueue.ts:68`, `:98`) → drains while offline.
**Why it happens:** Two independent pause mechanisms not reconciled.
**How to avoid:** Compute skip-vs-process per item (backoff window) AND keep the `if (!navigator.onLine) break/return` guards. Offline is itself a transient classification (D-08).

### Pitfall 5: FIFO dependency in write-ahead (REL-3)
**What goes wrong:** Dropping a permanent-failure insert without dropping its dependent same-item updates leaves orphan updates that will 404 forever.
**Why it happens:** A later `update`/`delete` entry for the same item id depends on the earlier `insert` succeeding (D-09).
**How to avoid:** When dropping a permanent entry, also drop queue entries whose `payload.id` (or `tempId`) matches the same item. `hasPendingForItem` (`useWriteAheadQueue.ts:78-83`) already shows the `payload.id` match idiom to reuse for dependent detection.

## Code Examples

### Backoff helper (§3 detail) — full jitter, base 5s, cap 5min
```typescript
// Source: AWS "Exponential Backoff And Jitter" full-jitter formula [CITED: aws.amazon.com/builders-library];
// constants per D-06.
const BACKOFF_BASE_MS = 5_000;   // 5s
const BACKOFF_CAP_MS = 300_000;  // 5min
const ATTEMPT_CAP = 5;           // D-07

/** Earliest epoch-ms at which an item may be retried. */
function nextEligibleAt(claimedAt: Date | null, attempts: number): number {
  if (!claimedAt || attempts <= 0) return 0; // never tried → eligible now
  const exp = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** attempts);
  const jittered = Math.random() * exp; // full jitter: [0, exp)
  return claimedAt.getTime() + jittered;
}
function isInBackoff(claimedAt: Date | null, attempts: number): boolean {
  return Date.now() < nextEligibleAt(claimedAt, attempts);
}
```
> `getQueuedItems` (`offlineQueue.ts:21-36`) must add `claimed_at, ai_attempts` to its `.select(...)` so the drain has these fields. Currently it selects only `id, mode, session_id, created_at` (`:24`).

### Generalized error classifier (D-08) — extends existing `isTransientNetworkError`
```typescript
// Source: generalizes gemini.ts:146-151. Proxy throws `Error("Proxy returned HTTP <status>: ...")`
// at gemini.ts:286 — parse the status out of the message, OR thread status through as a typed error.
function classifyAiError(error: unknown): "permanent" | "transient" {
  if (!navigator.onLine) return "transient";                       // offline
  if (error instanceof DOMException && error.name === "AbortError") return "transient"; // timeout
  const msg = error instanceof Error ? error.message : String(error);
  if (/abort|Load failed|Failed to fetch|NetworkError/i.test(msg)) return "transient";
  const httpMatch = msg.match(/HTTP (\d{3})/);                     // "Proxy returned HTTP 4xx/5xx"
  if (httpMatch) {
    const status = Number(httpMatch[1]);
    if (status === 429 || status >= 500) return "transient";       // rate-limit / server
    if (status >= 400) return "permanent";                         // validation / auth
  }
  if (/Zod validation failed|unsupported format/i.test(msg)) return "permanent";
  return "transient"; // default safe: retry rather than drop
}
```
> The proxy surfaces HTTP status only as text in the thrown `Error.message` (`gemini.ts:285-286`). The cleanest implementation threads the numeric status through a typed error from `processAudioWithAi`; the regex-parse above is the no-refactor fallback. Flag this choice to the planner.

## State of the Art

| Old Approach | Current (this phase) | When Changed | Impact |
|--------------|----------------------|--------------|--------|
| `MAX_RETRIES=2` immediate retry loop (`offlineQueue.ts:6,67-83`) | Persisted `ai_attempts` + backoff window, cap 5 → `failed` | Phase 33 | Kills retry storm; survives reload/cross-device. |
| Per-tab `draining` boolean only (`offlineQueue.ts:8`) | DB-atomic claim (`claimed_at`) | Phase 33 | Cross-tab/process safe; zero duplicate Gemini spend. |
| `break` on first write-ahead failure (`useWriteAheadQueue.ts:66`) | Classify; permanent→skip+continue, transient→halt | Phase 33 | One bad write no longer blocks all later writes. |
| `onstop` catch console.errors only (`useAudioRecorder.ts:203`) | Retry 2× then always settle + stash blob | Phase 33 | Eliminates the recorder hang. |

**No deprecated libraries.** Nothing being removed except local constants/logic.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Proxy HTTP status is only available as text in the thrown `Error.message` (`gemini.ts:286`), so D-08 must either regex-parse it or refactor to a typed error | §"Generalized error classifier", Pitfall notes | If a typed-error path already exists I'd be over-engineering; verified by reading gemini.ts — the throw is `new Error(\`Proxy returned HTTP ${response.status}...\`)`, plain Error. LOW risk. |
| A2 | Adding two nullable/defaulted columns needs no row backfill and is safe on a live prod table | §Runtime State Inventory, §4 | `claimed_at` is null-default, `ai_attempts` is `default 0` — standard safe additive DDL. LOW risk. |
| A3 | The drain can read `claimed_at`+`ai_attempts` by extending the existing `getQueuedItems` select rather than a second query | §Code Examples, §3 | Both columns live on `items`; one select suffices. Verified column ownership. LOW risk. |
| A4 | Full-jitter (`random()*exp`) is the intended jitter shape for D-06 | §Backoff helper | D-06 says "full jitter" explicitly; AWS full-jitter is `random()*exp`. Constants are Claude's discretion. LOW risk. |

**All four are LOW risk and confirmed against the actual files** — none block planning; they are implementation-detail flags for the planner.

## Open Questions

1. **Thread proxy HTTP status as a typed error vs regex-parse the message?**
   - What we know: `processAudioWithAi` throws plain `Error` with status embedded in text (`gemini.ts:286`).
   - What's unclear: whether the planner wants the (cleaner) typed-error refactor or the (smaller-blast-radius) regex parse.
   - Recommendation: regex-parse for this phase to keep the diff tight; note the typed-error refactor as a future cleanup. Surfaces in REL-1/REL-3 plans.

2. **Does REL-1's attempt increment happen client-side or via a DB expression?**
   - What we know: `ai_attempts` is server-persisted (D-05). The claim already writes `ai_status`/`claimed_at`.
   - What's unclear: increment via read-then-write (`ai_attempts: current+1`) vs an RPC/`rpc('increment')`. Read-then-write races are bounded because only the claim-winner increments.
   - Recommendation: increment in the claim winner's failure path with read-then-write (the claim already serialized access to that row). No RPC needed. Confirm in planning.

3. **Stale-claim threshold exact value (D-02 says ~5min).**
   - Recommendation: 5min default constant `STALE_MS = 300_000`; surface in a test. Claude's discretion per CONTEXT.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vitest | All unit tests | ✓ | ^4.0.18 | — |
| Vendored Supabase CLI | Migration push (`node_modules/.bin/supabase db push`) | ✓ | (in node_modules, used by Phase 31) | User runs `supabase login`/`link` if not authed (user-only) |
| `npm run db:types` | Regenerate database.types.ts post-migration | ✓ | script line 13 in package.json | — |
| Supabase project `wgrknodfxdjtddsirldw` | Prod schema target | ✓ (project-id in db:types script) | — | — |

**Missing dependencies with no fallback:** none.
**Note:** the only user-only step is Supabase CLI auth (`supabase login` + `link`) if the vendored CLI is not already linked — identical to Phase 31's gate. User pushes migrations to prod autonomously.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 (jsdom) |
| Config file | `vitest.config.ts` (existing; `src/tests/setup.ts` for global setup) |
| Quick run command | `npx vitest run src/tests/offline-queue.test.ts src/tests/write-ahead-queue.test.ts src/tests/audio-recorder.test.ts` |
| Full suite command | `npm test` (`vitest --run`) |

### Phase Requirements → Test Map
| Req ID | Behavior (observable signal) | Test Type | Automated Command | File Exists? |
|--------|------------------------------|-----------|-------------------|-------------|
| REL-2 | 4 concurrent `drainQueue()` calls over the same queued item → `processAudioWithAi` called **exactly once** (claim returns rows for one caller only; mock conditional `.update().eq().eq().select()` returns `[row]` first call, `[]` after) | unit | `npx vitest run src/tests/offline-queue.test.ts` | ✅ extend existing |
| REL-2 | Stale `processing` row (`claimed_at` < now−5min) is reclaimed to `queued` before drain | unit | same | ✅ extend |
| REL-1 | Item with recent `claimed_at` + `ai_attempts>0` inside backoff window is **skipped** (no `processAudioWithAi` call) | unit | same | ✅ extend |
| REL-1 | After 5 attempts, item is marked `ai_status='failed'` (assert update payload) | unit | same | ✅ extend |
| REL-1 | `nextEligibleAt`/`isInBackoff` pure-function math (base/cap/jitter bounds) | unit | new `src/tests/backoff.test.ts` | ❌ Wave 0 |
| REL-3 | Permanent failure (4xx/no-audio) → failing entry + same-item dependents dropped, **drain continues** to later entries | unit | `npx vitest run src/tests/write-ahead-queue.test.ts` | ✅ extend |
| REL-3 | Transient failure (offline/5xx/429) → drain halts, FIFO preserved, entries remain | unit | same | ✅ extend |
| REL-3 | `classifyAiError` taxonomy table (offline, AbortError, 4xx, 5xx, 429, Zod) | unit | new `src/tests/error-classify.test.ts` | ❌ Wave 0 |
| REL-3 | Blocked-count badge renders with `tone="err"` + count next to OfflineIndicator; click → detail | component | `npx vitest run src/tests/layout.test.tsx` (extend) or new | ✅ extend |
| REL-4 | `db.audio.add` rejects → `stopRecording()` settles to `undefined` within timeout (no hang), recorder error set, blob in `recordingStore` | unit (renderHook) | `npx vitest run src/tests/audio-recorder.test.ts` | ✅ extend |
| REL-4 | `db.audio.add` succeeds on 2nd attempt → resolves with id (retry path works) | unit | same | ✅ extend |
| Migration | `database.types.ts` includes `claimed_at`, `ai_attempts` on items Row/Insert/Update | unit | `npx vitest run src/tests/supabase-types.test.ts` (extend) | ✅ extend |

### Sampling Rate
- **Per task commit:** the single touched test file (e.g. `npx vitest run src/tests/offline-queue.test.ts`).
- **Per wave merge:** the quick-run trio + any new files.
- **Phase gate:** full `npm test` green + migration applied to prod + `db:types` zero-unexpected-diff before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `src/tests/backoff.test.ts` — covers REL-1 backoff math (pure functions).
- [ ] `src/tests/error-classify.test.ts` — covers REL-3/REL-1 D-08 taxonomy.
- [ ] Blocked-badge component test — covers REL-3 D-10 (extend `layout.test.tsx` or new `blocked-badge.test.tsx`).
- [ ] Existing files (`offline-queue.test.ts`, `write-ahead-queue.test.ts`, `audio-recorder.test.ts`, `supabase-types.test.ts`) get new cases — no new framework install needed.
- Framework install: none — Vitest + Testing Library already present.

## Security Domain

`security_enforcement` not explicitly disabled in config — included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface changed; claim runs under existing authed Supabase client + RLS. |
| V3 Session Management | no | — |
| V4 Access Control | yes | The new `.update()` claim + stale-reclaim run under existing items RLS (`schema.md:78`: specialists see own/assigned, admins all). New columns inherit table RLS automatically — **verify** the migration does not add column grants that bypass the Phase-31 column-scoping discipline. The two new columns are written only by the app's own drain, not user-PATCHable in a sensitive way, but confirm no broad `GRANT UPDATE` regression (the Phase 31 lesson). |
| V5 Input Validation | yes | Existing Zod validation on Gemini response (`gemini.ts:296`) unchanged; D-08 classifies the *failure*, doesn't relax validation. |
| V6 Cryptography | no | — |

### Known Threat Patterns for {Supabase + client drain}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A specialist PATCHing `ai_attempts`/`claimed_at` to manipulate queue | Tampering | Confirm migration does NOT broaden column grants; rely on table RLS. These are operational columns, not privilege-bearing, so blast radius is low — but echo the Phase-31 "no broad GRANT" rule in the migration. |
| Duplicate Gemini spend (cost) via concurrent drains | Denial-of-wallet | The DB-atomic claim (D-01) is itself the mitigation — that's REL-2. |

## Project Constraints (from CLAUDE.md)

Extracted directives the planner MUST honor:
- **Schema = single source of truth (../CLAUDE.md):** 4-step protocol for the migration — (1) update `../_workspace/Schema/schema.md` items section FIRST (add `claimed_at`, `ai_attempts` to the column list ~line 64), (2) add migration SQL to this repo's `supabase/migrations/` (date-prefixed, e.g. `20260601000000_add_items_claim_columns.sql`), (3) regenerate `src/db/database.types.ts` via `npm run db:types`, (4) A4 schema-drift-checker (Checkpoint G) fires on the schema/migration edit and writes `../_workspace/Schema/drift.md`. Record the migration in `../_workspace/Schema/migrations.md`.
- **Cross-app event:** schema change touches a shared Supabase project (cataloger + dashboard read items). Start from `schema.md`, not local belief.
- **No comments unless WHY-comments (global):** only non-obvious WHY comments (e.g. why `.select()` is required on the claim, why FIFO must be preserved).
- **Atomic commits (global):** one concern per commit — migration, REL-1, REL-2, REL-3, REL-4 as separate commits.
- **Cross-app coordination (CLAUDE.md):** before phase work, `grep -l "app:" ../_workspace/Features/*.md` to check for a driving feature note; PLAN.md should carry a `<context>` line if so.
- **Migration push (Phase 31 precedent):** `node_modules/.bin/supabase db push --dry-run` sibling-isolation gate → `--yes` apply. User pushes prod autonomously; CLI auth is user-only.

## Sources

### Primary (HIGH confidence)
- First-hand reads of: `src/services/offlineQueue.ts`, `src/hooks/useWriteAheadQueue.ts`, `src/hooks/useAudioRecorder.ts`, `src/layouts/AppLayout.tsx`, `src/db/index.ts`, `src/services/photoUploadQueue.ts`, `src/stores/recordingStore.ts`, `src/ui/Badge.tsx`, `src/db/audioLookup.ts`, `src/services/gemini.ts`, `src/db/types.ts`, `src/db/database.types.ts` (lines 180-240).
- `supabase/migrations/20260318000002_create_items.sql` (ai_status enum) + `20260529000000_lock_profiles_self_update.sql` (migration style precedent).
- `../_workspace/Schema/schema.md:50-78` (canonical items table).
- `.planning/milestones/v1.3-phases/31-*/31-02-PLAN.md` (db push gate precedent).
- Test files: `offline-queue.test.ts`, `audio-recorder.test.ts`, `write-ahead-queue.test.ts` (mock conventions).
- CONTEXT.md + DISCUSSION-LOG.md (locked decisions).

### Secondary (MEDIUM confidence)
- AWS "Exponential Backoff And Jitter" (full-jitter formula) — well-established pattern [CITED].

### Tertiary (LOW confidence)
- None — no unverified web claims; this is a closed-world code-reality research.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all existing deps confirmed installed and in use.
- Architecture: HIGH — every touchpoint read first-hand with exact line anchors; locked decisions map cleanly onto existing idioms.
- Pitfalls: HIGH — each pitfall is grounded in a specific line of real code (`.select()` requirement, `break` location, settle-ref mechanics, migration sibling-isolation from Phase 31).

**Research date:** 2026-06-01
**Valid until:** 2026-07-01 (stable — internal codebase, no fast-moving external deps).
