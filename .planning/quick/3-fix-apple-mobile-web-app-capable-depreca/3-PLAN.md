---
phase: quick
plan: 3
type: execute
wave: 1
depends_on: []
files_modified:
  - index.html
  - src/db/index.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "No apple-mobile-web-app-capable deprecation warning in browser console"
    - "Compound query where({sessionId, aiStatus}) uses a proper compound index"
  artifacts:
    - path: "index.html"
      provides: "PWA meta tags without deprecated apple-mobile-web-app-capable"
    - path: "src/db/index.ts"
      provides: "Dexie v4 schema with [sessionId+aiStatus] compound indexes"
  key_links: []
---

<objective>
Fix apple-mobile-web-app-capable deprecation warning and add compound Dexie index for [sessionId+aiStatus] queries.

Purpose: Eliminate console deprecation warning on iOS Safari and optimize the queued-item count query in SessionDetail.
Output: Updated index.html and Dexie schema migration.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@index.html
@src/db/index.ts
@src/pages/SessionDetail.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace deprecated apple-mobile-web-app-capable meta tag</name>
  <files>index.html</files>
  <action>
In index.html, remove the deprecated `<meta name="apple-mobile-web-app-capable" content="yes" />` tag on line 7.

The `apple-mobile-web-app-capable` meta tag is deprecated in favor of the `display` field in the web app manifest (manifest.json). Since this PWA already has a manifest with `"display": "standalone"`, the meta tag is redundant and produces a deprecation warning in Safari.

Simply delete line 7. Do NOT add a replacement tag -- the manifest handles this.

Verify the manifest already contains `"display": "standalone"` (it should from Phase 01). If for some reason it does not, add it.
  </action>
  <verify>
    <automated>grep -c "apple-mobile-web-app-capable" index.html | grep "^0$"</automated>
  </verify>
  <done>index.html no longer contains the apple-mobile-web-app-capable meta tag. The manifest.json display field provides the same functionality.</done>
</task>

<task type="auto">
  <name>Task 2: Add compound [sessionId+aiStatus] index via Dexie v4 migration</name>
  <files>src/db/index.ts</files>
  <action>
Add a Dexie version 4 migration that adds compound indexes `[sessionId+aiStatus]` to both `houseVisitItems` and `saleItems` tables. This optimizes the `where({ sessionId, aiStatus: "queued" })` query in SessionDetail.tsx.

In src/db/index.ts, after the existing `db.version(3).stores({...})` block, add:

```typescript
db.version(4).stores({
  sessions: "++id, mode, status, updatedAt, createdAt, deletedAt",
  houseVisitItems: "++id, sessionId, sortOrder, aiStatus, [sessionId+aiStatus]",
  saleItems: "++id, sessionId, receiptNumber, sortOrder, aiStatus, [sessionId+aiStatus]",
  photos: "++id, itemId, sortOrder",
  audio: "++id, itemId",
});
```

No upgrade function needed -- Dexie creates compound indexes automatically from existing data. Keep all existing individual indexes (sessionId, sortOrder, aiStatus) alongside the compound index.
  </action>
  <verify>
    <automated>grep -c "sessionId+aiStatus" src/db/index.ts | grep "^[1-9]"</automated>
  </verify>
  <done>Dexie schema v4 declares [sessionId+aiStatus] compound index on both houseVisitItems and saleItems tables.</done>
</task>

</tasks>

<verification>
- `grep "apple-mobile-web-app-capable" index.html` returns nothing
- `grep "sessionId+aiStatus" src/db/index.ts` shows compound index declarations
- `npx tsc --noEmit` passes (no type errors introduced)
- App loads without errors: `npm run dev` and visit localhost
</verification>

<success_criteria>
1. The apple-mobile-web-app-capable meta tag is removed from index.html
2. Dexie v4 migration adds [sessionId+aiStatus] compound index to both item tables
3. TypeScript compiles without errors
4. Existing tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/3-fix-apple-mobile-web-app-capable-depreca/3-SUMMARY.md`
</output>
