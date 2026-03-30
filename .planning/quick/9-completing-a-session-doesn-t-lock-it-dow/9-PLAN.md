---
phase: quick-9
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/pages/SessionDetail.tsx
  - src/components/ItemList.tsx
  - src/components/ItemCard.tsx
  - src/components/EditableField.tsx
  - src/components/SwipeableRow.tsx
autonomous: true
requirements: [QUICK-9]

must_haves:
  truths:
    - "Completed session does not allow adding items"
    - "Completed session does not allow deleting items (swipe or button)"
    - "Completed session does not allow editing item fields"
    - "Completed session does not allow editing session name or notes"
    - "Completed session does not allow recording audio on items"
    - "Completed session still allows export"
    - "Reopening a session re-enables all editing"
  artifacts:
    - path: "src/pages/SessionDetail.tsx"
      provides: "Read-only mode for completed sessions"
    - path: "src/components/ItemCard.tsx"
      provides: "Disabled editing/delete/recording in read-only mode"
    - path: "src/components/ItemList.tsx"
      provides: "Hidden add-item buttons in read-only mode"
  key_links:
    - from: "SessionDetail.tsx"
      to: "ItemList.tsx"
      via: "readOnly prop"
      pattern: "readOnly.*session\\.status"
    - from: "ItemList.tsx"
      to: "ItemCard.tsx"
      via: "readOnly prop passthrough"
---

<objective>
Lock down completed sessions so items cannot be added, deleted, or edited until the session is reopened.

Purpose: When a session is marked "completed" it should be read-only. Users must reopen (change status back to "active") before making changes. Currently all editing, adding, and deleting still works on completed sessions.

Output: Completed sessions display items in view-only mode with no add/delete/edit/record controls.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/pages/SessionDetail.tsx
@src/components/ItemList.tsx
@src/components/ItemCard.tsx
@src/components/EditableField.tsx
@src/components/SwipeableRow.tsx

<interfaces>
From src/db/types.ts:
```typescript
export interface Session {
  id?: number;
  name: string;
  mode: "house" | "sale";
  status: "active" | "completed";
  notes: string;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

From src/components/ItemList.tsx:
```typescript
interface ItemListProps {
  sessionId: number;
  mode: "house" | "sale";
  onAddItemRef?: React.MutableRefObject<(() => Promise<void>) | null>;
}
```

From src/components/ItemCard.tsx:
```typescript
interface ItemCardProps {
  item: HouseVisitItem | SaleItem;
  mode: "house" | "sale";
  isExpanded: boolean;
  onToggle: () => void;
}
```

From src/components/EditableField.tsx:
```typescript
interface EditableFieldProps {
  value: string | undefined;
  onSave: (val: string) => void;
  placeholder?: string;
  multiline?: boolean;
  label?: string;
}
```

From src/components/SwipeableRow.tsx:
```typescript
interface SwipeableRowProps {
  children: ReactNode;
  onDelete: () => void;
  deleteLabel?: string;
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add readOnly prop to child components</name>
  <files>src/components/EditableField.tsx, src/components/SwipeableRow.tsx, src/components/ItemCard.tsx, src/components/ItemList.tsx</files>
  <action>
Thread a `readOnly?: boolean` prop through the component hierarchy:

**EditableField.tsx:**
- Add `readOnly?: boolean` to `EditableFieldProps`
- When `readOnly` is true, render the display span without the `onClick` handler, without `cursor-pointer` / `hover:bg-*` classes. Just show the value as static text (keep the label).

**SwipeableRow.tsx:**
- Add `disabled?: boolean` to `SwipeableRowProps`
- When `disabled` is true, skip all touch/pointer event handlers (onTouchStart, onTouchMove, onTouchEnd, onPointerDown etc.) so swiping does nothing. Still render children normally.

**ItemCard.tsx:**
- Add `readOnly?: boolean` to `ItemCardProps`
- Pass `readOnly` to each `EditableField`
- When `readOnly`:
  - Do NOT render the mic button (the record audio button in the collapsed row icons area)
  - Do NOT render the "Delete Item" button in the expanded section
  - Do NOT render the "Retry AI" button in the expanded section
  - Pass `disabled={readOnly}` to `SwipeableRow`
- The expanded section should still open/close (users can VIEW item details) but all fields are read-only

**ItemList.tsx:**
- Add `readOnly?: boolean` to `ItemListProps`
- Pass `readOnly` to each `ItemCard`
- When `readOnly`:
  - Do NOT render the dashed "Add Item" button at the top of the list
  - Do NOT render the "Retry All Stuck" button
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>All four components accept and respect readOnly/disabled prop. TypeScript compiles clean.</done>
</task>

<task type="auto">
  <name>Task 2: Wire readOnly from SessionDetail based on session status</name>
  <files>src/pages/SessionDetail.tsx</files>
  <action>
In `SessionDetailPage`, derive `const isCompleted = session.status === "completed"` and use it to lock down the page:

1. **Session name:** When `isCompleted`, do NOT call `startEditingName` on click. Remove cursor-pointer and hover styles from the h1. Just render it as plain text.

2. **Notes textarea:** When `isCompleted`, set `readOnly` attribute on the textarea and add `cursor-default` class, remove focus ring styles. Or simpler: replace textarea with a `<p>` or `<div>` showing the notes text (or "No notes" placeholder).

3. **ItemList:** Pass `readOnly={isCompleted}` to `<ItemList>`.

4. **Floating "Add Item" button:** Do NOT render the fixed-bottom "Add Item" / "Start Cataloging" button when `isCompleted`.

5. **Export button:** Keep working (no change).

6. **"Mark Complete" / "Reopen Session" button:** Keep as-is (already toggles between the two based on status).

7. **Delete Session button:** Keep working (you should be able to delete a completed session).

All these checks use `isCompleted` which is reactive via `useLiveQuery` on the session -- so when a user clicks "Reopen Session", the status changes to "active" and all the locked UI immediately unlocks.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>Completed sessions are fully read-only: no add item, no delete item, no edit fields, no edit name/notes, no record audio. Reopen restores all editing. Export and delete session still work.</done>
</task>

</tasks>

<verification>
1. TypeScript compiles: `npx tsc --noEmit`
2. Dev server starts: `npx vite --host` (smoke test)
3. Manual flow: Create session, add items, mark complete -- verify cannot add/edit/delete items. Reopen -- verify editing restored.
</verification>

<success_criteria>
- Completed session shows all items in view-only mode
- No "Add Item" buttons visible on completed session
- Swipe-to-delete disabled on completed session items
- Item fields display as static text (not editable) on completed session
- Session name and notes not editable on completed session
- Mic/record button not shown on completed session items
- "Reopen Session" button still visible and functional
- After reopening, all editing capabilities restored
- Export and Delete Session still work on completed sessions
</success_criteria>

<output>
After completion, create `.planning/quick/9-completing-a-session-doesn-t-lock-it-dow/9-SUMMARY.md`
</output>
