---
phase: 8
slug: offline-queue
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `vite.config.ts` (test block) |
| **Quick run command** | `npx vitest run src/tests/offline-queue.test.ts --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/tests/offline-queue.test.ts --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-00-01 | 00 | 0 | OFFL-01, OFFL-02, OFFL-03, OFFL-04 | scaffold | `npx vitest run src/tests/offline-queue.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 08-01-01 | 01 | 1 | OFFL-01 | unit | `npx vitest run src/tests/offline-queue.test.ts -t "sets queued when offline" -x` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | OFFL-02 | unit | `npx vitest run src/tests/offline-queue.test.ts -t "drainQueue" -x` | ❌ W0 | ⬜ pending |
| 08-01-03 | 01 | 1 | OFFL-04 | unit | `npx vitest run src/tests/offline-queue.test.ts -t "online event triggers drain" -x` | ❌ W0 | ⬜ pending |
| 08-01-04 | 01 | 1 | OFFL-04 | unit | `npx vitest run src/tests/offline-queue.test.ts -t "retry" -x` | ❌ W0 | ⬜ pending |
| 08-01-05 | 01 | 1 | OFFL-04 | unit | `npx vitest run src/tests/offline-queue.test.ts -t "concurrency" -x` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 2 | OFFL-03 | unit | `npx vitest run src/tests/offline-queue.test.ts -t "queued badge" -x` | ❌ W0 | ⬜ pending |
| 08-02-02 | 02 | 2 | OFFL-03 | unit | `npx vitest run src/tests/offline-queue.test.ts -t "offline indicator" -x` | ❌ W0 | ⬜ pending |
| 08-02-03 | 02 | 2 | OFFL-02 | unit | `npx vitest run src/tests/offline-queue.test.ts -t "export disabled" -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/offline-queue.test.ts` — stubs for OFFL-01, OFFL-02, OFFL-03, OFFL-04
- [ ] Test setup: mock `navigator.onLine` and `online`/`offline` events in test helpers
- [ ] Mock for `processAudioWithAi` to control success/failure in drain tests

*Wave 0 creates test scaffolds; real assertions filled during execution.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Recording works in airplane mode | OFFL-01 | Requires physical device offline state | 1. Enable airplane mode 2. Tap record 3. Speak and stop 4. Verify item appears with "Queued" badge |
| Queue drains on reconnect | OFFL-04 | Requires real connectivity transition | 1. Record items offline 2. Disable airplane mode 3. Verify items process automatically |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
