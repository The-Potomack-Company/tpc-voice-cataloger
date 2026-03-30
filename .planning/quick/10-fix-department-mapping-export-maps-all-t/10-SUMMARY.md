---
phase: quick-10
plan: 01
subsystem: export, ai-pipeline, chrome-extension
tags: [department-codes, categoryMapper, export-schema, import-controller]

requires:
  - phase: 07-chrome-extension
    provides: Import controller with department dropdown setting
  - phase: 05-ai-pipeline
    provides: mapCategoryToCode and Gemini field extraction
provides:
  - "mapCategoryToCode returns null for null/empty/unrecognized input (no FRN default)"
  - "Export JSON uses 'department' field name for RFC department codes"
  - "Chrome extension import handles both 'department' and 'category' fields"
affects: [export, import, ai-pipeline, chrome-extension]

tech-stack:
  added: []
  patterns: ["Nullable return from mapping functions when no match found"]

key-files:
  created: []
  modified:
    - src/utils/categoryMapper.ts
    - src/services/gemini.ts
    - src/db/types.ts
    - src/utils/export.ts
    - src/tests/export.test.ts
    - ../TPC_AI_Cataloger/src/content/modules/importController.js

key-decisions:
  - "mapCategoryToCode returns null instead of FRN for unmapped input -- items without recognized department stay empty"
  - "Export field renamed from category to department for clarity -- these are RFC Invaluable department codes"
  - "Import reads item.department first, falls back to item.category for backward compat with old exports"

requirements-completed: [FIX-DEPT-MAPPING, FIX-DEPT-IMPORT]

duration: 2min
completed: 2026-03-16
---

# Quick Task 10: Fix Department Mapping Summary

**mapCategoryToCode returns null for unmapped input instead of defaulting to FRN, export field renamed from category to department with backward-compatible import**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-16T17:56:59Z
- **Completed:** 2026-03-16T17:58:46Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- mapCategoryToCode no longer silently assigns every unmapped item to Furniture (FRN)
- Export JSON field renamed from `category` to `department` matching RFC Invaluable terminology
- Chrome extension import reads both `department` (new) and `category` (old) for backward compatibility
- All 12 export tests pass including new department field test
- TypeScript compiles cleanly with no errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix mapCategoryToCode null fallback and rename export field to department** - `ea66e74` (fix)
2. **Task 2: Add backward-compatible department reading in Chrome extension import** - `a61501f` (fix, in TPC_AI_Cataloger repo)

## Files Created/Modified
- `src/utils/categoryMapper.ts` - Return null instead of "FRN" for null/empty/unrecognized input
- `src/services/gemini.ts` - Only set category when mapCategoryToCode returns non-null
- `src/db/types.ts` - ExportSchema: category field renamed to department
- `src/utils/export.ts` - buildExportData outputs department instead of category
- `src/tests/export.test.ts` - New test verifying department field in export output
- `TPC_AI_Cataloger/src/content/modules/importController.js` - Backward-compatible department/category reading

## Decisions Made
- mapCategoryToCode returns null for unmapped input rather than a default code -- preserves data integrity
- Export field renamed to `department` since these are RFC Invaluable department codes, not generic categories
- Backward compatibility in import via `item.department || item.category` fallback pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

---
*Quick Task: 10-fix-department-mapping-export-maps-all-t*
*Completed: 2026-03-16*
