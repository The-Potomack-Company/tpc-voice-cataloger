---
phase: 42-audio-upload-reliability
verified: 2026-06-04T15:30:00Z
status: passed   # human UAT legs passed 2026-06-04 (milestone-end)
score: 3/3 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Two-device cross-device self-heal — record on device A with airplane mode, reconnect, confirm audio row lands in Supabase; then open the same item on device B (no local Dexie blob) and confirm the AiFailureBanner Retry button appears and resolves via Storage"
    expected: "Banner renders with Retry; clicking Retry re-runs AI and the item transitions from failed to done on device B"
    why_human: "Requires two physical devices sharing a prod Supabase project and a real network flap; cannot be exercised by vitest or grep"
---

# Phase 42: Audio Upload Reliability Verification Report

**Phase Goal:** Audit and fix why recorded audio fails to reach the Supabase `audio` table (root cause of 34 stranded items); plus fix AiFailureBanner returning null for server-only audio so cross-device/historical failed items have a working Retry.
**Verified:** 2026-06-04T15:30:00Z
**Status:** passed (human UAT passed 2026-06-04)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A `failed` audio-upload-queue entry resurfaces on app boot and every `online` event (bounded, not a retry storm) and can land the `audio` row | VERIFIED | `resweepFailedUploads()` exported from `audioUploadQueue.ts:201`, gated by `RESWEEP_CAP=6` at `:19`; wired in `AppLayout.tsx:65` via `void resweepFailedUploads()` inside `handleReconnect` (runs on mount-if-online + `window.addEventListener("online")`). `retryCount` is preserved (never zeroed) — confirmed by `grep -A8 "function resweepFailedUploads" … \| grep -c "retryCount: 0"` returning 0. |
| 2 | An item stranded in `pending` or `failed` whose audio has since reached the `audio` table is reconciled back to `queued` and becomes drainable | VERIFIED | `offlineQueue.ts:221-263` — a `for (const stuckStatus of ["pending","failed"])` loop uses the canonical union-then-conditional-update shape: `supabase.from("audio").select("item_id").in("item_id", stuckIds)` followed by `.update({ai_status:"queued"}).in("id",idsWithAudio).eq("ai_status",stuckStatus).select("id")`. `.select("id")` on the write keeps winner-detection real (Pitfall 1). No service-role used (`grep -c "service_role" offlineQueue.ts` = 0). |
| 3 | AiFailureBanner renders with a working Retry for failed items whose audio exists only server-side | VERIFIED | `AiFailureBanner.tsx:52` gate changed from `if (latestAudioId == null)` to `if (!hasServerAudio && latestAudioId == null)`. Prop `hasServerAudio: boolean` added at `:46`. Retry calls the gemini.ts orchestrator (import unchanged: `from "../services/gemini"`) with `latestAudioId ?? 0` + `isRetry=true`; sentinel `0` is safe because `resolveAudioForAi` resolves by `item_id` when Dexie misses. Gate uses `== null` not `=== null` (Pitfall 2 safe). |
| 4 | `hasServerAudio` threaded through ItemList aggregate → ItemCard → banner, and derived in ItemEntry | VERIFIED | `ItemList.tsx:30,66,72,378` — field added to `ItemMeta`, computed as `audios.some((a) => a.id == null)`, passed as `hasServerAudio={meta?.hasServerAudio ?? false}` to `<ItemCard>`. `ItemCard.tsx:27,47,265,449` — prop typed, destructured, passed to `<AiFailureBanner>`, and added to `arePropsEqual` comparator. `ItemEntry.tsx:163-176` — parallel derivation in `bannerAudioMeta` useLiveQuery; `bannerHasServerAudio` passed to detail banner at `:308`. |
| 5 | Regression test covers the cross-device path (server-only audio → banner renders Retry → retry routes through gemini orchestrator keyed on item_id) | VERIFIED | `src/tests/audio-cross-device-recovery.test.tsx` exists (created commit `b9c5116`). 4 cases: (a) server-only renders alert + Retry, (b) Retry calls `processAudioWithAi` with `call[1]=ITEM_UUID, call[2]=SESSION_UUID, call[3]=true`, (c) no audio = banner hidden, (d) local-blob path unregressed. Test was RED before `efd1783` (banner gate change), GREEN after. |
| 6 | No schema changes; no new npm dependencies | VERIFIED | `git diff 522028e^1 c02cb5e -- "*.json" "supabase/"` returns empty. All 8 phase commits touch only `src/` and `.planning/`. |

