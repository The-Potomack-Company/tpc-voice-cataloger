# Quick Task 260402-dor: Ability to merge two items together into one - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Task Boundary

Add the ability to merge two items together into one within a session. User selects two items, merges them into a single item combining all fields and media.

</domain>

<decisions>
## Implementation Decisions

### Selection UX
- Long-press an item to enter multi-select mode with checkboxes
- User selects exactly 2 items, then taps a Merge button in a floating toolbar
- Existing tap-to-expand and swipe-to-delete remain unchanged when not in select mode

### Field Conflict Resolution
- Concatenate both items' values with a separator (semicolon for short fields, newline for long fields)
- Title: "VICTORIAN CHAIR; OTTOMAN"
- Description: append second after first
- Transcript: always append with separator
- Estimate, condition, measurements: concatenate with semicolon
- Category: keep first item's category (single value field)
- If only one item has a value for a field, use that value directly (no separator)

### Photos & Audio
- Move all photos and audio recordings from the source (absorbed) item to the target item
- Nothing is lost -- all media reassigned to the surviving item
- Photos: update item_id in Supabase photos table + Dexie
- Audio: update item references in Dexie

### Claude's Discretion
- Target item is the first item selected (or the one with lower sort_order)
- Both items must be in the same session (enforce in UI and logic)
- Both items must be the same mode (house/sale) -- enforced by being in same session
- After merge, re-sort remaining items to close any gaps
- AI status on merged item resets to 'done' if both were 'done', otherwise keeps current target status

</decisions>

<specifics>
## Specific Ideas

- The floating toolbar should show "Merge (2)" when exactly 2 items selected, disabled otherwise
- Long-press visual feedback: subtle highlight + checkbox appearance
- Confirmation dialog before merge executes ("Merge Item #X into Item #Y?")
- Undo is not required (confirmation dialog serves as safety gate)

</specifics>

<canonical_refs>
## Canonical References

No external specs -- requirements fully captured in decisions above

</canonical_refs>
