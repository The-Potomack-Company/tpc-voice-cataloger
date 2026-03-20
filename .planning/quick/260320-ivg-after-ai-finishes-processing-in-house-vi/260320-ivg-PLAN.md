---
phase: quick
plan: 260320-ivg
type: execute
wave: 1
depends_on: []
files_modified:
  - src/services/gemini.ts
autonomous: true
---

<objective>
After AI finishes processing an item, immediately update the item view so the user sees results without navigating away.

Purpose: Currently `processAudioWithAi` writes AI results (title, description, condition, estimate, etc.) directly to Supabase but never updates the Zustand sessionStore. The ItemEntry page (house visit item view) reads from Zustand via `useSessionItems`, so it stays stale until the user navigates away and back. This is especially bad in house visit mode where the user records audio and stays on the same item screen expecting to see AI-extracted fields appear.

Output: gemini.ts refreshes the Zustand store after successful or failed AI processing, causing immediate UI re-render.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/services/gemini.ts
@src/stores/sessionStore.ts
@src/pages/ItemEntry.tsx
@src/hooks/useSessions.ts

Key data flow:
- `processAudioWithAi(audioId, itemId, sessionId)` writes to Supabase `items` table
- `ItemEntry.tsx` reads from `useSessionItems(sessionId)` which reads `sessionStore.itemsBySession[sessionId]`
- The store is only refreshed when `fetchItems(sessionId)` is called (on mount/navigation)
- Gap: after AI writes to Supabase, the store is never told to re-fetch
</context>

<tasks>

<task type="auto">
  <name>Task 1: Refresh Zustand store after AI processing completes</name>
  <files>src/services/gemini.ts</files>
  <action>
In `processAudioWithAi` in `src/services/gemini.ts`, after the successful Supabase update (the `await supabase.from("items").update(supabaseUpdate).eq("id", itemId)` call around line 190), add a call to refresh the Zustand store:

```typescript
import { useSessionStore } from "../stores/sessionStore";
```

After the successful update write (line ~190):
```typescript
// Refresh Zustand store so UI re-renders with AI results
useSessionStore.getState().fetchItems(sessionId);
```

Also add the same refresh in the error/catch block (around line 204), after setting ai_status to "failed":
```typescript
// Refresh store so UI shows "failed" status immediately
useSessionStore.getState().fetchItems(sessionId);
```

This ensures:
1. On success: item fields (title, description, etc.) appear immediately in the ItemEntry view
2. On failure: the "failed" badge appears immediately without requiring navigation

Do NOT change the fire-and-forget pattern in RecordButton.tsx or ItemCard.tsx -- those callers are correct. The refresh happens inside gemini.ts after Supabase confirms the write.
  </action>
  <verify>
    <automated>npx vitest run src/tests/gemini-pipeline.test.ts --reporter=verbose 2>&1 | tail -20</automated>
  </verify>
  <done>After AI processing completes (success or failure), the Zustand sessionStore is refreshed with latest item data from Supabase, causing any mounted ItemEntry or ItemCard components to re-render immediately with the new field values or status.</done>
</task>

</tasks>

<verification>
1. Existing gemini pipeline tests pass
2. Manual verification: In house visit mode, record audio on an item, stay on that item screen -- AI-extracted fields should appear within seconds of processing completing, without navigating away
</verification>

<success_criteria>
- processAudioWithAi refreshes Zustand store after both successful and failed AI processing
- ItemEntry page re-renders with AI results without user needing to navigate away
- No regressions in existing gemini pipeline tests
</success_criteria>

<output>
After completion, create `.planning/quick/260320-ivg-after-ai-finishes-processing-in-house-vi/260320-ivg-SUMMARY.md`
</output>
