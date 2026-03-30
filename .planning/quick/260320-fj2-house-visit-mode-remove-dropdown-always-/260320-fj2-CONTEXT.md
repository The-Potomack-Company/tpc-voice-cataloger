# Quick Task 260320-fj2: House Visit Mode UX Overhaul - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Task Boundary

Separate house visit mode UX from sale mode. In house visit mode: remove inline editing dropdown, always navigate to full item page, move AI formatting/recording to item page, add back-to-session header and left/right item navigation arrows.

</domain>

<decisions>
## Implementation Decisions

### Item Card Tap Behavior (House Visit Mode)
- Dropdown chevron arrow still works — toggling a **bare summary** of fields only (title, description, measurements, condition, estimate, category)
- NO mic button in the expanded dropdown (recording happens on the item page)
- NO transcript display in the expanded dropdown
- Keep indicator icons for recordings and photos in collapsed row
- Clicking **anywhere except the chevron arrow** navigates to the full item page
- Sale mode remains completely unchanged

### AI Processing Trigger
- Primary recording and AI processing happens on the **item page** in house visit mode
- "Retry All Stuck" button remains on session detail page for bulk retry
- Individual recording/re-recording moves to item page only
- Remove inline mic button from ItemCard in house visit mode

### Left/Right Navigation Arrows
- Left arrow disabled on first item, right arrow on last item **creates a new item** and navigates to it
- Arrows positioned at middle edges of the screen
- Navigate between items within the same session

</decisions>

<specifics>
## Specific Ideas

- Back-to-session link in the top header area of item page
- Left/right arrows at middle edges of screen for item-to-item navigation
- Expanded dropdown in house visit mode shows only formatted field values (read-only summary), no editing controls, no mic, no transcript
- Sale mode behavior is completely untouched by this change

</specifics>
