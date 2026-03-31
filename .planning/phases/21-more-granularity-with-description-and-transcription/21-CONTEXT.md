# Phase 21: More Granularity with Description and Transcription - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Enhance the AI pipeline to support smart field merging (non-destructive re-recordings), expanded measurements (mm, weight, karats), and spoken punctuation parsing across all extracted fields. No new UI fields or pages -- this modifies AI behavior, the Gemini system prompt, the Zod schema, and the formatMeasurements utility.

</domain>

<decisions>
## Implementation Decisions

### Smart Field Merging
- **D-01:** New recordings append/merge with existing field values by default instead of overwriting. Users can give explicit edit instructions ("change description to say X", "add ROBERT to the title") and the AI interprets intent.
- **D-02:** The AI handles the merge -- existing field values are sent as context alongside the new audio to Gemini. Gemini sees current title/description/condition/etc and decides how to merge, edit, or append based on what the user said.
- **D-03:** The AI returns final merged values for each field (not value+action metadata). The app writes the result directly -- no diff/undo UI needed.
- **D-04:** Overwrite only happens when the user explicitly asks (e.g., "replace the description with..."). Default behavior is additive.

### Measurements Expansion
- **D-05:** All measurement types go in a single measurements field -- dimensions, weight, and karats together. Example: "4 x 6 in. (10.2 x 15.2 cm.), 2.5 oz., 18kt". Matches how RFC Invaluable expects a single dimensions field.
- **D-06:** Millimeters require the user to explicitly say "millimeters" or "mm" -- AI defaults to inches when no unit is specified. No auto-inference from item type.
- **D-07:** Millimeters are appended as-is with "mm" suffix -- no conversion to other units needed.
- **D-08:** Weight units supported: ounces and grams. No pounds.
- **D-09:** Karats are included in the measurements string (e.g., "18kt").

### Spoken Punctuation Parsing
- **D-10:** Punctuation parsing applies to ALL fields (title, description, condition, transcript, etc.), not just transcript. "Title: VASE comma BLUE" becomes "VASE, BLUE".
- **D-11:** Handled entirely in the AI prompt -- Gemini interprets spoken punctuation during extraction. No post-processing code layer.
- **D-12:** Common punctuation vocabulary: parenthesis/close parenthesis, comma, period, semicolon, colon, dash, hyphen, quote/unquote, exclamation point, question mark, etc. AI uses context to interpret.

### Claude's Discretion
- Weight unit formatting (e.g., "oz." vs "ounces", "g" vs "grams") -- pick the standard auction catalog convention
- Exact system prompt wording for merge instructions and punctuation rules
- Whether the Zod schema for measurements changes from `array(number)` to `string` (or a structured object) to accommodate the richer format

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### AI Pipeline
- `src/services/geminiSchema.ts` -- Zod schema defining all extracted fields (title, description, condition, estimate, category, measurements, transcript)
- `src/services/gemini.ts` -- System prompt, Gemini API call, field writing logic, transcript append logic
- `src/utils/formatMeasurements.ts` -- Current inch/cm formatting utility

### Item Entry UI
- `src/pages/ItemEntry.tsx` -- EditableField components for all catalog fields (description, measurements, etc.)

### Export Pipeline
- `src/utils/export.ts` -- JSON export that passes fields through to Chrome extension

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `EditableField` component -- already supports multiline, used for description
- `formatMeasurements` utility -- will need expansion for mm/weight/karats
- `formatEstimate` utility -- pattern for post-extraction formatting
- `mapCategoryToCode` utility -- pattern for AI output transformation

### Established Patterns
- Gemini system prompt + Zod schema define extraction contract
- `catalogFieldsSchema` in geminiSchema.ts is the single source of truth for AI output shape
- Field values written to Supabase `items` table after Zod validation
- Transcript already appends across recordings (gemini.ts:189-191) -- similar pattern can inform merge behavior

### Integration Points
- `processAudioWithAi()` in gemini.ts -- must be modified to read existing field values before calling Gemini
- Gemini proxy payload construction (gemini.ts:85-115) -- system prompt and schema sent here
- Supabase `items` table columns -- measurements column may need to accept richer string format

</code_context>

<specifics>
## Specific Ideas

- User example for merge: "change that description to say over instead of under" -- AI should find "under" in existing description and replace with "over"
- User example for merge: "add ROBERT to the title" -- AI should append ROBERT to existing title
- User example for punctuation: "parenthesis 18 karat parenthesis" should output "(18kt)"
- Measurements example: "4 x 6 in. (10.2 x 15.2 cm.), 2.5 oz., 18kt" -- all in one field

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 21-more-granularity-with-description-and-transcription*
*Context gathered: 2026-03-30*
