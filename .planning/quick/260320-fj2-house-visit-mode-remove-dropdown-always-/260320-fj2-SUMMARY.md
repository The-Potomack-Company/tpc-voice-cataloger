---
phase: quick-260320-fj2
plan: 01
one_liner: "House mode item cards navigate to full item page on tap, chevron toggles read-only summary, left/right arrows for item-to-item navigation"
completed: "2026-03-20T15:23:15Z"
duration: "2 min"
tasks_completed: 2
tasks_total: 2
key_files:
  created: []
  modified:
    - src/components/ItemCard.tsx
    - src/pages/ItemEntry.tsx
decisions:
  - "BackButton always goes to session detail (left arrow handles item-to-item navigation)"
  - "House mode expanded section shows static label+value pairs instead of EditableField components"
  - "Right arrow on last item creates new blank item and navigates to it"
---

# Quick Task 260320-fj2: House Visit Mode UX Overhaul Summary

House mode item cards navigate to full item page on body tap, chevron toggles read-only field summary (no mic, no editing, no transcript), and item page has back-to-session link plus left/right navigation arrows at screen edges.

## Task Results

### Task 1: ItemCard house mode -- navigate on tap, chevron-only summary, remove mic
**Commit:** ab59852
**Files:** src/components/ItemCard.tsx

- Card body click in house mode navigates to `/session/:sessionId/item/:itemId`
- Chevron SVG wrapped in a `<button>` with `stopPropagation` -- toggles expand/collapse in all modes
- Mic button hidden when `item.mode === "house"`
- Expanded section in house mode renders static label/value pairs for title, description, measurements, condition, estimate, category (skipping empty fields)
- Sale mode expanded section fully preserved -- EditableField, transcript, retry AI, delete button all unchanged

### Task 2: ItemEntry -- back-to-session header and left/right navigation arrows
**Commit:** 52d4aae
**Files:** src/pages/ItemEntry.tsx

- BackButton simplified to always navigate to `/session/${sessionId}` with label "Back to Session"
- Computed `prevItem` and `nextItem` from items array by sort_order
- Left arrow: fixed position at left-1, top-1/2, navigates to previous item, visually disabled (opacity-30) on first item
- Right arrow: fixed position at right-1, top-1/2, navigates to next item or creates new blank item on last item
- Arrows only render in house mode when item exists (not isNewItem)
- Existing "Next Item" button at bottom preserved

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- TypeScript compiles without errors (both tasks verified with `npx tsc --noEmit`)
- Sale mode behavior completely unchanged (conditional branching on `item.mode`)

## Self-Check: PASSED

- [x] src/components/ItemCard.tsx exists
- [x] src/pages/ItemEntry.tsx exists
- [x] Commit ab59852 exists
- [x] Commit 52d4aae exists
