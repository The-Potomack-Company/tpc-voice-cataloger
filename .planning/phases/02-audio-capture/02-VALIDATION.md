---
phase: 2
slug: audio-capture
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 + jsdom |
| **Config file** | `vite.config.ts` (test section) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 0 | VOICE-01, VOICE-02 | unit | `npx vitest run src/tests/audio-recorder.test.ts` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 0 | VOICE-03 | unit | `npx vitest run src/tests/record-button.test.tsx` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 0 | VOICE-04 | unit | `npx vitest run src/tests/audio-utils.test.ts` | ❌ W0 | ⬜ pending |
| 2-01-04 | 01 | 1 | VOICE-01 | unit | `npx vitest run src/tests/audio-recorder.test.ts -t "start and stop"` | ❌ W0 | ⬜ pending |
| 2-01-05 | 01 | 1 | VOICE-02 | unit | `npx vitest run src/tests/audio-recorder.test.ts -t "stores blob"` | ❌ W0 | ⬜ pending |
| 2-01-06 | 01 | 1 | VOICE-03 | unit | `npx vitest run src/tests/record-button.test.tsx -t "indicator"` | ❌ W0 | ⬜ pending |
| 2-01-07 | 01 | 1 | VOICE-04 | unit | `npx vitest run src/tests/audio-utils.test.ts -t "mime type"` | ❌ W0 | ⬜ pending |
| 2-01-08 | 01 | 1 | VOICE-04 | manual-only | N/A — real device testing | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/audio-recorder.test.ts` — stubs for VOICE-01, VOICE-02 (useAudioRecorder hook tests with mocked MediaRecorder)
- [ ] `src/tests/record-button.test.tsx` — stubs for VOICE-03 (component render tests for button states, timer, border)
- [ ] `src/tests/audio-utils.test.ts` — stubs for VOICE-04 (MIME type detection with mocked isTypeSupported)
- [ ] Mock setup: MediaRecorder and getUserMedia mocks in `src/tests/setup.ts` (extend existing file)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Recording + playback on iOS Safari | VOICE-04 | Requires real iPhone hardware with Safari | 1. Open app on iPhone Safari 2. Tap record 3. Speak for ~5s 4. Tap stop 5. Verify toast appears with play button 6. Tap play to confirm audio plays |
| Recording + playback on Android Chrome | VOICE-04 | Requires real Android device with Chrome | 1. Open app on Android Chrome 2. Tap record 3. Speak for ~5s 4. Tap stop 5. Verify toast appears with play button 6. Tap play to confirm audio plays |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
