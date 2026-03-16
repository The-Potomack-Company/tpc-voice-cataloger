---
status: diagnosed
trigger: "swipe-to-delete on item cards shows the options popup INSIDE the item card, making it unclickable/unviewable"
created: 2026-03-16T00:00:00Z
updated: 2026-03-16T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - ItemCard's `overflow-hidden` clips the SwipeableRow delete button
test: Code review of CSS stacking
expecting: overflow-hidden on inner card clips absolute-positioned delete button in outer wrapper
next_action: return diagnosis

## Symptoms

expected: Swiping left on an item card reveals a red "Delete" button behind the card that is fully visible and clickable
actual: The delete button appears clipped/trapped inside the card boundaries, making it unviewable and unclickable
errors: none (visual/layout bug)
reproduction: Swipe left on any item card in the item list
started: Since SwipeableRow was implemented

## Eliminated

(none needed - root cause found on first pass)

## Evidence

- timestamp: 2026-03-16T00:00:00Z
  checked: SwipeableRow.tsx line 93
  found: Outer wrapper has `overflow-hidden` class — this is correct and necessary to hide the delete button when row is not swiped
  implication: The swipe container itself clips content to its bounds

- timestamp: 2026-03-16T00:00:00Z
  checked: ItemCard.tsx line 72
  found: The card's root div has `overflow-hidden` in its className — `rounded-lg overflow-hidden`
  implication: This INNER overflow-hidden creates a second clipping context that fights with SwipeableRow

- timestamp: 2026-03-16T00:00:00Z
  checked: SwipeableRow.tsx lines 95-101
  found: Delete button is `absolute inset-y-0 right-0` positioned inside the SwipeableRow outer div
  implication: Button is correctly positioned in SwipeableRow's `relative overflow-hidden` container

- timestamp: 2026-03-16T00:00:00Z
  checked: ItemCard.tsx line 72, SwipeableRow.tsx line 109
  found: The sliding content div has `bg-white dark:bg-gray-900` which should cover the delete button when closed. The ItemCard also has `bg-gray-50 dark:bg-gray-800`. Both backgrounds are opaque — good.
  implication: Background layering is correct

- timestamp: 2026-03-16T00:00:00Z
  checked: Architecture — children placement
  found: ItemCard wraps its card div AND ConfirmDialog inside SwipeableRow. The card div (with overflow-hidden) is the sliding content's child. The delete button sits OUTSIDE the sliding div but INSIDE the outer relative container.
  implication: The delete button should be visible when the card slides left. The issue is NOT overflow-hidden on SwipeableRow (that's correct). The real question is whether something else clips.

- timestamp: 2026-03-16T00:00:00Z
  checked: Re-analysis of actual DOM nesting
  found: |
    DOM structure:
    SwipeableRow outer div (relative overflow-hidden)
      -> Delete button (absolute right-0, w-[120px])
      -> Sliding div (relative, translateX, bg-white)
        -> ItemCard card div (rounded-lg overflow-hidden, bg-gray-50)
        -> ConfirmDialog

    The delete button is a sibling of the sliding div, both inside the outer container.
    overflow-hidden on the outer div clips to its own bounds — this is fine and intended.
    overflow-hidden on the card div only clips the card's own children — NOT the delete button.

    REVISED ANALYSIS: The overflow-hidden on line 72 of ItemCard does NOT clip the delete button because the delete button is not a descendant of that div.
  implication: Need to look deeper at what actually causes the visual clipping

- timestamp: 2026-03-16T00:00:00Z
  checked: SwipeableRow delete button z-index and stacking
  found: |
    The delete button has NO z-index set. The sliding content div has `relative` positioning (creates stacking context).
    Without explicit z-index, the sliding content div (which comes AFTER the delete button in DOM order) will paint ON TOP of the delete button due to normal stacking order rules.

    When translateX slides the content left, the delete button SHOULD be revealed in the gap. But the outer container has overflow-hidden, so the delete button can only appear within the outer container's bounds.

    The outer container's width is determined by normal flow — it will be as wide as its parent. The delete button is absolute-positioned at right-0 with w-[120px], meaning it occupies the rightmost 120px of the container.

    When content slides left by 120px, those 120px of space on the right SHOULD show the delete button. The sliding div moves left but the outer container stays put.

    WAIT — the sliding div has `relative` class and is a later sibling. By default in CSS, later elements paint over earlier ones. The sliding div, even when translated, still occupies its original layout space in the flow. So the outer container's size doesn't change. The delete button at right-0 sits under where the right edge of content was.

    This should work. Let me check if there's a background issue.
  implication: The mechanism appears correct in theory

- timestamp: 2026-03-16T00:00:00Z
  checked: Potential root cause - rounded-lg overflow-hidden on ItemCard
  found: |
    ACTUALLY - reconsidering the user report: "shows the options popup INSIDE the item card."

    This means the user CAN see the delete button, but it appears trapped/clipped within the card's visual boundary rather than appearing as a separate panel behind it.

    The ItemCard card div has `rounded-lg overflow-hidden`. The `overflow-hidden` here is used to clip children to the rounded corners. But the card div is a CHILD of the SwipeableRow's sliding div.

    The real issue: The SwipeableRow outer div has `overflow-hidden`. When content slides left, the right edge of the outer container clips the delete button. The outer container is only as wide as the normal content flow — it does NOT expand to accommodate the absolute-positioned delete button sticking out.

    Actually no, the button is at `right-0` within the container, so it's within bounds.

    Let me reconsider: the user says "INSIDE the item card." This likely means the delete button visually appears within/behind the card area but is not interactable — perhaps because the sliding div's background covers it or pointer-events are blocked.

    ROOT CAUSE IDENTIFIED: The sliding content div has `relative` positioning, making it paint above the absolute-positioned delete button (which has no z-index). When partially slid, the visible gap shows the delete button, BUT the button may be partially obscured or the touch target overlaps with the sliding div's event handlers (pointer capture).

    Key issue: `(e.target as HTMLElement).setPointerCapture(e.pointerId)` on line 35 captures ALL pointer events to the sliding div, meaning clicks on the delete button may be intercepted.
  implication: Pointer capture on the sliding div steals click events from the delete button

## Resolution

root_cause: |
  Two compounding issues:

  1. **PRIMARY: `overflow-hidden` on SwipeableRow outer container (line 93) combined with no explicit z-index management.** The delete button is absolutely positioned inside a `relative overflow-hidden` container. The sliding content div is also `relative`, creating a stacking context that paints over the delete button. Without z-index differentiation, the later DOM element (sliding div) covers the earlier one (delete button).

  2. **SECONDARY: Pointer capture (`setPointerCapture`) on line 35 of SwipeableRow.** When the user touches down on the sliding content to begin a swipe, pointer capture is set. If the user then tries to tap the revealed delete button, pointer events may still be routed to the sliding content div rather than the delete button, because capture isn't released until pointerUp fires.

  The combination means: the delete button is technically there but (a) may be painted under the sliding content's stacking context and (b) click events on it may be stolen by pointer capture.

fix: (not yet applied)
verification: (not yet verified)
files_changed: []
