# Phase 42: audio-upload-reliability - Research

**Researched:** 2026-06-04
**Domain:** Offline-first audio durability — Dexie → Supabase Storage upload queue, item/audio sync decoupling, cross-device failure recovery UI
**Confidence:** HIGH (root cause traced in real code; all claims `file:line`-cited and verified against the running source)

## Summary

The 34 stranded items share one structural property: a synced `items` row (`ai_status` reached `'failed'`) with **zero `audio` rows in Supabase**. This research traces the recording→upload→`audio`-row path and finds the precondition is created by a **complete decoupling between the `items` write path and the `audio` upload queue**, combined with a **fire-and-forget enqueue whose failure is swallowed** and a **`failed` upload-queue terminal state that never resurfaces and never reconciles back to item state**.

The exact gap: in `RecordButton.handleClick` the item is welded to `ai_status='queued'` (a durable Supabase `items` write) **immediately and unconditionally** after `stopRecording()` resolves a Dexie audio id — but the Supabase Storage upload is a separate `db.audioUploadQueue` entry drained by an independent worker (`audioUploadQueue.ts`). If that worker exhausts its 3 retries the entry goes to `status:'failed'`, where (a) `drainAudioQueue` never looks again (it scans only `'pending'`, `audioUploadQueue.ts:143`), (b) nothing writes back to `items` — the item is happily `queued`/`processing`/`failed` with no Supabase `audio` row, and (c) the only re-trigger, `retryFailedUploads`, is reachable solely through an `ItemCard` pill that requires a local Dexie blob. When the AI worker then resolves the blob, `resolveAudioForAi` finds neither a Dexie blob (cleared / cross-device) nor a Storage object → throws → `ai_status='failed'`. That is the 34-item death spiral.

The second defect (F2): `AiFailureBanner` returns `null` whenever `latestAudioId == null` (`AiFailureBanner.tsx:39`). For a cross-device / Dexie-cleared item the `audio` blob exists only in Supabase, and `audioLookup.audioRecordsForItem` deliberately leaves Supabase-union rows with `id: undefined` (`audioLookup.ts:56-63`), so the `latestAudioId` reduce in both `ItemList.tsx:57` and `ItemEntry.tsx:163` produces `null`. Result: a failed item with recoverable server-side audio shows a red title and an invisible banner — no Retry path.

**Primary recommendation:** Two-plan phase. **Plan 1 (root cause / SC-1):** make the audio upload *durable and self-healing* — resume `failed` entries on app boot / online (not just manually), and close the "item synced before audio confirmed" window by making `ai_status='queued'` (and the AI fire) *gated on* a durable audio anchor that the AI worker can always resolve. **Plan 2 (F2 / SC-2/3):** drive `AiFailureBanner` Retry off a server-side audio existence check (query the `audio` table by `item_id`) instead of the Dexie-integer `latestAudioId`, and add regression tests for the cross-device path. **No new npm dependencies and no schema changes are required** — the `audio` table already has `upload_status` (`pending|uploading|uploaded|failed`) to reconcile against.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Audio capture → local persist | Browser (MediaRecorder + Dexie) | — | `useAudioRecorder.onstop` writes the blob to IndexedDB; offline-first |
| Audio blob → Supabase Storage + `audio` row | Browser worker (`audioUploadQueue`) | API/Storage | Durable upload queue lives client-side; Storage + Postgres are the sink |
| Item state machine (`ai_status`) | API (Supabase `items`) | Browser store mirror | `items` is the synced source of truth; sessionStore mirrors it |
| AI processing trigger / claim | Browser (`gemini.processAudioWithAi`) | API (atomic claim) | DB-atomic claim on `items`; blob resolved Dexie-first then Storage |
| Failure recovery UI | Browser (`AiFailureBanner`) | API (audio existence query) | Must read server-side audio existence, not local Dexie cache |

