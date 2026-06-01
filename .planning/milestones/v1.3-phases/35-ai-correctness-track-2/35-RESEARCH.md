# Phase 35: ai-correctness-track-2 - Research

**Researched:** 2026-06-01
**Domain:** Gemini extraction-pipeline correctness (determinism, confab guard, retry no-clobber, list-card failure visibility)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Set `temperature: 0` in `generationConfig` on **both** AI paths — single-shot `src/services/gemini.ts:267` and continuous `src/services/geminiContinuous.ts:165`. *(line numbers re-verified below — CONTEXT cites :249/:160 which are stale by a few lines)*
- **D-02:** Do **not** add `seed` (unreliable on `gemini-2.5-flash` REST). `topP`/`topK` left default — `temperature=0` greedy decoding is sufficient for deterministic snapshot tests.
- **D-03:** Transcript-emptiness gate. After Zod validation, if the model returns a null / whitespace / unintelligible `transcript`, **reject the whole response**: write no catalog fields and set `ai_status="failed"`.
- **D-04:** Zod schema stays the structural validator; the confab gate is a post-validation guard layered on top. Existing `.nullable()` + "null if not mentioned" describe text on `catalogFieldsSchema` is the prompt-side half and stays.
- **D-05:** Track per-field **user-edited provenance client-side in Dexie** (not Supabase). Flag a field as user-owned when `updateItemField` writes it; the retry write-back in `processAudioWithAi` **skips any flagged field**. No Supabase schema change; no `updated_at` machinery.
- **D-06:** The existing smart-merge context (current field values passed to the model) stays, but it is **not** the no-clobber mechanism — the hard skip-on-flag guard is.
- **D-07:** Promote the small `<Badge tone="err">Failed</Badge>` (`ItemCard.tsx:199`) to a **full-width inline warning row** — icon + "AI processing failed" + Retry CTA — mirroring the detail-view `AiFailureBanner` (`ItemEntry.tsx:33`). Renders only when `ai_status === "failed"`.
- **D-08:** Reuse the existing `processAudioWithAi(latestAudioId, item.id, sessionId)` retry handler in `ItemCard` (`handleRetryAi`, line 59). No new retry plumbing.

### Claude's Discretion
- Exact Dexie storage shape for the per-field user-edited flags (D-05). Constraint: must survive offline AND clear appropriately on a fresh AI success.
- Exact visual treatment of the card warning row (D-07) — match existing token palette (`text-err`, badge tones) and the detail banner's layout.

### Deferred Ideas (OUT OF SCOPE)
- General cross-writer / cross-device concurrency conflict handling (user edit racing a continuous-mode AI chunk write) → **Phase 39 (optimistic-locking, DAT-3)**. Phase 35 only guards the user-initiated retry case.
- Migration partial-state retry → Phase 38. Export/error-toast visibility → Phase 36.
- **No `items.updated_at` auto-bump trigger, no `seed`, no Supabase schema change** — hard "stay in your lane" constraints relative to Phase 39.
</user_constraints>

<phase_requirements>
## Phase Requirements

No REQ-IDs mapped (Track-2 quality track). Success criteria from ROADMAP.md §Phase 35 govern instead:

| SC | Behavior | Research Support |
|----|----------|------------------|
| SC-1 | Both AI paths set `temperature: 0`; deterministic-output snapshot test proves identical input → identical output | D-01 placement confirmed (single-line add to existing `generationConfig` object on each path) |
| SC-2 | Post-Zod confab guard rejects whole response (no fields written, `ai_status="failed"`) on null/whitespace/unintelligible transcript; confab-rejection test passes | D-03 insertion point confirmed at `gemini.ts:319` (post-`result.data`, pre-`supabaseUpdate`) |
| SC-3 | AI retry never overwrites a user-edited field; client-side Dexie provenance; no schema change | D-05 storage shape recommended below; choke point `updateItemField` confirmed Supabase-keyed UUID |
| SC-4 | `ItemCard` shows full-width inline AI-failure row mirroring detail banner, gated on `ai_status === "failed"` | D-07 source banner + card insertion site confirmed |
</phase_requirements>

## Summary

All four fixes land in **already-mapped, well-understood code paths**. There is no new library, no new infra, and (critically) no Supabase schema change required. The risk is entirely in getting three small details right: (1) where the confab guard sits relative to the existing Zod parse + `ai_status="failed"` write, (2) the Dexie provenance storage shape and its clear-on-success semantics, and (3) filtering flagged fields out of the `supabaseUpdate` object before `.update().eq("id")`.

