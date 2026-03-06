---
phase: 6
slug: review-edit-export
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `vite.config.ts` (test section) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | EDIT-01 | unit | `npx vitest run src/tests/item-list.test.tsx -x` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | EDIT-02 | unit | `npx vitest run src/tests/inline-edit.test.tsx -x` | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 1 | EDIT-03 | unit | `npx vitest run src/tests/item-crud.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-01-04 | 01 | 1 | EDIT-04 | unit | `npx vitest run src/tests/re-record.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | EXPO-01 | unit | `npx vitest run src/tests/export.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 2 | EXPO-02 | unit | `npx vitest run src/tests/export.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-02-03 | 02 | 2 | EXPO-03 | unit | `npx vitest run src/tests/export.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/item-list.test.tsx` — stubs for EDIT-01 (item list rendering with AI fields)
- [ ] `src/tests/inline-edit.test.tsx` — stubs for EDIT-02 (inline field editing)
- [ ] `src/tests/item-crud.test.ts` — stubs for EDIT-03 (item deletion)
- [ ] `src/tests/re-record.test.ts` — stubs for EDIT-04 (re-record append)
- [ ] `src/tests/export.test.ts` — stubs for EXPO-01, EXPO-02, EXPO-03 (export pipeline)

*Existing infrastructure covers framework setup (`vite.config.ts` test section, `src/tests/setup.ts`).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Web Share API file delivery | EXPO-03 | Requires real device/browser share sheet | 1. Tap Export, 2. Verify share sheet appears with JSON file, 3. Select destination, 4. Verify file received |
| 300+ item scroll performance | EDIT-01 | Performance perception is subjective | 1. Load session with 300+ items, 2. Scroll through list, 3. Verify no jank or lag |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