**Key boundary observation:** the audio-durability tier and the item-state tier are currently joined by *nothing* — no callback, no reconciliation, no shared status. That missing edge is the phase's core work.

## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for Phase 42 yet (`has_context: false`). This is a standalone research run (`/gsd:plan-phase --research-phase 42` or pre-discussion). Constraints below are derived from the ROADMAP phase entry and project CLAUDE.md and should be treated as **hard constraints** unless a later discuss-phase relaxes them:

### Locked Constraints (from ROADMAP + CLAUDE.md)
- **No schema changes** unless the root cause genuinely requires it. Supabase is shared across 3 apps — any schema change is a **cross-app event**: start from `../_workspace/Schema/schema.md`, flag cross-app impact explicitly, and regenerate `src/db/database.types.ts` via `npm run db:types` after any migration. [CITED: TPC/tpc-voice-cataloger/CLAUDE.md]
- **Prefer no new npm dependencies.** [CITED: phase additional_context]
- This app is **auth-of-record** (D-002) — do not touch the auth model. [CITED: D-002]
- Defer branch push + UAT to v1.3 milestone end — do not push or run per-phase UAT. [CITED: MEMORY.md v13-push-uat-at-milestone-end]
- `gsd-sdk phase.complete` fails on the milestones layout — run via `node gsd-tools.cjs`. [CITED: MEMORY.md phase-complete-use-native-bin]

### Out of Scope (deferred)
- Recovering the 34 *existing* stranded items — they have no audio anywhere and are explicitly NOT recovered (ROADMAP Phase 41 "Out of scope → Phase 42"). This phase closes the *precondition at the source*; the historical 34 stay dead.
- Root normalization of `db.audio.itemId` to a single UUID form (`audioLookup.ts:11-13` flags it as "a separate follow-up phase").

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| (none mapped) | Reliability work from v1.3 UAT findings F2 + audio-upload root cause | Success criteria below are the phase's contract; no REQUIREMENTS.md IDs (REQUIREMENTS.md covers v1.2 only) |

**Success Criteria (the phase contract — from ROADMAP):**
1. Recorded audio uploads durably to Supabase Storage + `audio` table with retry; no item can end with a synced `items` row but no `audio` row.
2. `AiFailureBanner` (and the list-card failure row) render with a working Retry for failed items whose audio exists only server-side (no local Dexie blob).
3. Regression tests cover the cross-device path (item present, audio only in Supabase).

## Root-Cause Findings (the core deliverable)

> *Where in the recording → upload → `audio`-row write path can an item's `items` row sync while its audio never lands?* Answer: **at least four independent gaps, all verified in code.**

### GAP-1 — `items` sync is unconditionally decoupled from audio upload confirmation [VERIFIED: code]

`RecordButton.handleClick` (`src/components/RecordButton.tsx:17-34`):
```ts
const audioId = await stopRecording();          // resolves a Dexie int id (or undefined)
if (audioId != null) {
  if (navigator.onLine) {
    await updateItemField(itemId, sessionId, "ai_status", "queued");  // DURABLE items write
    processAudioWithAi(audioId, itemId, sessionId).catch(...)          // fire-and-forget AI
  } else {
    await updateItemField(itemId, sessionId, "ai_status", "queued");
  }
}
```
`audioId != null` means only that the blob reached **Dexie** (local IndexedDB). The Supabase Storage upload has not even started — it was enqueued fire-and-forget inside `useAudioRecorder.onstop` (next gap). So the `items` row is welded to `'queued'` and synced to Supabase **before any audio upload is attempted, let alone confirmed.** This is the stranding precondition's origin: `items` synced, `audio` not yet (and possibly never) uploaded.

### GAP-2 — the enqueue + drain is fire-and-forget with a swallowed `.catch(() => {})` [VERIFIED: code]

