---
phase: quick-8
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/utils/toTitleCase.ts
  - src/services/gemini.ts
  - src/tests/gemini-pipeline.test.ts
autonomous: true
requirements: [QUICK-8]
must_haves:
  truths:
    - "AI-transcribed titles are formatted in ALL CAPS instead of Title Case"
  artifacts:
    - path: "src/utils/toTitleCase.ts"
      provides: "toAllCaps utility function"
    - path: "src/services/gemini.ts"
      provides: "Gemini pipeline calling toAllCaps on title"
  key_links:
    - from: "src/services/gemini.ts"
      to: "src/utils/toTitleCase.ts"
      via: "import toAllCaps"
      pattern: "toAllCaps"
---

<objective>
Change the title autoformatting from Title Case to ALL CAPS.

Purpose: User wants auction catalog titles displayed in all uppercase letters instead of capitalizing the first letter of each word.
Output: Updated utility function, service call, and test.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/utils/toTitleCase.ts
@src/services/gemini.ts
@src/tests/gemini-pipeline.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Change title formatting from Title Case to ALL CAPS</name>
  <files>src/utils/toTitleCase.ts, src/services/gemini.ts, src/tests/gemini-pipeline.test.ts</files>
  <action>
1. Rename `src/utils/toTitleCase.ts` to `src/utils/toAllCaps.ts`. Update the function:
   - Rename from `toTitleCase` to `toAllCaps`
   - Update JSDoc: "Convert a string to ALL CAPS"
   - Implementation: `return str.toUpperCase();` (keep the empty string guard)

2. In `src/services/gemini.ts` line 5: change import from `toTitleCase` to `toAllCaps` and update the path from `"../utils/toTitleCase"` to `"../utils/toAllCaps"`. On line 152, change `toTitleCase(fields.title)` to `toAllCaps(fields.title)`.

3. In `src/tests/gemini-pipeline.test.ts`:
   - Line 129: Update test description from "title gets Title Case" to "title gets ALL CAPS"
   - Line 144: Update comment from "Title gets Title Case applied" to "Title gets ALL CAPS applied"
   - Line 145: Change expected value from `"Oak Table, Kinda Beat Up"` to `"OAK TABLE, KINDA BEAT UP"`

4. Delete the old file `src/utils/toTitleCase.ts` after creating the new one.
  </action>
  <verify>
    <automated>cd C:/Users/maser/TPC_App && npx vitest run src/tests/gemini-pipeline.test.ts 2>&1 | tail -20</automated>
  </verify>
  <done>Title formatting produces ALL CAPS output. Test passes with uppercase expectation. No references to toTitleCase remain.</done>
</task>

</tasks>

<verification>
- `npx vitest run` -- all tests pass
- Grep for `toTitleCase` returns zero results in src/ (excluding node_modules)
</verification>

<success_criteria>
- AI-transcribed titles are formatted as ALL CAPS (e.g., "oak table" becomes "OAK TABLE")
- All existing tests updated and passing
- No dead references to old toTitleCase function
</success_criteria>

<output>
After completion, create `.planning/quick/8-change-the-autoformatting-for-titles-to-/8-SUMMARY.md`
</output>
