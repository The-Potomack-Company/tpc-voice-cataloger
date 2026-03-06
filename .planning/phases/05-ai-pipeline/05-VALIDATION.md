---
phase: 5
slug: ai-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `vite.config.ts` (test section) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | AI-01 | unit (mock fetch) | `npx vitest run src/tests/gemini-pipeline.test.ts -t "processes audio" --reporter=verbose` | ❌ W0 | ⬜ pending |
| 5-01-02 | 01 | 1 | AI-01 | unit (mock env) | `npx vitest run src/tests/gemini-proxy.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 5-01-03 | 01 | 1 | AI-02 | unit | `npx vitest run src/tests/gemini-pipeline.test.ts -t "verbatim" --reporter=verbose` | ❌ W0 | ⬜ pending |
| 5-01-04 | 01 | 1 | AI-03 | unit | `npx vitest run src/tests/gemini-pipeline.test.ts -t "null fields" --reporter=verbose` | ❌ W0 | ⬜ pending |
| 5-01-05 | 01 | 1 | AI-03 | unit | `npx vitest run src/tests/gemini-pipeline.test.ts -t "fallback" --reporter=verbose` | ❌ W0 | ⬜ pending |
| 5-01-06 | 01 | 1 | AI-01 | unit | `npx vitest run src/tests/gemini-schema.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 5-01-07 | 01 | 1 | AI-01 | unit | `npx vitest run src/tests/gemini-pipeline.test.ts -t "aiStatus" --reporter=verbose` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/gemini-pipeline.test.ts` — stubs for AI-01, AI-02, AI-03 (mock fetch to proxy, validate Dexie writes)
- [ ] `src/tests/gemini-schema.test.ts` — Zod schema validation of various Gemini response shapes
- [ ] `src/tests/gemini-proxy.test.ts` — proxy handler logic (if proxy code lives in this repo)
- [ ] DB migration test for v3 (aiStatus field) — extend existing `src/tests/db.test.ts`
- [ ] Mock `fetch` in test setup for proxy calls

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Audio recording → transcription end-to-end | AI-01 | Requires real Gemini API call with real audio | Record a test item, verify structured fields appear within 30s |
| iOS Safari audio format compatibility | AI-01 | Device-specific browser behavior | Test on iPhone Safari, verify audio processes correctly |
| Rapid item switching race condition | AI-03 | Timing-dependent concurrent behavior | Record 3 items quickly, verify fields land on correct items |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
