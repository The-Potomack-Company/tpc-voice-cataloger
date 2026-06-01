---
phase: 34
slug: ios-memory-optimization
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-01
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 (jsdom env) |
| **Config file** | `vite.config.ts` (`test:` block, ~line 61-68) |
| **Quick run command** | `npx vitest --run src/tests/gemini-pipeline.test.ts src/tests/item-card-render-count.test.tsx` |
| **Full suite command** | `npm test` (= `vitest --run`) |
| **Setup file** | `src/tests/setup.ts` (jest-dom + fake-indexeddb/auto + MediaRecorder mocks) |
| **Estimated runtime** | ~30 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run quick command (the two target suites)
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd:verify-work`:** Full suite green **minus the 18 known pre-existing `localStorage.clear` failures** (`persist-scoping.test.ts` / `photo-migration.test.ts`, per STATE.md — do not attribute to this phase)
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 34-W0 | — | 0 | PERF-1 | — | N/A | unit | `npx vitest --run src/tests/gemini-pipeline.test.ts -t "multi-chunk"` | ❌ W0 | ⬜ pending |
| 34-W0 | — | 0 | PERF-3 | — | N/A | component | `npx vitest --run src/tests/item-card-render-count.test.tsx` | ❌ W0 | ⬜ pending |
| 34-enc | 01 | 1 | PERF-1 | — | N/A | unit | `npx vitest --run src/tests/gemini-pipeline.test.ts` | ✅ | ⬜ pending |
| 34-enc | 01 | 1 | PERF-1 | — | N/A | integration | `npx vitest --run src/tests/geminiContinuous.test.ts` | ✅ | ⬜ pending |
| 34-hoist | 02 | 1 | PERF-3 | — | N/A | component | `npx vitest --run src/tests/item-card-render-count.test.tsx` | ❌ W0 | ⬜ pending |
| 34-hoist | 02 | 1 | PERF-3 | — | N/A | component | `npx vitest --run src/tests/item-card-audio-status.test.tsx` | ⚠️ prop-sig | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/gemini-pipeline.test.ts` — add multi-chunk blob test (blob > chunk size): chunked output === reference whole-buffer `btoa`. Guards the 3-byte alignment trap (chunk size MUST be a multiple of 3, e.g. `32766`) — PERF-1.
- [ ] `src/tests/item-card-render-count.test.tsx` — dev-only render counter + RTL rerender asserting a one-item `ai_status`/recording-state flip does NOT re-render the other N-1 cards. Mock pattern: copy `item-card-audio-status.test.tsx:29-53` — PERF-3 / D-08.
- [ ] Confirm `item-card-audio-status.test.tsx` still passes after `ItemCard` prop-signature change (it renders `ItemCard` directly + mocks helpers; new required meta props may need adding to `renderCard`'s `<ItemCard ... />`).
- Framework install: none — Vitest / RTL / fake-indexeddb already present.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bounded heap over a 5-min single-mode session | PERF-1 | Heap-snapshot diffing is not CI-automatable | Desktop Chrome: heap snapshot → 5-min single-mode recording/cataloging session → snapshot again; assert no monotonic multi-MB-per-recording climb from retained binary strings |
| No runaway JS-heap / tab reload on-device | PERF-1 | iOS Safari target; `measureUserAgentSpecificMemory()` is Chromium-only + needs COOP/COEP (PWA not cross-origin isolated) | iOS Safari Web Inspector: record JS-heap timeline during a session; confirm no runaway growth / no tab reload (OOM). Capture COOP/COEP caveat in the runbook (D-09) |
| Continuous-mode master-blob (PERF-2) | PERF-2 | Deferred — continuous gated off (D-050) | Regression-only via existing `geminiContinuous.test.ts`; no manual check this phase |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (multi-chunk encoder test, render-count test)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