The single most important grounding correction: **`updateItemField` and `processAudioWithAi` operate on Supabase items keyed by UUID string `itemId`, not on the Dexie `houseVisitItems`/`saleItems` tables** (those are legacy pre-migration stores). Therefore D-05's "Dexie provenance" must be a **new Dexie table keyed by the Supabase UUID `itemId`**, not a field added to a Dexie item record. This is the central architectural decision of the phase and is detailed below.

Verified against live Gemini docs: `temperature: 0` yields "mostly deterministic" output with a small residual variation, and `seed` is explicitly best-effort and breaks across model/param changes — confirming D-01/D-02 exactly. The `generationConfig` object already exists in both payloads; adding `temperature: 0` is a one-line change per path.

**Primary recommendation:** Add a dedicated Dexie table `userEditedFields` (v11 migration) keyed by `[itemId+field]`, set on every `updateItemField` write, read inside `processAudioWithAi` to filter `supabaseUpdate`, and **cleared for the item on a fresh successful non-retry AI write**. Insert the confab guard immediately after `const fields = result.data;` (gemini.ts:319) reusing the existing `ai_status:"failed"` catch path. Add `temperature: 0` to both `generationConfig` objects. Lift the detail-view `AiFailureBanner` into a shared component and render it on the card when `isFailed`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Deterministic generation (`temperature: 0`) | API / Backend (Gemini via proxy) | — | A model sampling param; lives in the request payload sent through the proxy |
| Confabulation guard (transcript-emptiness) | API / Backend (client service `gemini.ts`) | — | Post-response validation; belongs next to the existing Zod parse, before any DB write |
| User-edited provenance storage (D-05) | Database / Storage (Dexie, client-local) | — | Client-local, offline-durable, deliberately NOT Supabase (avoids cross-app schema event + Phase 39 lane) |
| No-clobber filter on retry | API / Backend (client service `gemini.ts`) | Database (reads Dexie provenance) | The skip logic gates the Supabase write; reads client-local provenance |
| List-card failure visibility (D-07) | Browser / Client (React component) | — | Pure presentation gated on `ai_status` already in the item row |

## Standard Stack

No new dependencies. All work uses libraries already in `package.json`.

### Core (already installed — versions verified in package.json)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `dexie` | ^4.3.0 [VERIFIED: package.json] | Client-local provenance table (D-05) | Already the app's offline store; v10 schema present, add v11 |
| `dexie-react-hooks` | ^4.2.0 [VERIFIED: package.json] | `useLiveQuery` reactive reads (detail banner already uses it) | Already used for `latestAudioId` in `AiFailureBanner` |
| `zod` | ^4.3.6 [VERIFIED: package.json] | Structural validation (stays per D-04); confab guard layers on top | Already the schema validator (`catalogFieldsSchema`) |
| `vitest` | ^4.0.18 [VERIFIED: package.json] | All four test dimensions | Existing harness (`src/tests/gemini-pipeline.test.ts` is the template) |

### Alternatives Considered (D-05 storage shape)
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New Dexie table keyed `[itemId+field]` (**recommended**) | `userEditedFields: string[]` array on a Dexie item record | Rejected: the Dexie `houseVisitItems`/`saleItems` records are keyed by **integer** id and are legacy pre-migration; the live item identity is the Supabase **UUID**. There is no current Dexie record reliably keyed by that UUID to hang a field-set on. A dedicated table keyed by UUID is the clean fit. |
| New Dexie table | A single `Set<field>` per item in a JSON blob row | Workable, but a compound-index `[itemId+field]` table gives O(1) `.where` filtering and a trivial `.where("itemId").equals(id).delete()` clear-on-success. Recommended. |
| Dexie | Supabase column (`user_edited_fields jsonb`) | **Forbidden by D-05** — cross-app schema event + bleeds into Phase 39 lane. |

**Installation:** none. Schema bump only:
```ts
// src/db/index.ts — append after v10
db.version(11).stores({
  // ...all existing v10 stores unchanged...
  userEditedFields: "[itemId+field], itemId",
});
```
No `.upgrade()` needed (new empty table; absence of a flag === field not user-edited).

## Package Legitimacy Audit