`src/hooks/useAudioRecorder.ts:215-227`:
```ts
enqueueAudioUpload({ dexieAudioId: id, itemId: itemIdRef.current, sessionId: ..., mimeType: ... })
  .then(() => drainAudioQueue())
  .catch(() => {});                 // ← any enqueue/drain failure is silently dropped
```
If `enqueueAudioUpload` (a `db.audioUploadQueue.add`) throws (Dexie quota, transaction abort), the upload is **never queued at all** and nothing observes it. The comment at `:215-219` documents this as intentional ("never blocks the resolve … A rejected enqueue/drain is swallowed") — correct for UX latency, but it means a failed enqueue produces an item with no audio and no recovery anchor.

### GAP-3 — the `failed` upload-queue terminal state never resurfaces and never reconciles to `items` [VERIFIED: code]

In `audioUploadQueue.ts`:
- `processOneAudioUpload` after `MAX_RETRIES = 3` sets the entry to `status:'failed'` (`:106-110`) and on a missing Dexie blob sets `status:'failed'` immediately (`:63-66`).
- `drainAudioQueue` scans **only** `status === 'pending'` (`:142-144`). A `'failed'` entry is therefore *invisible* to every automatic drain — including the app-boot drain (`AppLayout.tsx:65 void drainAudioQueue()`).
- **Nothing in the codebase writes the upload outcome back to `items`.** Grep for any reconciliation between `audioUploadQueue.status`/`audio.upload_status` and `items.ai_status` returns nothing. The two state machines never communicate.
- The only `failed → pending` transition is `retryFailedUploads` (`:159-176`), invoked from exactly one place: `ItemCard.tsx:11` behind a "Failed-retry" audio pill — which is driven by `useAudioUploadStatus(latestAudioId)` (`ItemCard.tsx:59`) and is therefore **silent for any item with no local Dexie integer id** (cross-device / cleared). So the manual escape hatch is unreachable for precisely the stranded population.

**Net effect:** once an upload exhausts 3 retries (e.g. recorded offline, app closed before reconnection, or a transient RLS/network blip), the audio is welded to a dead `failed` queue entry, the Storage object never lands, and the item — already `queued` in Supabase from GAP-1 — eventually hits the AI worker.

### GAP-4 — the AI worker then converts "no audio" into a terminal `ai_status='failed'` [VERIFIED: code]

- `offlineQueue.processItem` (`:107-117`): `findAudioForItem` returns `null` for an item whose only audio is a Supabase-union row with `id: undefined` (filtered out at `:84`) OR whose Dexie row is gone → item is set `ai_status='failed'` with no recovery.
- `gemini.processAudioWithAi` (`:241-242`) resolves the blob via `resolveAudioForAi` (`processAudioWithAi.ts:21-51`): Dexie-first, then Supabase Storage download by `item_id`. If the upload never landed (GAP-2/3) **and** the Dexie blob is gone, both miss → `throw new Error("Audio … not in Dexie or Storage")` → caught → `ai_status='failed'`.

This is the terminal state the 34 items are stuck in. Phase 41 made the *pending→queued* path durable; it did nothing about the *audio never uploaded* root cause — exactly as its "Out of scope → Phase 42" note says.

### GAP-5 (F2) — `AiFailureBanner` hides itself when audio is server-only [VERIFIED: code]

`AiFailureBanner.tsx:39`: `if (latestAudioId == null) return null;`
`latestAudioId` is an integer Dexie id. For a cross-device / cleared item, `audioRecordsForItem` (`audioLookup.ts:56-63`) returns Supabase-union rows with `id` **intentionally `undefined`**, so:
- `ItemList.tsx:57` reduce → `null` (no integer id)
- `ItemEntry.tsx:163` reduce → `undefined`/`null`

→ banner renders `null` → the user sees a red title (failed) with **no Retry control**. The retry handler `processAudioWithAiRetry(latestAudioId, …)` (`:46`) also can't run because it needs an integer `audioId` it doesn't have — but `processAudioWithAi`/`resolveAudioForAi` already supports a Storage-by-`item_id` fallback (`processAudioWithAi.ts:32-50`), so the *capability* exists; only the *gating* and the *audioId plumbing* are wrong.

