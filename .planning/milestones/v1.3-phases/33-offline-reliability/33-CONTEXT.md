# Phase 33: offline-reliability - Context

**Gathered:** 2026-06-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Harden the offline/sync pipeline against four known reliability defects (REL-1..REL-4). No new user-facing features — this is correctness/robustness work on existing offline queue, write-ahead queue, cross-tab coordination, and recorder lifecycle.

**In scope:**
- REL-1: exponential backoff + persisted attempt counter on the offline (audio→AI) queue drain; folds in the #17 net-abort-requeue follow-up.
- REL-2: atomic `queued→processing` claim + cross-tab/process coordination so concurrent drains never duplicate Gemini spend or lose updates.
- REL-3: permanent-vs-transient error classification in the write-ahead queue; stop one permanent failure from blocking all later writes; surface a blocked-count badge.
- REL-4: `useAudioRecorder.stopRecording()` always settles (even on `db.audio.add` reject) and the recorded blob is retained for retry.

**Out of scope:** new cataloging features, UI redesign, changing the Gemini processing logic itself, photo-upload-queue rework (separate queue, not in REL list).
</domain>

<decisions>
## Implementation Decisions

### REL-2 — Cross-tab claim (concurrency)
- **D-01:** DB-atomic claim is the single source of truth. Claim via conditional Supabase update — `update items set ai_status='processing', claimed_at=now() where id=? and ai_status='queued'` using `.select()`; only the row-returning tab proceeds. Chosen over BroadcastChannel leader-election because the DB claim survives multi-tab **and** multi-process/multi-device, and a leader tab dying mid-process cannot strand work the way client-side election can.
- **D-02:** Stale-claim recovery: an item stuck in `ai_status='processing'` with `claimed_at` older than ~5 min is reclaimable (treated as `queued` again). Threshold ≈ 2× expected max processing time — tune during planning.
- **D-03:** No BroadcastChannel layer. DB claim alone makes duplicate Gemini calls structurally impossible; adding election is redundant code.
- **D-04 (schema):** Adds `claimed_at timestamptz null` to `items`. This is a cross-app schema event — see canonical refs; start from `../_workspace/Schema/schema.md`, not a local belief. Regenerate `src/db/database.types.ts` via `npm run db:types` after migration. `claimed_by` deliberately NOT added (debug-only; keep migration lean).

### REL-1 — Backoff + attempt persistence
- **D-05:** Attempt counter persisted server-side: add `ai_attempts int not null default 0` to `items`. Server-side (not Dexie-local) so counts stay consistent across tabs/devices and coordinate with the REL-2 claim. Same migration as D-04 → one migration, two columns total.
- **D-06:** Backoff window computed from `claimed_at + base·2^ai_attempts` with full jitter; base 5s, cap 5min (exact constants finalized in planning). Drain skips any item still inside its backoff window instead of re-processing on every `online` flip — kills the retry-storm.
- **D-07:** Attempt cap = 5. On exceeding the cap, mark `ai_status='failed'` (permanent) — this feeds the REL-3 blocked-count badge. Replaces the current `MAX_RETRIES=2` immediate-retry loop in `offlineQueue.ts`.

### REL-3 — Error classification + blocked-queue UX
- **D-08:** Taxonomy — **permanent:** no-audio-for-item, 4xx validation/auth from Gemini, unsupported format. **transient:** offline, 5xx, 429 rate-limit, request timeout.
- **D-09:** Write-ahead queue behavior — on **permanent** failure, drop the failing entry plus its dependent same-item entries and continue draining the rest; on **transient** failure, halt-and-backoff (preserve FIFO, since later updates depend on earlier inserts succeeding). Replaces the current unconditional `break` on first failure in `useWriteAheadQueue.ts`.
- **D-10:** Blocked-count badge rendered in the AppLayout header next to `OfflineIndicator`; click/tap → detail list of blocked items. Reuse the existing `Badge` primitive (`tone="err"`).

### REL-4 — Recorder settle contract
- **D-11:** Keep the `stopRecording(): Promise<number | undefined>` signature — rejecting would force try/catch on every caller (larger blast radius, rejected).
- **D-12:** On `db.audio.add` reject: retry the add 2× (IndexedDB failures are usually transient/quota), then **always settle** — resolve `undefined`, set recorder error state, and stash the blob in `recordingStore` for manual re-save. Eliminates the hang where `onstop`'s catch only `console.error`s and the promise never resolves.

