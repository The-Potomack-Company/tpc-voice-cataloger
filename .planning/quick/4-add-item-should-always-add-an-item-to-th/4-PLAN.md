---
phase: quick
plan: 4
type: execute
wave: 1
depends_on: []
files_modified:
  - src/db/items.ts
  - src/tests/item-crud.test.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "New items always appear at the end of the list, even after deletions"
    - "sortOrder of new item is always greater than all existing items in the session"
  artifacts:
    - path: "src/db/items.ts"
      provides: "createBlankItem with max-sortOrder logic"
      contains: "sortOrder"
    - path: "src/tests/item-crud.test.ts"
      provides: "Test proving new item appends after deletion"
  key_links:
    - from: "src/db/items.ts"
      to: "src/components/ItemList.tsx"
      via: "sortBy('sortOrder') in useLiveQuery"
      pattern: "sortBy.*sortOrder"
---

<objective>
Fix createBlankItem to always assign a sortOrder higher than all existing items in the session, so new items always appear at the end of the list.

Purpose: Currently sortOrder is set to `count` of items. After deleting items, count < max sortOrder, causing new items to appear between existing items instead of at the end.
Output: Fixed createBlankItem + regression test
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/db/items.ts
@src/db/index.ts
@src/tests/item-crud.test.ts
@src/components/ItemList.tsx
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Fix sortOrder calculation in createBlankItem and add regression test</name>
  <files>src/db/items.ts, src/tests/item-crud.test.ts</files>
  <behavior>
    - Test: After creating 3 items (sortOrder 0,1,2), deleting item with sortOrder 1, then adding a new item, the new item should have sortOrder 3 (not 2)
    - Test: After deleting ALL items in a session, adding a new item should have sortOrder 0
    - Existing test "creates a blank house item with sortOrder = existing count" should be updated to reflect new logic (max+1 instead of count)
  </behavior>
  <action>
    1. In `src/tests/item-crud.test.ts`, add a new test in the `createBlankItem` describe block:
       - "assigns sortOrder after max existing sortOrder when items have been deleted"
       - Create 3 items for sessionId=1 with sortOrders 0, 1, 2
       - Delete the middle item (sortOrder 1)
       - Call createBlankItem(1, "house")
       - Assert new item's sortOrder is 3 (max of remaining [0,2] + 1 = 3)

    2. Add another test:
       - "assigns sortOrder 0 when all items deleted"
       - Create an item, delete it, create a new one
       - Assert sortOrder is 0

    3. Run tests -- new test should FAIL (RED phase).

    4. In `src/db/items.ts`, fix `createBlankItem`:
       - Instead of `const count = await table.where("sessionId").equals(sessionId).count();`
       - Query existing items for this session, get them sorted by sortOrder descending, take the first one
       - Use Dexie: `const lastItem = await table.where("sessionId").equals(sessionId).reverse().sortBy("sortOrder")` then take `[0]`
       - If no items exist, sortOrder = 0. Otherwise sortOrder = lastItem.sortOrder + 1
       - Note: Dexie's `.sortBy()` returns a promise of array. Use `.reverse()` before `.sortBy()` won't work as expected since sortBy is post-query. Instead: get all items sorted by sortOrder, take the last one: `const items = await table.where("sessionId").equals(sessionId).sortBy("sortOrder"); const maxSort = items.length > 0 ? items[items.length - 1].sortOrder : -1; const sortOrder = maxSort + 1;`

    5. Run tests -- all should PASS (GREEN phase).

    6. Update the existing test description from "creates a blank house item with sortOrder = existing count" to "creates a blank house item with correct sortOrder" (the assertion `expect(item!.sortOrder).toBe(2)` still holds since no deletions occurred, max sortOrder is 1, so new = 2).
  </action>
  <verify>
    <automated>cd C:/Users/maser/TPC_App && npx vitest run src/tests/item-crud.test.ts</automated>
  </verify>
  <done>createBlankItem always produces sortOrder = max(existing sortOrders) + 1, new test proves items append correctly after deletions, all existing tests pass</done>
</task>

</tasks>

<verification>
npx vitest run src/tests/item-crud.test.ts
npx tsc --noEmit
</verification>

<success_criteria>
- New items always get a sortOrder higher than any existing item in the session
- Regression test covers the delete-then-add scenario
- All existing tests continue to pass
- TypeScript compiles without errors
</success_criteria>

<output>
After completion, create `.planning/quick/4-add-item-should-always-add-an-item-to-th/4-SUMMARY.md`
</output>
