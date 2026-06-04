---
phase: 45-ai-write-precondition
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/services/gemini.ts
  - src/tests/gemini-precondition.test.ts
autonomous: true
requirements: []   # concurrency-correctness fix; v1.3 milestone-audit SEAM-3
nyquist_compliant: true

must_haves:
  truths:
    - "processAudioWithAi's single-item AI success write routes through preconditionUpdate (from ../db/optimisticUpdate), carrying the updated_at token read alongside the merge snapshot — no bare supabase.from('items').update(supabaseUpdate).eq('id', itemId) remains for the AI-done catalog write."
    - "On a concurrent conflict, a catalog field changed by another writer since the AI read (fresh[field] !== valueAtRead[field]) is NOT re-applied (AI yields, D-06), while control fields (ai_status, completed_at) and untouched catalog fields DO apply — identical reconcile semantics to geminiContinuous.ts:286-303."
    - "The existing per-field user-edit provenance skip (the `flagged` set / db.userEditedFields), the claimed_at/ai_status claim guard, clear-on-fresh, trackEvent, and store refresh are all preserved unchanged. The failure-path write (ai_status only) is left as-is (control-only; cannot clobber catalog content)."
  artifacts:
    - path: "src/services/gemini.ts"
      provides: "preconditionUpdate-routed AI success write with compare-and-skip reconcile + updated_at snapshot"
      contains: "preconditionUpdate"
    - path: "src/tests/gemini-precondition.test.ts"
      provides: "RED→GREEN test: success write goes through preconditionUpdate; reconcile drops a concurrently-changed catalog field, keeps control + untouched fields"
      contains: "preconditionUpdate"
  key_links:
    - from: "src/services/gemini.ts processAudioWithAi success write"
      to: "src/db/optimisticUpdate.ts:preconditionUpdate"
      via: "import + call with prevUpdatedAt = snapshot.updated_at, patch = supabaseUpdate, reconcile = per-field compare-and-skip vs valueAtRead"
      pattern: "preconditionUpdate\\(\\{"
---

<objective>
Close the SEAM-3 lost-write gap from the v1.3 milestone audit. The dominant single-item AI
write-back in `processAudioWithAi` (`src/services/gemini.ts:421-424`) does an unconditional
`supabase.from("items").update(supabaseUpdate).eq("id", itemId)` — last-writer-wins. A concurrent
human edit (another tab/device) to a catalog field the local device has NOT flagged in
`db.userEditedFields`, made between the AI snapshot read (`gemini.ts:254`) and the write
(`gemini.ts:421`), is silently clobbered. This is the exact lost-write class Phase 39's
`preconditionUpdate` exists to prevent; the continuous path (`geminiContinuous.ts:297`) already
routes through it, but the single-item production path forked.

The fix: route the AI success write through `preconditionUpdate` with a per-field compare-and-skip
`reconcile` mirroring `geminiContinuous.ts:286-303`. Control fields (`ai_status`, `completed_at`)
and untouched catalog fields apply against the fresh token; a catalog field another writer changed
since the AI read yields (D-06). The `flagged` (user-edited) skip stays as the first-line
no-clobber for THIS device; `preconditionUpdate` adds the cross-writer guard the `flagged` set
can't see.

Purpose: stop the AI from silently overwriting a concurrent human edit to an untouched field.
Output: a `preconditionUpdate`-routed success write in gemini.ts + a regression test.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
@$HOME/.claude/get-shit-done/references/tdd.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/v1.3-MILESTONE-AUDIT.md

<interfaces>
<!-- The primitive to call. Already correct — do NOT modify it. -->
From src/db/optimisticUpdate.ts:
  export type ReconcileFn = (freshRow, intendedPatch) => Record<string, unknown> | null;
  export async function preconditionUpdate(args: {
    table: string; id: string; prevUpdatedAt: string | null | undefined;
    patch: Record<string, unknown>; reconcile?: ReconcileFn; maxAttempts?: number;
  }): Promise<{status:"applied"|"noop"|"exhausted"; ...}>;
  // - Handles a missing prevUpdatedAt by re-reading the row first (CR-01) — so it is
  //   safe even if the snapshot read returned no updated_at.
  // - Owns the bounded retry + exhaustion toast. Caller does NOT loop.
  // - The trigger owns the updated_at bump — NEVER put updated_at in the patch.

<!-- The canonical pattern to mirror (continuous path, already shipped Phase 39 Plan 03). -->
From src/services/geminiContinuous.ts:264-303:
  // value-at-read snapshot of merge fields + updated_at, then:
  const reconcile: ReconcileFn = (fresh, intended) => {
    const next = {};
    for (const [field, value] of Object.entries(intended)) {
      if (CATALOG_FIELDS.includes(field) && fresh[field] !== valueAtRead[field]) continue; // user changed → AI yields
      next[field] = value;  // control fields + untouched catalog re-apply
    }
    return next;
  };
  await preconditionUpdate({ table: "items", id: itemId, prevUpdatedAt: snapshotRow.updated_at, patch, reconcile });
</interfaces>
</context>

<tasks>

