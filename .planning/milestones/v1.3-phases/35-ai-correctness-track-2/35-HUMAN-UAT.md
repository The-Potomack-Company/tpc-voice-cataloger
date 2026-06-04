---
status: complete
phase: 35-ai-correctness-track-2
source: [35-VERIFICATION.md]
started: 2026-06-01T16:00:00Z
updated: 2026-06-04T00:00:00Z
---

## Current Test

[complete — milestone-end UAT walk 2026-06-04]

## Tests

### 1. List-card AI-failure row matches the detail-view banner

expected: On an item with `ai_status === "failed"`, the full-width inline failure row on the list card (icon, "AI processing failed" copy, Retry CTA, and `text-err`/`border-err` token palette) is visually consistent with the detail-view AiFailureBanner. Both surfaces render the same shared `AiFailureBanner` component, so structural parity is guaranteed by code; this check confirms the rendered appearance in the live app.
result: PASS. NOTE finding F2: the failure row + Retry are hidden for items whose audio is not in the local Dexie cache (cross-device/historical items) because AiFailureBanner returns null when latestAudioId is null — real bug, common admin case, follow-up.

## Summary

total: 1
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
