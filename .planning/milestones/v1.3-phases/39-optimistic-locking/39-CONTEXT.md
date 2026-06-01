# Phase 39: optimistic-locking - Context

**Gathered:** 2026-06-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Add database-enforced optimistic concurrency to `items` writes so concurrent writers (a live user edit racing an AI continuous-mode merge write) cannot silently drop each other's changes.

Delivers:
- An `items.updated_at` column + auto-bump `BEFORE UPDATE` trigger.
- `updateItemField` and the AI merge path read `updated_at` and write with an `.eq("updated_at", <prev>)` precondition; a 0-row result means conflict → re-read + reconcile instead of last-writer-wins.
- Per-writer reconcile policy: user single-field edits re-apply (intent-preserving); the AI merge re-reads and must NOT overwrite a field the user changed since the merge's read.
- Conflicts that can't be auto-reconciled surface via the existing ErrorToast.

Does NOT deliver: cross-tab/cross-device proactive sync (deferred — see Deferred Ideas), multi-user real-time collaboration (out of project scope).
</domain>

<decisions>
## Implementation Decisions

### Trigger & version token (decided by reuse — not re-asked)
- **D-01:** Reuse the existing generic `set_updated_at()` plpgsql function (`supabase/migrations/20260421000000_create_updated_at_trigger.sql`, already attached to `crm_threads` in `20260520120000`). Add a new migration that (a) adds `items.updated_at timestamptz not null default now()` and (b) attaches a `BEFORE UPDATE` trigger to `items` using `set_updated_at()`. Mirror the `crm_threads_updated_at` trigger as the template. No `moddatetime` extension — the custom fn already exists.
- **D-02:** Use `updated_at` (timestamptz) as the precondition/version token, per ROADMAP. Accept the rare same-microsecond-collision edge; do NOT introduce a separate integer `version` column or `xmin`. (xmin noted as the fallback only if µs-collisions ever prove real — not now.)
- **D-03:** Backfill `updated_at` for existing rows in the same migration (default `now()` covers new rows; set existing rows to `coalesce(created_at, now())`). Regenerate `src/db/database.types.ts` via `npm run db:types` after the migration. Update `../_workspace/Schema/schema.md` (cross-app schema event).

### Offline write-ahead queue interaction (Area A)
- **D-04:** Capture the item's `updated_at` snapshot at **enqueue** time into the Dexie `writeAheadQueue` payload. On flush, apply the `.eq("updated_at", <snapshot>)` precondition; a 0-row result routes through the **same reconcile path as online writes**. For a queued user field-edit that means re-apply (intent-preserving) so offline edits are not lost on reconnect.
- **D-05:** The precondition/reconcile logic must compose with **Phase 33** (offline-reliability: queue backoff + attempt-cap + cross-tab claim — sibling phase, not yet built). Sequencing flag: if Phase 33 reworks the queue drain, coordinate so the precondition isn't bypassed. Not a blocker for 39.

### AI-merge clobber guard (Area B)
- **D-06:** Per-field compare-and-skip. The AI merge (`mergeFieldsIntoItem`) records the field values it read at merge start. On a write conflict (0-row), re-read the item and, per field the merge wants to write, compare the current DB value to the value-at-read: if it differs, the user changed it → **skip that field**; otherwise re-apply with the fresh `updated_at` precondition. No extra Gemini round-trip. Rejected alt: abort + re-run the full Gemini merge (costs latency + tokens).

