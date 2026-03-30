---
phase: quick-7
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/services/gemini.ts
  - src/services/geminiSchema.ts
  - src/utils/categoryMapper.ts
  - src/utils/toTitleCase.ts
autonomous: true
requirements: [quick-7]
must_haves:
  truths:
    - "AI transcription returns RFC department codes instead of verbatim text"
    - "Spoken words like 'ceramics' resolve to department code 'CER'"
    - "Unknown categories default to 'FRN'"
    - "Item titles are stored in Title Case"
  artifacts:
    - path: "src/utils/categoryMapper.ts"
      provides: "Spoken-word-to-RFC-department-code mapper"
      exports: ["mapCategoryToCode"]
    - path: "src/utils/toTitleCase.ts"
      provides: "Title Case formatting utility"
      exports: ["toTitleCase"]
    - path: "src/services/gemini.ts"
      provides: "Updated system prompt and post-processing"
      contains: "mapCategoryToCode"
  key_links:
    - from: "src/services/gemini.ts"
      to: "src/utils/categoryMapper.ts"
      via: "import mapCategoryToCode"
      pattern: "mapCategoryToCode\\(fields\\.category"
    - from: "src/services/gemini.ts"
      to: "src/utils/toTitleCase.ts"
      via: "import toTitleCase"
      pattern: "toTitleCase\\(fields\\.title"
---

<objective>
Format AI transcription category output to store RFC department codes and apply Title Case to titles.

Purpose: The category field currently stores verbatim spoken text (e.g., "ceramics"), but the RFC Invaluable system requires specific department codes (e.g., "CER"). Titles also need consistent Title Case formatting.

Output: Updated Gemini prompt, TypeScript category mapper with fallback, Title Case utility, wired into processAudioWithAi pipeline.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/services/gemini.ts
@src/services/geminiSchema.ts
@src/utils/formatEstimate.ts
</context>

<interfaces>
<!-- Existing interfaces the executor needs -->

From src/services/geminiSchema.ts:
```typescript
export const catalogFieldsSchema = z.object({
  title: z.string().nullable(),
  description: z.string().nullable(),
  condition: z.string().nullable(),
  estimate: z.string().nullable(),
  category: z.string().nullable(),
  transcript: z.string().nullable(),
});
export type CatalogFields = z.infer<typeof catalogFieldsSchema>;
```

