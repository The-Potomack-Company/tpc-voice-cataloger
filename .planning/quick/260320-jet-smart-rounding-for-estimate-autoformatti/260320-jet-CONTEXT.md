# Quick Task 260320-jet: Smart rounding for estimate autoformatting based on magnitude - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Task Boundary

Smart rounding for estimate autoformatting based on magnitude — round differently depending on how big the number is so estimates look clean at any scale.

</domain>

<decisions>
## Implementation Decisions

### Rounding tiers
- Round to 10^(floor(log10(value))) — i.e., the magnitude's "tens place":
  - < 10: round to nearest 1
  - < 100: round to nearest 10 (e.g. 50 -> 40 - 60)
  - < 1,000: round to nearest 100 (e.g. 900 -> 800 - 1000)
  - < 10,000: round to nearest 1,000 (e.g. 8000 -> 7000 - 9000)
  - < 100,000: round to nearest 10,000
  - Pattern continues for any magnitude
- The +/-20% spread stays unchanged
- Formula: `roundUnit = 10 ** Math.floor(Math.log10(value))`

### Multi-number inputs
- Keep exact — when user/AI gives an explicit range (e.g. "300 to 500"), respect those numbers as-is
- No change from current behavior

</decisions>

<specifics>
## Specific Ideas

- File: `src/utils/formatEstimate.ts`
- Tests: `src/tests/formatEstimate.test.ts`
- Current code rounds to nearest 100 only when value >= 100, with no rounding below 100
- New approach replaces the simple if/else with a single formula based on log10

</specifics>
