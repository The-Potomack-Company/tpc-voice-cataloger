---
phase: quick-10
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/utils/categoryMapper.ts
  - src/services/gemini.ts
  - src/db/types.ts
  - src/utils/export.ts
  - src/tests/export.test.ts
autonomous: true
requirements: [FIX-DEPT-MAPPING, FIX-DEPT-IMPORT]

must_haves:
  truths:
    - "Items with null/unmapped AI category do NOT default to FRN — they remain empty"
    - "Export JSON uses 'department' field name instead of 'category'"
    - "Chrome extension import sets department dropdown when 'department' field is present"
    - "Chrome extension import also works with old export files that use 'category' field"
  artifacts:
    - path: "src/utils/categoryMapper.ts"
      provides: "mapCategoryToCode returns null for null/unmapped input"
      contains: "return null"
    - path: "src/db/types.ts"
      provides: "ExportSchema with department field"
      contains: "department"
    - path: "src/utils/export.ts"
      provides: "buildExportData outputs department"
      contains: "department: item.category"
  key_links:
    - from: "src/services/gemini.ts"
      to: "src/utils/categoryMapper.ts"
      via: "mapCategoryToCode call"
      pattern: "mapCategoryToCode"
    - from: "src/utils/export.ts"
      to: "src/db/types.ts"
      via: "ExportSchema type"
      pattern: "department"
---

<objective>
Fix two department mapping bugs across TPC_App and TPC_AI_Cataloger:
1. `mapCategoryToCode()` defaults null/unmapped values to "FRN" — should return null instead
2. Export JSON field is named `category` but import checks `item.department` — rename in export

Purpose: Items without a recognized department code should not be silently assigned to Furniture, and the Chrome extension should correctly set the department dropdown from exported data.
Output: Fixed categoryMapper, updated export schema, backward-compatible import.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/10-fix-department-mapping-export-maps-all-t/10-CONTEXT.md

<interfaces>
<!-- Key types and contracts the executor needs -->

From src/utils/categoryMapper.ts:
```typescript
export const VALID_DEPARTMENT_CODES = new Set([...]);
export const KEYWORD_TO_CODE: Record<string, string> = {...};
export function mapCategoryToCode(raw: string | null): string;
```

From src/db/types.ts (ExportSchema items array element):
```typescript
{
  title?: string;
  description?: string;
  condition?: string;
  estimate?: string;
  measurements?: string;
  category?: string;       // <-- rename to department
  transcript?: string;
  receiptNumber?: string;
  sortOrder: number;
  createdAt: string;
  photos: Array<{blob: string; sortOrder: number}>;
  audio: Array<{blob: string; mimeType: string; durationMs?: number}>;
}
```

From src/services/gemini.ts line 166:
```typescript
updateData.category = mapCategoryToCode(fields.category);
// Called unconditionally — null input produces "FRN"
```

From src/utils/export.ts line 81:
```typescript
category: item.category,
// Exports the DB field 'category' under key 'category'
```

