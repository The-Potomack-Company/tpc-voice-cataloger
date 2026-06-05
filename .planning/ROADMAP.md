# Roadmap: TPC Speech Cataloger

## Milestones

- ✅ **v1.0 MVP** -- Phases 1-9 + 5.1 (shipped 2026-03-17) -- See [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Accounts & Deploy** -- Phases 11-21 (shipped 2026-03-31) -- See [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
- ✅ **v1.2 UI Overhaul** -- Phases 22-30 (shipped 2026-05-13 via PR #11) -- See [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)
- ✅ **v1.3 Maturation** -- Phases 31-45 (shipped 2026-06-04) -- See [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md)
- 📋 **v1.4 (next)** -- not yet defined. Run `/gsd-new-milestone` to scope. Carry-ins: SEAM-3 follow-ups closed; accepted tech-debt backlog in `milestones/v1.3-MILESTONE-AUDIT.md`.

## Phases

<details>
<summary>v1.0 MVP (Phases 1-9 + 5.1) -- SHIPPED 2026-03-17</summary>

- [x] Phase 1: Foundation (2/2 plans) -- completed 2026-03-06
- [x] Phase 2: Audio Capture (2/2 plans) -- completed 2026-03-06
- [x] Phase 3: Session Management (3/3 plans) -- completed 2026-03-06
- [x] Phase 4: Cataloging Modes (2/2 plans) -- completed 2026-03-06
- [x] Phase 5: AI Pipeline (5/5 plans) -- completed 2026-03-16
- [x] Phase 5.1: Measurements Field (2/2 plans) -- completed 2026-03-16 *(inserted)*
- [x] Phase 6: Review, Edit, Export (3/3 plans) -- completed 2026-03-16
- [x] Phase 7: Extension Batch Import (3/3 plans) -- completed 2026-03-09
- [x] Phase 8: Offline Queue (2/2 plans) -- completed 2026-03-16
- [x] Phase 9: Deferred Items (3/3 plans) -- completed 2026-03-17

</details>

<details>
<summary>v1.1 Accounts & Deploy (Phases 11-21) -- SHIPPED 2026-03-31</summary>

- [x] Phase 11: Supabase Foundation (2/2 plans) -- completed 2026-03-18
- [x] Phase 12: Authentication (3/3 plans) -- completed 2026-03-18
- [x] Phase 13: Account Management (2/2 plans) -- completed 2026-03-18
- [x] Phase 14: Data Migration (5/5 plans) -- completed 2026-03-20
- [x] Phase 15: Session Assignment (3/3 plans) -- completed 2026-03-20
- [x] Phase 16: Session Lifecycle (4/4 plans) -- completed 2026-03-20
- [x] Phase 17: Deployment & CI (4/4 plans) -- completed 2026-03-30
- [x] Phase 18: Walkthrough (3/3 plans) -- completed 2026-03-20
- [x] Phase 19: Photo Upload (5/5 plans) -- completed 2026-03-22
- [x] Phase 20: House Session Import Fix (2/2 plans) -- completed 2026-03-28
- [x] Phase 21: AI Granularity (3/3 plans) -- completed 2026-03-31

</details>

<details>
<summary>✅ v1.2 UI Overhaul (Phases 22-30) -- SHIPPED 2026-05-13</summary>

Mockup-faithful design system migration: unified tokens, LIB primitives, theme picker (light/dark/system), self-hosted fonts (EB Garamond/Inter/IBM Plex Mono), mockup-faithful Sessions/Recording/Review screens, motion + waveform, WCAG AA contrast guard, focus rings across all primitives. Shipped via PR #11 (single mega-PR; phases 22-30 SUMMARY.md preserved in milestones/v1.2-phases/).

- [x] Phase 22: Foundation Tokens (4/4 plans) -- completed 2026-04-30
- [x] Phase 23: Typography Pipeline -- completed 2026-05-12
- [x] Phase 24: Component Library -- completed 2026-05-12
- [x] Phase 25: Theme Toggle & Settings -- completed 2026-05-12
- [x] Phase 26: Mockup-Faithful Screens -- completed 2026-05-12
- [x] Phase 27: Motion & Live Feedback -- completed 2026-05-12
- [x] Phase 28: Specialist Screen Restyle -- completed 2026-05-12
- [x] Phase 29: Admin Screen Restyle -- completed 2026-05-12
- [x] Phase 30: A11Y Verification -- completed 2026-05-12

Known issues + follow-ups: `.planning/v1.2-known-issues.md`, `.planning/v1.2-followup.md`.

</details>

<details>
<summary>✅ v1.3 Maturation (Phases 31-45) -- SHIPPED 2026-06-04</summary>

Security/durability/quality maturation: profiles RLS hardening, durable cross-device audio persistence, offline reliability, iOS memory, AI correctness, UX visibility, a11y foundation, retryable migration, optimistic locking, AI-proxy Cloud Run cutover + CI hardening, pending-stranding recovery, audio-upload reliability, photo-migration collision fix, visibility UX polish, and the SEAM-3 AI-write precondition fix. Verdict: tech_debt (no blockers); all integration seams wired; live UAT passed. Full detail + accepted tech-debt backlog in [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md) + [milestones/v1.3-MILESTONE-AUDIT.md](milestones/v1.3-MILESTONE-AUDIT.md).

- [x] Phase 31: sec-profiles-self-update-hardening -- completed 2026-05-29
- [x] Phase 32: audio-blob-supabase-persistence -- completed 2026-06-01
- [x] Phase 33: offline-reliability -- completed 2026-06
- [x] Phase 34: ios-memory-optimization -- completed 2026-06
- [x] Phase 35: ai-correctness-track-2 -- completed 2026-06
- [x] Phase 36: ux-visibility-polish -- completed 2026-06
- [x] Phase 37: a11y-foundation -- completed 2026-06
- [x] Phase 38: migration-retryability -- completed 2026-06 (live UAT 2026-06-04)
- [x] Phase 39: optimistic-locking -- completed 2026-06
- [x] Phase 40: ai-proxy-cloud-run-migration -- completed 2026-06-02
- [x] Phase 40.1: harden-ai-proxy-deploy-ci -- completed 2026-06-03 *(inserted, urgent)*
- [x] Phase 41: ai-pending-stranding -- completed 2026-06-04 *(urgent lane)*
- [x] Phase 42: audio-upload-reliability -- completed 2026-06-04 (live UAT)
- [x] Phase 43: photomigration-itemid-collision -- completed 2026-06-04
- [x] Phase 44: visibility-ux-polish -- completed 2026-06-04 (live UAT)
- [x] Phase 45: ai-write-precondition -- completed 2026-06-04 *(SEAM-3 fix)*

</details>

## Progress

| Milestone | Phases | Status | Completed |
|-----------|--------|--------|-----------|
| v1.0 MVP | 1-9 + 5.1 | ✅ Shipped | 2026-03-17 |
| v1.1 Accounts & Deploy | 11-21 | ✅ Shipped | 2026-03-31 |
| v1.2 UI Overhaul | 22-30 | ✅ Shipped (PR #11) | 2026-05-13 |
| v1.3 Maturation | 31-45 | ✅ Shipped | 2026-06-04 |
| v1.4 (next) | TBD | 📋 Not defined | — |

## Backlog

### Phase 999.1: Stream photos from Supabase Storage during extension import (BACKLOG)

**Goal:** Replace base64-embedded photos in export JSON with Supabase Storage URLs fetched on demand during extension import. Current approach embeds all photos as base64, which balloons to 200-450MB for typical house visits (100-300 items x multiple photos). With Storage URLs, export JSON drops to ~500KB and photos stream one at a time during import. Requires: export emits storage paths/signed URLs instead of base64 blobs, importController fetches URL->blob->File before injection. Supabase Storage infra already exists from Phase 19.
**Requirements:** TBD
**Plans:** 1/1 plans complete

Plans:

- [ ] TBD (promote with /gsd:review-backlog when ready)