## Standard Stack

No new libraries. The phase works entirely within the existing stack. [VERIFIED: package.json]

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| dexie | ^4.3.0 | IndexedDB wrapper — `audio`, `audioUploadQueue` tables | Already the offline persistence layer |
| @supabase/supabase-js | ^2.99.2 | Storage upload/download + `audio`/`items` rows | Already the backend client |
| zustand | ^5.0.11 | `recordingStore` / `sessionStore` | Already the state layer |
| vitest | ^4.0.18 | Test framework (`vitest --run`) | Existing harness |
| @testing-library/react | ^16.3.2 | Component tests (banner) | Existing harness |

**No installation step.** This phase adds zero dependencies.

## Package Legitimacy Audit

Not applicable — this phase installs **no external packages**. All work uses libraries already in `package.json` (verified above). slopcheck/registry verification not run because no new package names are introduced.

## Architecture Patterns

### Data-flow diagram (current — showing the break)

```
RecordButton.click(stop)
        │
        ▼
useAudioRecorder.onstop ──► db.audio.add (Dexie blob)  ──► resolves audioId
        │                          │
        │                          └─(fire&forget, .catch swallowed)─► enqueueAudioUpload
        │                                                                     │
        ▼                                                              db.audioUploadQueue (pending)
RecordButton: updateItemField(ai_status='queued')                            │
        │   [items row SYNCS to Supabase — GAP-1: no audio yet]        drainAudioQueue (pending only)
        ▼                                                                     │
processAudioWithAi (fire&forget)                              ┌──────success──┴──fail×3──┐
        │                                                     ▼                          ▼
        ▼                                          Storage obj + audio row        status:'failed'
resolveAudioForAi: Dexie? Storage?                 (upload_status='uploaded')   ╳ never re-drained
        │                                                                       ╳ never reconciled
        ├─ found ─► AI runs ─► ai_status='done'                                   to items.ai_status
        └─ MISSING ─► throw ─► ai_status='failed'  ◄────────── 34 stranded items live here
                                    │
                                    ▼
                        AiFailureBanner (latestAudioId==null ⇒ returns null) ╳ no Retry  [GAP-5/F2]
```

The two fixes close the dashed/╳ edges: (1) a reconciliation/resume edge from the upload queue back into the durable retry surface, and (2) a real Retry edge from the failure banner driven by server-side audio existence.

### Pattern 1: Reconcile the two state machines via `audio.upload_status` (no schema change)
**What:** the `audio` table already carries `upload_status text not null default 'pending'` with domain `pending|uploading|uploaded|failed` (`../_workspace/Schema/schema.md:111`). Use it as the cross-machine signal: the AI claim / failure-recovery path should treat "an item with `ai_status` advancing but no `audio` row at `upload_status='uploaded'`" as the *recoverable* state, and the upload queue should be resumable.
**When to use:** SC-1 durability and SC-2 recovery.
**Why no schema change:** the column already exists and `processOneAudioUpload` already writes `upload_status:'uploaded'` on success (`audioUploadQueue.ts:87`). The gap is purely that nothing *reads* it for reconciliation and nothing resumes `failed` queue entries.

### Pattern 2: Resume `failed` upload-queue entries automatically (boot + online)
**What:** `AppLayout.tsx:65` already calls `drainAudioQueue()` on boot for `pending`. Add a `failed → pending` resweep (bounded — e.g. reset `failed` entries with `retryCount` reset, like `retryFailedUploads` does but automatically) on boot and on `online`, so a transient failure self-heals instead of welding. This mirrors the Phase 41 pattern of a durable resurfacing anchor (`offlineQueue` re-queues below the attempt cap).
**When to use:** SC-1.
**Anti-pattern avoided:** don't add an unbounded auto-retry — Phase 33/41 history (`offlineQueue.ts:90-98`) shows an unbounded per-`online`-event retry storm burned calls forever. Keep a bounded attempt cap.

