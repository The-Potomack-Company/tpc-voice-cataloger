---
status: partial
phase: 33-offline-reliability
source: [33-VERIFICATION.md]
started: 2026-06-01T00:00:00Z
updated: 2026-06-01T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Real 4-tab concurrent drain bills Gemini once
expected: Open the app in 4 tabs (or 2 tabs + 2 devices) with the same queued item(s). On reconnect/drain, only ONE tab wins the DB-atomic claim per item and fires exactly one `processAudioWithAi` call — zero duplicate Gemini billing, no lost updates. (Unit tests mock the claim; real multi-tab needs a browser against live Supabase.)
result: [pending]

### 2. Blocked-count badge renders and updates while online
expected: When an item hits the attempt cap / permanent error (or a write-ahead entry is dropped) while continuously online, a `tone="err"` blocked-count badge appears next to the OfflineIndicator in the AppLayout header without a reload, and clicking it opens the detail list. Count reflects `items.ai_status='failed'`.
result: [pending]

### 3. Recorder always settles under real IndexedDB quota pressure
expected: Force a `db.audio.add` failure on-device (e.g. quota pressure). `stopRecording()` resolves (no hang), a recorder error surfaces, and the blob is retained in `recordingStore.retryBuffer`. (D-12 manual re-save UI is deferred — only the always-settle + retention is in scope here.)
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
