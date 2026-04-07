---
phase: quick
plan: 260402-doe
type: execute
wave: 1
depends_on: []
files_modified:
  - src/stores/sessionStore.ts
  - src/tests/session-store.test.ts
autonomous: true
must_haves:
  truths:
    - "Specialist can delete items from sessions assigned to them by admin (assigned_to = uid)"
    - "Specialist can delete items from sessions they created themselves (created_by = uid)"
    - "When an RLS-blocked delete silently fails (0 rows affected), the optimistic UI reverts and shows a toast"
  artifacts:
    - path: "src/stores/sessionStore.ts"
      provides: "deleteItem with RLS silent-failure detection"
      contains: "count === 0"
  key_links:
    - from: "src/stores/sessionStore.ts deleteItem"
      to: "supabase items.delete"
      via: "select count after delete to detect RLS silent failure"
---

<objective>
Fix specialist item deletion from admin-created and self-created sessions.

Purpose: Specialists report being unable to delete items. Investigation reveals the Supabase
`deleteItem` call uses optimistic UI but doesn't detect RLS silent failures (Supabase returns
`{ error: null }` when RLS filters out all rows, resulting in 0 rows deleted). The item
disappears from the UI optimistically but reappears on next fetch. The fix adds proper
detection of 0-row deletes and reverts + shows user feedback when this happens.

Additionally, `deleteSession` has the same silent-failure pattern and should be fixed
for consistency.

Output: Updated sessionStore.ts with robust delete error handling
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@src/stores/sessionStore.ts
@supabase/migrations/20260318000005_rls_policies.sql

RLS policies for items (from 20260318000005_rls_policies.sql):
- Admins: full CRUD via `private.is_admin()`
- Specialists: can SELECT/INSERT/UPDATE/DELETE items where the parent session has
  `created_by = auth.uid() OR assigned_to = auth.uid()`

The deleteItem function (sessionStore.ts line 377-405):
1. Optimistically removes item from `itemsBySession[sessionId]`
2. Calls `supabase.from("items").delete().eq("id", itemId)`
3. Only checks `if (error)` to revert -- but RLS silent failures return `error: null`
   with 0 rows affected, so the revert never triggers

The deleteSession function (sessionStore.ts line 210-240) has the same pattern.

Key insight: Supabase `.delete()` with RLS returns `{ data: null, error: null, count: null }`
by default. To detect 0-row deletes, we must add `.select()` after `.delete()` which returns
the deleted rows, or use `{ count: 'exact' }` in the query options to get a row count via
the `Prefer: count=exact` header.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix deleteItem and deleteSession to detect RLS silent failures</name>
  <files>src/stores/sessionStore.ts</files>
  <action>
Modify `deleteItem` (around line 391) to detect when Supabase RLS silently blocks the delete:

1. Change the delete call from:
   ```ts
   const { error } = await supabase.from("items").delete().eq("id", itemId);
   ```
   To use `.select()` after `.delete()` which returns deleted rows:
   ```ts
   const { data: deleted, error } = await supabase
     .from("items")
     .delete()
     .eq("id", itemId)
     .select("id");
   ```

2. Update the error check to also revert when 0 rows were deleted:
   ```ts
   if (error || !deleted || deleted.length === 0) {
     // Revert optimistic delete
     set((state) => ({
       itemsBySession: {
         ...state.itemsBySession,
         [sessionId]: originalItems,
       },
     }));
     if (!error) {
       console.error("Delete blocked by RLS policy — item not deleted");
     }
   }
   ```

3. Apply the same fix to `deleteSession` (around line 225):
   ```ts
   const { data: deleted, error } = await supabase
     .from("sessions")
     .delete()
     .eq("id", id)
     .select("id");
   ```
   And update its error check:
   ```ts
   if (error || !deleted || deleted.length === 0) {
     // Revert optimistic delete
     set({
       sessions: originalSessions,
       itemsBySession: {
         ...get().itemsBySession,
         ...(originalItems !== undefined ? { [id]: originalItems } : {}),
       },
     });
   }
   ```

4. For `deleteSession`, also update the return: currently `handleConfirm` in SessionDetail.tsx
   navigates away after delete (line 236-237). Since deleteSession doesn't return success/failure,
   the navigate happens regardless. Change `deleteSession` to return a boolean indicating success:
   - Update the type: `deleteSession: (id: string) => Promise<boolean>;`
   - Return `true` on success, `false` on failure (revert case)

