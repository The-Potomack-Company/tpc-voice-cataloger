---
phase: 35
slug: ai-correctness-track-2
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-01
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 [VERIFIED: package.json] |
| **Config file** | `vite.config.ts` (Vitest config co-located) |
| **Quick run command** | `npx vitest --run src/tests/gemini-*.test.ts src/tests/item-card-*.test.tsx` |
| **Full suite command** | `npm test` (`vitest --run`) |
| **Estimated runtime** | ~30 seconds (targeted files); full suite longer |

**Template to copy:** `src/tests/gemini-pipeline.test.ts` already mocks `../lib/supabase` (hoisted `mockFrom`/`mockUpdate`/`mockEq`) and `../stores/sessionStore`, stubs `VITE_GEMINI_PROXY_URL`, dynamically imports `processAudioWithAi`, and provides a `mockGeminiResponse(fields)` helper wrapping fields in the Gemini `candidates[0].content.parts[0].text` envelope. New tests extend this file or sit beside it. Dexie (`db.audio`, and now `db.userEditedFields`) is real in tests (fake-indexeddb via existing setup) — assert on it directly. Component test mirrors `src/tests/item-card-audio-status.test.tsx`.

---

## Sampling Rate

- **After every task commit:** Run the single new test file for that task (e.g. `npx vitest --run src/tests/gemini-confab-guard.test.ts`)
- **After every plan wave:** Run `npx vitest --run src/tests/gemini-*.test.ts src/tests/item-card-*.test.tsx`
- **Before `/gsd:verify-work`:** `npm test` must be green
- **Max feedback latency:** ~30 seconds (targeted files)

---

## Per-Task Verification Map

| SC | Behavior | Test Type | Automated Command | File Exists | Status |
|----|----------|-----------|-------------------|-------------|--------|
| SC-1 | Identical mocked input → identical `supabaseUpdate` across two `processAudioWithAi` calls; `temperature:0` present in proxy request body (both paths) | unit | `npx vitest --run src/tests/gemini-determinism.test.ts` | ❌ W0 | ⬜ pending |
| SC-2 | Empty/whitespace/null transcript → `ai_status:"failed"`, ZERO catalog-field keys written, `ai.processing_failed` event fired | unit | `npx vitest --run src/tests/gemini-confab-guard.test.ts` | ❌ W0 | ⬜ pending |
| SC-3 | User-flagged `title` survives retry (`supabaseUpdate` omits `title`, includes other fields); fresh (non-retry) extraction clears flags | unit | `npx vitest --run src/tests/gemini-no-clobber.test.ts` | ❌ W0 | ⬜ pending |
| SC-4 | `ItemCard` with `ai_status:"failed"` renders inline failure row (role=alert + Retry); absent for other statuses | component (jsdom) | `npx vitest --run src/tests/item-card-ai-failure.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/gemini-determinism.test.ts` — SC-1 (deterministic-output snapshot + temperature assertion)
- [ ] `src/tests/gemini-confab-guard.test.ts` — SC-2 (confab-rejection on null + whitespace transcript)
- [ ] `src/tests/gemini-no-clobber.test.ts` — SC-3 (user-edited-field-survives-retry + clear-on-fresh)
- [ ] `src/tests/item-card-ai-failure.test.tsx` — SC-4 (copy structure from `item-card-audio-status.test.tsx`)
- [ ] **Prerequisite (not a test):** Dexie v11 `userEditedFields` store must exist before SC-3 can run — db migration is a prerequisite task.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual fidelity of the list-card failure row vs the detail-view `AiFailureBanner` | SC-4 (D-07) | Pixel/token-level visual consistency is subjective; automated test asserts presence + role, not visual parity | On a failed item, compare list-card warning row to detail banner: icon, "AI processing failed" copy, Retry CTA, token palette (`text-err`/badge tones) match |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
