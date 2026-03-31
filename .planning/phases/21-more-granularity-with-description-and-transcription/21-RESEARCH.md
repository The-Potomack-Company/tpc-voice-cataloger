# Phase 21: More Granularity with Description and Transcription - Research

**Researched:** 2026-03-30
**Domain:** AI pipeline enhancement (Gemini system prompt, Zod schema, measurement formatting)
**Confidence:** HIGH

## Summary

Phase 21 modifies the AI extraction pipeline in three areas: (1) smart field merging so re-recordings append/edit rather than overwrite, (2) expanded measurements to include mm, weight, and karats in a single string field, and (3) spoken punctuation parsing across all extracted fields. All three features are prompt-level and schema-level changes -- no new UI pages or fields are needed.

The core change pattern is: modify the Gemini system prompt to describe new behaviors, update the Zod schema from `array(number)` to `string` for measurements, rewrite `formatMeasurements` to handle the richer format, and modify `processAudioWithAi()` to pass existing field values as context to Gemini for merge decisions. The Supabase `measurements` column is already `text` type, so no database migration is needed.

**Primary recommendation:** Implement in three focused plans: (1) schema + measurements expansion, (2) smart field merging with existing-value context passing, (3) spoken punctuation prompt additions. Each plan modifies `geminiSchema.ts`, `gemini.ts`, and related utilities/tests.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** New recordings append/merge with existing field values by default instead of overwriting. Users can give explicit edit instructions ("change description to say X", "add ROBERT to the title") and the AI interprets intent.
- **D-02:** The AI handles the merge -- existing field values are sent as context alongside the new audio to Gemini. Gemini sees current title/description/condition/etc and decides how to merge, edit, or append based on what the user said.
- **D-03:** The AI returns final merged values for each field (not value+action metadata). The app writes the result directly -- no diff/undo UI needed.
- **D-04:** Overwrite only happens when the user explicitly asks (e.g., "replace the description with..."). Default behavior is additive.
- **D-05:** All measurement types go in a single measurements field -- dimensions, weight, and karats together. Example: "4 x 6 in. (10.2 x 15.2 cm.), 2.5 oz., 18kt".
- **D-06:** Millimeters require the user to explicitly say "millimeters" or "mm" -- AI defaults to inches when no unit is specified.
- **D-07:** Millimeters are appended as-is with "mm" suffix -- no conversion to other units.
- **D-08:** Weight units supported: ounces and grams. No pounds.
- **D-09:** Karats are included in the measurements string (e.g., "18kt").
- **D-10:** Punctuation parsing applies to ALL fields (title, description, condition, transcript, etc.).
- **D-11:** Handled entirely in the AI prompt -- Gemini interprets spoken punctuation during extraction. No post-processing code layer.
- **D-12:** Common punctuation vocabulary: parenthesis/close parenthesis, comma, period, semicolon, colon, dash, hyphen, quote/unquote, exclamation point, question mark, etc.

### Claude's Discretion
- Weight unit formatting (e.g., "oz." vs "ounces", "g" vs "grams") -- pick the standard auction catalog convention
- Exact system prompt wording for merge instructions and punctuation rules
- Whether the Zod schema for measurements changes from `array(number)` to `string` (or a structured object) to accommodate the richer format

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Architecture Patterns

### Current Pipeline Architecture
```
Audio blob (Dexie)
  -> blobToBase64()
  -> Build Gemini payload (system prompt + JSON schema + audio)
  -> POST to proxy
  -> Parse JSON response
  -> Validate with Zod (catalogFieldsSchema)
  -> Post-process (toAllCaps, formatEstimate, mapCategoryToCode, formatMeasurements)
  -> Write to Supabase items table
  -> Refresh Zustand store
```

### Modified Pipeline (Phase 21)
```
Audio blob (Dexie)
  -> blobToBase64()
  -> READ EXISTING FIELDS from Supabase items table   <-- NEW
  -> Build Gemini payload (system prompt + existing fields as context + JSON schema + audio)  <-- MODIFIED
  -> POST to proxy
  -> Parse JSON response
  -> Validate with Zod (catalogFieldsSchema)           <-- SCHEMA CHANGED
  -> Post-process (toAllCaps, formatEstimate, mapCategoryToCode)  <-- formatMeasurements REMOVED (AI returns formatted string)
  -> Write to Supabase items table (direct write, no merge logic in app)
  -> Refresh Zustand store
```

