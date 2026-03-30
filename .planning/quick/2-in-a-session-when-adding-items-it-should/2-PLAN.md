---
phase: quick
plan: 2
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/ItemList.tsx
  - src/pages/SessionDetail.tsx
autonomous: false
requirements: []
must_haves:
  truths:
    - "When user taps Add Item, all currently expanded items collapse"
    - "When user taps Add Item, the new item is expanded and scrolled into view"
    - "Both the inline Add Item button (ItemList) and floating Add Item button (SessionDetail) exhibit this behavior"
  artifacts:
    - path: "src/components/ItemList.tsx"
      provides: "Collapse-all-then-expand + scroll-to-new logic"
    - path: "src/pages/SessionDetail.tsx"
      provides: "Floating button delegates to ItemList add handler"
  key_links:
    - from: "src/pages/SessionDetail.tsx"
      to: "src/components/ItemList.tsx"
      via: "shared handleAddItem callback or ref"
      pattern: "onAddItem|handleAddItem"
---

<objective>
When adding items in a session, automatically collapse all currently expanded items AND scroll to the newly created item.

Purpose: Keeps the item list tidy as the user catalogs — they always see the fresh item front-and-center without manually collapsing previous items.
Output: Updated ItemList.tsx and SessionDetail.tsx with collapse-all + scroll-to-new behavior.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/ItemList.tsx
@src/pages/SessionDetail.tsx
@src/components/ItemCard.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Collapse all + expand new + scroll to new item on add</name>
  <files>src/components/ItemList.tsx, src/pages/SessionDetail.tsx</files>
  <action>
In `src/components/ItemList.tsx`:

1. Add `useRef` and `useEffect` imports (useRef already needs adding).

2. Add a `newItemId` state to track which item was just created:
   ```
   const [newItemId, setNewItemId] = useState<number | null>(null);
   ```

3. Modify `handleAddItem` to collapse all expanded items, then expand only the new one:
   ```
   const handleAddItem = useCallback(async () => {
     const newId = await createBlankItem(sessionId, mode);
     setExpandedIds(new Set([newId]));  // replaces all expanded with just the new one
     setNewItemId(newId);
   }, [sessionId, mode]);
   ```

4. Add a useEffect that scrolls to the new item once it appears in the DOM. Use a ref map or data attribute approach:
   ```
   useEffect(() => {
     if (newItemId !== null) {
       // Small delay to let the DOM update after Dexie live query re-renders
       const timer = setTimeout(() => {
         const el = document.querySelector(`[data-item-id="${newItemId}"]`);
         if (el) {
           el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
         }
         setNewItemId(null);
       }, 100);
       return () => clearTimeout(timer);
     }
   }, [newItemId, items]);
   ```

5. Add `data-item-id={item.id}` attribute to the wrapper around each ItemCard in the map:
   ```
   {items.map((item) => (
     <div key={item.id} data-item-id={item.id}>
       <ItemCard ... />
     </div>
   ))}
   ```
   Note: Currently the `key` is on `ItemCard` directly. Wrap it in a div so we have a DOM element to target for scrolling.

6. Expose the `handleAddItem` function to the parent via a callback prop. Add an optional prop `onAddItemRef` of type `React.MutableRefObject<(() => Promise<void>) | null>` to ItemListProps. In a useEffect, assign `handleAddItem` to `onAddItemRef.current` so the parent can call it.

In `src/pages/SessionDetail.tsx`:

7. Create a ref: `const addItemRef = useRef<(() => Promise<void>) | null>(null);`

8. Pass `onAddItemRef={addItemRef}` to `<ItemList>`.

9. Update the floating button's `handleAddItem` to delegate to the ItemList's handler:
   ```
   const handleAddItem = async () => {
     if (addItemRef.current) {
       await addItemRef.current();
     } else {
       await createBlankItem(sessionId, session.mode);
     }
   };
   ```
   This ensures both the inline button and floating button use the same collapse+expand+scroll logic.

IMPORTANT: Do NOT change the visual design of ItemCard or ItemList. Only behavioral changes (collapse, expand, scroll).
  </action>
  <verify>
    <automated>cd C:/Users/maser/TPC_App && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>
    - Tapping either "Add Item" button collapses all currently expanded items
    - The newly created item is the only one expanded
    - The view scrolls smoothly to the new item
    - TypeScript compiles without errors
  </done>
</task>

<task type="checkpoint:human-verify">
  <name>Task 2: Verify collapse and scroll behavior on device</name>
  <files>n/a</files>
  <action>
User verifies the auto-collapse and scroll-to-new behavior works correctly on device/localhost.
  </action>
  <verify>
    <automated>echo "Manual verification checkpoint"</automated>
  </verify>
  <done>User confirms both Add Item buttons collapse existing items and scroll to the new expanded item.</done>
</task>

</tasks>

<verification>
- TypeScript compiles: `npx tsc --noEmit`
- Both Add Item buttons (inline in ItemList, floating in SessionDetail) trigger collapse-all + expand-new + scroll
- No visual regressions in item list
</verification>

<success_criteria>
- Adding an item from either button collapses all open items and scrolls to the new expanded item
- Existing expand/collapse toggle behavior unchanged for individual items
- No TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/quick/2-in-a-session-when-adding-items-it-should/2-SUMMARY.md`
</output>