### Pattern 3: Drive failure-recovery UI off server-side existence, not Dexie ints
**What:** `AiFailureBanner` should query `audio` by `item_id` (or accept a boolean `hasServerAudio` prop the parent computes via `audioRecordsForItem`'s already-fetched Supabase-union rows) to decide whether to show Retry, and pass `itemId`/`sessionId` (not an integer `audioId`) to a retry that uses the Storage-by-`item_id` fallback.
**When to use:** SC-2.
**Existing capability:** `resolveAudioForAi` (`processAudioWithAi.ts:32-50`) and `processAudioWithAi`'s claim path (`gemini.ts:218-231`) already work without a local Dexie id — the retry just needs to stop requiring `latestAudioId: number`.

### Anti-Patterns to Avoid
- **Blocking the recorder on upload confirmation.** Do NOT make `stopRecording()` await the Storage upload — the fire-and-forget UX (auctioneer moves on, `useAudioRecorder.ts:215-217`, D-05) is intentional. Durability must come from a *resumable* queue, not a synchronous wait.
- **Leaving `ai_status='queued'` ungated.** If you gate the AI fire on audio durability, the item must still reach a *recoverable* state (e.g. stays `queued` and drainable) when audio isn't yet up — never a dead state.
- **Re-deriving `latestAudioId` as the recovery key.** The integer id is device-local by design; server-side recovery must key on `item_id` (UUID).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bounded retry/backoff for uploads | A new retry scheduler | Extend `audioUploadQueue`'s existing `retryCount`/`MAX_RETRIES`/backoff (`:7-9,104-127`) + a bounded `failed→pending` resweep | Mirrors the proven Phase-41 `offlineQueue` attempt-cap pattern |
| Cross-device audio existence | A new RPC / view | `audioRecordsForItem` already unions Supabase `audio` by `item_id` (`audioLookup.ts:44-49`) | The query exists; reuse it |
| Idempotent re-upload | Dedup logic | The existing `upsert … onConflict:'storage_path', ignoreDuplicates:true` (`audioUploadQueue.ts:82-90`, DAT-5) | Retry-safe already |
| Item/audio reconciliation signal | A new column | `audio.upload_status` (already `pending|uploading|uploaded|failed`) | Schema already supports it |

**Key insight:** every primitive needed for SC-1/2/3 already exists in the codebase. The phase is *wiring the missing edges between existing components*, not building new machinery — which is exactly why no schema change and no new dependency are needed.

## Runtime State Inventory

> This is a reliability/wiring phase, not a rename/refactor. The relevant runtime-state question is "what stranded state exists in prod?" — answered here.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data (prod) | 34 items: `ai_status='failed'`, **zero** `audio` rows (verified premise of phase). | **No migration** — explicitly out of scope (ROADMAP: "the 34 existing stranded items … are NOT recovered"). Phase closes the precondition only. |
| Stored data (Dexie) | `db.audioUploadQueue` may hold `status:'failed'` entries on user devices that never resurfaced (GAP-3). | The boot resweep (Pattern 2) will pick these up — they self-heal on next app open if the blob is still in Dexie. Verify in the cross-device test. |
| Live service config | Supabase Storage `audio` bucket policies + `audio` RLS — shared, unchanged. | None — no schema/policy change. Confirm code stays within existing RLS (session-owner-scoped). |
| Secrets/env vars | `VITE_GEMINI_PROXY_URL` (AI), Supabase keys — unchanged. | None. |
| Build artifacts | `src/db/database.types.ts` — only touched if a migration happens (it should NOT). | None expected. If forced to migrate, `npm run db:types`. |

**Nothing found requiring migration:** verified — the 34 are dead-by-design and no schema change is planned.

## Common Pitfalls

### Pitfall 1: PostgREST `.update().eq()` returns `data:null` without `.select()`
**What goes wrong:** a conditional claim/reconcile update silently reports zero rows.
**How to avoid:** always append `.select("id")` (the codebase already does — `gemini.ts:230`, `offlineQueue.ts:131`). Any new reconcile write must follow suit.
**Warning signs:** winner-detection / "did the update apply?" logic that reads `data` without a select.

### Pitfall 2: Cross-device union rows carry `id: undefined`
**What goes wrong:** `Math.max(...)` / reduce over `a.id!` yields `undefined`/`NaN`; `=== null` guards miss it.
**How to avoid:** use `== null` (covers `undefined`) and filter `typeof x === "number"` — exactly the `WR-01` fix at `offlineQueue.ts:84,108`. The F2 fix MUST NOT reintroduce this by keying recovery on the integer id.
**Warning signs:** `a.id!` non-null assertions in any path that can see Supabase-union rows.

### Pitfall 3: Unbounded auto-retry storm
**What goes wrong:** re-firing on every `online` event burns Gemini calls / Storage requests forever on a permanently-failing item (the original Phase-33 bug, `offlineQueue.ts:90-97`).
**How to avoid:** the new `failed→pending` resweep must be bounded (attempt cap / one-shot per session), not unconditional.
**Warning signs:** a resweep with no cap or a `setTimeout` retry that re-arms unconditionally.

### Pitfall 4: Blocking the recorder on upload
**What goes wrong:** awaiting Storage upload in `onstop` reintroduces the UX latency D-05 deliberately removed and can re-hang the recorder (the T-33-10 / REL-4 bug class).
**How to avoid:** durability via resumable queue only; never `await` the upload in the capture path.

### Pitfall 5: Storage path/mime assumptions
**What goes wrong:** hardcoding `.opus` or a stale mime breaks playback/AI.
**How to avoid:** ext is derived from blob mime via `extFromMime` (`audioUploadQueue.ts:26`); path is `audio/{sessionId}/{itemId}/{dexieAudioId}.{ext}`. Keep using the runtime mime.

## Code Examples

### Existing idempotent upload (retry-safe) — reuse, don't reinvent
```ts
// Source: src/services/audioUploadQueue.ts:71-91 (VERIFIED in repo)
await supabase.storage.from("audio").upload(entry.storagePath, audio.blob, {
  contentType: entry.mimeType, cacheControl: "31536000", upsert: true,
});
await supabase.from("audio").upsert(
  { item_id: entry.itemId, storage_path: entry.storagePath, mime_type: entry.mimeType, upload_status: "uploaded" },
  { onConflict: "storage_path", ignoreDuplicates: true }   // DAT-5: retry can't duplicate
);
```

### Existing cross-device audio existence query — reuse for F2 gating
```ts
// Source: src/db/audioLookup.ts:44-49 (VERIFIED) — Supabase audio by item_id (UUID)
const res = await supabase.from("audio")
  .select("id, item_id, mime_type, storage_path, upload_status, created_at")
  .eq("item_id", itemId);
```

### Existing Storage-fallback resolver — already keyed by item_id, no Dexie int needed
```ts
// Source: src/services/processAudioWithAi.ts:27-50 (VERIFIED)
const audioRecord = await db.audio.get(dexieAudioId);
if (audioRecord?.blob) return { blob: audioRecord.blob, mimeType: audioRecord.mimeType };
const { data: rows } = await supabase.from("audio").select("storage_path, mime_type").eq("item_id", itemId);
const { data: dl } = await supabase.storage.from("audio").download(rows[0].storage_path);
return { blob: dl, mimeType: rows[0].mime_type ?? undefined };
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pending`-weld with no retry | Phase 41 durable `queued` anchor + atomic claim + pending reclaim | 2026-06-03 (`6d210b9`) | Fixed the *symptom* (orphan pending); did NOT fix audio-never-uploaded root |
| Audio upload coupled to nothing | (this phase) reconcile via `upload_status` + resumable `failed` entries | Phase 42 (proposed) | Closes the stranding precondition at source |

**Not deprecated, but flagged:** `db.audio.itemId` is stored as both UUID strings and legacy ints (`audioLookup.ts:6-13`); normalization is a separate follow-up phase — do not attempt it here.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The 34 prod items each have an `items` row but zero `audio` rows (the premise). | Summary / Runtime State | LOW — stated as verified premise in ROADMAP Phase 41/42; recommend a one-time prod read (`select count from audio where item_id in (…)`) during discuss-phase to confirm before locking the plan. Not yet queried live in this session. |
| A2 | `audio.upload_status` can serve as the reconciliation signal without a schema change. | Pattern 1 | LOW — column verified present in schema.md:111 and written at audioUploadQueue.ts:87; the only assumption is that no new states are needed. |
| A3 | A bounded `failed→pending` boot/online resweep is acceptable UX (no new dep). | Pattern 2 | MEDIUM — depends on discuss-phase confirming the resweep cadence/cap; mirrors the accepted Phase-41 pattern. |
| A4 | No prod schema change is required to satisfy SC-1/2/3. | User Constraints | MEDIUM — if discuss-phase decides reconciliation needs a new column (e.g. `items.audio_upload_status`), that becomes a cross-app schema event; flag early. |

## Open Questions

1. **Exact 34-item state in prod (confirm A1).**
   - What we know: ROADMAP asserts zero `audio` rows for all 34.
   - What's unclear: not queried live this session.
   - Recommendation: a single read-only `supabase` MCP query during discuss-phase (`select item_id, ai_status from items left join audio … where audio is null`) to confirm before planning.

2. **Should `ai_status='queued'` be gated on audio durability, or should the AI claim simply re-queue when audio isn't yet uploaded?**
   - Two valid designs for SC-1. Gating at `RecordButton` is cleaner but touches the hot path; re-queue-on-missing-audio in `offlineQueue`/`gemini` is lower-risk and reuses the attempt cap.
   - Recommendation: prefer the re-queue design (lower blast radius, reuses Phase-41 machinery); decide in discuss-phase.

3. **Banner gating mechanism: prop vs. internal query.**
   - `ItemList.tsx:51-67` already runs `audioRecordsForItem` per item and could thread a `hasServerAudio: boolean` prop (clean React.memo compare, consistent with PERF-3). The detail page (`ItemEntry.tsx:159`) would need a parallel boolean. Alternatively the banner queries internally.
   - Recommendation: thread a boolean prop (matches existing aggregate-subscription pattern, avoids per-banner network calls).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build/test | ✓ | v24.15.0 (project default) | — |
| vitest | regression tests | ✓ | ^4.0.18 | — |
| Supabase project | Storage + `audio`/`items` | ✓ (shared prod) | — | tests mock `../lib/supabase` (see `audio-storage-fallback.test.ts`) |

No external CLI tools needed beyond the existing toolchain.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 (+ @testing-library/react ^16.3.2, jsdom) |
| Config file | `vitest.config.ts` (present at repo root) |
| Quick run command | `npx vitest --run src/tests/<file>` |
| Full suite command | `npm test` (`vitest --run`) |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| SC-1 | A `failed` upload-queue entry resurfaces on boot/online (bounded) and lands the `audio` row | unit | `npx vitest --run src/tests/audio-upload-queue.test.ts` | ✅ extend (exists) |
| SC-1 | No code path syncs `ai_status` past `queued` while audio is unconfirmed (re-queue/gate) | unit | `npx vitest --run src/tests/offline-queue.test.ts` | ✅ extend |
| SC-2 | `AiFailureBanner` renders Retry when audio exists only server-side (no Dexie int) | component | `npx vitest --run src/tests/item-card-ai-failure.test.tsx` | ✅ extend |
| SC-2 | Banner Retry resolves audio via Storage-by-`item_id` (no integer audioId) | unit | `npx vitest --run src/tests/audio-storage-fallback.test.ts` | ✅ extend |
| SC-3 | Cross-device path: item present, audio only in Supabase → recoverable end-to-end | unit/component | new test (Wave 0) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the single nearest `npx vitest --run src/tests/<touched>.test.*`
- **Per wave merge:** `npm test` (full suite — currently ~710 passing, keep green)
- **Phase gate:** full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] New cross-device regression test (item with only Supabase `audio`, no Dexie blob → banner shows Retry → retry resolves via Storage). Likely `src/tests/audio-cross-device-recovery.test.tsx`.
- [ ] Extend `audio-upload-queue.test.ts` with a `failed→pending` resweep case.
- [ ] No framework install needed.