No external packages installed this phase. All libraries used are pre-existing and pinned in `package.json` (`dexie`, `dexie-react-hooks`, `zod`, `vitest`). slopcheck gate N/A — nothing to install.

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────────┐
  user edits a field      │  updateItemField(itemId, sessionId, field)   │
  (ItemCard / ItemEntry)  │  src/db/items.ts:13 → store:411              │
        │                 └───────────────┬─────────────────────────────┘
        │                                 │ (D-05 write)
        ▼                                 ▼
  Supabase items.update          Dexie userEditedFields.put({itemId, field})
        │                                 │
        │                                 │  (provenance survives offline)
        │                                 ▼
        │                  ┌──────────────────────────────────────────────┐
  RETRY │                  │  processAudioWithAi(audioId, itemId, sessionId)│
  ──────┼─────────────────▶│  src/services/gemini.ts                       │
        │                  │   1. fetch audio + currentItem                │
        │                  │   2. POST proxy  {generationConfig.temperature:0} ◀── D-01
        │                  │   3. JSON.parse → catalogFieldsSchema.safeParse│
        │                  │   4. const fields = result.data               │
        │                  │   5. CONFAB GUARD ◀───────────────────── D-03 │
        │                  │      if transcript empty → ai_status=failed,   │
        │                  │      write NO fields, return                  │
        │                  │   6. read Dexie userEditedFields(itemId)       │
        │                  │   7. build supabaseUpdate, SKIP flagged ◀── D-05/D-06
        │                  │   8. supabase.items.update(...).eq("id")      │
        │                  │   9. on fresh non-retry success → clear flags  │
        │                  └──────────────────────────────────────────────┘
                                          │
                                          ▼ (ai_status drives UI)
                          ┌─────────────────────────────────────────────┐
                          │  ItemCard (isFailed) → <AiFailureRow/> ◀── D-07│
                          │  mirrors ItemEntry AiFailureBanner            │
                          └─────────────────────────────────────────────┘