### Key Files to Modify

| File | Changes |
|------|---------|
| `src/services/geminiSchema.ts` | `measurements`: `z.array(z.number()).nullable()` -> `z.string().nullable()` |
| `src/services/gemini.ts` | (1) System prompt: add merge instructions, punctuation rules, measurement expansion. (2) Read existing fields before Gemini call. (3) Pass existing fields as text context in the prompt. (4) Remove `formatMeasurements()` call from post-processing. (5) Transcript append logic may simplify (AI handles merge). |
| `src/utils/formatMeasurements.ts` | `formatMeasurements(inches: number[])` becomes unused by AI pipeline. Keep `parseMeasurements` and `reformatMeasurements` for the EditableField on-save reformat. Possibly deprecate or keep for backward compat. |
| `src/pages/ItemEntry.tsx` | Measurements EditableField `onSave` may need adjustment if `reformatMeasurements` no longer applies to the richer format. |
| `src/tests/gemini-schema.test.ts` | Update test data: `measurements` from `[36, 24, 18]` to `"36 x 24 x 18 in. (91.4 x 61 x 45.7 cm.)"` |
| `src/tests/gemini-pipeline.test.ts` | Update mock responses to return string measurements. Add tests for merge behavior (existing fields passed to Gemini). |
| `src/tests/formatMeasurements.test.ts` | Keep existing tests. Possibly add tests for new format strings if reformatMeasurements is updated. |

### Pattern: Passing Existing Fields as Context

The existing transcript append logic (gemini.ts:181-191) already reads the current item from Supabase before writing. For smart merging, this pattern expands: read ALL current field values before calling Gemini, and include them in the prompt text part.

```typescript
// Before building Gemini payload, read existing fields
const { data: currentItem } = await supabase
  .from("items")
  .select("title, description, condition, estimate, category, measurements, transcript")
  .eq("id", itemId)
  .maybeSingle();

// Include in the text prompt part alongside audio
const existingContext = currentItem ? `
EXISTING FIELD VALUES (merge with, do not overwrite unless explicitly asked):
- Title: ${currentItem.title ?? "(empty)"}
- Description: ${currentItem.description ?? "(empty)"}
- Condition: ${currentItem.condition ?? "(empty)"}
- Estimate: ${currentItem.estimate ?? "(empty)"}
- Category: ${currentItem.category ?? "(empty)"}
- Measurements: ${currentItem.measurements ?? "(empty)"}
- Transcript: ${currentItem.transcript ?? "(empty)"}
` : "";
```

This replaces the current separate transcript-only read (gemini.ts:181-186). The existing read can be moved earlier, before the Gemini API call.

### Anti-Patterns to Avoid
- **Client-side merge logic:** D-03 explicitly says AI returns final merged values. Do NOT build diff/patch logic in the app.
- **Post-processing the measurements string:** Since measurements are now a free-form string from the AI, do NOT run formatMeasurements() on it. The AI formats directly.
- **Separate punctuation post-processor:** D-11 explicitly says no post-processing code. Punctuation is handled in the prompt.

## Schema Change Decision

**Recommendation: Change measurements from `z.array(z.number()).nullable()` to `z.string().nullable()`.**

Rationale:
1. The new measurements format includes mixed types: dimensions with units, weight with units, karats. This cannot be represented as `array(number)`.
2. The Supabase `measurements` column is already `text` -- no migration needed.
3. The AI will return the fully formatted string (e.g., "4 x 6 in. (10.2 x 15.2 cm.), 2.5 oz., 18kt").
4. The `formatMeasurements()` utility becomes unused by the AI pipeline (AI does the formatting).
5. The export pipeline (`export.ts` line 121) already passes `item.measurements` as a string -- no change needed.

**Impact on reformatMeasurements:** The EditableField for measurements calls `reformatMeasurements()` on save. With the new richer format (including weight, karats), `parseMeasurements()` will return null for strings it cannot parse, and `reformatMeasurements()` will return the string as-is. This is safe behavior -- unparseable strings pass through unchanged.

## Weight Unit Formatting (Claude's Discretion)

**Decision: Use "oz." and "g" -- standard auction catalog abbreviations.**

