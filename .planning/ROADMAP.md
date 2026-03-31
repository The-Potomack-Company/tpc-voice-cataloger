# Roadmap: TPC Speech Cataloger

## Milestones

- ✅ **v1.0 MVP** -- Phases 1-9 + 5.1 (shipped 2026-03-17) -- See [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Accounts & Deploy** -- Phases 11-21 (shipped 2026-03-31) -- See [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

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

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1-9 + 5.1 | v1.0 | 27/27 | Complete | 2026-03-17 |
| 11-21 | v1.1 | 36/36 | Complete | 2026-03-31 |

## Backlog

### Phase 999.1: Stream photos from Supabase Storage during extension import (BACKLOG)

**Goal:** Replace base64-embedded photos in export JSON with Supabase Storage URLs fetched on demand during extension import. Current approach embeds all photos as base64, which balloons to 200-450MB for typical house visits (100-300 items x multiple photos). With Storage URLs, export JSON drops to ~500KB and photos stream one at a time during import. Requires: export emits storage paths/signed URLs instead of base64 blobs, importController fetches URL->blob->File before injection. Supabase Storage infra already exists from Phase 19.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)
