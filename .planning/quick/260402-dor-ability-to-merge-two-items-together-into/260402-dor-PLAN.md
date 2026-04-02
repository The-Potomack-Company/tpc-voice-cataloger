---
phase: quick-260402-dor
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/services/mergeItems.ts
  - src/components/ItemList.tsx
  - src/tests/merge-items.test.ts
autonomous: false
requirements: [MERGE-01]

must_haves:
  truths:
    - "User can long-press an item to enter multi-select mode"
    - "User can select exactly 2 items and tap Merge"
    - "Merged item contains concatenated fields from both source items"
    - "All photos and audio from absorbed item transfer to surviving item"
    - "Absorbed item is deleted after merge"
    - "Remaining items re-sort to close gaps"
  artifacts:
    - path: "src/services/mergeItems.ts"
      provides: "Core merge logic - field concatenation, media reassignment, item deletion"
      exports: ["mergeItems"]
    - path: "src/components/ItemList.tsx"
      provides: "Multi-select UI with long-press, floating merge toolbar, confirmation dialog"
    - path: "src/tests/merge-items.test.ts"
      provides: "Unit tests for merge field logic"
  key_links:
    - from: "src/components/ItemList.tsx"
      to: "src/services/mergeItems.ts"
      via: "import mergeItems, called on merge button click"
      pattern: "mergeItems\\("
    - from: "src/services/mergeItems.ts"
      to: "supabase items table"
      via: "update target item fields, update photos/audio item_id, delete source item"
      pattern: "supabase\\.from\\(.(items|photos)."
    - from: "src/services/mergeItems.ts"
      to: "Dexie photos/audio tables"
      via: "reassign itemId on local blobs"
      pattern: "db\\.(photos|audio)"
---

<objective>
Add the ability to merge two items within a session into one combined item.

Purpose: Auctioneers sometimes dictate separate entries that should be a single lot. Merge eliminates manual copy-paste of fields between items.
Output: Multi-select UI in ItemList, merge service that concatenates fields and reassigns media, tests for merge logic.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260402-dor-ability-to-merge-two-items-together-into/260402-dor-CONTEXT.md

<interfaces>
<!-- Key types and contracts the executor needs -->

From src/db/database.types.ts (items table):
```typescript
// Items row has: id, session_id, mode, sort_order, title, description, condition,
// estimate, measurements, category, transcript, ai_status, receipt_number, created_at
```

From src/db/database.types.ts (photos table):
```typescript
// Photos row has: id, item_id, sort_order, storage_path, thumbnail_path, upload_status, created_at
```

From src/stores/sessionStore.ts:
```typescript
type SupabaseItem = Tables<"items">;

interface SessionState {
  itemsBySession: Record<string, SupabaseItem[]>;
  updateItemField: (itemId: string, sessionId: string, field: string, value: string | null) => Promise<void>;
  deleteItem: (itemId: string, sessionId: string) => Promise<void>;
  fetchItems: (sessionId: string) => Promise<void>;
  _setItems: (sessionId: string, items: SupabaseItem[]) => void;
}
```

From src/db/index.ts (Dexie tables):
```typescript
// db.photos: EntityTable<ItemPhoto, "id"> — indexed by itemId
// db.audio: EntityTable<ItemAudio, "id"> — indexed by itemId
```

From src/db/types.ts:
```typescript
export interface ItemPhoto {
  id?: number; itemId: number; itemType: "house" | "sale"; blob: Blob;
  thumbnail?: Blob; sortOrder: number; createdAt: Date;
}
export interface ItemAudio {
  id?: number; itemId: number; itemType: "house" | "sale"; blob: Blob;
  mimeType: string; durationMs?: number; createdAt: Date;
}
```

