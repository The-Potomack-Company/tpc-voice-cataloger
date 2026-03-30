---
phase: 21
slug: more-granularity-with-description-and-transcription
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run src/tests/gemini-schema.test.ts src/tests/gemini-pipeline.test.ts src/tests/formatMeasurements.test.ts -x` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/tests/gemini-schema.test.ts src/tests/gemini-pipeline.test.ts src/tests/formatMeasurements.test.ts -x`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 1 | D-05/D-09 | unit | `npx vitest run src/tests/gemini-schema.test.ts -x` | ❌ W0 | ⬜ pending |
| 21-01-02 | 01 | 1 | D-06/D-07 | unit | `npx vitest run src/tests/gemini-schema.test.ts -x` | ❌ W0 | ⬜ pending |
| 21-02-01 | 02 | 1 | D-01/D-02 | unit | `npx vitest run src/tests/gemini-pipeline.test.ts -x` | ❌ W0 | ⬜ pending |
| 21-02-02 | 02 | 1 | D-03 | unit | `npx vitest run src/tests/gemini-pipeline.test.ts -x` | ❌ W0 | ⬜ pending |
| 21-03-01 | 03 | 1 | D-10/D-11 | unit | `npx vitest run src/tests/gemini-pipeline.test.ts -x` | ❌ W0 | ⬜ pending |
| 21-compat | 01 | 1 | Compat | unit | `npx vitest run src/tests/formatMeasurements.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Update `src/tests/gemini-schema.test.ts` — measurements field from array to string in all test cases
- [ ] Update `src/tests/gemini-pipeline.test.ts` — mock responses return string measurements; add merge behavior tests
- [ ] Add `src/tests/formatMeasurements.test.ts` cases for rich format pass-through

*Existing infrastructure covers framework setup. Only test data updates needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Merge intent from audio | D-01/D-02 | Requires actual Gemini API call with audio | Record "add ROBERT to the title" after initial recording; verify title includes ROBERT alongside original content |
| Spoken punctuation from audio | D-10/D-11 | Requires actual Gemini API call with audio | Record "title colon VASE comma BLUE" and verify output "VASE, BLUE" |
| mm unit triggering | D-06 | Requires spoken "millimeters" vs unspecified | Record dimensions without unit (expect inches), then with "millimeters" (expect mm) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
