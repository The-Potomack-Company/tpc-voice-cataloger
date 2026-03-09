---
phase: 05-ai-pipeline
verified: 2026-03-06T16:57:00Z
status: gaps_found
score: 6/7 must-haves verified
gaps:
  - truth: "Title output is in ALL CAPS following TPC format; description starts with 'the' in lowercase formal auction language"
    status: failed
    reason: "ROADMAP success criterion #2 (AI-02) requires TPC formatting applied by the AI, but the implementation explicitly uses verbatim extraction only. SYSTEM_PROMPT instructs Gemini 'Do not rephrase, improve, or formalize.' No ALL CAPS conversion, no 'the'-prefixing, no formal language rewriting exists anywhere in the service. This is a documented deferral to Phase 6, but the ROADMAP contract was never updated."
    artifacts:
      - path: "src/services/gemini.ts"
        issue: "SYSTEM_PROMPT explicitly forbids TPC formatting ('Do not rephrase, improve, or formalize'). No post-processing step applies ALL CAPS or formal auction language conventions."
    missing:
      - "Either: update Gemini SYSTEM_PROMPT to produce TPC-formatted output (ALL CAPS title in [PERIOD/STYLE] [MATERIAL] [ITEM TYPE] format; description starting with 'the' in lowercase formal language)"
      - "Or: update ROADMAP.md success criterion #2 to reflect the agreed deferral of TPC formatting to Phase 6 (if that is the accepted decision)"
---

# Phase 5: AI Pipeline Verification Report

**Phase Goal:** Recorded audio is automatically transcribed and parsed into structured catalog fields that follow TPC auction conventions, with no hallucinated values for fields not mentioned in the recording
**Verified:** 2026-03-06T16:57:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| #  | Truth                                                                                                                                         | Status      | Evidence                                                                                                                    |
|----|-----------------------------------------------------------------------------------------------------------------------------------------------|-------------|-----------------------------------------------------------------------------------------------------------------------------|
| 1  | After recording stops, structured fields appear in the item record without a separate transcription step                                      | VERIFIED    | `RecordButton.tsx` calls `processAudioWithAi` fire-and-forget after `stopRecording()` resolves; single Gemini call extracts all fields |
| 2  | Title output is in ALL CAPS following TPC format; description starts with "the" in lowercase formal auction language                          | FAILED      | `SYSTEM_PROMPT` explicitly instructs "Do not rephrase, improve, or formalize." No formatting applied anywhere in pipeline   |
| 3  | Fields not mentioned in audio are stored as null — no hallucinated values                                                                     | VERIFIED    | Zod schema validates nullable fields; null fields stored as `undefined` in Dexie; 3 tests verify null handling              |

**Score:** 2/3 ROADMAP success criteria verified

### Must-Have Truths (from PLAN frontmatter)

#### Plan 01 Truths

| #  | Truth                                                                      | Status   | Evidence                                                                  |
|----|----------------------------------------------------------------------------|----------|---------------------------------------------------------------------------|
| 1  | Item records have an aiStatus field that tracks processing state           | VERIFIED | `src/db/types.ts` line 12: `AiStatus` type; lines 22, 36: `aiStatus?: AiStatus` on both interfaces |
| 2  | Zod schema validates Gemini JSON responses with nullable fields            | VERIFIED | `src/services/geminiSchema.ts` — all 5 fields are `z.string().nullable()`; 5 schema tests pass |
| 3  | Backend proxy forwards requests to Gemini with API key attached            | VERIFIED | `proxy/src/index.ts` line 30: constructs URL with `env.GEMINI_API_KEY`    |
| 4  | Proxy handles CORS preflight requests correctly                            | VERIFIED | `proxy/src/index.ts` lines 13-15: OPTIONS returns 204 with CORS headers   |

#### Plan 02 Truths

| #  | Truth                                                                                                         | Status   | Evidence                                                            |
|----|---------------------------------------------------------------------------------------------------------------|----------|---------------------------------------------------------------------|
| 1  | processAudioWithAi is callable fire-and-forget and writes structured fields to Dexie on success               | VERIFIED | `src/services/gemini.ts` lines 42-148; 12 tests pass                |
| 2  | Structured fields are written to the item record                                                              | VERIFIED | `table.update(itemId, updateData)` at line 138                      |
| 3  | Fields not mentioned are stored as null — no hallucinated values                                              | VERIFIED | Lines 124-136: null fields skip the update; category defaults to "furniture" |
| 4  | If Gemini fails, description gets fallback text and aiStatus is set to failed                                 | VERIFIED | Lines 139-147: catch block sets `aiStatus: "failed"` and fallback description |
| 5  | Category defaults to furniture when not spoken                                                                | VERIFIED | Line 136: `fields.category ?? "furniture"`                          |
| 6  | Rapid item switching does not cause fields to land on wrong items                                             | VERIFIED | `itemId` captured in closure parameter; race condition test passes  |
| 7  | After recording stops in ItemEntry, processAudioWithAi is called automatically                                | PARTIAL  | Wired in `RecordButton.tsx` (not `ItemEntry.tsx` as PLAN specified, but plan acknowledged this as an auto-fix); functionally correct |