From src/db/idMapping.ts:
```typescript
export async function getDexieItemId(supabaseId: string): Promise<number | string | undefined>;
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create merge service with field-concatenation logic and media reassignment</name>
  <files>src/services/mergeItems.ts, src/tests/merge-items.test.ts</files>
  <behavior>
    - mergeFields: when both items have title, result is "TITLE A; TITLE B"
    - mergeFields: when only one item has title, result is that value (no separator)
    - mergeFields: description concatenates with newline separator
    - mergeFields: transcript concatenates with newline separator
    - mergeFields: estimate, condition, measurements concatenate with "; "
    - mergeFields: category uses target item's value (first selected / lower sort_order)
    - mergeFields: receipt_number uses target item's value
    - ai_status: "done" if both are "done", otherwise target's current status
    - mergeItems: calls Supabase update on target item with merged fields
    - mergeItems: updates Supabase photos table — sets item_id to target for all source item photos
    - mergeItems: updates Dexie photos and audio tables — reassigns itemId from source to target
    - mergeItems: deletes source item via Supabase
    - mergeItems: re-sorts remaining items to close sort_order gaps
  </behavior>
  <action>
    Create `src/services/mergeItems.ts` with two exports:

    1. `mergeFields(target: SupabaseItem, source: SupabaseItem): Partial<SupabaseItem>` — pure function:
       - For `title`, `estimate`, `condition`, `measurements`: if both have values, join with "; ". If only one, use it.
       - For `description`, `transcript`: if both have values, join with "\n". If only one, use it.
       - For `category`: keep target's value. If target has none, use source's.
       - For `receipt_number`: keep target's value. If target has none, use source's.
       - For `ai_status`: "done" if both are "done", else target's current status.

    2. `mergeItems(targetId: string, sourceId: string, sessionId: string): Promise<void>` — orchestrator:
       - Load items from sessionStore.itemsBySession[sessionId]
       - Determine target (lower sort_order) and source (higher sort_order)
       - Call mergeFields to compute merged values
       - Update target item in Supabase: `supabase.from("items").update(mergedFields).eq("id", targetId)`
       - Reassign Supabase photos: `supabase.from("photos").update({ item_id: targetId }).eq("item_id", sourceId)`
       - Reassign Dexie photos: get dexieItemId for both, then `db.photos.where("itemId").equals(sourceDexieId).modify({ itemId: targetDexieId })`
       - Reassign Dexie audio: same pattern with `db.audio`
       - Delete source item: `supabase.from("items").delete().eq("id", sourceId)`
       - Re-sort remaining items: fetch updated items, assign sequential sort_order 0,1,2,..., batch update
       - Refresh store: call `useSessionStore.getState().fetchItems(sessionId)`

    Create `src/tests/merge-items.test.ts`:
    - Test `mergeFields` pure function with various input combinations (both values, one null, both null)
    - Mock Supabase and Dexie for `mergeItems` integration test confirming correct call sequence
  </action>
  <verify>
    <automated>npx vitest run src/tests/merge-items.test.ts</automated>
  </verify>
  <done>mergeFields correctly concatenates all field types per decision rules. mergeItems orchestrates Supabase updates, Dexie reassignment, source deletion, and re-sort.</done>
</task>

<task type="auto">
  <name>Task 2: Add multi-select mode with long-press and floating merge toolbar to ItemList</name>
  <files>src/components/ItemList.tsx</files>
  <action>
    Modify `src/components/ItemList.tsx` to add multi-select merge UX. All changes scoped within this single component (no new files needed).

    **State additions:**
    - `selectMode: boolean` — whether multi-select is active
    - `selectedIds: Set<string>` — currently selected item IDs

    **Long-press to enter select mode:**
    - Wrap each item's outer div with an `onPointerDown`/`onPointerUp` pair implementing a 500ms long-press timer
    - On long-press: set `selectMode = true`, add that item's ID to `selectedIds`
    - Visual feedback: when `selectMode` is true, show a checkbox overlay to the left of each ItemCard
    - Tapping an item in select mode toggles its selection (does NOT expand/navigate)
    - Existing tap-to-expand and swipe-to-delete work normally when `selectMode` is false

    **Floating merge toolbar:**
    - When `selectMode` is true, render a fixed-bottom toolbar (above any existing bottom nav)
    - Show selected count: "N selected"
    - "Cancel" button on left — clears selection, exits select mode
    - "Merge (2)" button on right — enabled only when exactly 2 items selected, disabled otherwise
    - Style: `fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t shadow-lg px-4 py-3 flex items-center justify-between z-50`
    - Add `pb-16` to the item list container when selectMode is active (so items aren't hidden behind toolbar)

    **Merge flow:**
    - On "Merge (2)" tap: show ConfirmDialog with message "Merge Item #X into Item #Y? All fields and media will be combined into the first item."
    - Target = item with lower sort_order. Source = item with higher sort_order. Use sort_order from items array.
    - On confirm: call `mergeItems(targetId, sourceId, sessionId)` from `src/services/mergeItems.ts`
    - After merge completes: clear selection, exit select mode
    - Handle errors with console.error (matches existing pattern in codebase)

    **Checkbox rendering per item (in select mode):**
    - Before each ItemCard div, add a checkbox circle (24x24px)
    - Selected: filled accent circle with white checkmark
    - Unselected: gray border circle
    - Use inline SVG matching existing icon patterns in the codebase

    **Important:** Do NOT break existing functionality:
    - `readOnly` mode should not allow entering select mode
    - Swipe-to-delete still works when not in select mode
    - Tap-to-expand/navigate still works when not in select mode
  </action>
  <verify>
    <automated>npx vitest run src/tests/item-list.test.tsx</automated>
  </verify>
  <done>Long-press enters multi-select mode with checkboxes. Floating toolbar shows with Merge button (enabled at exactly 2 selections). Confirmation dialog triggers merge. Existing interactions unaffected.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Verify merge feature end-to-end</name>
  <files>N/A</files>
  <action>
    Human verifies the complete merge feature works correctly in the running app.

    What was built: Complete item merge feature with long-press multi-select, floating merge toolbar, field concatenation, photo/audio reassignment.

    How to verify:
    1. Open the app and navigate to a session with 3+ items (some with photos/audio)
    2. Long-press an item — verify checkboxes appear on all items and a bottom toolbar appears
    3. Tap a second item — verify "Merge (2)" button becomes enabled
    4. Tap a third item — verify "Merge (2)" changes to disabled state (3 selected)
    5. Deselect one item — verify Merge re-enables
    6. Tap "Merge (2)" — verify confirmation dialog shows target and source item numbers
    7. Confirm merge — verify:
       a. One item disappears from the list
       b. Surviving item has concatenated title (e.g., "CHAIR; OTTOMAN")
       c. Photos from absorbed item now appear under surviving item
       d. Audio recordings from absorbed item now appear under surviving item
    8. Tap "Cancel" in toolbar — verify select mode exits and normal interactions resume
    9. Verify normal tap-to-expand still works when not in select mode

    Resume signal: Type "approved" or describe issues.
  </action>
  <verify>Human visual and functional verification of merge flow</verify>
  <done>User confirms merge feature works: select mode, merge execution, field concatenation, media transfer, and normal mode restoration all function correctly.</done>
</task>

</tasks>

<verification>
- `npx vitest run src/tests/merge-items.test.ts` passes — merge field logic correct
- `npx vitest run src/tests/item-list.test.tsx` passes — existing item list tests unbroken
- Manual verification of full merge flow with real data
</verification>

<success_criteria>
- Two items can be merged into one via long-press select + merge button
- Fields concatenate per decision rules (semicolon for short, newline for long, first-wins for category)
- All photos and audio transfer from source to target item
- Source item is deleted, remaining items re-sorted
- Existing tap/swipe interactions unaffected when not in select mode
</success_criteria>

<output>
After completion, create `.planning/quick/260402-dor-ability-to-merge-two-items-together-into/260402-dor-SUMMARY.md`
</output>
