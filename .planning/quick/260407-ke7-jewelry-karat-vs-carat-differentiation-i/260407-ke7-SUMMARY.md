# Quick Task 260407-ke7: Jewelry karat vs carat differentiation — Summary

**Completed:** 2026-04-07
**Commits:** 5f2fa88, 0c0b6ab

## What Changed

### Task 1: Add failing test for gem carat format
- Added 4 new test cases in `src/tests/gemini-schema.test.ts`
- Tests cover gem carat measurements (Nct format) and correct spelling enforcement

### Task 2: Update AI prompt and schema for karat vs carat disambiguation
- **`src/services/gemini.ts`** — Updated system prompt with disambiguation rules:
  - Context-based: numbers like 10/14/18/24 with gold → karat (Nkt); fractional numbers with gemstones → carat (Nct)
  - Speaker override: explicit "karat" or "carat" from specialist takes priority
  - Spelling enforcement: "karat" for gold purity, "carat" for gem weight in descriptions
- **`src/services/geminiSchema.ts`** — Updated measurements schema docs to reflect both `Nkt` and `Nct` formats

## Decisions Honored
- Context-based + speaker clarification disambiguation
- Nct compact format for gem weight (mirrors Nkt)
- Correct spelling enforced in description field