**Score (plan truths):** 10/11 plan truths verified (1 partial on wiring location — functionally identical)

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact                             | Expected                                    | Status     | Details                                                          |
|--------------------------------------|---------------------------------------------|------------|------------------------------------------------------------------|
| `src/db/types.ts`                    | aiStatus field on HouseVisitItem/SaleItem   | VERIFIED   | `aiStatus?: AiStatus` on both interfaces (lines 22, 36)         |
| `src/db/index.ts`                    | Dexie v3 migration with aiStatus index      | VERIFIED   | `db.version(3).stores(...)` with `aiStatus` in both item stores (lines 48-54) |
| `src/services/geminiSchema.ts`       | Zod schema + JSON schema export             | VERIFIED   | Exports `catalogFieldsSchema`, `CatalogFields`, `catalogFieldsJsonSchema` |
| `proxy/src/index.ts`                 | Cloudflare Worker proxy (30+ lines)         | VERIFIED   | 51 lines; handles OPTIONS, POST, 405, 500                        |

### Plan 02 Artifacts

| Artifact                             | Expected                                    | Status     | Details                                                          |
|--------------------------------------|---------------------------------------------|------------|------------------------------------------------------------------|
| `src/services/gemini.ts`             | AI processing pipeline (50+ lines)          | VERIFIED   | 149 lines; exports `processAudioWithAi` and `blobToBase64`      |
| `src/tests/gemini-pipeline.test.ts`  | Tests for AI pipeline (80+ lines)           | VERIFIED   | 362 lines; 12 tests covering all specified behaviors             |
| `src/pages/ItemEntry.tsx` (plan said) / `src/components/RecordButton.tsx` (actual) | processAudioWithAi wiring | VERIFIED   | Wired in `RecordButton.tsx` — fire-and-forget call at line 21 |

---

## Key Link Verification

| From                              | To                                    | Via                                | Status     | Details                                              |
|-----------------------------------|---------------------------------------|------------------------------------|------------|------------------------------------------------------|
| `src/services/geminiSchema.ts`    | `zod`                                 | `z.object` schema definition       | VERIFIED   | `import { z, toJSONSchema } from "zod"` + `z.object(...)` |
| `proxy/src/index.ts`              | `generativelanguage.googleapis.com`   | fetch forwarding                   | VERIFIED   | Line 30-36: constructs full Gemini URL and forwards  |
| `src/services/gemini.ts`          | `src/services/geminiSchema.ts`        | import catalogFieldsSchema         | VERIFIED   | Line 2: `import { catalogFieldsSchema, catalogFieldsJsonSchema } from "./geminiSchema"` |
| `src/services/gemini.ts`          | `src/db/index.ts`                     | `table.update`                     | VERIFIED   | Lines 52, 138, 142: `table.update(itemId, ...)` calls |
| `src/services/gemini.ts`          | `VITE_GEMINI_PROXY_URL`               | `import.meta.env`                  | VERIFIED   | Line 93: `const proxyUrl = import.meta.env.VITE_GEMINI_PROXY_URL` |
| `src/components/RecordButton.tsx` | `src/services/gemini.ts`              | import + fire-and-forget call      | VERIFIED   | Line 2: import; line 21: `processAudioWithAi(audioId, itemId, itemType).catch(...)` |

---

## Requirements Coverage

| Requirement | Source Plan | Description                                                                                     | Status       | Evidence                                                                            |
|-------------|-------------|-------------------------------------------------------------------------------------------------|--------------|-------------------------------------------------------------------------------------|
| AI-01       | 05-01, 05-02 | Recorded audio is sent to AI and returned as structured fields in a single step                | SATISFIED    | Single Gemini call via proxy; all 5 fields extracted and written to Dexie; 12 tests pass |
| AI-02       | 05-02       | AI output follows TPC conventions (ALL CAPS title, lowercase "the"-starting description, formal language) | BLOCKED | SYSTEM_PROMPT explicitly forbids TPC formatting; no post-processing exists; verbatim extraction only |
| AI-03       | 05-01, 05-02 | AI handles missing fields gracefully (null when not spoken, no hallucinated values)            | SATISFIED    | Zod nullable schema; null-to-undefined conversion; category default; 5 null-handling tests pass |

### Requirement AI-02 — Detailed Analysis

REQUIREMENTS.md defines AI-02 as: "AI output follows TPC conventions (ALL CAPS title, lowercase 'the'-starting description, formal auction language)"