**Score:** 6/6 observable truths verified (mapped to 3 SCs)

---

### Required Artifacts

| Artifact | Expected | Status | Evidence |
|----------|----------|--------|---------|
| `src/services/audioUploadQueue.ts` | `resweepFailedUploads()` with `RESWEEP_CAP`, retryCount preserved | VERIFIED | `:19,201-219` — exported function, cap constant, no retryCount:0 in resweep body |
| `src/services/offlineQueue.ts` | Reconcile loop covering `pending` and `failed` stuck states | VERIFIED | `:221-263` — generalized union-then-conditional-update for both states |
| `src/layouts/AppLayout.tsx` | `resweepFailedUploads` wired in `handleReconnect` | VERIFIED | `:9` (import), `:65` (call before `drainAudioQueue`) |
| `src/components/AiFailureBanner.tsx` | `hasServerAudio` prop + gate + sentinel retry | VERIFIED | `:41,46,52,61` |
| `src/components/ItemList.tsx` | `hasServerAudio` in ItemMeta, computed, threaded | VERIFIED | 4 occurrences (interface, compute, map.set, ItemCard prop) |
| `src/components/ItemCard.tsx` | `hasServerAudio` in props, destructure, banner pass, memo compare | VERIFIED | 4 occurrences including `arePropsEqual` at `:449` |
| `src/pages/ItemEntry.tsx` | `hasServerAudio` derived + passed to detail banner | VERIFIED | 7 occurrences — derivation `:163-176`, banner prop `:308` |
| `src/tests/audio-cross-device-recovery.test.tsx` | Cross-device SC-3 regression test | VERIFIED | 92-line file, 4 test cases, mocks gemini orchestrator |
| `src/tests/audio-upload-queue.test.ts` | Resweep cases (below-cap, at-cap, blob-gone, idempotent) | VERIFIED | `describe "resweepFailedUploads"` block at `:262-379`, 4 cases |
| `src/tests/offline-queue.test.ts` | Reconcile cases (uploaded requeues, no-audio untouched, select-present, id:undefined safe) | VERIFIED | Confirmed green (18/18 per SUMMARY.md; `npm test` 709 passed) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `AppLayout.tsx handleReconnect` | `audioUploadQueue.ts resweepFailedUploads` | `void resweepFailedUploads()` at `:65` | WIRED | Fires on boot (if online) and every `online` event |
| `resweepFailedUploads` | `db.audioUploadQueue failed entries` | `where("status").equals("failed")` at `:202` | WIRED | Bounded by `RESWEEP_CAP`; retryCount preserved |
| `offlineQueue drainQueue reconcile` | `supabase.from("audio") by item_id` | `from("audio").select("item_id").in("item_id", stuckIds)` at `:235-239` | WIRED | Two stuck states covered; RLS-scoped |
| `ItemList → ItemCard` | `hasServerAudio` prop | `hasServerAudio={meta?.hasServerAudio ?? false}` at `:378` | WIRED | Computed from `audios.some((a) => a.id == null)` |
| `ItemCard → AiFailureBanner` | `hasServerAudio` prop | `hasServerAudio={hasServerAudio}` at `:265` | WIRED | Passed through ItemCardImpl |
| `AiFailureBanner handleRetry` | `gemini.ts processAudioWithAi` | `processAudioWithAiRetry(latestAudioId ?? 0, itemId, sessionId, true)` at `:61` | WIRED | Orchestrator import unchanged; sentinel 0 safe per T-42-09 |
| `ItemEntry bannerAudioMeta` | `AiFailureBanner hasServerAudio` | `hasServerAudio={bannerHasServerAudio}` at `:308` | WIRED | Parallel derivation in useLiveQuery |

