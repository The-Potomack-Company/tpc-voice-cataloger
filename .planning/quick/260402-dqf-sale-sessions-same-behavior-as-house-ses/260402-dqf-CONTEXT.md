# Quick Task 260402-dqf: Sale sessions same behavior as house sessions - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Task Boundary

Make sale session item detail view behave identically to house session item detail view:
- Full-screen detail view when clicking into a sale item
- All the same fields (title, description, measurements, condition, estimate, category)
- Transcript section below fields
- Big recording button in the middle
- Item navigation arrows (left/right between items)
- NO photo upload section (the only difference from house)

</domain>

<decisions>
## Implementation Decisions

### Sale Item Fields
- Show ALL house fields: Title, Description, Measurements, Condition, Estimate, Category
- AI fills them from audio transcription, same as house items
- Fields are editable by the user (not read-only)

### Receipt Number Placement
- Receipt number appears as the TOP field, above title
- Keeps the receipt number prominent since it's sale-specific

### Item Navigation
- Yes, sale items get the same left/right arrow navigation between items
- Matches house session behavior exactly

### Claude's Discretion
- Layout/spacing adjustments to accommodate receipt number field at top
- Any conditional rendering cleanup needed in ItemEntry.tsx

</decisions>

<specifics>
## Specific Ideas

- The existing `ItemEntry.tsx` already handles mode-aware rendering — modify the sale branch to show the same layout as house, minus PhotoCapture
- Receipt number field (ReceiptNumberInput component) placed above the first editable field
- Recording button should remain gated on valid receipt number (existing behavior)

</specifics>
