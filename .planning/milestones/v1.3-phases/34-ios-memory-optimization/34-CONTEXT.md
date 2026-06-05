# Phase 34: ios-memory-optimization - Context

**Gathered:** 2026-06-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Reduce peak memory on the hot recording/AI paths so the iOS PWA tab stops OOM-ing
during normal cataloging. Three targets from ROADMAP (PERF-1/2/3):

- **PERF-1:** `blobToBase64` holds multiple full copies of multi-MB audio in memory.
- **PERF-2:** continuous-mode master blob grows unbounded (continuous is gated off — D-050).
- **PERF-3:** `ItemCard` runs 2 live Dexie subscriptions + 2 async effects per card × N items → re-render storm during recording.

This phase optimizes existing behavior only. No new cataloging features, no schema
changes, no auth work, no new npm deps (project guardrails).
</domain>

<decisions>
## Implementation Decisions

### PERF-1 — Audio encode strategy
- **D-01:** Fix in-place with **chunked base64 encode** this phase. Replace the
  per-byte `String.fromCharCode` accumulation loop in
  [src/services/gemini.ts:135](../../../../src/services/gemini.ts) with a
  fixed-chunk encoder (e.g. 32 KB windows: `btoa(String.fromCharCode(...chunk))`
  concatenated), eliminating the multi-MB intermediate binary string.
- **D-02:** Drop the `freshBlob = new Blob([blob], …)` re-wrap copy unless a
  test proves the structured-clone edge case still bites — it adds a full copy
  on the hot path. If kept, document why with a WHY-comment.
- **D-03:** **Do NOT** move to out-of-band Gemini Files API upload in this phase.
  The true OOM-proof fix (stream-upload blob, pass only a file URI inline) touches
  the proxy contract, which is migrating from the in-repo Cloudflare Worker to the
  shared tpc-ai-proxy Cloud Run service in **Phase 40 (D-056)**. Land Files API
  there so the upload endpoint ships with the new proxy. Captured as a deferred idea.
- **Same fix applies** to the duplicate `blobToBase64` in
  `src/services/geminiContinuous.ts` (shared helper preferred over two copies),
  but continuous is gated off (see PERF-2) — at minimum, route both through one
  chunked encoder so the fix isn't lost when continuous is re-enabled.

### PERF-2 — Continuous master-blob scope
- **D-04:** **Defer.** Continuous mode is disabled (D-050) and ROADMAP marks this
  lower-priority. No master-blob rework this phase. Leave a tracked TODO/deferred
  note so it's picked up alongside the continuous-mode rework. (The chunked-encode
  fix from D-03 still flows through the continuous path if it shares the helper.)

### PERF-3 — Hoist Dexie subscriptions
- **D-05:** Introduce a **session-level provider** mounted in `ItemList` scope that
  runs **one** aggregate `useLiveQuery` over the session's items and returns a
  per-item meta map (keyed by item id): `{ audioCount, latestAudioId, photoCount,
  dexieItemId, isPending }`. This collapses 4 subscriptions/effects × N cards into
  one subscription.
- **D-06:** `ItemList` reads each item's slice from the provider and **passes it as
  a prop** to `ItemCard` (ROADMAP wording). `ItemCard` becomes prop-driven/"dumb"
  for these values — no live queries or async effects of its own for audio/photo/
  pending/dexieId. Keep local UI state (delete-confirm, retrying) in the card.
- **D-07:** Provider must handle house-mode-only photo counts (current logic skips
  photo count for non-house mode) and the `getDexieItemId` mapping in the aggregate.

### Verification method
- **D-08:** **Render-count is the CI-testable win.** Add a dev-only render counter
  to `ItemCard` (guarded by a dev flag, no-op in prod) and a Vitest component test
  asserting that an `ai_status`/recording-state change on one item does **not**
  re-render the other N-1 cards (target ~Nx drop).
