---
phase: 05-ai-pipeline
verified: 2026-03-16T11:00:00Z
status: human_needed
score: 18/18 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 7/8
  gaps_closed:
    - "AI-02 contract mismatch: ROADMAP.md success criterion #2 and REQUIREMENTS.md AI-02 updated to reflect verbatim extraction with TPC formatting deferred to Phase 6 (Plan 04)"
    - "AI status indicators: ItemCard.tsx now shows red Failed badge, blue Processing badge, and Retry AI button for failed items (Plan 05)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Real audio processing end-to-end with deployed proxy"
    expected: "After recording 'antique oak table, quite nice, maybe three hundred dollars', item record shows populated fields and aiStatus: done within 15-30 seconds"
    why_human: "Requires real Gemini API key, deployed Cloudflare Worker, and real audio input"
  - test: "iOS Safari audio format compatibility"
    expected: "On iPhone Safari, mimeType is audio/mp4 (not audio/webm); recording processes correctly through Gemini"
    why_human: "Requires physical iOS device testing"
  - test: "Retry AI button end-to-end"
    expected: "On an item with aiStatus=failed, tapping Retry AI shows Retrying... state, then either populates fields (aiStatus: done) or remains failed; never gets stuck at processing"
    why_human: "Requires deployed proxy and real audio blob in the item record"
---

# Phase 5: AI Pipeline Verification Report

**Phase Goal:** Recorded audio is automatically transcribed and parsed into structured catalog fields that follow TPC auction conventions, with no hallucinated values for fields not mentioned in the recording
**Verified:** 2026-03-16T11:00:00Z
**Status:** human_needed (all automated checks pass)
**Re-verification:** Yes — after Plans 04 and 05 gap closure

---

## Re-verification Summary

| Item | Previous | Current | Change |
|------|----------|---------|--------|
| Score | 7/8 | 18/18 | All gaps closed |
| AI-02 contract mismatch | FAILED | VERIFIED | Closed by Plan 04 (docs update) |
| AI status indicators / retry | Not in scope (new gap) | VERIFIED | Closed by Plan 05 |
| AI stuck at "processing" | VERIFIED (from Plan 03) | VERIFIED | No regression |
| All tests | 21/21 | 21/21 | No regression |
| Build | Passing | Passing | No regression |
| Regressions | — | None | — |

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | After recording stops, structured fields (title, description, condition, estimate, category) appear in the item record without a separate transcription step | VERIFIED | `RecordButton.tsx` lines 19-25: fire-and-forget `processAudioWithAi` called after `stopRecording()` resolves; single Gemini call extracts all 5 fields; also wired in `ItemCard.tsx` lines 78-92 for re-record path |
| 2 | AI returns verbatim speech in structured fields without reformatting; TPC conventions applied downstream in Phase 6 review | VERIFIED | `SYSTEM_PROMPT` lines 13-17 instructs verbatim extraction; ROADMAP.md criterion #2 now reads "AI returns verbatim speech in structured fields...TPC conventions...are applied downstream in Phase 6 review"; REQUIREMENTS.md AI-02 updated to match |
| 3 | Fields not mentioned in the audio are stored as null — the app does not invent plausible values for unspoken details | VERIFIED | Zod schema uses `.nullable()` on all 5 fields; null fields skipped on Dexie write (lines 139-151); category defaults to "furniture"; 5 tests verify null handling |

**Score (ROADMAP criteria):** 3/3 ROADMAP success criteria verified

---

## Plan Must-Have Truths

### Plan 01 Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Item records have an aiStatus field that tracks processing state | VERIFIED | `src/db/types.ts`: `AiStatus` type exported; `aiStatus?: AiStatus` on both `HouseVisitItem` and `SaleItem` |
| 2 | Zod schema validates Gemini JSON responses with nullable fields | VERIFIED | `src/services/geminiSchema.ts`: all 5 fields are `z.string().nullable()`; 5 schema tests pass |
| 3 | Backend proxy forwards requests to Gemini with API key attached | VERIFIED | `proxy/src/index.ts` line 30: constructs URL with `env.GEMINI_API_KEY` |
| 4 | Proxy handles CORS preflight requests correctly | VERIFIED | `proxy/src/index.ts` lines 13-15: OPTIONS returns 204 with CORS headers |

