# Quick Task 260407-ke7: Jewelry karat vs carat differentiation in specialist - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Task Boundary

Jewelry has two types of karat: karat (gold purity) and carat (gem weight). The specialist AI should differentiate between these, and spelling should match the correct term in all output fields.

</domain>

<decisions>
## Implementation Decisions

### Disambiguation Logic
- Context-based + speaker clarification: AI uses context clues (numbers like 10/14/18/24 with gold references → karat; fractional numbers with gemstone names → carat) AND respects explicit speaker clarification when provided
- Both approaches work together — context is the default, speaker override takes priority

### Output Formatting
- Gold purity: `Nkt` (e.g., 14kt, 18kt, 24kt) — existing format, unchanged
- Gem weight: `Nct` (e.g., 1.5ct, 3ct) — new format, mirrors the compact kt pattern

### Spelling in Description
- Enforce correct spelling: "karat" for gold purity, "carat" for gem weight
- AI normalizes regardless of what the specialist actually said
- This applies to the description text field output

### Claude's Discretion
- Specific context clue rules and edge case handling

</decisions>

<specifics>
## Specific Ideas

- Current system prompt in gemini.ts treats all karat/carat/carrot as gold purity ("Nkt")
- Schema in geminiSchema.ts documents measurements format with "Karats: 'Nkt'"
- Need to update both the system prompt and schema documentation to reflect the dual measurement types
- Tests in gemini-schema.test.ts may need updating for carat examples

</specifics>