- **D-09:** **Memory is a manual smoke**, not CI. `performance.measureUserAgentSpecificMemory()`
  is Chromium-only and requires cross-origin isolation (COOP/COEP) — it will **not**
  run on the actual iOS Safari target. Document a two-part procedure: (a) desktop
  Chrome heap snapshot before/after a 5-minute single-mode session showing bounded
  growth, (b) iOS Safari Web Inspector JS-heap timeline as the real-device check.
  Note the COOP/COEP caveat in the runbook; if the PWA isn't cross-origin isolated,
  the `measureUserAgentSpecificMemory()` path is unavailable and only the Web
  Inspector timeline applies on-device.

### Claude's Discretion
- Exact chunk size for the base64 encoder (32 KB is a starting point; tune if a
  test shows a better peak/throughput tradeoff).
- Provider shape (React context vs. lifted state passed through `ItemList`) — keep
  it minimal; the contract is "one subscription, slice-as-prop".
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase definition
- `.planning/ROADMAP.md` — Phase 34 entry (PERF-1/2/3 spec, tests, risk).

### Decisions
- `../_workspace/Decisions/D-050-disable-continuous-mode-pending-rework.md` — continuous mode is gated off; basis for deferring PERF-2.
- `../_workspace/Decisions/D-056-cataloger-ai-proxy-cloud-run-migration.md` — proxy moves to Cloud Run in Phase 40; basis for deferring PERF-1 Files API.
- `../_workspace/Decisions/D-047-continuous-recording-d037-exception.md` — continuous recording scope/origin (context for PERF-2).

### Hot-path code
- `src/services/gemini.ts` §`blobToBase64` (line ~135) + `processAudioWithAi` inline payload — PERF-1 target.
- `src/services/geminiContinuous.ts` — duplicate base64 path; share the chunked encoder.
- `src/components/ItemCard.tsx` (lines ~36–83) — 2 live queries + 2 effects to hoist.
- `src/components/ItemList.tsx` (line ~301) — render site; provider mounts here.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useSessionStore` (Zustand) already drives item-list state — the new aggregate
  provider can sit alongside or fold into the session-store layer rather than a
  standalone context, if cleaner.
- `audioRecordsForItem`, `getDexieItemId`, `hasPendingForItem` (used per-card today)
  become the building blocks of the aggregate query — call them once over the set.

### Established Patterns
- Dexie reads via `useLiveQuery` (dexie-react-hooks) with a default value — the
  aggregate should keep the same default-value pattern to avoid undefined flicker.
- AI processing is fire-and-forget from `processAudioWithAi(latestAudioId, …)`;
  the retry handler in `ItemCard` needs `latestAudioId` — must still arrive via the
  hoisted slice prop.

### Integration Points
- `ItemList` → `ItemCard` prop interface (`ItemCardProps`) gains the meta slice.
- Both `gemini.ts` and `geminiContinuous.ts` consume the chunked encoder.
</code_context>

<specifics>
## Specific Ideas

- Encoder: chunk the `Uint8Array` (~32 KB), `btoa` per chunk, join — avoid building
  one giant binary string and avoid the blob re-wrap copy.
- Provider returns a `Map<itemId, ItemMeta>`; `ItemList` does the lookup and spreads
  the slice as props so `ItemCard` has zero Dexie/async surface for these values.
</specifics>

<deferred>
## Deferred Ideas

- **Out-of-band Gemini Files API upload (PERF-1 structural fix)** — stream-upload the
  audio blob, pass only a file URI in the inline payload so the worker never holds a
  giant base64. Belongs in **Phase 40** alongside the Cloud Run proxy migration (D-056).
- **Continuous-mode master-blob rework (PERF-2)** — stream-append or
  segment-and-discard instead of re-materializing the growing blob every 15s append.
  Pick up when continuous mode is re-enabled (D-050 rework), not this phase.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.
</deferred>

---

*Phase: 34-ios-memory-optimization*
*Context gathered: 2026-06-01*