Rationale from auction catalog conventions:
- Christie's, Sotheby's, and RFC Invaluable use abbreviated forms
- "oz." with period (matches "in." convention)
- "g" without period (standard metric abbreviation)
- "kt" for karats (standard jewelry convention, no period)

Examples:
- `"4 x 6 in. (10.2 x 15.2 cm.), 2.5 oz., 18kt"`
- `"12 in. (30.5 cm.), 450 g, 14kt"`
- `"8 x 6 mm, 2.1 oz."`

## System Prompt Design

### Merge Instructions (addition to SYSTEM_PROMPT)

The prompt needs three new sections added to the existing SYSTEM_PROMPT:

1. **Merge behavior rules** -- explaining that existing field values are provided and the AI should merge/append/edit based on user intent
2. **Measurement expansion rules** -- explaining the richer format with mm, weight, karats
3. **Spoken punctuation rules** -- explaining how to interpret spoken punctuation words

Key prompt engineering considerations:
- Existing field values should be presented clearly with labels
- The "default is additive" rule needs explicit emphasis
- Measurement formatting rules should include examples
- Punctuation vocabulary should be listed with examples

### Prompt Structure

```
[Existing SYSTEM_PROMPT content]

MERGE RULES:
When existing field values are provided below, your job is to MERGE new information with existing values:
- Default behavior: APPEND new information to existing values
- If the speaker says "change X to Y" or "replace X with Y", modify the existing value accordingly
- If the speaker says "add X to the title/description", append X to the existing value
- Only OVERWRITE a field if the speaker explicitly asks (e.g., "replace the description with...")
- If a field has no existing value, write the new value directly
- For transcript: always append new speech to existing transcript

MEASUREMENTS FORMAT:
Return measurements as a single formatted string (not an array of numbers).
- Dimensions in inches: format as "N x N in. (N x N cm.)" with auto cm conversion
- Dimensions in millimeters: only if speaker says "millimeters" or "mm". Format as "N x N mm" (no conversion)
- Default unit when none specified: inches
- Weight: "N oz." for ounces, "N g" for grams. No pounds.
- Karats: "Nkt" (e.g., "18kt")
- Combine all in one string: "4 x 6 in. (10.2 x 15.2 cm.), 2.5 oz., 18kt"
- Common fractions (1/4, 1/2, 3/4) should be written as fractions in inches

SPOKEN PUNCTUATION:
When the speaker says punctuation words, convert them to actual punctuation:
- "comma" -> ","
- "period" / "full stop" -> "."
- "semicolon" -> ";"
- "colon" -> ":"
- "dash" / "hyphen" -> "-"
- "parenthesis" / "open parenthesis" -> "("
- "close parenthesis" / "end parenthesis" -> ")"
- "quote" / "open quote" -> opening quotation mark
- "unquote" / "close quote" / "end quote" -> closing quotation mark
- "exclamation point" / "exclamation mark" -> "!"
- "question mark" -> "?"
Use context to distinguish: "period" as punctuation vs "period" as a time era.
Apply to ALL fields: title, description, condition, transcript, etc.
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Field merge logic | Custom diff/patch system | Gemini prompt instructions | D-03: AI returns final values, no app-side merge |
| Punctuation parsing | Regex post-processor | Gemini prompt instructions | D-11: No post-processing code layer |
| Measurement formatting | Complex parser for mixed units | Gemini prompt instructions | AI returns the formatted string directly |
| Unit conversion (mm to in) | Conversion utility | None needed | D-07: mm appended as-is, no conversion |

## Common Pitfalls

### Pitfall 1: Existing Field Read Timing
**What goes wrong:** Reading existing fields after the Gemini call means the AI cannot merge.
**Why it happens:** The current code reads transcript only after getting AI results (gemini.ts:181-186).
**How to avoid:** Move the Supabase read BEFORE building the Gemini payload. Read all fields, not just transcript.
**Warning signs:** AI returns standalone values ignoring existing content.

### Pitfall 2: formatMeasurements Still Called on String
**What goes wrong:** After changing measurements to string in the schema, the post-processing code (gemini.ts:177-179) still tries to call `formatMeasurements()` expecting `number[]`.
**Why it happens:** Forgetting to update the post-processing section after schema change.
**How to avoid:** Remove the `formatMeasurements()` call from gemini.ts. The AI returns the formatted string directly. Simply write `fields.measurements` to the update object.
**Warning signs:** TypeScript error -- `string` is not assignable to `number[]`.

### Pitfall 3: Transcript Double-Append
**What goes wrong:** The current code appends transcript separately (gemini.ts:189-191). If the AI also appends (because merge rules tell it to), transcript gets doubled.
**Why it happens:** Both the AI and the app code are doing append.
**How to avoid:** Since merge rules tell the AI to handle transcript appending (existing transcript is passed as context), remove the app-side append logic. The AI returns the final merged transcript. Write it directly.
**Warning signs:** Transcript content appears twice after re-recording.

### Pitfall 4: Gemini JSON Schema Mismatch
**What goes wrong:** The Zod schema changes to `z.string().nullable()` but the JSON schema sent to Gemini still describes `array(number)`.
**Why it happens:** `catalogFieldsJsonSchema` is derived from `catalogFieldsSchema` via `toJSONSchema()`. If the Zod schema is updated correctly, the JSON schema updates automatically. But if someone hard-codes the schema, it drifts.
**How to avoid:** Verify that `toJSONSchema(catalogFieldsSchema)` reflects the new string type after the change.
**Warning signs:** Gemini returns `[36, 24]` instead of `"36 x 24 in. (91.4 x 61 cm.)"`.

### Pitfall 5: EditableField reformatMeasurements Breaking
**What goes wrong:** User manually edits measurements to "2.5 oz., 18kt" and `reformatMeasurements()` tries to parse/reformat it.
**Why it happens:** `parseMeasurements()` returns null for non-dimension strings, so `reformatMeasurements()` returns the string as-is. This is actually safe.
**How to avoid:** Verify this pass-through behavior works. No code change needed -- `reformatMeasurements` already returns unparseable strings unchanged.
**Warning signs:** None expected -- existing code handles this gracefully.

### Pitfall 6: First Recording Has No Existing Fields
**What goes wrong:** On first recording, all fields are null/empty. The merge context section of the prompt is all "(empty)".
**Why it happens:** Normal first-use case.
**How to avoid:** Make the prompt handle this gracefully. When all existing fields are empty, the AI should extract normally without merge behavior. The prompt should say "If no existing values, extract normally."
**Warning signs:** AI returns null for fields that should have been extracted because it thinks it needs to "merge" with nothing.

## Code Examples

### Schema Change (geminiSchema.ts)
```typescript
// BEFORE
measurements: z
  .array(z.number())
  .nullable()
  .describe("Array of 1-3 measurement numbers in inches..."),