5. Update SessionDetail.tsx `handleConfirm` (around line 235-237) to only navigate on success:
   ```ts
   } else if (confirmAction === "delete") {
     const success = await useSessionStore.getState().deleteSession(session.id);
     if (success) {
       navigate("/");
     }
   }
   ```
   Similarly update Sessions.tsx `handleDeleteConfirm` (around line 260-264):
   ```ts
   const handleDeleteConfirm = async () => {
     if (deleteTarget?.id) {
       await deleteSession(deleteTarget.id);
     }
     setDeleteTarget(null);
   };
   ```
   Note: Sessions.tsx already handles this OK since the session disappears from the list
   optimistically and reverts on failure. No change needed there.

6. Do NOT add toast/UI notification in this task -- the revert itself is sufficient user
   feedback (item reappears). Console error aids debugging.
  </action>
  <verify>
    <automated>cd C:/Users/maser/TPC_App && npx vitest run src/tests/session-store.test.ts --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <done>
    - deleteItem reverts optimistic UI when Supabase returns 0 deleted rows (RLS block)
    - deleteSession reverts optimistic UI when Supabase returns 0 deleted rows (RLS block)
    - deleteSession returns boolean success indicator
    - SessionDetail.tsx only navigates away on successful session delete
    - Existing tests still pass
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add tests for RLS silent-failure revert behavior</name>
  <files>src/tests/session-store.test.ts</files>
  <behavior>
    - deleteItem: when supabase returns empty data array (RLS block), itemsBySession reverts to original
    - deleteItem: when supabase returns data with deleted row, item stays removed
    - deleteSession: when supabase returns empty data array (RLS block), sessions list reverts to original
    - deleteSession: returns false when RLS blocks delete
    - deleteSession: returns true when delete succeeds
  </behavior>
  <action>
Add tests in the existing `deleteItem` and `deleteSession` describe blocks in
`src/tests/session-store.test.ts`:

For `deleteItem` (after the existing test around line 376):
```ts
it("reverts optimistic delete when RLS silently blocks (0 rows returned)", async () => {
  // Setup items in store
  const items = [{ id: "item-1", session_id: "session-1", ... }];
  useSessionStore.setState({ itemsBySession: { "session-1": items } });

  // Mock: delete returns empty array (RLS filtered)
  setupDeleteChain(null, []); // modify helper to support returning data

  await useSessionStore.getState().deleteItem("item-1", "session-1");

  // Should revert -- item still present
  const state = useSessionStore.getState();
  expect(state.itemsBySession["session-1"]).toHaveLength(1);
  expect(state.itemsBySession["session-1"][0].id).toBe("item-1");
});
```

For `deleteSession`:
```ts
it("reverts optimistic delete when RLS silently blocks (0 rows returned)", async () => {
  // Setup
  useSessionStore.setState({ sessions: [{ id: "uuid-1", ... }] });

  // Mock: delete returns empty array
  setupDeleteChain(null, []);

  const success = await useSessionStore.getState().deleteSession("uuid-1");

  expect(success).toBe(false);
  expect(useSessionStore.getState().sessions).toHaveLength(1);
});

it("returns true and keeps deletion on success", async () => {
  useSessionStore.setState({ sessions: [{ id: "uuid-1", ... }] });
  setupDeleteChain(null, [{ id: "uuid-1" }]);

  const success = await useSessionStore.getState().deleteSession("uuid-1");

  expect(success).toBe(true);
  expect(useSessionStore.getState().sessions).toHaveLength(0);
});
```

Note: The existing mock setup uses `setupDeleteChain(error)`. You need to extend this
helper to also support returning `data`. Look at how the existing test mocks work
(search for `setupDeleteChain` and the mock chain pattern) and adapt accordingly.
The key change: the `.select("id")` call now chained after `.delete().eq()` means the
mock chain needs an additional `.select` step that resolves with `{ data, error }`.
  </action>
  <verify>
    <automated>cd C:/Users/maser/TPC_App && npx vitest run src/tests/session-store.test.ts --reporter=verbose 2>&1 | tail -40</automated>
  </verify>
  <done>
    - Tests cover RLS silent-failure revert for both deleteItem and deleteSession
    - Tests cover successful delete path (data returned)
    - Tests cover deleteSession return value (boolean)
    - All session-store tests pass
  </done>
</task>

</tasks>

<verification>
```bash
cd C:/Users/maser/TPC_App && npx vitest run src/tests/session-store.test.ts --reporter=verbose
cd C:/Users/maser/TPC_App && npx tsc --noEmit
```
</verification>

<success_criteria>
- deleteItem and deleteSession detect RLS silent failures (0 rows returned) and revert optimistic UI
- SessionDetail.tsx does not navigate away on failed session delete
- All existing and new tests pass
- TypeScript compiles cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/260402-doe-specialists-unable-to-delete-items-from-/260402-doe-SUMMARY.md`
</output>