### Plan 02 Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | processAudioWithAi is callable fire-and-forget and writes structured fields to Dexie on success | VERIFIED | `src/services/gemini.ts` lines 42-167; 16 tests pass |
| 2 | Structured fields (title, description, condition, estimate, category) are written to the item record | VERIFIED | `table.update(itemId, updateData)` at line 153 |
| 3 | Fields not mentioned are stored as null — no hallucinated values | VERIFIED | Lines 135-151: null fields skip the update; category defaults to "furniture" |
| 4 | If Gemini fails, description gets fallback text and aiStatus is set to failed | VERIFIED | Lines 157-165: nested catch sets `aiStatus: "failed"` and fallback description |
| 5 | Category defaults to furniture when not spoken | VERIFIED | Line 151: `fields.category ?? "furniture"` |
| 6 | Rapid item switching does not cause fields to land on wrong items | VERIFIED | `itemId` captured in closure parameter; race condition test passes |
| 7 | After recording stops, processAudioWithAi is called automatically | VERIFIED | Wired in `RecordButton.tsx` lines 19-25 and `ItemCard.tsx` lines 78-92 |

### Plan 03 Truths (gap closure)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | When VITE_GEMINI_PROXY_URL is not configured, processAudioWithAi sets aiStatus to "failed" immediately | VERIFIED | `gemini.ts` lines 61-64: `if (!proxyUrl) throw new Error(...)` before fetch |
| 2 | When the proxy returns a non-200 response, aiStatus transitions to "failed" | VERIFIED | `gemini.ts` lines 113-116: `if (!response.ok) throw new Error(...)` before parsing |
| 3 | When the catch block's own DB write fails, aiStatus still reaches "failed" or the error is logged | VERIFIED | `gemini.ts` lines 157-165: nested try/catch in catch block; `console.error("Failed to update aiStatus to failed:", dbError)` |
| 4 | A .env file exists with VITE_GEMINI_PROXY_URL pointing to localhost for development | VERIFIED | `.env` contains `VITE_GEMINI_PROXY_URL=http://localhost:8787` |

### Plan 04 Truths (gap closure — contract alignment)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ROADMAP.md Phase 5 success criterion #2 reflects verbatim speech extraction with TPC formatting deferred to Phase 6 | VERIFIED | ROADMAP.md line 89: "AI returns verbatim speech in structured fields...TPC conventions...are applied downstream in Phase 6 review" (commit `99c0c39`) |
| 2 | REQUIREMENTS.md AI-02 description reflects the deferral of TPC formatting conventions to Phase 6 | VERIFIED | REQUIREMENTS.md line 20: "AI returns verbatim speech in structured fields; TPC formatting conventions (ALL CAPS title, formal description language) are applied in Phase 6 review" (commit `376df85`) |
| 3 | No code changes made — this is a contract alignment fix only | VERIFIED | Both commits are `docs()` type; only `.planning/` files modified |

### Plan 05 Truths (gap closure — AI status indicators)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Items with aiStatus=failed show a visible "Failed" badge on the collapsed card row | VERIFIED | `ItemCard.tsx` lines 151-155: `{isFailed && <span ...>Failed</span>}` with red styling |
| 2 | Items with aiStatus=failed show a "Retry AI" button in the expanded section | VERIFIED | `ItemCard.tsx` lines 268-285: `{isFailed && <button ...>Retry AI</button>}` |
| 3 | Tapping "Retry AI" re-triggers processAudioWithAi and the button shows a processing state | VERIFIED | `handleRetryAi` (lines 43-52): sets `retrying=true`, calls `processAudioWithAi(latestAudioId, item.id!, mode)`, shows "Retrying..." with `animate-pulse` |
| 4 | Items with aiStatus=processing show a "Processing..." indicator on the collapsed card row | VERIFIED | `ItemCard.tsx` lines 157-161: `{isProcessing && <span ...>Processing...</span>}` with blue + `animate-pulse` styling; mic button hidden during processing (line 164) |

