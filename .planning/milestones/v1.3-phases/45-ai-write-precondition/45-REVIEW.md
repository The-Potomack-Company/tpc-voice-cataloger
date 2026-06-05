---
phase: 45-ai-write-precondition
reviewed: 2026-06-04T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/services/gemini.ts
  - src/tests/gemini-precondition.test.ts
  - src/tests/gemini-pipeline.test.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 45: Code Review Report

**Reviewed:** 2026-06-04
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Phase 45 routes the single-item AI success write in `processAudioWithAi` through `preconditionUpdate`, closing the SEAM-3 lost-write gap. I traced the implementation against the five named concerns and against the reference path (`geminiContinuous.ts:286-303`), the primitive (`db/optimisticUpdate.ts`), and the test mocks.

All five focus points pass:

1. **Reconcile correctness (gemini.ts:463-475):** Drops only catalog fields whose fresh value diverges from `valueAtRead`; control fields (`ai_status`, `completed_at`) are never in `CATALOG_FIELDS` so they always re-apply; untouched catalog fields re-apply. Semantically identical to the continuous reference (the `&&` form vs the nested `if` form are equivalent). `CATALOG_FIELDS` correctly includes `receipt_number` — the single-item path writes it (line 450), unlike continuous which deliberately omits it.
2. **Same-read snapshot:** `prevUpdatedAt` (line 292) and every `valueAtRead[field]` (line 297) are read from the one `currentItem` object produced by the single `maybeSingle()` at line 271-275. No second read, no torn snapshot.
3. **`updated_at` not in patch:** `supabaseUpdate` (line 419) holds only `ai_status`, `completed_at`, and catalog fields. `updated_at` is never assigned. Confirmed by `gemini-precondition.test.ts:217`. The trigger owns the bump.
4. **`!= null` / MERGE-mode detection:** The `hasExistingData` heuristic now iterates `CATALOG_FIELDS` (line 302-304) instead of `Object.values(currentItem)`, so the newly-selected `updated_at` column is correctly excluded — adding it to the SELECT does not force MERGE mode on a first recording. `gemini-pipeline.test.ts:658-685` (null item → simple prompt) still passes. `formatExistingValuesBlock(currentItem)` reads only its 8 typed fields, so the extra `updated_at` key on the object is ignored — no leak into the prompt.
5. **No loop:** `preconditionUpdate` is awaited once (line 476). The bounded retry + exhaustion toast live inside the primitive (`optimisticUpdate.ts:63,103`). No retry loop in gemini.ts.

The two warnings below are pre-existing-but-now-more-relevant robustness gaps the phase touches, not regressions in the new code. Info items are minor consistency notes.

## Warnings

### WR-01: `hasExistingData` switch silently drops the `new_item_detected` field from MERGE-mode detection

**File:** `src/services/gemini.ts:302-304`
**Issue:** The old heuristic was `Object.values(currentItem).some(v => v !== null)` — it considered every selected column. The new heuristic only iterates the 8 `CATALOG_FIELDS`. This is correct for excluding `updated_at`, but it is a behavioral change beyond the stated goal: any non-null persisted column that is NOT in `CATALOG_FIELDS` no longer triggers MERGE mode. Today the SELECT only adds `updated_at`, so the net effect is exactly the intended one, but the heuristic is now coupled to "MERGE-relevant fields == CATALOG_FIELDS" rather than "any data present." If a future field is added to the SELECT for context (e.g. a notes column) but not to `CATALOG_FIELDS`, MERGE mode will silently fail to engage. The coupling is implicit.
**Fix:** Make the intent explicit so the coupling is documented, e.g. derive the merge-detection set from a named constant or assert it equals `CATALOG_FIELDS`:
```ts
// MERGE-context detection keys deliberately == CATALOG_FIELDS: updated_at is the
// only other selected column and must be excluded (always non-null).
const MERGE_CONTEXT_FIELDS = CATALOG_FIELDS;
const hasExistingData = MERGE_CONTEXT_FIELDS.some(
  (field) => (currentItem as Record<string, unknown>)[field] != null,
);
```

### WR-02: Failure-path `ai_status` write remains an unguarded last-writer-wins update

**File:** `src/services/gemini.ts:525-528`
**Issue:** The success write now goes through `preconditionUpdate`, but the catch-block status write (`{ ai_status: "failed" | "queued" }`) is still a bare `supabase.from("items").update(update).eq("id", itemId)`. This is lower-risk than the success path because it writes only the `ai_status` control field (no catalog content), so a concurrent human catalog edit is not clobbered. But it CAN clobber a concurrent `ai_status` transition — e.g. a parallel retry that just set `processing`, or a drain that re-queued — because there is no token precondition. Given SEAM-3's whole premise is "AI writes must not blindly win," leaving the failure write unconditional is an inconsistency worth a deliberate decision rather than an accident.
**Fix:** Either (a) document why the failure write is intentionally unconditional (control-field-only, terminal state acceptable), or (b) route it through `preconditionUpdate` with `prevUpdatedAt` (note: `prevUpdatedAt` may be out of scope in the catch if the read at line 271 threw — would need capture before the try, or accept a re-read inside the primitive's null-token branch). Lowest-effort acceptable resolution is a one-line WHY comment at line 522 stating the unconditional write is intentional for terminal status.

## Info

### IN-01: Reconcile form diverges stylistically from the reference it claims to mirror

**File:** `src/services/gemini.ts:463-475`
**Issue:** The comment at line 461 says "Mirrors geminiContinuous.ts:286-303," but the two reconciles are written differently: continuous uses a nested `if (MERGE_FIELDS.includes(field)) { if (fresh !== valueAtRead) continue; }`, while this uses a single `if (CATALOG_FIELDS.includes(field) && fresh !== valueAtRead) continue;`. They are logically equivalent, so this is not a bug — but "mirrors" overstates the textual relationship and a future reader diffing the two will pause. Consider matching the reference structure exactly, or softening the comment to "mirrors the reconcile semantics of geminiContinuous.ts:286-303."
**Fix:** Align the structure or reword the comment; no behavioral change needed.

### IN-02: Repeated `currentItem as Record<string, unknown>` casts obscure the typed read

**File:** `src/services/gemini.ts:292, 297, 303`
**Issue:** `currentItem` comes back typed from supabase-js but is cast to `Record<string, unknown>` three times to index `updated_at` and dynamic `CATALOG_FIELDS` keys. This is functional but loses the type safety the typed client provides and is repeated. A single narrowed local would read better.
**Fix:**
```ts
const row = currentItem as Record<string, unknown>;
const prevUpdatedAt = row.updated_at as string | undefined;
const valueAtRead: Record<string, unknown> = {};
for (const field of CATALOG_FIELDS) valueAtRead[field] = row[field];
const hasExistingData = CATALOG_FIELDS.some((f) => row[f] != null);
```

---

_Reviewed: 2026-06-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
