---
status: complete
phase: 21-more-granularity-with-description-and-transcription
source: 21-01-SUMMARY.md, 21-02-SUMMARY.md, 21-03-SUMMARY.md
started: 2026-03-31T14:00:00Z
updated: 2026-03-31T14:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Measurements as Formatted String
expected: Record a piece with physical measurements (dimensions, weight, karats). The AI should return measurements as a formatted string like "3 inches (7.6 cm), 5mm, 2 oz, 14kt" rather than just an array of numbers.
result: pass

### 2. Re-recording Merges Fields Additively
expected: Record a piece with some details (e.g., title, description). Then re-record the same piece with additional details. The existing fields should be preserved and new information merged in — not overwritten.
result: pass

### 3. Transcript Merge on Re-recording
expected: Record a piece, then re-record it with additional narration. The transcript field should contain both the original and new content merged together by the AI, not just the latest recording.
result: pass

### 4. Spoken Punctuation Conversion
expected: Dictate something like "this piece is beautiful comma with intricate details period" during a recording. The AI should convert spoken punctuation words to actual characters, producing "this piece is beautiful, with intricate details."
result: pass

### 5. Spoken Punctuation Context Awareness
expected: Dictate something where "period" is used as a real word (e.g., "Victorian period brooch"). The word "period" should remain as text and not be converted to a dot.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
