---
status: partial
phase: 44-visibility-ux-polish
source: [44-VERIFICATION.md]
started: 2026-06-04
updated: 2026-06-04
---

## Current Test

[awaiting human testing — deferred to v1.3 milestone-end UAT per standing policy]

## Tests

### 1. Blocked-queue badge — visual + navigation
expected: With a `failed` item present, tapping the blocked badge opens a dropdown whose rows show the item name/mode (title → #receipt → short id) — never a bare UUID. Tapping a row navigates to `/session/:session_id/item/:id` and closes the dropdown.
result: [pending]

### 2. Duplicate-receipt import — live 23505 path
expected: Importing a CSV containing a receipt that already exists in the DB shows a toast naming the offending receipt ("Receipt #<number> is already in use — that import was undone…"), not the generic copy, and the session rolls back cleanly with no orphan rows.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