## Security Domain

`security_enforcement` not explicitly set in config; treat as enabled. This phase is low-surface (no auth/crypto changes), but the relevant controls:

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Unchanged (auth-of-record D-002 untouched) |
| V4 Access Control | yes | `audio` RLS + Storage bucket policies are session-owner-scoped on path token [2]=sessionId (schema.md:116). New reconcile reads/writes MUST stay within these — never broaden the query to other sessions. |
| V5 Input Validation | yes (light) | `item_id` is a UUID from the row; no new user input. Keep mime/path derived (Pitfall 5). |
| V6 Cryptography | no | None |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-session audio read via reconcile query | Information Disclosure | Existing RLS denies it; rely on it, don't bypass with service-role |
| Duplicate Gemini spend from auto-retry storm | DoS (cost) | Bounded attempt cap (Pitfall 3) |
| Retry re-upload duplicating Storage objects | Tampering/cost | Existing `upsert onConflict:storage_path ignoreDuplicates` (DAT-5) |

## Sources

### Primary (HIGH confidence — read directly this session)
- `src/services/audioUploadQueue.ts` — upload queue, retry, drain (`failed` never re-scanned)
- `src/hooks/useAudioRecorder.ts:189-255` — onstop capture + fire-and-forget enqueue
- `src/components/RecordButton.tsx:17-34` — item-sync decoupled from upload
- `src/services/gemini.ts:202-331` — AI claim + blob resolve → `failed`
- `src/services/processAudioWithAi.ts` — Dexie→Storage blob resolver
- `src/db/audioLookup.ts` — Supabase-union, `id: undefined` rows
- `src/services/offlineQueue.ts:78-159` — `findAudioForItem`, no-audio→failed, attempt cap
- `src/components/AiFailureBanner.tsx` — `latestAudioId == null` ⇒ null
- `src/components/ItemList.tsx:51-67`, `src/pages/ItemEntry.tsx:159-169` — `latestAudioId` derivation
- `../_workspace/Schema/schema.md:102-117` — `audio` table (`upload_status` domain, RLS, Storage policies)
- `.planning/ROADMAP.md:350-381` — Phase 41/42 goals + scope boundaries
- `.planning/STATE.md` — Phase 41 commits, decisions, constraints

### Secondary (MEDIUM)
- Project CLAUDE.md files (schema-as-cross-app, db:types regen, D-002)
- MEMORY.md (push/UAT deferral, phase.complete native-bin)

## Metadata

**Confidence breakdown:**
- Root cause: HIGH — all 5 gaps traced to specific `file:line` in current source; the decoupling is structural, not speculative.
- Standard stack / no-new-deps: HIGH — package.json verified, all needed primitives already present.
- Recovery design (Patterns 2/3): MEDIUM — multiple valid implementations; final choice is a discuss-phase decision (Open Questions 2/3).
- Prod 34-item state: MEDIUM — premise asserted by ROADMAP, recommend a live read to confirm (A1).

**Research date:** 2026-06-04
**Valid until:** 2026-07-04 (stable internal codebase; re-verify if `audioUploadQueue.ts` / `gemini.ts` / `audioLookup.ts` change before planning)