// AFTER
measurements: z
  .string()
  .nullable()
  .describe("Formatted measurements string combining dimensions, weight, and karats. Example: '4 x 6 in. (10.2 x 15.2 cm.), 2.5 oz., 18kt'. Return null if no measurements mentioned."),
```

### Existing Field Read (gemini.ts)
```typescript
// Read existing fields BEFORE Gemini call (replaces transcript-only read at line 181)
const { data: currentItem } = await supabase
  .from("items")
  .select("title, description, condition, estimate, category, measurements, transcript")
  .eq("id", itemId)
  .maybeSingle();

if (!currentItem) return; // Item deleted mid-processing

const hasExistingData = Object.values(currentItem).some(v => v !== null);
```

### Context Injection in Prompt (gemini.ts)
```typescript
// In the contents array, add existing field context as a text part
const textPart = hasExistingData
  ? `Extract and MERGE catalog fields from this audio recording with the existing values below.\n\nEXISTING VALUES:\nTitle: ${currentItem.title ?? "(empty)"}\nDescription: ${currentItem.description ?? "(empty)"}\nCondition: ${currentItem.condition ?? "(empty)"}\nEstimate: ${currentItem.estimate ?? "(empty)"}\nCategory: ${currentItem.category ?? "(empty)"}\nMeasurements: ${currentItem.measurements ?? "(empty)"}\nTranscript: ${currentItem.transcript ?? "(empty)"}`
  : "Extract catalog fields from this audio recording.";
```

### Post-Processing Simplification (gemini.ts)
```typescript
// BEFORE (lines 177-179)
if (fields.measurements !== null && fields.measurements.length > 0) {
  supabaseUpdate.measurements = formatMeasurements(fields.measurements);
}

