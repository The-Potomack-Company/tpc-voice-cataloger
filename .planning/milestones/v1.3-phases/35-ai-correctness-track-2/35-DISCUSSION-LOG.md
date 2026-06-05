# Phase 35: ai-correctness-track-2 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-01
**Phase:** 35-ai-correctness-track-2
**Areas discussed:** No-clobber retry guard, Confab rejection behavior, List-card failure visibility, Determinism scope

User response to gray-area selection: "go with your recs for all" — Claude made the call on each area; alternatives considered are recorded below.

---

## No-clobber retry guard

| Option | Description | Selected |
|--------|-------------|----------|
| Per-field user-edited provenance (Dexie, client-side) | Flag field on `updateItemField`; retry write-back skips flagged fields | ✓ |
| Compare-against-current value | On retry, only overwrite if current DB value still equals last AI-authored value | |
| Prompt-merge-only | Rely on existing D-02 smart-merge context to instruct model not to rewrite | |
| Supabase column / `updated_at` precondition | Schema-level tracking | (rejected — collides with Phase 39) |

**User's choice:** Claude rec — Dexie client-side per-field flag.
**Notes:** No Supabase schema change; retry-scoped; stays out of Phase 39 optimistic-locking lane. Prompt-merge-only rejected (model can still rewrite).

---

## Confab rejection behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Transcript-emptiness gate → reject whole response, `ai_status=failed` | Empty/unintelligible transcript ⇒ write no fields, mark failed | ✓ |
| Drop confabulated fields (null-coerce), keep item `done` | Silently null invented fields | |
| Per-field "clearly empty" detection | Field-level confab test | |

**User's choice:** Claude rec — transcript-emptiness whole-response gate.
**Notes:** Failing honestly surfaces via this phase's visibility work; crisper than per-field "clearly empty" definition. Zod stays as structural validator.

---

## List-card failure visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Full-width inline warning row mirroring detail `AiFailureBanner` | Icon + "AI processing failed" + Retry CTA | ✓ |
| Larger / recolored badge | Keep badge, bump size/contrast | |
| Toast on render | Transient surface | |

**User's choice:** Claude rec — full-width warning row.
**Notes:** Reuses `AiFailureBanner` structure (`ItemEntry.tsx:33`) + existing `handleRetryAi`. Only when `ai_status==="failed"`.

---

## Determinism scope

| Option | Description | Selected |
|--------|-------------|----------|
| `temperature: 0` on both gemini.ts + geminiContinuous.ts | Greedy decoding, no seed | ✓ |
| temp=0 + pin topP/topK + seed | Maximal knob-pinning | |

**User's choice:** Claude rec — temp=0 on both paths, no seed.
**Notes:** `seed` unreliable on gemini-2.5-flash REST; greedy decoding sufficient for snapshot tests.

---

## Claude's Discretion

- Exact Dexie storage shape for per-field user-edited flags.
- Exact visual treatment of the card warning row (within existing token palette).

## Deferred Ideas

- General cross-writer/cross-device concurrency conflict → Phase 39 (optimistic-locking, DAT-3).
- Migration partial-state retry → Phase 38. Export/error-toast visibility → Phase 36.
