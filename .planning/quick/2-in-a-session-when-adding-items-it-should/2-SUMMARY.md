---
phase: quick
plan: 2
subsystem: ui-behavior
tags: [item-list, collapse, scroll, ux]
dependency_graph:
  requires: []
  provides: [collapse-on-add, scroll-to-new-item]
  affects: [ItemList, SessionDetail]
tech_stack:
  added: []
  patterns: [ref-callback-to-parent, data-attribute-scroll-target]
key_files:
  created: []
  modified:
    - src/components/ItemList.tsx
    - src/pages/SessionDetail.tsx
decisions:
  - Used data-item-id attribute + querySelector for scroll targeting (simpler than ref map)
  - Used onAddItemRef callback ref pattern to share handleAddItem between ItemList and SessionDetail
  - 100ms setTimeout for DOM settle before scrollIntoView (Dexie live query re-render delay)
metrics:
  duration: 7min
  completed: 2026-03-16
---

# Quick Task 2: Auto-collapse and Scroll-to-New on Add Item Summary

Collapse all expanded items and smooth-scroll to new item when adding via either Add Item button, using data-attribute scroll targeting and ref-based handler sharing.

## What Was Done

### Task 1: Collapse all + expand new + scroll to new item on add (f4e085f)

**ItemList.tsx changes:**
- Added `newItemId` state to track freshly created items
- Modified `handleAddItem` to replace expanded set with only the new item ID (collapses all others)
- Added useEffect that scrolls to `[data-item-id="N"]` element after 100ms DOM settle delay
- Wrapped each ItemCard in a div with `data-item-id={item.id}` for scroll targeting
- Added `onAddItemRef` prop to expose `handleAddItem` to parent components

**SessionDetail.tsx changes:**
- Created `addItemRef` and passed to `<ItemList onAddItemRef={addItemRef}>`
- Updated floating button's `handleAddItem` to delegate to ItemList's handler (with fallback to direct createBlankItem)

### Task 2: Verify collapse and scroll behavior on device (checkpoint)

User verified on device: "Works correctly" -- both inline and floating Add Item buttons collapse existing expanded items, expand the new item, and scroll to it.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- TypeScript compiles: PASSED (npx tsc --noEmit -- clean)
- Both Add Item buttons trigger collapse-all + expand-new + scroll: PASSED (user verified)
- No visual regressions: PASSED (user verified)
- Individual expand/collapse toggle unchanged: PASSED (user verified)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | f4e085f | feat(quick-2): collapse all items + scroll to new on add |

## Self-Check: PASSED

- [x] src/components/ItemList.tsx exists
- [x] src/pages/SessionDetail.tsx exists
- [x] .planning/quick/2-in-a-session-when-adding-items-it-should/2-SUMMARY.md exists
- [x] Commit f4e085f exists