### User-edit conflict flow (Area C)
- **D-07:** Bounded read-modify-reapply: up to **3** attempts of (re-read → re-apply the user's field value → write with fresh precondition). Silent on success — no toast for a successfully re-applied edit. On exhaustion, surface `ErrorToast` via `notificationStore.notifyError(message, retry)` with a Retry callback. This same 3× bound caps the AI-merge reconcile loop (D-06) to prevent livelock.
- **D-08:** User-vs-user concurrent edits are out of scope (small team, no real-time collab per PROJECT.md Out of Scope). The single-field user edit always re-applies (last human intent wins for that field); the guard that matters is AI-yields-to-user (D-06).

### Cross-tab / device version check (Area D)
- **D-09:** Out of scope for Phase 39. The DB-level precondition already prevents cross-tab/device **silent loss** (any tab's stale write 0-rows and reconciles). Proactive cross-tab refresh/broadcast is an optimization owned by Phase 33 (cross-tab claim/coordination). Captured as a deferred idea.

### Claude's Discretion
- Exact migration filename/timestamp, error message copy for the exhaustion toast, and where the value-at-read snapshot is threaded through `mergeFieldsIntoItem` are left to planning/implementation, provided they honor D-01..D-09.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & requirements
- `.planning/ROADMAP.md` (Phase 39 entry, lines ~152-159) — locks the trigger + precondition-write + reconcile direction, per-writer policy, ErrorToast surfacing, and HIGH-RISK test bar.
- `.planning/PROJECT.md` — milestone scope, architecture (Supabase server-authoritative for item metadata; Dexie = blobs only), Out-of-Scope (no real-time collab).

### Cross-app schema (MANDATORY — shared Supabase)
- `../_workspace/Schema/schema.md` — canonical schema; MUST update here first for the `items.updated_at` add (cross-app event per CLAUDE.md schema-as-SSoT).
- `../_workspace/Schema/migrations.md` — cross-app migration log; record the new migration.

### Existing code touchpoints (from scout)
- `src/stores/sessionStore.ts:411-490` — `updateItemField` core impl; write at `:428-431` is current last-writer-wins; offline enqueue at `:437-441`.
- `src/db/items.ts:13-22` — `updateItemField` wrapper delegating to the store.
- `src/services/geminiContinuous.ts:207-249` — `mergeFieldsIntoItem` (per-field AI merge loop).
- `src/hooks/useWriteAheadQueue.ts:9-72` — Dexie write-ahead enqueue (`:9-22`) + FIFO flush (`:24-72`); payload currently carries no `updated_at`.
- `src/db/index.ts:104` — Dexie `writeAheadQueue` table def.
- `src/db/database.types.ts:339-361` — `items` Row type (currently no `updated_at`; only `created_at`).
- `supabase/migrations/20260421000000_create_updated_at_trigger.sql` — generic `set_updated_at()` fn to reuse.
- `supabase/migrations/20260520120000_create_crm_v05_tables.sql` — `crm_threads_updated_at` trigger = the template to mirror.
- `supabase/migrations/20260318000002_create_items.sql` — original `items` DDL (no `updated_at`).
- `src/components/ErrorToast.tsx` + `src/stores/notificationStore.ts:10-15` — DAT-4 conflict surface (`notifyError(message, retry?)`).

### Sibling-phase dependency
- ROADMAP.md Phase 33 (offline-reliability) — owns queue backoff/attempt-cap + cross-tab coordination; D-05 + D-09 defer to it.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `set_updated_at()` plpgsql fn + `crm_threads_updated_at` trigger: copy-paste template for the `items` trigger.
- `notificationStore.notifyError(message, retry)` + `ErrorToast`: ready conflict surface with a Retry affordance — no new UI needed.
- Dexie `writeAheadQueue` + `useWriteAheadQueue`: extend payload with `updated_at`; reuse the existing FIFO drain.

### Established Patterns
- `items` metadata is Supabase server-authoritative; Dexie holds blobs only — the precondition lives at the Supabase write, not in Dexie.
- AI merge already writes per-field via `updateItemField` (not whole-row) — per-field compare-and-skip (D-06) fits the existing loop with no restructure.
- Smart field merging (v1.1) already passes existing values to the AI as context; the value-at-read snapshot needed for D-06 overlaps with what the merge already reads.

### Integration Points
- New precondition + reconcile wraps the single `supabase.from("items").update(...).eq("id",...)` call in `sessionStore.ts:428-431` and the queue flush in `useWriteAheadQueue.ts:38-46`.
- Migration + type regen + `_workspace/Schema/schema.md` update form the schema-change triad (Claude-owned per D-046; Codex barred from supabase/ + schema).

</code_context>

<specifics>
## Specific Ideas

- Core test the roadmap demands: a live user single-field edit racing an AI continuous-mode chunk write must NOT silently lose the user's edit — drive UAT from this exact race.
- Offline variant: an offline user edit that flushes after a server-side change to the same item must re-apply (not vanish, not clobber unrelated fields).

</specifics>

<deferred>
## Deferred Ideas

- **Proactive cross-tab/device version check** (broadcast or Supabase realtime sub on the open item to refresh `updated_at` before the user edits stale data) — belongs to Phase 33 (cross-tab claim/coordination). Correctness is already covered by the DB precondition; this is a UX optimization.
- **Dedicated integer `version` column / `xmin` token** — only if same-microsecond `updated_at` collisions ever prove real in practice. Not now.

</deferred>

---

*Phase: 39-optimistic-locking*
*Context gathered: 2026-06-01*