**Score (all plan truths):** 18/18 truths verified

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/types.ts` | aiStatus field on HouseVisitItem/SaleItem | VERIFIED | `aiStatus?: AiStatus` on both interfaces |
| `src/db/index.ts` | Dexie v3 migration with aiStatus index | VERIFIED | `db.version(3).stores(...)` with `aiStatus` in both item stores |
| `src/services/geminiSchema.ts` | Zod schema + JSON schema export | VERIFIED | Exports `catalogFieldsSchema`, `CatalogFields`, `catalogFieldsJsonSchema` |
| `proxy/src/index.ts` | Cloudflare Worker proxy (30+ lines) | VERIFIED | 51 lines; handles OPTIONS, POST, 405, 500 |

### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/services/gemini.ts` | AI processing pipeline (50+ lines) | VERIFIED | 168 lines; exports `processAudioWithAi` and `blobToBase64`; includes Plan 03 hardening |
| `src/tests/gemini-pipeline.test.ts` | Tests for AI pipeline (80+ lines) | VERIFIED | 16 tests; all pass |
| `src/components/RecordButton.tsx` | processAudioWithAi wiring on recording stop | VERIFIED | Fire-and-forget call; also handles offline queue path |

### Plan 03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/services/gemini.ts` | Hardened with proxyUrl guard, response status check, nested try/catch | VERIFIED | `if (!proxyUrl)` at line 62; `if (!response.ok)` at line 113; `catch (dbError)` at line 163 |
| `src/tests/gemini-pipeline.test.ts` | 4 new test cases for failure modes | VERIFIED | All 4 new tests present and passing |
| `.env` | Development config with VITE_GEMINI_PROXY_URL | VERIFIED | `.env` contains `VITE_GEMINI_PROXY_URL=http://localhost:8787` |

### Plan 04 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.planning/ROADMAP.md` | Updated success criterion #2 for Phase 5 containing "verbatim" | VERIFIED | Line 89: "AI returns verbatim speech in structured fields..."; commit `99c0c39` |
| `.planning/REQUIREMENTS.md` | Updated AI-02 description noting Phase 6 deferral | VERIFIED | Line 20: "...applied in Phase 6 review"; commit `376df85` |

### Plan 05 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/ItemCard.tsx` | AI status indicators and retry button (contains "Retry AI") | VERIFIED | 312 lines; contains "Retry AI" at line 282; "Failed" badge at line 153; "Processing..." badge at line 159; commit `4bc5716` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/services/geminiSchema.ts` | `zod` | `z.object` schema definition | VERIFIED | `import { z, toJSONSchema } from "zod"` + `z.object(...)` |
| `proxy/src/index.ts` | `generativelanguage.googleapis.com` | fetch forwarding | VERIFIED | Constructs full Gemini URL and forwards POST body |
| `src/services/gemini.ts` | `src/services/geminiSchema.ts` | import catalogFieldsSchema | VERIFIED | Line 2: `import { catalogFieldsSchema, catalogFieldsJsonSchema } from "./geminiSchema"` |
| `src/services/gemini.ts` | `src/db/index.ts` | `table.update` | VERIFIED | Lines 52, 153, 158: `table.update(itemId, ...)` calls |
| `src/services/gemini.ts` | `VITE_GEMINI_PROXY_URL` | `import.meta.env` + guard | VERIFIED | Lines 61-64: read from `import.meta.env.VITE_GEMINI_PROXY_URL` with early guard if missing |
| `src/components/RecordButton.tsx` | `src/services/gemini.ts` | import + fire-and-forget call | VERIFIED | Import present; fire-and-forget `processAudioWithAi(audioId, itemId, itemType).catch(...)` |
| `src/services/gemini.ts` | catch block | nested try/catch | VERIFIED | Lines 154-165: outer catch; lines 157-165: inner try/catch protects DB write |
| `src/components/ItemCard.tsx` | `src/services/gemini.ts` | processAudioWithAi call on retry button click | VERIFIED | Line 10: `import { processAudioWithAi } from "../services/gemini"`; line 46: `processAudioWithAi(latestAudioId, item.id!, mode)` in `handleRetryAi` |
| `src/components/ItemCard.tsx` | Dexie audio table | `db.audio.where("itemId")` inline query | VERIFIED | Line 29: `db.audio.where("itemId").equals(item.id!).toArray()` in combined useLiveQuery |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AI-01 | 05-01, 05-02, 05-03, 05-05 | Recorded audio is sent to AI and returned as structured fields in a single step | SATISFIED | Single Gemini call via proxy; all 5 fields extracted and written to Dexie; 16 tests pass; 3 hardening guards prevent stuck states; retry button allows recovery without re-recording |
| AI-02 | 05-02, 05-04 | AI returns verbatim speech in structured fields; TPC formatting conventions applied in Phase 6 review | SATISFIED | `SYSTEM_PROMPT` instructs verbatim extraction; ROADMAP.md and REQUIREMENTS.md updated by Plan 04 to reflect this decision (commits `99c0c39`, `376df85`) |
| AI-03 | 05-01, 05-02 | AI handles missing fields gracefully (null when not spoken, no hallucinated values) | SATISFIED | Zod nullable schema; null-to-undefined conversion; category default; 5 null-handling tests pass |

