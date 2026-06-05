---
status: complete
phase: 05-ai-pipeline
source: 05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md
started: 2026-03-16T14:00:00Z
updated: 2026-03-16T14:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server. Run `npm run dev` from scratch. The server boots without errors, the app loads in the browser, and the main page renders. No console errors related to DB migration or missing fields.
result: pass

### 2. AI Status Field in IndexedDB
expected: Open DevTools > Application > IndexedDB. Find the app's database. Items (HouseVisitItem or SaleItem) should have an `aiStatus` field visible in stored records (default "pending" for new items).
result: pass

### 3. Recording Triggers AI Processing
expected: Navigate to an item entry screen. Record audio using the Record button, then stop. After stopping, the AI pipeline fires automatically — check the Network tab for a POST request to the Gemini proxy URL. The item's aiStatus should transition from "pending" to "processing".
result: pass

### 4. AI-Extracted Fields Written to Item
expected: After AI processing completes (proxy request returns successfully), the item's catalog fields in IndexedDB should be populated with values extracted by Gemini. The aiStatus should be "done".
result: pass
note: Required fix during UAT — Gemini API rejects $schema and additionalProperties in responseSchema. Fixed by stripping those fields in gemini.ts before sending.

### 5. Missing Proxy URL Handled Gracefully
expected: Temporarily clear or remove VITE_GEMINI_PROXY_URL from .env (or set it to empty). Stop and restart dev server. Record and stop audio. The app should NOT crash — aiStatus should be set to "failed" and you should see a console error about missing proxy URL. No stuck "processing" state.
result: pass

### 6. Non-200 Proxy Response Handled
expected: If the proxy returns an error (e.g., proxy not deployed, wrong URL), stopping a recording should NOT crash the app. The aiStatus should be set to "failed", not stuck at "processing". App continues working normally.
result: pass

### 7. Cloudflare Worker Proxy CORS
expected: If the proxy is deployed, requests from the app's origin should succeed without CORS errors. Check the Network tab — the proxy response should include appropriate Access-Control-Allow-Origin headers.
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Gaps

- truth: "User can manually retry AI processing on items that failed"
  status: missing
  reason: "User reported: no way to retry AI processing manually from failures — need better error handling UX"
  severity: major
  test: n/a
  root_cause: "No retry mechanism exists in the UI; fire-and-forget pattern has no user-facing recovery path"
  artifacts:
    - path: "src/services/gemini.ts"
      issue: "processAudioWithAi is fire-and-forget only, no manual trigger path"
    - path: "src/components/RecordButton.tsx"
      issue: "Only triggers AI on recording stop, no retry button for failed items"
  missing:
    - "UI indicator showing aiStatus (failed/processing/done) on item cards"
    - "Retry button on items with aiStatus=failed that re-triggers processAudioWithAi"
  debug_session: ""