---

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| `resweepFailedUploads` does NOT zero retryCount | `grep -A8 "function resweepFailedUploads" audioUploadQueue.ts \| grep -c "retryCount: 0"` | `0` | PASS |
| `resweepFailedUploads` called in AppLayout | `grep -c "resweepFailedUploads" AppLayout.tsx` | `2` (import + call) | PASS |
| Banner gate uses `== null` not `=== null` | Actual gate code at `AiFailureBanner.tsx:52` | `if (!hasServerAudio && latestAudioId == null)` | PASS |
| Banner imports gemini.ts orchestrator (not processAudioWithAi.ts) | `grep -n 'from.*gemini' AiFailureBanner.tsx` | `import { processAudioWithAi } from "../services/gemini"` at `:2` | PASS |
| Reconcile write uses `.select("id")` | `grep -n '.select("id")' offlineQueue.ts` | Lines `131,225,259` — all conditional writes have it | PASS |
| No service-role in offlineQueue | `grep -c "service_role\|serviceRole" offlineQueue.ts` | `0` | PASS |
| Full test suite | `npm test` | `709 passed, 0 failed` | PASS |
| TypeScript | `npx tsc -p tsconfig.app.json --noEmit` | Exit 0 | PASS |

---

### Anti-Patterns Found

No blockers. Key negative checks:

| File | Pattern checked | Result |
|------|----------------|--------|
| `audioUploadQueue.ts` | Unbounded resweep (retryCount zeroed) | Not present — retryCount preserved |
| `offlineQueue.ts` | `service_role` / cross-session broadening | Not present |
| `AiFailureBanner.tsx` | `=== null` in gate (Pitfall 2) | In comment only (`:51`); actual gate at `:52` uses `== null` |
| Any phase file | `TBD`, `FIXME`, `XXX` unresolved debt markers | None found |
| `package.json` / `supabase/` | Schema changes or new deps | Zero phase commits touch either |

---

### Human Verification Required

The one genuine manual leg cannot be exercised by automated tests: the end-to-end two-device + live-RLS cross-device recovery path.

#### 1. Two-Device Cross-Device Self-Heal

**Test:** On device A, put the device in airplane mode, record an item, then reconnect. Confirm in Supabase that an `audio` row with `upload_status='uploaded'` appears for the item. Then open the same item on device B (which has no local Dexie blob for that audio). Confirm the AiFailureBanner is visible with a Retry button. Click Retry. Confirm the item transitions to `done` and AI output is populated.

**Expected:** Audio self-heals on reconnect (SC-1 resweep picks up the failed queue entry); device B sees the server-only audio (hasServerAudio=true), banner shows Retry; Retry resolves the blob from Supabase Storage via item_id and the item is processed successfully.

**Why human:** Requires two physical devices sharing a live Supabase project with real Storage + RLS active, a real network flap (airplane mode toggle), and observing the resulting DB state. Cannot be simulated in vitest/jsdom.

**Note:** Per `MEMORY.md v13-push-uat-at-milestone-end`, this UAT is deferred to the v1.3 milestone-end on-device batch. This is a known non-blocking deferral, not a failure.

---

### Gaps Summary

No gaps. All three Success Criteria are delivered in code:

- **SC-1** (upload durability + stranding precondition closed): `resweepFailedUploads` + `RESWEEP_CAP` + AppLayout wiring + offlineQueue reconcile loop cover GAP-1 through GAP-4.
- **SC-2** (banner Retry for server-only audio): `hasServerAudio` prop gate + sentinel audioId + gemini orchestrator wiring closes GAP-5/F2. Both list card and detail page covered.
- **SC-3** (regression test): `audio-cross-device-recovery.test.tsx` exercises all four cases including the gemini orchestrator keyed-on-item_id assertion.

The only open item is the two-device UAT, which is a scheduled manual verification (v1.3 milestone end), not a code deficiency.

---

_Verified: 2026-06-04T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