```

### Pattern 1: Confab guard as post-parse early-return reusing the failed path (D-03)
**What:** After `const fields = result.data;` (gemini.ts:319), check transcript emptiness; if empty, set `ai_status="failed"` and return without building `supabaseUpdate`.
**When to use:** Single-shot path only (see continuous-path note below).
**Where exactly:** Insert between line 319 (`const fields = result.data;`) and line 321 (the `applySpokenQuotes` safety-net loop). Reuse the existing terminal-failure write (gemini.ts:402-405 writes `{ ai_status: "failed" }`) — the cleanest implementation throws a sentinel error that the existing `catch` (gemini.ts:385) maps to `failed`, OR writes `failed` inline and returns. Recommend **throw a tagged non-transient error** so the existing `catch`/`isTransientNetworkError(false)` → `{ ai_status: "failed" }` path is reused verbatim (no duplicate write logic, and the analytics `ai.processing_failed` event fires for free).

**"Empty/whitespace/unintelligible transcript" defined concretely:**
```ts
function isTranscriptEmpty(t: string | null | undefined): boolean {
  return t == null || t.trim().length === 0;
}
```
The Zod schema already describes `transcript` as "null if audio is unintelligible" (geminiSchema.ts:31), so a well-behaved model returns `null` on empty audio. The guard catches both `null` and whitespace-only. Do NOT attempt content-quality heuristics (e.g., "is this gibberish") — D-03's rationale is explicitly that a crisp emptiness gate beats per-field "clearly empty" heuristics.

### Pattern 2: Dedicated provenance table, compound-key (D-05)
**What:** `userEditedFields` Dexie table, primary key `[itemId+field]`, secondary index `itemId`.
**Write (in `updateItemField`):** after a successful user edit, `await db.userEditedFields.put({ itemId, field })`. Note: `updateItemField` is also called internally by `mergeFieldsIntoItem` (continuous, geminiContinuous.ts:251) and the failed-save retry — see Pitfall 3 for why the flag must be set ONLY for genuine user edits, not AI-internal writes.
**Read (in `processAudioWithAi`):** `const flagged = new Set((await db.userEditedFields.where("itemId").equals(itemId).toArray()).map(r => r.field));` then guard each `supabaseUpdate.X = ...` assignment with `if (!flagged.has("X"))`.
**Clear-on-success:** on a **fresh (non-retry) successful AI write**, `await db.userEditedFields.where("itemId").equals(itemId).delete();` — see Pitfall 4 for the fresh-vs-retry distinction.

### Pattern 3: Shared failure banner lifted from ItemEntry (D-07)
**What:** Extract `AiFailureBanner` (currently a local function in `ItemEntry.tsx:33`) into a shared component (e.g. `src/components/AiFailureBanner.tsx`), accept `{ itemId, sessionId, latestAudioId }`, render the same `role="alert"` + `border-err`/`bg-err-wash` markup. Render in `ItemCard` when `isFailed`.
**Card specifics:** `ItemCard` already has `latestAudioId` as a prop, `isFailed`, and `handleRetryAi` (line 59). The detail banner derives `latestAudioId` itself via `useLiveQuery(audioRecordsForItem)`; the card already receives it as a prop, so the shared component should accept `latestAudioId` as a prop and the detail view passes its own `useLiveQuery` result. Same null-guard semantics (hide if no audio).

### Anti-Patterns to Avoid
- **Prompt-merge-only no-clobber:** explicitly rejected by D-06 — the model can still rewrite a field even when given current values as merge context. The hard skip-on-flag is the mechanism.
- **Reading `updated_at` / adding an `.eq("updated_at", prev)` precondition:** that is Phase 39. Forbidden here.
- **Writing provenance to Supabase:** cross-app schema event; forbidden by D-05.
- **Content-quality confab heuristics:** D-03 is transcript-emptiness only.
- **Duplicating the `ai_status="failed"` write:** reuse the existing catch path (gemini.ts:402) by throwing a tagged terminal error.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Failure banner UI | New banner markup on card | Lift existing `AiFailureBanner` (ItemEntry.tsx:33) | D-07's explicit goal is list/detail consistency |
| Retry plumbing | New retry handler | Existing `handleRetryAi`/`processAudioWithAi` (ItemCard.tsx:59) | D-08 |
| Failed-state write | New `ai_status` write in confab guard | Existing catch path (gemini.ts:402) via tagged throw | Single source of truth + free analytics event |
| Deterministic sampling | `seed`, custom retry-compare | `temperature: 0` only | D-02; seed is best-effort/brittle per Google docs |
| Provenance persistence | localStorage / Zustand-only | Dexie table | Must survive offline + reload; Dexie is the durable client store |

**Key insight:** Every piece of this phase has an existing twin to mirror. The work is wiring and placement, not invention.

## Runtime State Inventory

> Refactor-adjacent (adds a Dexie table + instruments a write path). Inventory of runtime state that a code change alone won't update:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Dexie `userEditedFields` is a **new** table — no existing data carries the old shape. Existing items have no provenance flags (correct default: unflagged === AI-owned). | New v11 store, no `.upgrade()` migration of existing rows. |
| Live service config | None — no external service holds phase-relevant state. The Gemini proxy forwards `generationConfig` verbatim; `temperature:0` is request-time only. | None. |
| OS-registered state | None. | None — verified (web app, no OS registrations). |
| Secrets/env vars | None changed. `VITE_GEMINI_PROXY_URL` unchanged; no new keys. | None. |
| Build artifacts | `src/db/database.types.ts` is generated from Supabase schema. **No Supabase schema change this phase (D-05)**, so NO `npm run db:types` regen needed. | None — verified: D-05 is client-side; `items` table untouched. |

**Supabase schema confirmation (D-05 stays client-side):** `../_workspace/Schema/schema.md` shows `items` already has `updated_at timestamptz not null default now()` (line 45) but the auto-bump trigger is on **`sessions`**, not `items` (line 356). Adding that trigger to `items` is precisely Phase 39's job (ROADMAP.md:157). Phase 35 introduces NO column and NO trigger. Verified.

## Common Pitfalls

### Pitfall 1: Provenance keyed on the wrong id (integer Dexie id vs Supabase UUID)
**What goes wrong:** Hanging the flag on the legacy Dexie item record (integer-keyed) means the live UUID-keyed item path can't find it; the no-clobber silently fails.
**Why it happens:** The app migrated to Supabase; `updateItemField`/`processAudioWithAi` use the UUID `itemId`, but the Dexie `houseVisitItems`/`saleItems` tables predate that and are integer-keyed.
**How to avoid:** Key the `userEditedFields` table on the Supabase UUID `itemId` (a string) — the same value `updateItemField` and `processAudioWithAi` already pass around. Never go through `idMapping`.
**Warning signs:** A user-edited-field-survives-retry test passes only for freshly-created-this-session items but fails for migrated items.

### Pitfall 2: Confab guard inserted after fields are already written
**What goes wrong:** If the guard sits after `supabaseUpdate` is built/sent, invented fields are already persisted.
**Why it happens:** The write-back block is long (gemini.ts:332-371); easy to drop the guard below it.
**How to avoid:** Guard goes at line 319, immediately after `const fields = result.data;` and before the `applySpokenQuotes` loop. Nothing touches the DB between parse and the guard.
**Warning signs:** Confab-rejection test sees a title/estimate persisted on empty-audio input.

### Pitfall 3: The provenance flag set by AI-internal `updateItemField` calls
**What goes wrong:** `mergeFieldsIntoItem` (continuous, geminiContinuous.ts:251) and the DAT-4 failed-save retry both call `store.updateItemField`. If the flag is set unconditionally in `updateItemField`, AI writes flag their own fields, then a later retry refuses to update them — the no-clobber guard fires against the AI itself.
**Why it happens:** `updateItemField` is a shared choke point used by both user edits and AI merge writes.
**How to avoid:** Set the flag **only for genuine user-originated edits**. The cleanest cut: set it in the public `updateItemField` wrapper in `src/db/items.ts:13` (the user-edit entry point that UI components call) rather than deep in the store action that AI paths also invoke. Verify the continuous merge path (`mergeFieldsIntoItem`) calls the store action directly (geminiContinuous.ts:251 calls `sessionStore.updateItemField`), NOT the `src/db/items.ts` wrapper — so flagging in the wrapper cleanly excludes AI writes. **The planner must confirm every UI edit site routes through `src/db/items.ts:updateItemField` and not the store action directly.**
**Warning signs:** A retry refuses to populate fields the user never touched; continuous-mode chunks stop merging after the first chunk.

### Pitfall 4: Flags never clear, or clear on the wrong event
**What goes wrong:** If flags persist forever, a user edit on item A permanently locks that field against ALL future AI runs (including a legitimately desired fresh re-record). If flags clear on every AI write (including retries), the no-clobber is defeated.
**Why it happens:** "Clear on success" is ambiguous between retry-success and fresh-success.
**How to avoid (per CONTEXT constraint "clear appropriately on a fresh AI success, not just on retry"):** Distinguish **fresh AI processing** (a new recording → new `processAudioWithAi` call where the prior `ai_status` was `pending`/no prior success) from a **retry** (re-running on existing audio after `failed`). Recommended signal: the existing `hasExistingData` flag (gemini.ts:240) already distinguishes a first extraction (`false`) from a merge/retry (`true`). On `!hasExistingData` success (first-ever extraction), clear the item's flags; on a retry merge, keep them. **Open question O-1 below** flags that `hasExistingData` is a proxy, not a perfect fresh/retry oracle — the planner should validate it against the desired UX.
**Warning signs:** Second-time-recording an item ignores the new audio for previously-edited fields; or, retry clobbers a user edit.

### Pitfall 5: Continuous path confab guard scope (D-03)
**What goes wrong:** Applying the whole-response transcript-emptiness reject to continuous chunks would reject legitimately silent chunks (a chunk with no new speech is normal in continuous mode, not a confabulation).
**Why it happens:** Continuous chunks routinely contain look-back-only or silent audio; an empty transcript there is expected, not a hallucination.
**How to avoid:** D-03's confab guard is **single-shot only**. CONTEXT (D-03 scope note) makes continuous conditional ("if continuous chunks share the confab risk"). They do NOT share it the same way — continuous is also gated OFF (D-050, referenced in gemini.ts:337). **Recommendation: scope the confab guard to `processAudioWithAi` (single-shot) only; do not add it to `processContinuousChunk`.** Document this as an explicit decision. `temperature: 0` (D-01) still applies to both paths.
**Warning signs:** Continuous sessions start marking valid chunks as failed.

## Code Examples

### D-01: temperature on both paths
```ts
// src/services/gemini.ts ~ generationConfig at :267 (CONTEXT says :249 — verify, code is :267)
generationConfig: {
  temperature: 0,               // D-01: greedy decoding for deterministic snapshots
  responseMimeType: "application/json",
  responseSchema: /* unchanged */,
},
```
```ts
// src/services/geminiContinuous.ts ~ generationConfig at :165 (CONTEXT says :160)
generationConfig: {
  temperature: 0,               // D-01
  responseMimeType: "application/json",
  responseSchema: responseSchemaForGemini(),
},
```

### D-03: confab guard (single-shot)
```ts
// src/services/gemini.ts — insert immediately after line 319 `const fields = result.data;`
if (isTranscriptEmpty(fields.transcript)) {
  // Reuse the terminal-failure path: throw a tagged non-transient error so the
  // existing catch (line 385) writes { ai_status: "failed" } and fires the
  // ai.processing_failed analytics event. No catalog fields are written.
  throw new ConfabRejectedError("Empty transcript — refusing to persist invented fields");
}
// isTransientNetworkError must return false for ConfabRejectedError so it maps to "failed", not "queued".
```
(`ConfabRejectedError` is a trivial `class extends Error`; `isTransientNetworkError` at gemini.ts:164 already returns false for non-network errors, so the default mapping is `failed` — verify the regex at :167 does not accidentally match the message.)

### D-05/D-06: read provenance, skip flagged fields
```ts
// src/services/gemini.ts — after `const fields = result.data;` and the confab guard,
// before building supabaseUpdate (~line 332):
const flagged = new Set(
  (await db.userEditedFields.where("itemId").equals(itemId).toArray()).map((r) => r.field),
);