ROADMAP.md success criterion #2 states: "Title output is in ALL CAPS following the TPC format ([PERIOD/STYLE] [MATERIAL] [ITEM TYPE]); description starts with 'the' in lowercase formal auction language"

**What exists:**
- `SYSTEM_PROMPT` in `src/services/gemini.ts` lines 4-17 instructs Gemini: "Use the speaker's EXACT words. Do not rephrase, improve, or formalize."
- `05-CONTEXT.md` documents an explicit decision: "No post-processing: no ALL CAPS conversion, no 'the'-prefixing, no formal language rewriting. TPC formatting is a downstream concern (Phase 6 or a separate utility)"
- `05-02-SUMMARY.md` key decisions notes the wiring is in `RecordButton.tsx` and references verbatim extraction

**The conflict:** The CONTEXT.md decision to defer TPC formatting to Phase 6 was made but the ROADMAP.md success criterion was never updated to reflect this deferral. The REQUIREMENTS.md still marks AI-02 as `[x]` (complete).

**Resolution options:**
1. Add TPC formatting to the Gemini prompt (Phase 5 scope) — aligns implementation with ROADMAP
2. Update ROADMAP.md success criterion #2 and REQUIREMENTS.md AI-02 to reflect the Phase 6 deferral — aligns ROADMAP with implementation decision

---

## Anti-Patterns Found

| File                              | Line  | Pattern                          | Severity | Impact                                                  |
|-----------------------------------|-------|----------------------------------|----------|---------------------------------------------------------|
| None found                        | —     | —                                | —        | —                                                       |

No placeholder implementations, empty handlers, or TODO stubs found in any phase 5 files. All implementations are substantive.

---

## Human Verification Required

### 1. Real Audio Processing End-to-End

**Test:** With a valid `VITE_GEMINI_PROXY_URL` and deployed Cloudflare Worker, record an item description in ItemEntry ("antique oak table, quite nice, maybe three hundred dollars") and stop recording.
**Expected:** Within 15-30 seconds, the item record in Dexie shows: `title: "antique oak table"`, `description: "quite nice"` (or similar verbatim split), `estimate: "maybe three hundred dollars"`, `aiStatus: "done"`
**Why human:** Requires real Gemini API key, deployed proxy, and real audio input — cannot be mocked programmatically

### 2. iOS Safari Audio Format Compatibility

**Test:** On an iPhone running Safari, record audio and stop.
**Expected:** `mimeType` is `audio/mp4` (not `audio/webm`); after stripping codec parameters, the base64 audio processes correctly through Gemini
**Why human:** iOS Safari produces `audio/mp4` not `audio/webm` — requires physical device testing

### 3. AI-02 TPC Formatting Decision Confirmation

**Test:** Review the verbatim output from real Gemini processing against Phase 6 requirements.
**Expected:** Either (a) confirm Phase 6 will apply TPC formatting to verbatim extracted fields, making AI-02 ultimately satisfied; or (b) confirm Phase 5 should add TPC formatting to the prompt now
**Why human:** Requires product decision — whether AI-02 is "satisfied by Phase 5 + Phase 6 combined" or "blocked because Phase 5 alone must produce formatted output"

---

## Test Results

All automated tests pass:
- `src/tests/gemini-schema.test.ts`: 5/5 tests pass
- `src/tests/gemini-pipeline.test.ts`: 12/12 tests pass
- Total: **17/17 tests pass**

Tests cover: aiStatus lifecycle (processing→done/failed), verbatim field writing, null field handling, category default, fetch failure, malformed JSON, Zod validation failure, MIME stripping, race condition prevention, audio blob fetched by ID.

---

## Gaps Summary

**One gap blocks goal achievement as stated in ROADMAP.md:**

**AI-02 TPC Formatting** — The ROADMAP success criterion #2 requires AI output in TPC auction format (ALL CAPS titles, formal description language starting with "the"). The implementation intentionally uses verbatim extraction only, deferring formatting to Phase 6. This is documented in `05-CONTEXT.md` as an explicit team decision, but:

1. REQUIREMENTS.md marks AI-02 as `[x]` complete — this is premature
2. ROADMAP.md success criterion #2 was not updated to reflect the deferral
3. The gap is a **contract mismatch**, not a code quality problem

**This gap requires a decision, not necessarily more code:** If TPC formatting belongs in Phase 6 (which has its own review/edit scope), the fix is to update ROADMAP.md and REQUIREMENTS.md to reflect the deferral. If it belongs in Phase 5, the fix is to update the Gemini SYSTEM_PROMPT with TPC formatting instructions.

All other artifacts — DB migration, Zod schema, proxy, processing service, wiring, tests — are substantive and correctly implemented.

---

_Verified: 2026-03-06T16:57:00Z_
_Verifier: Claude (gsd-verifier)_
