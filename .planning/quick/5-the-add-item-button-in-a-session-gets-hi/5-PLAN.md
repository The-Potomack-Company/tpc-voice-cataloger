---
phase: quick-5
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/pages/SessionDetail.tsx
autonomous: true
must_haves:
  truths:
    - "Floating Add Item button is always visible above item cards when scrolling"
    - "Floating Add Item button does not obscure dialogs, recording overlays, or toasts"
  artifacts:
    - path: "src/pages/SessionDetail.tsx"
      provides: "Floating Add Item button with correct z-index"
      contains: "z-30"
  key_links:
    - from: "src/pages/SessionDetail.tsx"
      to: "src/components/SwipeableRow.tsx"
      via: "z-index stacking context"
      pattern: "z-30.*fixed bottom"
---

<objective>
Fix the floating "Add Item" button on the SessionDetail page so it renders above ItemCard/SwipeableRow content instead of being hidden behind it.

Purpose: The SwipeableRow sliding content uses `z-20` while the floating button only has `z-10`, causing item cards to overlap and hide the button.
Output: Floating button always visible above cards, below overlays.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/pages/SessionDetail.tsx
@src/components/SwipeableRow.tsx

Z-index hierarchy in this app:
- SwipeableRow delete button: z-10 (relative, within card)
- SwipeableRow sliding content: z-20 (relative, within card)
- Floating Add Item button: z-10 (fixed) <-- BUG: same/lower than card content
- RecordingIndicator: z-40 (fixed)
- RecordingToast: z-50 (fixed)
- ConfirmDialog: z-50 (fixed)
- PhotoLightbox: z-50 (fixed)

Fix: Bump floating button to z-30 (above cards z-20, below overlays z-40+).
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix floating Add Item button z-index</name>
  <files>src/pages/SessionDetail.tsx</files>
  <action>
    In SessionDetail.tsx, find the floating Add Item button container (line ~406):
    ```
    <div className="fixed bottom-20 left-0 right-0 px-4 landscape:max-w-3xl landscape:mx-auto z-10">
    ```
    Change `z-10` to `z-30`. This places it above SwipeableRow content (z-20) but below RecordingIndicator (z-40) and dialogs (z-50).

    No other files need changes. The z-10/z-20 in SwipeableRow.tsx are correct for their internal stacking context (delete behind sliding content) and should not be modified.
  </action>
  <verify>
    <automated>cd C:/Users/maser/TPC_App && grep -n "z-30" src/pages/SessionDetail.tsx | grep -q "fixed bottom-20" && echo "PASS: z-30 applied to floating button" || echo "FAIL"</automated>
  </verify>
  <done>Floating Add Item button uses z-30, rendering above all ItemCard/SwipeableRow content (z-20) while remaining below recording overlays (z-40) and dialogs (z-50).</done>
</task>

</tasks>

<verification>
- `grep "z-30" src/pages/SessionDetail.tsx` shows the floating button line
- `grep "z-20" src/components/SwipeableRow.tsx` still present (unchanged)
- No other z-index values modified
- Dev server: floating button visible over item cards on scroll
</verification>

<success_criteria>
The floating "Add Item" button is always visible and tappable, floating above all item cards regardless of scroll position or swipe state. Overlays (recording indicator, toasts, dialogs) still render above the button.
</success_criteria>

<output>
After completion, create `.planning/quick/5-the-add-item-button-in-a-session-gets-hi/5-SUMMARY.md`
</output>