From src/services/gemini.ts (line 162, current category handling):
```typescript
updateData.category = fields.category ?? "furniture";
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Create categoryMapper and toTitleCase utilities</name>
  <files>src/utils/categoryMapper.ts, src/utils/toTitleCase.ts</files>
  <action>
Create `src/utils/toTitleCase.ts`:
- Export `toTitleCase(str: string): string` that capitalizes the first letter of each word, lowercases the rest.
- Handle edge cases: empty string returns empty, preserves spaces, handles single-word input.

Create `src/utils/categoryMapper.ts`:
- Export a `VALID_DEPARTMENT_CODES` constant Set containing all 47 codes: AA, AMER, AWFA, ANT, AAR, 0001, ASD, ASN, ASNP, BKS, CER, IND, CLK, CNS, DEC, DRW, ENT, EA, FASH, FIS, FRN, MDF, PER, GAR, GEN, GLS, ITS, ISL, JWL, LIT, MANU, MAP, MA, MUS, NAT, TXTL, PND, PNT, PEN, MIN, REL, RUG, SPT, SIL, TAP, TRI, WINE.
- Export a `KEYWORD_TO_CODE` record mapping common spoken words/phrases (lowercased) to department codes. Include at minimum:
  - "american art" -> "AA", "american" -> "AMER", "western" -> "AWFA", "antiquities" -> "ANT", "antiques" -> "ANT"
  - "arms" -> "AAR", "armour" -> "AAR", "armor" -> "AAR"
  - "art" -> "0001", "asian decorative" -> "ASD", "asian" -> "ASN"
  - "books" -> "BKS", "book" -> "BKS", "ceramics" -> "CER", "ceramic" -> "CER", "pottery" -> "CER"
  - "indian" -> "IND", "clocks" -> "CLK", "clock" -> "CLK", "coins" -> "CNS", "coin" -> "CNS"
  - "decorative" -> "DEC", "dec arts" -> "DEC"
  - "drawings" -> "DRW", "prints" -> "DRW", "photographs" -> "DRW", "photography" -> "DRW"
  - "entertainment" -> "ENT", "european" -> "EA", "fashion" -> "FASH", "clothing" -> "FASH"
  - "fishing" -> "FIS", "furniture" -> "FRN", "modern furniture" -> "MDF", "period furniture" -> "PER"
  - "garden" -> "GAR", "general" -> "GEN", "glass" -> "GLS", "glassware" -> "GLS"
  - "islamic" -> "ISL", "jewelry" -> "JWL", "jewellery" -> "JWL"
  - "lighting" -> "LIT", "chandeliers" -> "LIT", "chandelier" -> "LIT"
  - "manuscripts" -> "MANU", "manuscript" -> "MANU", "autographs" -> "MANU"
  - "maps" -> "MAP", "atlas" -> "MAP", "modern art" -> "MA"
  - "musical" -> "MUS", "instruments" -> "MUS"
  - "native american" -> "NAT", "textiles" -> "TXTL", "textile" -> "TXTL"
  - "paintings decorative" -> "PND", "paintings" -> "PNT", "painting" -> "PNT", "fine art" -> "PNT"
  - "pens" -> "PEN", "pen" -> "PEN", "miniatures" -> "MIN", "miniature" -> "MIN"
  - "religious" -> "REL", "icons" -> "REL", "rugs" -> "RUG", "rug" -> "RUG", "carpet" -> "RUG"
  - "sculpture" -> "SPT", "sculptures" -> "SPT", "silver" -> "SIL", "silverware" -> "SIL"
  - "tapestries" -> "TAP", "tapestry" -> "TAP", "tribal" -> "TRI", "wine" -> "WINE", "spirits" -> "WINE"
- Export `mapCategoryToCode(raw: string | null): string`:
  1. If null/empty, return "FRN".
  2. Trim and uppercase the input. If it matches a valid department code directly, return it.
  3. Trim and lowercase the input. Check KEYWORD_TO_CODE for exact match.
  4. If no exact match, check if any keyword is contained in the lowercased input (sort keywords by length descending so longer phrases match first, e.g., "modern furniture" matches before "furniture").
  5. If still no match, return "FRN".

Follow the same pattern as formatEstimate.ts: pure function, well-commented, exported.
  </action>
  <verify>
    <automated>npx vitest run --reporter=verbose 2>&1 | head -50</automated>
  </verify>
  <done>Both utility files exist with exported functions. mapCategoryToCode("ceramics") returns "CER", mapCategoryToCode("CER") returns "CER", mapCategoryToCode(null) returns "FRN", mapCategoryToCode("unknown stuff") returns "FRN". toTitleCase("oak side table") returns "Oak Side Table".</done>
</task>

<task type="auto">
  <name>Task 2: Update Gemini prompt and wire post-processing</name>
  <files>src/services/gemini.ts, src/services/geminiSchema.ts</files>
  <action>
In `src/services/geminiSchema.ts`:
- Update the `category` field description to: "The RFC department code that best matches the spoken category. Valid codes: AA, AMER, AWFA, ANT, AAR, 0001, ASD, ASN, ASNP, BKS, CER, IND, CLK, CNS, DEC, DRW, ENT, EA, FASH, FIS, FRN, MDF, PER, GAR, GEN, GLS, ITS, ISL, JWL, LIT, MANU, MAP, MA, MUS, NAT, TXTL, PND, PNT, PEN, MIN, REL, RUG, SPT, SIL, TAP, TRI, WINE. Return null if not mentioned."

In `src/services/gemini.ts`:
- Add imports at top: `import { mapCategoryToCode } from "../utils/categoryMapper";` and `import { toTitleCase } from "../utils/toTitleCase";`
- Update SYSTEM_PROMPT line for category (line ~12) from `"- category: The item category as spoken"` to:
  `"- category: The RFC department code matching the item category. Valid codes: AA, AMER, AWFA, ANT, AAR, 0001, ASD, ASN, ASNP, BKS, CER, IND, CLK, CNS, DEC, DRW, ENT, EA, FASH, FIS, FRN, MDF, PER, GAR, GEN, GLS, ITS, ISL, JWL, LIT, MANU, MAP, MA, MUS, NAT, TXTL, PND, PNT, PEN, MIN, REL, RUG, SPT, SIL, TAP, TRI, WINE. If uncertain, return the closest match."`
- Update title post-processing (around line 149-151): wrap `fields.title` with `toTitleCase`:
  ```typescript
  if (fields.title !== null) {
    updateData.title = toTitleCase(fields.title);
  }
  ```
- Update category post-processing (line 162): replace `updateData.category = fields.category ?? "furniture";` with:
  ```typescript
  updateData.category = mapCategoryToCode(fields.category);
  ```
  This handles the null case (defaults to "FRN" inside mapCategoryToCode) and normalizes any verbatim text the AI might still return.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>Gemini system prompt instructs AI to return department codes. Schema description updated. Title gets Title Case applied. Category goes through mapCategoryToCode with "FRN" default. TypeScript compiles without errors.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes with no errors
- `npx vitest run` passes all existing tests
- Manual: record audio saying "ceramics" -> category field stores "CER" not "ceramics"
- Manual: record audio saying "oak side table" -> title field stores "Oak Side Table"
</verification>

<success_criteria>
- Category field stores RFC department codes (e.g., "CER", "BKS", "JWL") not verbatim text
- Unknown/unmatched categories default to "FRN"
- AI is prompted to return department codes directly
- TypeScript fallback mapper catches any AI misses
- Titles are formatted in Title Case
- All existing tests pass, no type errors
</success_criteria>

<output>
After completion, create `.planning/quick/7-format-ai-transcription-category-output-/7-SUMMARY.md`
</output>
