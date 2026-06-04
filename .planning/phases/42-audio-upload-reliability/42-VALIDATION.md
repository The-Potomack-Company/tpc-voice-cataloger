---
phase: 42
slug: audio-upload-reliability
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-04
---

# Phase 42 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 (+ @testing-library/react ^16.3.2, jsdom) |
| **Config file** | `vite.config.ts` (test block at :61; setupFiles `src/tests/setup.ts`; e2e excluded) |
| **Quick run command** | `npx vitest --run src/tests/<file>` |
| **Full suite command** | `npm test` (`vitest --run`) |
| **Estimated runtime** | ~30s single file; full suite ~60-90s (~710 tests) |

---

## Sampling Rate

- **After every task commit:** Run the nearest `npx vitest --run src/tests/<touched>.test.*`
- **After every plan wave:** Run `npm test` (full suite — keep ~710 green)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds (single-file quick run)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Success Criterion | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 42-01-01 | 01 | 1 | SC-1 | T-42-01 / T-42-04 | Bounded resweep (retryCount preserved, no re-arm storm); idempotent upsert can't duplicate Storage object | unit | `npx vitest --run src/tests/audio-upload-queue.test.ts` | ✅ extend | ⬜ pending |
| 42-01-02 | 01 | 1 | SC-1 | T-42-02 / T-42-03 / T-42-05 | Reconcile keys on item_id under RLS, no service-role, conditional write keeps .select | unit | `npx vitest --run src/tests/offline-queue.test.ts` | ✅ extend | ⬜ pending |
| 42-01-03 | 01 | 1 | SC-1 | — | Glue: boot+online resweep trigger | typecheck | `grep -n resweepFailedUploads src/layouts/AppLayout.tsx && npx tsc -p tsconfig.app.json --noEmit` | ✅ existing | ⬜ pending |
| 42-02-00 | 02 | 1 | SC-2/SC-3 | — | RED gate: cross-device banner shows Retry; retry keys on item_id | component+unit | `npx vitest --run src/tests/audio-cross-device-recovery.test.tsx` | ❌ W0 (new) | ⬜ pending |
| 42-02-01 | 02 | 1 | SC-2 | T-42-06 / T-42-07 / T-42-09 | Retry under RLS via orchestrator; sentinel 0 audioId resolves by item_id only | component | `npx vitest --run src/tests/audio-cross-device-recovery.test.tsx src/tests/item-card-ai-failure.test.tsx` | ✅+❌ | ⬜ pending |
| 42-02-02 | 02 | 1 | SC-2 | — | hasServerAudio threaded through aggregate + memo compare; == null safety | typecheck+component | `npx vitest --run src/tests/audio-cross-device-recovery.test.tsx && npx tsc -p tsconfig.app.json --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/audio-cross-device-recovery.test.tsx` (NEW, Plan 02 Task 0) — RED gate for SC-2/SC-3: item present, audio only in Supabase → banner shows Retry → retry resolves via Storage-by-item_id. Clones harness from `item-card-ai-failure.test.tsx` + `audio-storage-fallback.test.ts`.
- [ ] Extend `src/tests/audio-upload-queue.test.ts` (Plan 01 Task 1) — failed→pending→uploaded resweep + resweep-cap + blob-gone + idempotency cases (existing vi.hoisted supabase + mockAudioUploadQueue/mockAudio harness).
- [ ] Extend `src/tests/offline-queue.test.ts` (Plan 01 Task 2) — uploaded-audio-requeues + no-audio-untouched + select-present + id:undefined-safe reconcile cases.
- [x] Framework install — NOT needed (vitest + RTL already present; RESEARCH §Environment Availability).

---

## Manual-Only Verifications

| Behavior | Criterion | Why Manual | Test Instructions |
|----------|-----------|------------|-------------------|
| Real cross-device self-heal on prod (device A records offline, device B opens item, audio recovers) | SC-1/SC-2 | Requires two physical devices + shared prod Supabase + real network flap | Deferred to v1.3 milestone-end on-device UAT batch (MEMORY.md). Add to `42-HUMAN-UAT.md` at phase close: record on device A with airplane mode, reconnect, confirm audio row lands; open same item on device B, confirm failure banner Retry resolves via Storage. |

*Automated tests cover the logic; the genuine multi-device + live-RLS path is the one manual leg, batched at milestone end per the push/UAT-deferral decision.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (audio-cross-device-recovery.test.tsx)
- [x] No watch-mode flags (all `vitest --run`)
- [x] Feedback latency < 30s (single-file quick run)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-04