From TPC_AI_Cataloger importController.js line 176:
```javascript
if (item.department) {
  // Sets department dropdown — but export sends 'category', not 'department'
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix mapCategoryToCode null fallback and rename export field to department</name>
  <files>
    src/utils/categoryMapper.ts,
    src/services/gemini.ts,
    src/db/types.ts,
    src/utils/export.ts,
    src/tests/export.test.ts
  </files>
  <action>
**A) Fix `mapCategoryToCode()` in `src/utils/categoryMapper.ts`:**
- Change return type from `string` to `string | null`
- Line 121 (`if (raw === null || raw.trim() === "")`): return `null` instead of `"FRN"`
- Line 145 (final fallback): return `null` instead of `"FRN"`
- Update the JSDoc comment on lines 112-117 to reflect new behavior: null/empty returns null, no-match returns null
- The function still returns a valid department code when one IS matched (steps 2-4 unchanged)

**B) Fix call site in `src/services/gemini.ts`:**
- Line 166: Change from unconditional assignment `updateData.category = mapCategoryToCode(fields.category)` to conditional:
  ```typescript
  const mappedCategory = mapCategoryToCode(fields.category);
  if (mappedCategory !== null) {
    updateData.category = mappedCategory;
  }
  ```
- This way, if AI returns null or an unrecognized string, the category field is left unchanged (not overwritten with FRN)

**C) Rename `category` to `department` in `ExportSchema` in `src/db/types.ts`:**
- In the `ExportSchema` interface, items array element: change `category?: string` to `department?: string`

**D) Update `buildExportData()` in `src/utils/export.ts`:**
- Line 81: Change `category: item.category` to `department: item.category`
- Note: The DB field is still called `category` on HouseVisitItem/SaleItem — only the EXPORT key changes to `department`

**E) Update export tests in `src/tests/export.test.ts`:**
- Add a test that verifies exported items have `department` field (not `category`)
- Create a session with a house visit item that has `category: "FRN"`, export it, verify `data.items[0].department === "FRN"` and `data.items[0].category === undefined`
  </action>
  <verify>
    <automated>cd C:/Users/maser/TPC_App && npx vitest run src/tests/export.test.ts --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <done>
- mapCategoryToCode returns null for null, empty, and unrecognized input (not "FRN")
- mapCategoryToCode still returns valid codes for recognized input (e.g., "furniture" -> "FRN", "SIL" -> "SIL")
- gemini.ts only sets category when mapCategoryToCode returns non-null
- ExportSchema uses `department` field name
- buildExportData outputs `department: item.category`
- Export test confirms `department` key in output
  </done>
</task>

<task type="auto">
  <name>Task 2: Add backward-compatible department reading in Chrome extension import</name>
  <files>C:/Users/maser/Projects/TPC_AI_Cataloger/src/content/modules/importController.js</files>
  <action>
In `fillFieldsVerbatim()` function (around line 176), update the department check to accept BOTH `item.department` (new export format) and `item.category` (old export format for backward compat):

Change:
```javascript
if (item.department) {
```

To:
```javascript
const deptCode = item.department || item.category;
if (deptCode) {
```

Then update the references inside that block:
- Line 180 comment: update to mention backward compat
- Line 181: change `item.department` to `deptCode` in the querySelector
- Line 182: change `item.department.padEnd(4)` to `deptCode.padEnd(4)`
- Line 185: the value assignment already uses the matched option's value, no change needed
- Line 189: change the Logger.warn department value from `item.department` to `deptCode`

This ensures:
- New exports (with `department` field) work correctly
- Old exports (with `category` field) also work via fallback
  </action>
  <verify>
    <automated>cd C:/Users/maser/Projects/TPC_AI_Cataloger && grep -n "department\|category" src/content/modules/importController.js | head -20</automated>
  </verify>
  <done>
- Import reads `item.department` first, falls back to `item.category`
- Both old and new export formats set the department dropdown correctly
- No other import behavior is changed
  </done>
</task>

</tasks>

<verification>
1. `cd C:/Users/maser/TPC_App && npx vitest run src/tests/export.test.ts` — all export tests pass including new department field test
2. `cd C:/Users/maser/TPC_App && npx tsc --noEmit` — no TypeScript errors from the rename
3. Grep verification: `grep -n "category" src/utils/export.ts` should show NO `category:` key in buildExportData output (only `department:`)
4. Grep verification: `grep -n "FRN" src/utils/categoryMapper.ts` should show FRN only in the KEYWORD_TO_CODE mapping (not as a default return)
</verification>

<success_criteria>
- mapCategoryToCode("furniture") returns "FRN" (keyword match still works)
- mapCategoryToCode(null) returns null (not "FRN")
- mapCategoryToCode("gibberish") returns null (not "FRN")
- Export JSON contains `department` field, not `category`
- Chrome extension import handles both `department` and `category` fields
- All existing tests pass, new export test passes
- TypeScript compiles without errors
</success_criteria>

<output>
After completion, create `.planning/quick/10-fix-department-mapping-export-maps-all-t/10-SUMMARY.md`
</output>
