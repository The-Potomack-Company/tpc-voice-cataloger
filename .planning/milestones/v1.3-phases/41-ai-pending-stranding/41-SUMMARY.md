---
phase: 41-ai-pending-stranding
status: complete
shipped: 2026-06-04
implemented_by: codex
reviewed_by: claude
lane: urgent
---

# Phase 41 — ai-pending-stranding (SUMMARY)

Shipped via the urgent lane during v1.3 milestone-end UAT (found by UAT-9). Not
planned through the per-phase planner; this SUMMARY back-fills the roadmap for
clean provenance ahead of the v1.3 merge.

## Problem

Items could weld to `ai_status='pending'` forever. The offline drain
(`drainQueue`/`getQueuedItems`) only scanned `'queued'`. Online record-stop fired
`processAudioWithAi` fire-and-forget from `pending`; an abandoned (tab close/nav)
or network-down-during-catch call stranded the item with no retry path. 34 prod
items were stranded back to 2026-05-06 — all with **zero** Supabase `audio` rows
(audio never uploaded), so unrecoverable; not recovered here.

## What shipped

1. Durable `queued` anchor — `RecordButton` online branch sets `ai_status='queued'`
   before the fire-and-forget AI call (`RecordButton.tsx`).
2. Atomic inline claim — `processAudioWithAi` flips to `processing` via a
   conditional claim: fresh from `'queued'`, retry from `['failed','processing']`
   (R-1), drain passes `alreadyClaimed=true`; bails on 0 rows so inline + drain
   never double-spend Gemini (`gemini.ts`).
3. Orphan-pending reclaim — `drainQueue` reclaims `pending`-with-Supabase-audio
   items to `'queued'`; `pending`-without-audio left untouched (`offlineQueue.ts`).
4. Detail-view waiting indicator for `pending`/`queued` (`ItemEntry.tsx`).

## Verification

- 698 tests pass, build clean (independently re-run on the fix branch).
- Codex implemented; Claude reviewed (cross-vendor gate). One review finding (R-1)
  folded in.
- UAT-9 re-verified live on the v1.3 preview: offline record → online → item
  drains `queued → processing → done`; detail waiting indicator confirmed.

## Commits (on gsd/v1.3-maturation)

- `6d210b9` fix(33): recover orphaned pending items — durable queued anchor + atomic inline claim + pending reclaim + detail indicator
- `7efcd17` fix(33): allow manual stuck-processing retry to re-claim
- `2ae60f0` chore(33): drop URGENT-SUMMARY — captured in vault urgent note

## Follow-ups (new roadmap phases)

- **Phase 42** audio-upload-reliability — root cause (why audio never reached
  Supabase) + cross-device `AiFailureBanner`/Retry visibility (F2).
- **Phase 43** photomigration-itemid-collision (38-3).
- **Phase 44** visibility-ux-polish (F1 badge nav + F4 dup-import copy).

Full record: `_workspace/Urgent/done/ai-pending-stranding.md`.
