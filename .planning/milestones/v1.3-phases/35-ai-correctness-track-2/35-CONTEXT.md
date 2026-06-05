# Phase 35: ai-correctness-track-2 - Context

**Gathered:** 2026-06-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the Gemini cataloging pipeline **deterministic, non-confabulating, retry-safe, and visibly-failed**. Four narrow correctness fixes to the existing AI extraction path:

1. Deterministic output (`temperature=0`).
2. Confabulation guard (reject invented fields on empty/unintelligible audio).
3. No-clobber on AI retry (a user-edited field survives a retry).
4. List-view failure visibility (the Phase-31 detail banner reflected on the item card).

**Out of scope:** general cross-writer concurrency / optimistic locking (that is Phase 39, DAT-3, `items.updated_at` trigger). Phase 35's no-clobber is **retry-specific only** and must not introduce the `updated_at` precondition machinery Phase 39 owns.

</domain>

<decisions>
## Implementation Decisions

User selected "go with your recommendations for all" — these are Claude-recommended calls, each with one-line rationale.

### Determinism
- **D-01:** Set `temperature: 0` in `generationConfig` on **both** AI paths — single-shot `src/services/gemini.ts:249` and continuous `src/services/geminiContinuous.ts:160`.
- **D-02:** Do **not** add `seed` (unreliable on `gemini-2.5-flash` REST). `topP`/`topK` left default — `temperature=0` greedy decoding is sufficient for deterministic snapshot tests. *Rationale: extra sampling knobs add config noise without a guaranteed determinism gain over greedy decoding.*

### Confabulation guard
- **D-03:** Transcript-emptiness gate. After Zod validation, if the model returns a null / whitespace / unintelligible `transcript`, **reject the whole response**: write no catalog fields and set `ai_status="failed"`. *Rationale: empty audio that yields a title/estimate is hallucination; failing honestly (and surfacing via the visibility work in this same phase) beats persisting invented data. A whole-response gate on transcript-emptiness is crisper than trying to define "clearly empty" per field.*
- **D-04:** Zod schema stays the structural validator; the confab gate is a post-validation guard layered on top. Existing `.nullable()` + "null if not mentioned" describe text on `catalogFieldsSchema` is the prompt-side half and stays.

### No-clobber retry guard
- **D-05:** Track per-field **user-edited provenance client-side in Dexie** (not Supabase). Flag a field as user-owned when `updateItemField` writes it; the retry write-back in `processAudioWithAi` **skips any flagged field**. *Rationale: satisfies "user-edited field survives a retry" with no Supabase schema change and without touching Phase 39's `updated_at` optimistic-locking lane. Retry-scoped by construction.*
- **D-06:** The existing D-02 smart-merge context (current field values passed to the model as merge data) stays, but it is **not** the no-clobber mechanism — the hard skip-on-flag guard is. Prompt-merge-only was rejected as insufficient (model can still rewrite a field).

### List-view failure visibility
- **D-07:** Promote the small `<Badge tone="err">Failed</Badge>` (`src/components/ItemCard.tsx:185`) to a **full-width inline warning row** on the failed card — icon + "AI processing failed" copy + the existing Retry CTA — mirroring the detail-view `AiFailureBanner` (`src/pages/ItemEntry.tsx:33`). Renders only when `ai_status === "failed"`.
- **D-08:** Reuse the existing `processAudioWithAi(latestAudioId, item.id, sessionId)` retry handler already wired in `ItemCard` (`handleRetryAi`, line 63). No new retry plumbing.

### Claude's Discretion
- Exact Dexie storage shape for the per-field user-edited flags (D-05) — researcher/planner to choose (e.g., a `userEditedFields` set on the local item record vs a sibling table). Constraint: must survive offline and clear appropriately on a fresh AI success.
- Exact visual treatment of the card warning row (D-07) — match existing token palette (`text-err`, badge tones) and the detail banner's layout.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### AI pipeline (where the changes land)
- `src/services/gemini.ts` — single-shot `processAudioWithAi`; `generationConfig` at :249, write-back merge at :316-352. Target for D-01, D-03, D-05.
- `src/services/geminiContinuous.ts` — continuous-mode path; `generationConfig` at :160. Target for D-01 (and D-03 if continuous chunks share the confab risk).
- `src/services/geminiSchema.ts` — `catalogFieldsSchema` (Zod, nullable fields). Target for D-04.

### Failure-surface reuse
- `src/pages/ItemEntry.tsx` §`AiFailureBanner` (line 33) — the Phase-31 detail-view banner to mirror on the list card (D-07).
- `src/components/ItemCard.tsx` — list card; existing `Failed` badge (:185) + `handleRetryAi` (:63). Target for D-07/D-08.

### Edit path (no-clobber)
- `src/db/items.ts` §`updateItemField` (line 13) — the user-edit write path to instrument for provenance flagging (D-05).

### Boundary / coordination
- `.planning/ROADMAP.md` — Phase 35 (this phase) and Phase 39 (optimistic-locking; the line Phase 35 must NOT cross).
- `../_workspace/Schema/schema.md` — `items` table source of truth. Confirm NO schema change is introduced (D-05 is client-side); regen `src/db/database.types.ts` only if that assumption breaks.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AiFailureBanner` (`src/pages/ItemEntry.tsx:33`): the detail-view failure banner — copy its structure/copy/retry wiring onto the list card.
- `handleRetryAi` / `processAudioWithAi` (`ItemCard.tsx:63`): retry already wired on the card; reuse, don't rebuild.
- `updateItemField` (`src/db/items.ts:13`): single choke point for user edits — ideal place to set the per-field user-edited flag.
- `catalogFieldsSchema` (`geminiSchema.ts`): already nullable with "null if not mentioned" describe text — confab guard builds on this, doesn't replace it.

### Established Patterns
- Write-back is conditional-on-non-null then unconditional `.update().eq("id")` (`gemini.ts:316-352`) — D-05's skip guard inserts here, filtering flagged fields out of `supabaseUpdate`.
- `ai_status` state machine (`queued`/`processing`/`done`/`failed`) drives all failure UI — D-03 sets `failed`, D-07 reads it.

### Integration Points
- D-03 reject path joins the existing `ai_status: "failed"` write (`gemini.ts:376-388`).
- D-05 reads Dexie provenance inside `processAudioWithAi` before building `supabaseUpdate`.
- D-07 is purely presentational in `ItemCard`, gated on `isFailed`.

</code_context>

<specifics>
## Specific Ideas

- The card warning row should read like the detail banner ("AI processing failed" + Retry), not a terse badge — consistency across list and detail views was the explicit goal.
- No `seed`; no Supabase schema change; no `updated_at` — these are hard "stay in your lane" constraints relative to Phase 39.

</specifics>

<deferred>
## Deferred Ideas

- General cross-writer / cross-device concurrency conflict handling (user edit racing a continuous-mode AI chunk write) → **Phase 39 (optimistic-locking, DAT-3)**. Phase 35 only guards the user-initiated retry case.
- Migration partial-state retry → Phase 38. Export/error-toast visibility → Phase 36. Not touched here.

None other — discussion stayed within phase scope.

</deferred>

---

*Phase: 35-ai-correctness-track-2*
*Context gathered: 2026-06-01*
