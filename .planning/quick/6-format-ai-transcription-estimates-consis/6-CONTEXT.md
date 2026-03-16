# Quick Task 6: Format AI transcription estimates consistently - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Task Boundary

Format AI transcription estimates consistently: single number as range, two numbers as lower-higher format. Currently the AI transcription processing is purely separation (verbatim extraction) — estimates need specific formatting.

</domain>

<decisions>
## Implementation Decisions

### Approach
- Hybrid: Update Gemini system prompt to request formatted estimates + lightweight post-processing code as safety net

### Output Format
- Format: `X - Y` (no dollar signs, spaces around dash)
- Two numbers spoken → sort low to high, format as `low - high`
- Single number spoken → ±20% spread, round each to nearest 100 (unless value < 100)
- No numbers detected → return null

### Rounding Rules
- ±20% then round each (low and high) to nearest 100
- Below 100: keep as-is (no rounding)
- Examples:
  - "500" → 400 - 600
  - "750" → 600 - 900
  - "1200" → 1000 - 1400
  - "50" → 40 - 60 (below 100, no rounding to hundreds)
  - "300 to 500" → 300 - 500 (two numbers, just sort and format)

### Claude's Discretion
- Gemini prompt wording details
- Post-processing implementation specifics (regex patterns, edge case handling)

</decisions>

<specifics>
## Specific Ideas

- Update system prompt in `gemini.ts` to instruct Gemini to format estimates as `X - Y` ranges
- Add `formatEstimate()` utility function for post-processing validation
- Update Zod schema if needed (estimate stays as string)
- Post-processing: strip dollar signs, normalize spacing, apply range logic if Gemini returns raw number

</specifics>