### Claude's Discretion
- Exact backoff constants (base/cap/jitter shape) and the stale-claim threshold value — pick sensible defaults during planning, surface in tests.
- Internal structure of the blocked-items detail view (list vs expandable) and the retry-buffer shape inside `recordingStore`.
- Whether the offline-queue drain and write-ahead drain share a common backoff/classification helper module (DRY) or stay separate.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema (cross-app — mandatory for the migration)
- `../_workspace/Schema/schema.md` — canonical Supabase schema; `items.ai_status` enum (`pending|processing|done|failed|queued`) at line ~65 already includes `processing`. New columns `claimed_at`, `ai_attempts` go here FIRST.
- `../_workspace/Schema/migrations.md` — cross-app migration log; record the new migration here.
- `../CLAUDE.md` §"Schema = single source of truth" — the 4-step schema-change protocol (update schema.md → add migration SQL → regenerate database.types.ts → A4 drift check).
- `src/db/database.types.ts` — regenerate via `npm run db:types` after migration.

### Phase source
- `.planning/ROADMAP.md` — Phase 33 requirement definitions REL-1..REL-4 + test criteria + risk note.

### Code touchpoints (read before planning)
- `src/services/offlineQueue.ts` — REL-1/REL-2 core: `draining` module-level mutex (per-tab only), `CONCURRENCY=4`, `MAX_RETRIES=2`, `processWithRetry`, `drainQueue`.
- `src/hooks/useWriteAheadQueue.ts` — REL-3 core: `processWriteAheadQueue` with `break`-on-first-failure at line ~66.
- `src/hooks/useAudioRecorder.ts` — REL-4 core: `onstop` add at line ~187, catch at ~202; `stopResolveRef` settle path.
- `src/layouts/AppLayout.tsx` — `handleReconnect` drain orchestration (write-ahead → sessions → photos → audio) + `online` listener; badge mount point.
- `src/db/index.ts` — Dexie schema (`writeAheadQueue: "++id, createdAt"`, `audio: "++id, itemId"`); bump version if recorder retry-buffer needs a store.
- `src/services/photoUploadQueue.ts` — sibling queue with existing BroadcastChannel/CONCURRENCY usage; reference pattern only (NOT in scope to change).

### Workspace policy
- `../_workspace/AI/agents.md` — A4 schema-drift-checker (Checkpoint G) fires on schema/migration edits.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Badge` primitive (`src/ui/Badge.tsx`, `tone="err"`) — for the REL-3 blocked-count badge.
- `OfflineIndicator` (mounted in `AppLayout.tsx`) — co-location anchor for the blocked badge in the header.
- `recordingStore` (`src/stores/recordingStore.ts`) — already holds recorder state (`setLastSaved`, `setRecording`); extend for REL-4 blob retry buffer + error.
- `audioRecordsForItem` (`src/db/audioLookup.ts`) — DAT-7 union helper already used by `findAudioForItem`.
- `photoUploadQueue.ts` — existing BroadcastChannel + CONCURRENCY pattern to reference (do not modify).

### Established Patterns
- Module-level boolean mutex (`draining`, `processing`) dedupes drains **within a single tab only** — REL-2 must replace/augment this with the DB-atomic claim for cross-tab safety.
- `navigator.onLine` short-circuits inside loops (`offlineQueue` batch loop, `processWithRetry`) — backoff logic must integrate with these existing pause points.
- Drain order in `AppLayout.handleReconnect`: write-ahead → fetchSessions → photos → audio. Backoff/claim changes must not break this ordering invariant (items must exist server-side before AI updates them).
- `ai_status` lifecycle is the existing coordination primitive — REL-2 rides it (`queued`→`processing`→`done`/`failed`) rather than inventing a new state field.

### Integration Points
- Supabase `items` table — new `claimed_at` + `ai_attempts` columns; conditional-update claim; stale-claim reclaim query.
- Dexie `writeAheadQueue` store — REL-3 classification + selective drop/continue.
- Dexie `audio` store — REL-4 add-retry; possible new retry-buffer store (version bump) if blob can't stay in `recordingStore`.
</code_context>

<specifics>
## Specific Ideas

- One migration, two columns (`claimed_at`, `ai_attempts`) — keep it minimal; no `claimed_by`.
- Claim winner determined by `.select()` returning the row from the conditional update — idiomatic Supabase optimistic claim.
- Stale-claim threshold framed as ~2× max expected processing time (~5 min starting point).
- Backoff explicitly to kill the "retry storm on every online event" described in REL-1.
</specifics>

<deferred>
## Deferred Ideas

- `claimed_by` (per-instance/tab identifier) for observability/debugging — skipped to keep the migration lean; revisit if cross-tab debugging gets hard.
- Photo-upload-queue applying the same backoff/classification hardening — separate queue, not in REL-1..4; candidate for a future reliability pass.
- Shared backoff/error-classification helper module extracted across both queues — left to planner's discretion this phase, but a clean future refactor target.

None beyond the above — discussion stayed within phase scope.
</deferred>

---

*Phase: 33-offline-reliability*
*Context gathered: 2026-06-01*
