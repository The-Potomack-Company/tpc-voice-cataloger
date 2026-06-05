# Phase 36: ux-visibility-polish - Context

**Gathered:** 2026-06-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Make currently-silent failure paths **visible** and make new-session/import
**atomic**. Every error path that today fails console-only must produce a
visible toast or UI state. Scope is the Codex-flagged touchpoints listed in
ROADMAP Phase 36:

- Export failures (Codex #9, #10) → toast + retry
- New session / import not transactional (Codex #7, #8) → atomic with rollback
- Migration success copy false (Codex #2) → honest copy vs `partial` flag
- Silent fetch errors (Codex #27, #28) → catch-and-surface
- Admin role/account load silent failures (Codex #16–20) → ErrorToast path
- Raw login errors (Codex #21) → friendly copy

No new capabilities. UI/UX clarity + transactional correctness only.
Risk: low–medium (many small touchpoints).

</domain>

<decisions>
## Implementation Decisions

### Transaction strategy (new session / import — Codex #7, #8)
- **D-01:** Use **client-side rollback**, NOT a Supabase RPC. New session and
  import touch *both* Dexie (offline cache) and Supabase; an RPC only wraps the
  Supabase side and cannot unwind Dexie state. Orchestrate the inserts
  client-side, track what landed, and run compensating deletes on failure.
- **D-02:** On failure, surface via the DAT-4 ErrorToast path with a `retry`
  callback. Retry re-runs the same operation (see D-08).
- **D-03:** **No schema change in this phase.** A transactional RPC is the
  heavier, more-robust alternative — deferred to a phase where schema work
  already happens (38/39 territory). Keeping 36 schema-free preserves its
  low-risk posture.

### Toast concurrency / lifecycle
- **D-04:** Keep `notificationStore` **single-slot** (one active message).
  Many new touchpoints route through it, but simultaneous *distinct* errors are
  rare for a single-operator cataloger. Latest-message-wins.
- **D-05:** **Dedupe** — do not re-show a message identical to the currently
  displayed one (avoid flicker/spam).
- **D-06:** **Retryable toasts are sticky.** Drop the 6s auto-dismiss only when
  a `retry` callback is attached, so a retry toast can't vanish before the user
  taps it. Informational (non-retry) toasts keep the existing 6s auto-dismiss.

### Migration success copy (Codex #2)
- **D-07:** Fix the false-success copy **now, standalone — decoupled from
  Phase 38.** DAT-1 already returns the `partial` flag; make the banner copy
  honest about partial state immediately (a correctness bug, not cosmetic).
  Phase 38 later *upgrades* the banner to add retry ("N items not yet synced —
  Retry"); Phase 36 only stops the banner from claiming success when partial.
  Do not block this fix on Phase 38.

### Retry semantics + error-copy mapping
- **D-08:** **Retry re-runs the operation wholesale.** Export is
  idempotent/read-only so re-running is safe; fetch retries simply refetch. No
  partial/targeted retry logic in this phase.
- **D-09:** Add one **central `toUserMessage(err)` helper** that maps known
  error shapes to friendly copy with a generic fallback:
  - Supabase auth JSON → `"Wrong email or password"` (Codex #21)
  - Network/fetch failure → `"Connection problem — try again"` (Codex #27, #28)
  - Unknown → generic fallback (e.g. `"Something went wrong"`)
  Raw Supabase/JSON error text must never reach the user. All touchpoints
  (login, fetch, admin load, export) funnel through this helper so copy stays
  consistent.

### Claude's Discretion
- Exact friendly-copy wording per error class (within the spirit of D-09).
- Where `toUserMessage` lives (`src/services/` vs `src/lib/`) — planner's call.
- Admin load (#16–20) and silent fetch (#27, #28) reuse the same notify path;
  exact call sites are an implementation detail.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase definition
- `.planning/ROADMAP.md` (Phase 36 block) — the 6 Codex-flagged touchpoints and
  the test requirement ("each error path produces a visible toast/state; no
  console-only failures").

### Existing error-surface infrastructure (reuse — DAT-4)
- `src/stores/notificationStore.ts` — `notifyError(message, retry?)` / `dismiss`
  / `message` / `retry`. Single-slot Zustand store. D-04/05/06 modify this.
- `src/components/ErrorToast.tsx` — renders the active message + optional Retry
  button; currently 6s auto-dismiss (D-06 makes retryable toasts sticky).
- `src/layouts/AppLayout.tsx:121` — ErrorToast mount point (already global).

### Sequencing dependency
- `.planning/ROADMAP.md` (Phase 38: migration-retryability) — owns the *upgraded*
  migration banner with retry. Phase 36 only fixes the false-success copy
  (D-07); do not implement Phase 38's retry banner here.

No external ADRs/specs drive this phase — decisions above are self-contained.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `notificationStore.notifyError(msg, retry?)` — the single channel every new
  error path should call. No new toast system needed.
- `ErrorToast` — already mounted globally in AppLayout; supports an optional
  Retry button keyed on the store's `retry` callback.

### Established Patterns
- Errors are surfaced via Zustand store → global toast (set by DAT-4). Phase 36
  extends coverage to the silent paths; it does not introduce a new pattern.
- Services in `src/services/*` (gemini, adminApi, audioUploadQueue, etc.) are
  the catch points where silent failures currently die console-only.

### Integration Points
- Export flow, NewSession/import flow, admin role/account load, auth/login, and
  the fetch paths flagged by Codex all connect to `notifyError`.
- `toUserMessage(err)` (new, D-09) sits between caught errors and `notifyError`.

</code_context>

<specifics>
## Specific Ideas

- User pre-approved all four recommendations ("surface recs and I'll probably
  go with them" → "Lock all 4"). Decisions reflect the recommended defaults,
  calibrated to keep this a low-risk, schema-free polish phase.

</specifics>

<deferred>
## Deferred Ideas

- **Transactional RPC for session/import** — the DB-level-atomic alternative to
  D-01's client rollback. Revisit when a phase is already doing schema work.
- **Multi-toast queue / stacking** — if concurrent distinct errors become a real
  problem, upgrade `notificationStore` from single-slot to a queue. Not needed
  now (D-04).
- **Phase 38 migration retry banner** — "N items not yet synced — Retry" lives
  in Phase 38, not here (D-07).

None outside phase scope surfaced during discussion.

</deferred>

---

*Phase: 36-ux-visibility-polish*
*Context gathered: 2026-06-01*
