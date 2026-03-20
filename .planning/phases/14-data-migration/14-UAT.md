---
status: diagnosed
phase: 14-data-migration
source: 14-01-SUMMARY.md, 14-02-SUMMARY.md, 14-03-SUMMARY.md, 14-04-SUMMARY.md
started: 2026-03-20T12:00:00Z
updated: 2026-03-20T12:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server. Start the application from scratch with `npm run dev`. Server boots without errors, no console crashes. The app loads in the browser and shows the login page (or sessions page if already authenticated).
result: pass

### 2. Sessions Load After Login
expected: After logging in, the Sessions page loads and displays your sessions. Data is fetched from Supabase (not local Dexie). Sessions show correct names and dates.
result: pass

### 3. Create New Session
expected: Tap/click "New Session", fill in session details, and save. The new session appears in the sessions list immediately (optimistic update). No errors in console.
result: pass

### 4. Session Detail View
expected: Open an existing session. Session detail page shows the session name, date, and its items. All fields display correctly (no "undefined" or missing data).
result: pass

### 5. Add/Edit Item in Session
expected: Within a session, add a new item or edit an existing item's fields. Changes save successfully and persist when navigating away and back.
result: pass

### 6. Photo and Audio Blobs Load
expected: Open an item that has photos or audio recordings. Photos display correctly and audio recordings are playable. (These are loaded from local Dexie via the ID mapping bridge.)
result: issue
reported: "photo upload for items not visible in house visit mode. audio recordings arent playable but they shouldn't be - there are transcripts instead at the bottom of the item details"
severity: major

### 7. Offline Banner
expected: Disconnect from the internet (toggle airplane mode or disable WiFi). The Sessions page shows an offline banner/indicator. Reconnecting dismisses it.
result: pass

### 8. Settings Page Updated
expected: Open Settings. The version shows v1.1. There is no "Deleted Sessions" or "Archived Sessions" section (soft-delete/archive UI has been removed).
result: pass

### 9. Export Session
expected: Export a session. The export completes successfully, pulling session/item metadata from Supabase and photos/audio from local storage. The exported file contains correct data.
result: pass

### 10. Delete Item
expected: Deleting an item removes it from both UI and Supabase without errors.
result: issue
reported: "406 (Not Acceptable) on GET items?select=transcript&id=eq.{uuid} when deleting an item. Item disappears from UI but Supabase query fails."
severity: major

### 11. Mark Session Complete
expected: Marking a session as complete updates the session status in Supabase without errors.
result: issue
reported: "400 (Bad Request) on PATCH sessions?id=eq.{uuid} when trying to mark a session complete. Two consecutive 400 errors."
severity: major

## Summary

total: 11
passed: 7
issues: 3
pending: 0
skipped: 0

## Gaps

- truth: "Photos display correctly for items in house visit mode"
  status: failed
  reason: "User reported: photo upload for items not visible in house visit mode"
  severity: major
  test: 6
  root_cause: "Race condition in PhotoCapture.tsx — useLiveQuery fires with dexieItemId=null before async getDexieItemId resolves, returns empty array. Save path uses fallback (dexieItemId ?? itemId) but query path bails out on null. Same bug in ItemEntry.tsx photo query."
  artifacts:
    - path: "src/components/PhotoCapture.tsx"
      issue: "Line 57-58: query returns [] when dexieItemId is null instead of falling back to itemId"
    - path: "src/pages/ItemEntry.tsx"
      issue: "Line 80: same query pattern with same null bail-out bug"
  missing:
    - "Change photo query to fall back to itemId when dexieItemId is null (match save path behavior)"
  debug_session: ".planning/debug/photos-not-visible-house-visit.md"

- truth: "Deleting an item removes it from both UI and Supabase without errors"
  status: failed
  reason: "User reported: 406 (Not Acceptable) on GET items?select=transcript&id=eq.{uuid} when deleting item"
  severity: major
  test: 10
  root_cause: "Race condition between fire-and-forget AI pipeline and item deletion. processAudioWithAi uses .single() on gemini.ts:182 to read transcript. When item is deleted mid-processing, .single() returns 406 (PostgREST behavior for zero-row single-object request)."
  artifacts:
    - path: "src/services/gemini.ts"
      issue: "Line 182: .single() causes 406 when item deleted during AI processing"
  missing:
    - "Replace .single() with .maybeSingle() and add null-check bail-out for deleted items"
  debug_session: ".planning/debug/delete-item-406-transcript.md"

- truth: "Marking a session as complete updates status in Supabase without errors"
  status: failed
  reason: "User reported: 400 (Bad Request) on PATCH sessions?id=eq.{uuid} when marking session complete"
  severity: major
  test: 11
  root_cause: "Supabase sessions table CHECK constraint only allows 'active', 'submitted', 'returned', 'exported'. Frontend sends status: 'completed' which is not in the allowed set. PostgreSQL rejects with 400."
  artifacts:
    - path: "supabase/migrations/20260318000001_create_sessions.sql"
      issue: "CHECK constraint missing 'completed' value"
    - path: "src/pages/SessionDetail.tsx"
      issue: "Line 179: sends status 'completed' which DB rejects"
  missing:
    - "Add 'completed' to sessions status CHECK constraint via new migration"
  debug_session: ".planning/debug/session-complete-400.md"