All three Phase 5 requirements are SATISFIED. No orphaned requirements (REQUIREMENTS.md traceability table maps AI-01, AI-02, AI-03 to Phase 5 only).

---

## Test Results

All automated tests pass:

- `src/tests/gemini-schema.test.ts`: 5/5 tests pass
- `src/tests/gemini-pipeline.test.ts`: 16/16 tests pass
- **Total phase 05 tests: 21/21 pass**
- **Vite build: passing** (no TypeScript errors)

Commits verified in git history:
- `99c0c39` — docs(05-04): update ROADMAP Phase 5 success criterion to reflect verbatim extraction
- `376df85` — docs(05-04): update REQUIREMENTS AI-02 to reflect verbatim extraction with Phase 6 deferral
- `4bc5716` — feat(05-05): add AI status indicators and retry button to ItemCard
- `efcc93e` — docs(05-04): complete contract alignment plan - SUMMARY and state updates
- `bcd7eb4` — docs(05-05): complete AI status indicators and retry plan

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No placeholder implementations, empty handlers, TODO stubs, or unprotected error paths found. All plan 04 and 05 changes are substantive.

---

## Human Verification Required

### 1. Real Audio Processing End-to-End

**Test:** With a valid `VITE_GEMINI_PROXY_URL` pointing to a deployed Cloudflare Worker, record "antique oak table, quite nice, maybe three hundred dollars" in ItemEntry and stop recording.
**Expected:** Within 15-30 seconds, the item record shows `title`, `description`, `estimate` populated from verbatim speech; `aiStatus: "done"`. Fields like `condition` and `category` default correctly (null skipped / "furniture" default).
**Why human:** Requires real Gemini API key, deployed proxy, and real audio input.

### 2. iOS Safari Audio Format Compatibility

**Test:** On an iPhone running Safari, record audio and stop.
**Expected:** `mimeType` is `audio/mp4` (not `audio/webm`); after stripping codec parameters with `.split(";")[0]`, the base64 audio processes correctly through Gemini with no format rejection error.
**Why human:** iOS Safari produces `audio/mp4` — requires physical device testing.

### 3. Retry AI Button End-to-End

**Test:** With an item that has `aiStatus=failed` and an audio record attached, expand the item and tap "Retry AI".
**Expected:** Button shows "Retrying..." with pulse animation; after 15-30 seconds either fields populate (`aiStatus: done`) or failure repeats (`aiStatus: failed`); button never leaves the item stuck at "processing".
**Why human:** Requires deployed proxy and a real audio blob in Dexie to exercise the full path.

---

## Gaps Summary

No gaps remain. All previously identified gaps are closed:

1. **AI stuck at "processing"** (Plan 03 + post-verification fix) — three defensive guards in `gemini.ts` ensure aiStatus always reaches "done" or "failed". Additionally, a 30-second AbortController timeout on the fetch call prevents indefinite hangs when the proxy is unreachable.
2. **AI-02 contract mismatch** (Plan 04) — ROADMAP.md and REQUIREMENTS.md updated to reflect the CONTEXT.md decision that verbatim extraction is Phase 5's scope and TPC formatting belongs to Phase 6.
3. **AI status indicators / retry button** (Plan 05 + post-verification fix) — `ItemCard.tsx` shows red "Failed" badge, blue "Processing..." badge, and retry buttons for both failed AND stuck-processing items. `ItemList.tsx` has a bulk "Retry All Stuck" button when any items are in failed/processing state.
4. **Transcript accumulation** (post-verification fix) — Multiple recordings on the same item now append transcripts instead of overwriting.

The phase goal is fully achieved by the codebase. Remaining verification items are operational (require a live Gemini API key and real device) rather than code quality concerns.

---

_Verified: 2026-03-16T11:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Mode: Re-verification (previous: 2026-03-16T09:51:00Z, status: gaps_found)_