// then each conditional assignment becomes (example for title):
if (fields.title !== null && !flagged.has("title")) {
  supabaseUpdate.title = toAllCaps(fields.title);
}
// ...repeat the !flagged.has(...) guard for description, condition, estimate,
//    category, measurements, transcript, receipt_number.

// On fresh (first-ever) extraction success, clear flags (see Pitfall 4):
if (!hasExistingData) {
  await db.userEditedFields.where("itemId").equals(itemId).delete();
}
```

### D-05: set provenance on user edit
```ts
// src/db/items.ts:13 — the user-edit wrapper (NOT the store action AI paths use)
export async function updateItemField(id, sessionId, field, value): Promise<void> {
  await useSessionStore.getState().updateItemField(id, sessionId, field, value);
  await db.userEditedFields.put({ itemId: id, field }); // D-05: flag user-owned field
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Default Gemini sampling (drift between identical retries) | `temperature: 0` greedy decoding | This phase | Deterministic-enough snapshots; small residual variation possible per Google docs (acceptable, no `seed`) |
| Small `Failed` badge on card | Full-width inline failure row mirroring detail banner | This phase (D-07) | List/detail visibility parity |
| Retry can clobber user edits | Client-side Dexie per-field provenance skip | This phase (D-05) | Retry-scoped no-clobber without touching Phase 39 lane |

**Deprecated/outdated:**
- `seed` for determinism on `gemini-2.5-flash`: best-effort only, breaks across param/model changes (Google docs + GitHub issue #745 on 2.5-pro). Correctly rejected by D-02.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `temperature: 0` placement inside the existing `generationConfig` object is honored by the proxy (proxy forwards `payload` verbatim) | D-01 | Low — proxy passes `{model, payload}` through; payload includes generationConfig already |
| A2 | All UI field-edit sites route through `src/db/items.ts:updateItemField`, not the store action directly | D-05 / Pitfall 3 | Medium — if a UI site calls the store action directly, its edits won't be flagged. Planner must grep-verify. |
| A3 | `hasExistingData` (gemini.ts:240) is an acceptable proxy for "fresh extraction vs retry" for the clear-on-success rule | Pitfall 4 / O-1 | Medium — affects whether flags clear at the right time; see O-1 |
| A4 | Continuous path should NOT get the confab guard (only `temperature:0`) | Pitfall 5 | Low — continuous is gated off (D-050); decision documented for re-enable |

## Open Questions

1. **O-1: Fresh-vs-retry signal for clearing provenance flags.**
   - What we know: CONTEXT requires flags clear "on a fresh AI success, not just on retry." `hasExistingData` (gemini.ts:240) distinguishes first extraction from merge.
   - What's unclear: whether `hasExistingData === false` is a precise enough oracle. Edge case: a user records, edits a field, then re-records the SAME item (fresh audio but `hasExistingData` is now `true`). Does the new recording's AI output get to overwrite the user's earlier edit, or is that edit still protected?
   - Recommendation: Treat "re-record same item" as a fresh user-initiated action that SHOULD clear flags (the user chose to re-record). If so, clearing only on `!hasExistingData` is too narrow. Planner should decide: clear on any **non-retry** invocation (i.e., any call originating from a new recording, distinguishable from `handleRetryAi`). Simplest robust signal: pass an explicit `isRetry` boolean into `processAudioWithAi` from `handleRetryAi`/`AiFailureBanner` (retry sites) vs the record-stop site (fresh). This is a small signature change but makes the clear-semantics exact. **Flag for discuss-phase if UX ambiguity matters.**

2. **O-2: `isTransientNetworkError` regex false-positive on the confab error message.**
   - What we know: the catch path maps non-transient errors to `failed` (desired). The regex at gemini.ts:167 matches `/abort|Load failed|Failed to fetch|NetworkError/i`.
   - What's unclear: ensure the `ConfabRejectedError` message contains none of those tokens (it won't if worded "Empty transcript — refusing to persist invented fields").
   - Recommendation: make the guard branch explicit on error type rather than relying on message wording — add `if (error instanceof ConfabRejectedError) return { ai_status: "failed" }` ahead of the transient check.

## Environment Availability

No external runtime dependencies introduced. All work is client TypeScript + an existing Vitest harness + an existing Dexie store + the existing Gemini proxy. Skipping detailed table: nothing to probe.

## Validation Architecture

Nyquist validation is enabled (`workflow.nyquist_validation: true`). Test framework and the four required dimensions below.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 [VERIFIED: package.json] |
| Config file | `vite.config.ts` (Vitest config co-located) |
| Quick run command | `npx vitest --run src/tests/gemini-pipeline.test.ts` |
| Full suite command | `npm test` (`vitest --run`) |

**Template to copy:** `src/tests/gemini-pipeline.test.ts` already mocks `../lib/supabase` (hoisted `mockFrom`/`mockUpdate`/`mockEq`) and `../stores/sessionStore`, stubs `VITE_GEMINI_PROXY_URL`, dynamically imports `processAudioWithAi`, and provides a `mockGeminiResponse(fields)` helper that wraps fields in the Gemini `candidates[0].content.parts[0].text` envelope. All four new tests extend this file or sit beside it. Dexie (`db.audio`, and now `db.userEditedFields`) is real in tests (fake-indexeddb via the existing setup) — assert on it directly.

### Phase Requirements → Test Map
| SC | Behavior | Test Type | Automated Command | File Exists? |
|----|----------|-----------|-------------------|-------------|
| SC-1 | Identical mocked input → identical `supabaseUpdate` across two `processAudioWithAi` calls; and `temperature:0` present in the proxy request body | unit | `npx vitest --run src/tests/gemini-determinism.test.ts` | ❌ Wave 0 |
| SC-2 | Empty/whitespace/null transcript → `ai_status:"failed"`, ZERO catalog-field keys written, `ai.processing_failed` event fired | unit | `npx vitest --run src/tests/gemini-confab-guard.test.ts` | ❌ Wave 0 |
| SC-3 | User flags `title` (via `db.userEditedFields.put`), retry returns a new title → `supabaseUpdate` omits `title`, includes other fields; and fresh extraction clears flags | unit | `npx vitest --run src/tests/gemini-no-clobber.test.ts` | ❌ Wave 0 |
| SC-4 | `ItemCard` with `ai_status:"failed"` renders the inline failure row (role=alert, Retry button); not rendered for other statuses | component (jsdom) | `npx vitest --run src/tests/item-card-ai-failure.test.tsx` | ❌ Wave 0 (mirror `item-card-audio-status.test.tsx`) |

### Sampling Rate
- **Per task commit:** the single new test file for that task (e.g. `npx vitest --run src/tests/gemini-confab-guard.test.ts`).
- **Per wave merge:** `npx vitest --run src/tests/gemini-*.test.ts src/tests/item-card-*.test.tsx`.
- **Phase gate:** `npm test` green before `/gsd:verify-work`.

### Dimension detail
1. **Deterministic-output snapshot (SC-1):** assert the proxy `fetch` body parses to a payload whose `generationConfig.temperature === 0` (both paths), and that two identical mocked runs produce identical `mockUpdate` argument objects. Snapshot the `supabaseUpdate`.
2. **Confab-rejection (SC-2):** mock a Gemini response with `transcript: null` (and a separate case `transcript: "   "`) plus a populated `title`/`estimate`; assert the only Supabase write is `{ ai_status: "failed" }` and no `title`/`estimate` write occurred.
3. **User-edited-field-survives-retry (SC-3):** seed `db.userEditedFields` with `{itemId, field:"title"}`, set `hasExistingData` true (currentItem has values), mock a Gemini response with a new title + new description; assert `mockUpdate` payload has no `title` key but has `description`. Second assertion: a `!hasExistingData` run deletes the flags.
4. **List-card visibility (SC-4):** render `ItemCard` with `item.ai_status="failed"` and a `latestAudioId`; assert `getByRole("alert")` with "AI processing failed" text and a Retry control present; assert absent when `ai_status="done"`.

### Wave 0 Gaps
- [ ] `src/tests/gemini-determinism.test.ts` — SC-1
- [ ] `src/tests/gemini-confab-guard.test.ts` — SC-2
- [ ] `src/tests/gemini-no-clobber.test.ts` — SC-3
- [ ] `src/tests/item-card-ai-failure.test.tsx` — SC-4 (copy structure from `item-card-audio-status.test.tsx`)
- [ ] Dexie v11 `userEditedFields` store must exist before SC-3 can run (db migration is a prerequisite task, not a test fixture).

## Security Domain

`security_enforcement` not disabled (absent = enabled). Phase scope is correctness, but two existing controls intersect:

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | `catalogFieldsSchema` (Zod) stays the structural validator (D-04); confab guard is an additional output-trust check on model-produced data |
| V5 (prompt injection) | yes (no regression) | The existing SEC-5 data-block delimiter sanitization (`sanitizeForDataBlock`, gemini.ts:104) and the DATA-vs-INSTRUCTIONS system rule (system prompt rule 11) must remain untouched — confab guard and provenance changes are downstream of the request build and do not alter it |
| V6 Cryptography | no | — |
| V2/V3/V4 Auth/Session/Access | no (unchanged) | `ensureFreshSession` path untouched |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Model confabulation persisting invented catalog data | Tampering (data integrity) | D-03 transcript-emptiness reject — the core new control |
| Stored-field prompt injection via merge context | Tampering / EoP | Existing SEC-5 sanitization — must NOT be regressed by D-05/D-06 changes |
| Provenance flag tampering (client-local Dexie) | Tampering | Accepted risk — Dexie is client-trusted; provenance only affects which fields a retry skips, never auth/access. No server trust placed in it. |

## Sources

### Primary (HIGH confidence)
- Codebase (read this session): `src/services/gemini.ts`, `src/services/geminiContinuous.ts`, `src/services/geminiSchema.ts`, `src/db/items.ts`, `src/db/index.ts`, `src/db/types.ts`, `src/db/audioLookup.ts`, `src/stores/sessionStore.ts` (updateItemField :411), `src/components/ItemCard.tsx`, `src/pages/ItemEntry.tsx`, `src/tests/gemini-pipeline.test.ts`, `package.json`.
- `../_workspace/Schema/schema.md` — `items` table; confirmed `updated_at` exists with `default now()` but auto-bump trigger is on `sessions` only (line 356), not `items` (Phase 39's job).
- `.planning/milestones/v1.3-phases/35-ai-correctness-track-2/35-CONTEXT.md` — D-01..D-08.
- `.planning/ROADMAP.md` — Phase 35 success criteria + Phase 39 boundary.

### Secondary (MEDIUM confidence)
- [Generating content | Gemini API | Google AI for Developers](https://ai.google.dev/api/generate-content) — `generationConfig` accepts `temperature`, `topP`, `topK`, `seed`; `temperature:0` "mostly deterministic, small variation possible"; `seed` best-effort.
- [Content generation parameters | Google Cloud](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/content-generation-parameters) — seed determinism caveats.
- [Critical Determinism Failure with Fixed seed and temperature · Issue #745](https://github.com/google-gemini/deprecated-generative-ai-python/issues/745) — corroborates D-02 (seed unreliable).

## Metadata

**Confidence breakdown:**
- Standard stack / no-new-deps: HIGH — verified in package.json, no installs.
- Architecture / insertion points: HIGH — exact lines read this session (minor line-number drift from CONTEXT noted and corrected).
- D-05 storage shape: HIGH — grounded in the real Dexie schema + the UUID-vs-integer key reality.
- Determinism behavior: MEDIUM-HIGH — Google docs confirm `temperature:0`/`seed` semantics; residual non-determinism is documented, so snapshot tests should tolerate it or use fully-mocked proxy responses (the existing test pattern mocks the proxy, so determinism tests are deterministic by construction).
- Confab guard scope (continuous): MEDIUM — recommendation to scope single-shot only; flagged as decision (A4).

**Research date:** 2026-06-01
**Valid until:** 2026-07-01 (stable; Gemini sampling semantics and the codebase paths are settled)
