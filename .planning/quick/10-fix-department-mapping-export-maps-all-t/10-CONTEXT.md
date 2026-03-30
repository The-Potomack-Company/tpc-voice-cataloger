# Quick Task 10: Fix department mapping on export and import - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Task Boundary

Fix two department mapping bugs:
1. TPC_App export: `mapCategoryToCode()` defaults too aggressively to "FRN" — items with null/unmapped categories all export as FRN instead of preserving the actual AI-returned value
2. TPC_AI_Cataloger import: When importing JSON, the department dropdown is never set because the import checks for `item.department` but the export JSON field is called `category`

</domain>

<decisions>
## Implementation Decisions

### FRN fallback behavior
- The category field already stores department codes (letter codes like FRN, SIL, etc.) in the database
- Export should include these codes in the JSON as-is — they should be correct department codes
- The issue is `mapCategoryToCode()` defaulting null/unmapped AI responses to "FRN" instead of preserving the original value or leaving empty

### Field naming (export → import)
- Rename `category` to `department` in the TPC_App export schema and export data
- This is more accurate since these ARE RFC Invaluable department codes
- Update TPC_AI_Cataloger import to read from `item.department` (which it already checks for — the field name mismatch was the bug)

### Import department setting
- Import controller already has department-setting code at line 176 (`item.department` check)
- Once the export field is renamed from `category` to `department`, the existing import code should work
- The import should set the RFC department dropdown based on the department code from the JSON file

### Scope
- Both repos: TPC_App (export fix + field rename) and TPC_AI_Cataloger (verify import works with renamed field)

### Claude's Discretion
- How to handle backward compatibility (old exports with `category` field)

</decisions>

<specifics>
## Specific Ideas

- `mapCategoryToCode()` in `src/utils/categoryMapper.ts` — change null/unmapped fallback behavior
- `ExportSchema` in `src/db/types.ts` — rename `category` to `department`
- `buildExportData()` in `src/utils/export.ts` — export `department` instead of `category`
- Import controller in extension already handles `item.department` — verify it works once export is fixed
- Consider supporting both `item.department` and `item.category` in import for backward compat with old export files

</specifics>