// AFTER
if (fields.measurements !== null) {
  supabaseUpdate.measurements = fields.measurements;
}

// BEFORE (lines 181-191 -- transcript append)
if (fields.transcript !== null) {
  const { data: currentItem } = await supabase...
  supabaseUpdate.transcript = prev ? `${prev}\n\n${fields.transcript}` : fields.transcript;
}

// AFTER (AI handles merge, write directly)
if (fields.transcript !== null) {
  supabaseUpdate.transcript = fields.transcript;
}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | vitest.config.ts (assumed, standard Vite project) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01/D-02 | Existing fields passed to Gemini as context | unit | `npx vitest run src/tests/gemini-pipeline.test.ts -x` | Needs update |
| D-03 | AI returns final merged values, written directly | unit | `npx vitest run src/tests/gemini-pipeline.test.ts -x` | Needs update |
| D-05/D-09 | Measurements schema accepts string with dimensions+weight+karats | unit | `npx vitest run src/tests/gemini-schema.test.ts -x` | Needs update |
| D-06/D-07 | mm handling in measurements string | unit | `npx vitest run src/tests/gemini-schema.test.ts -x` | Needs new test |
| D-10/D-11 | Spoken punctuation in prompt (no post-processing) | unit | `npx vitest run src/tests/gemini-pipeline.test.ts -x` | Needs new test |
| Schema | measurements z.string().nullable() validates correctly | unit | `npx vitest run src/tests/gemini-schema.test.ts -x` | Needs update |
| Compat | reformatMeasurements passes through rich format strings | unit | `npx vitest run src/tests/formatMeasurements.test.ts -x` | Needs new test |

### Sampling Rate
- **Per task commit:** `npx vitest run src/tests/gemini-schema.test.ts src/tests/gemini-pipeline.test.ts src/tests/formatMeasurements.test.ts -x`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Update `gemini-schema.test.ts` -- measurements field from array to string in all test cases
- [ ] Update `gemini-pipeline.test.ts` -- mock responses return string measurements; add merge behavior tests
- [ ] Add `formatMeasurements.test.ts` cases for rich format pass-through

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `measurements: z.array(z.number())` | `measurements: z.string()` | Phase 21 | AI returns formatted string, no post-processing |
| Transcript-only read before write | All-fields read before Gemini call | Phase 21 | Enables smart merge |
| Overwrite fields on re-record | Merge/append by default | Phase 21 | Non-destructive re-recordings |
| No punctuation handling | Prompt-level spoken punctuation | Phase 21 | User can dictate commas, parentheses, etc. |

## Open Questions

1. **How does the Chrome extension handle the new measurements format?**
   - What we know: Extension fills `#dimetext/fld3` with the measurements string. Since it is already a text field, the richer format should pass through.
   - What's unclear: Whether RFC Invaluable has field length limits or format validation on the dimensions field.
   - Recommendation: Test with a sample import after implementation. The string is still human-readable auction catalog format.

2. **Should formatMeasurements utility be preserved or deprecated?**
   - What we know: `reformatMeasurements` is still called from ItemEntry.tsx on manual edit. It safely passes through unparseable strings.
   - What's unclear: Whether users will ever manually type pure dimension numbers that should be auto-formatted.
   - Recommendation: Keep the utility. It handles the simple case (user types "36 x 24") and passes through the complex case ("36 x 24 in. (91.4 x 61 cm.), 2.5 oz.") unchanged.

## Sources

### Primary (HIGH confidence)
- `src/services/geminiSchema.ts` -- current Zod schema (read directly)
- `src/services/gemini.ts` -- current system prompt and pipeline (read directly)
- `src/utils/formatMeasurements.ts` -- current formatting utility (read directly)
- `supabase/migrations/20260318000002_create_items.sql` -- measurements column is `text` (read directly)
- `src/db/database.types.ts` -- TypeScript type confirms `measurements: string | null` (grep verified)
- `src/utils/export.ts` -- export passes measurements as string (grep verified)

### Secondary (MEDIUM confidence)
- Auction catalog conventions for weight/karat abbreviations (domain knowledge, consistent across Christie's/Sotheby's catalogs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries, all changes to existing files
- Architecture: HIGH - pipeline modification pattern well-understood from codebase reading
- Pitfalls: HIGH - identified from direct code analysis of current pipeline

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable domain, no external dependency changes)