<task type="execute" tdd="true">
  <name>Task 1: RED — pin the AI success write to preconditionUpdate with compare-and-skip reconcile</name>
  <files>src/tests/gemini-precondition.test.ts</files>
  <read_first>
    - src/tests/gemini-no-clobber.test.ts (REQUIRED — mirror its hoisted supabase mock: mockFrom/mockUpdate/mockEq/mockSelect/mockSingle, mockGetSession/mockRefreshSession, the VITE_GEMINI_PROXY_URL stubEnv, mockGeminiResponse helper, the dynamic import of processAudioWithAi, and how it seeds db.userEditedFields)
    - src/tests/continuous-merge-no-clobber.test.ts (the analogous reconcile-behavior assertions for the continuous path — mirror how it proves a concurrently-changed field is dropped while control/untouched fields apply)
    - src/tests/optimistic-update.test.ts (preconditionUpdate behavior + how it is mocked/exercised)
    - src/services/gemini.ts (lines 215-478 — the claim guard at 218-231, the snapshot read at 254-258, the flagged set at 379-383, the supabaseUpdate assembly at 386-419, the success write at 421-424, the failure write at 467-470)
    - src/services/geminiContinuous.ts:264-303 (the reconcile + preconditionUpdate call to mirror)
    - src/db/optimisticUpdate.ts (preconditionUpdate signature + ReconcileFn)
  </read_first>
  <behavior>
    - Mock "../db/optimisticUpdate" with a hoisted mockPreconditionUpdate (vi.fn().mockResolvedValue({status:"applied", row:{}})) so the success write is intercepted.
    - Mock supabase so: ensureFreshSession passes; the claim update (.update({ai_status:"processing"...}).eq("id").in/eq("ai_status").select("id")) returns a claimed row; resolveAudioForAi resolves (seed whatever the no-clobber test seeds, or mock resolveAudioForAi's deps); the proxy fetch returns a mockGeminiResponse with a non-empty transcript + a couple catalog fields (e.g. title, condition); the snapshot read at 254 (now selecting updated_at too) returns a row with a known updated_at token plus current catalog values (valueAtRead).
    - Case A (routing + token): after a FRESH (isRetry=false) success, assert mockPreconditionUpdate was called once with objectContaining({ table: "items", id: ITEM_UUID, prevUpdatedAt: <the snapshot updated_at token> }) and that the patch contains ai_status: "done" and completed_at. Assert the AI catalog write did NOT go through a bare mockUpdate(...).eq("id") path (the only direct items .update calls are the claim write with ai_status:"processing" and, on the failure path, ai_status-only — never the supabaseUpdate catalog object).
    - Case B (reconcile semantics): capture the reconcile fn passed to mockPreconditionUpdate (mockPreconditionUpdate.mock.calls[0][0].reconcile). Call it directly with a fresh row where ONE catalog field differs from valueAtRead (e.g. fresh.title = "USER EDIT", valueAtRead.title = original) and an intended patch that includes that field + another untouched catalog field + ai_status:"done". Assert the changed field is ABSENT from the result, the untouched field and ai_status:"done" are PRESENT.
    - These fail on current code: today there is no preconditionUpdate import/call in gemini.ts (mockPreconditionUpdate is never called) and no reconcile to capture → RED.
  </behavior>
  <action>
    Create src/tests/gemini-precondition.test.ts mirroring gemini-no-clobber.test.ts's mock scaffold. Add vi.mock("../db/optimisticUpdate", () => ({ preconditionUpdate: mockPreconditionUpdate })) with a hoisted mock. Drive one FRESH success through processAudioWithAi and assert Case A + Case B as described. Do NOT write the production change in this task — assertions target the fixed contract and MUST fail until Task 2 lands.
  </action>
  <verify>
    <automated>cd /home/spoods/Projects/TPC/tpc-voice-cataloger && npx vitest --run src/tests/gemini-precondition.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - src/tests/gemini-precondition.test.ts exists, mocks ../db/optimisticUpdate, and asserts (A) preconditionUpdate is called with table/id/prevUpdatedAt + a patch carrying ai_status:"done"+completed_at, and (B) the captured reconcile drops a concurrently-changed catalog field while keeping control + untouched fields.
    - Running BEFORE Task 2 produces a FAILING run (RED) — preconditionUpdate is never imported/called by current gemini.ts.
    - No production source modified in this task.
  </acceptance_criteria>
  <done>The precondition test is committed and fails on current (unfixed) gemini.ts.</done>
</task>

<task type="execute" tdd="true">
  <name>Task 2: GREEN — route the AI success write through preconditionUpdate</name>
  <files>src/services/gemini.ts</files>
  <read_first>
    - src/services/gemini.ts (REQUIRED — the snapshot read at 254-258, supabaseUpdate at 386-419, success write at 421-424; preserve everything else)
    - src/services/geminiContinuous.ts:264-303 (the reconcile + call shape to mirror)
    - src/db/optimisticUpdate.ts (signature + missing-token re-read behavior)
  </read_first>
  <action>
    In src/services/gemini.ts:
    1. Add `import { preconditionUpdate, type ReconcileFn } from "../db/optimisticUpdate";` at the top (alongside the other db imports).
    2. Extend the snapshot read at line 254-256 to also select `updated_at` (keep the existing catalog columns). The `currentItem` row now carries both the value-at-read catalog values AND the precondition token. Capture `const prevUpdatedAt = currentItem.updated_at as string | undefined;` and build `const valueAtRead` from currentItem's catalog fields (title, description, condition, estimate, category, measurements, transcript, receipt_number).
    3. Define a module-level (or in-function) catalog field list for the single-item path: `["title","description","condition","estimate","category","measurements","transcript","receipt_number"]`. NOTE this includes receipt_number (the continuous MERGE_FIELDS omits it because continuous locks the receipt; the single-item path writes it, so it must be in the yield set here).
    4. Replace the success write (current 421-424) with:
       ```
       const reconcile: ReconcileFn = (fresh, intended) => {
         const next: Record<string, unknown> = {};
         for (const [field, value] of Object.entries(intended)) {
           if (CATALOG_FIELDS.includes(field) && fresh[field] !== valueAtRead[field]) continue; // D-06: user changed it since read → AI yields
           next[field] = value;
         }
         return next;
       };
       await preconditionUpdate({ table: "items", id: itemId, prevUpdatedAt, patch: supabaseUpdate, reconcile });
       ```
       Do NOT add updated_at to supabaseUpdate (the trigger owns the bump). Do NOT loop — preconditionUpdate owns the bounded retry + exhaustion toast.
    5. Leave UNCHANGED: the claim guard (218-231), the flagged set + per-field skip (379-419), clear-on-fresh (428-430), trackEvent (432-440), the store refresh (443), and the catch/failure write (455-477 — it writes ai_status only, a control field that cannot clobber catalog content; routing it through preconditionUpdate is out of scope for this gap). Do not refactor anything else.
  </action>
  <verify>
    <automated>cd /home/spoods/Projects/TPC/tpc-voice-cataloger && npx vitest --run src/tests/gemini-precondition.test.ts src/tests/gemini-no-clobber.test.ts src/tests/gemini-pipeline.test.ts && npx tsc -b</automated>
  </verify>
  <acceptance_criteria>
    - gemini.ts imports preconditionUpdate and the success write calls preconditionUpdate({ table:"items", id:itemId, prevUpdatedAt, patch:supabaseUpdate, reconcile }). Verify: grep -n 'preconditionUpdate({' src/services/gemini.ts returns a match.
    - The bare `supabase.from("items").update(supabaseUpdate).eq("id", itemId)` success write is gone. Verify: the catalog success write no longer uses the inline .update(...).eq("id") shape (claim write + failure ai_status write may remain).
    - The snapshot read selects updated_at; reconcile drops catalog fields changed since read and keeps control + untouched fields.
    - gemini-precondition.test.ts PASSES (GREEN); gemini-no-clobber.test.ts and gemini-pipeline.test.ts still pass; npx tsc -b exits 0.
  </acceptance_criteria>
  <done>The single-item AI success write routes through preconditionUpdate; precondition test passes, prior gemini tests still pass, typecheck clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Concurrent writers (AI vs human, cross-tab/device) → items row | The single-item AI write commits catalog fields. Without an updated_at precondition it overwrites a concurrent human edit to an untouched field — silent lost write. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-45-01 | Tampering (lost write) | processAudioWithAi success write | mitigate | Route through preconditionUpdate with compare-and-skip reconcile so a field changed by another writer since the AI read is not overwritten (AI yields, D-06). This IS the phase fix. Regression test (Task 1) locks it. |
| T-45-02 | Tampering | failure-path ai_status write | accept | Writes ai_status only (control field); cannot clobber catalog content. Left unchanged — out of scope for the lost-write gap. |
| T-45-SC | Tampering | npm/pip/cargo installs | accept | No package installs — existing-primitive call + a test file. |
</threat_model>

<verification>
- `npx vitest --run src/tests/gemini-precondition.test.ts` fails before Task 2, passes after.
- `npx vitest --run src/tests/gemini-no-clobber.test.ts src/tests/gemini-pipeline.test.ts` continue to pass (flagged-skip + pipeline behavior unregressed).
- `npx tsc -b` exits 0.
- `grep -n 'preconditionUpdate({' src/services/gemini.ts` returns a match; the inline `.update(supabaseUpdate).eq("id", itemId)` success write is gone.
- Scope fence: only src/services/gemini.ts and src/tests/gemini-precondition.test.ts changed. No edits to optimisticUpdate.ts, geminiContinuous.ts, schema, or database.types.ts.
</verification>

<success_criteria>
1. The single-item AI success write resolves through preconditionUpdate carrying the updated_at token — no bare last-writer-wins catalog write remains.
2. On conflict, a concurrently-changed catalog field is not overwritten (AI yields); control + untouched fields still apply.
3. Existing flagged-skip, claim guard, and the test suite remain green; no schema/dep changes.
</success_criteria>

<output>
Create `.planning/milestones/v1.3-phases/45-ai-write-precondition/45-01-SUMMARY.md` when done.
</output>
