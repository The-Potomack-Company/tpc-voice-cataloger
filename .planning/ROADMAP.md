# Roadmap: TPC Speech Cataloger

## Milestones

- ✅ **v1.0 MVP** — Phases 1–9 + 5.1 (shipped 2026-03-17) — See [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- 🚧 **v1.1 Deploy** — Phase 10 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–9 + 5.1) — SHIPPED 2026-03-17</summary>

- [x] Phase 1: Foundation (2/2 plans) — completed 2026-03-06
- [x] Phase 2: Audio Capture (2/2 plans) — completed 2026-03-06
- [x] Phase 3: Session Management (3/3 plans) — completed 2026-03-06
- [x] Phase 4: Cataloging Modes (2/2 plans) — completed 2026-03-06
- [x] Phase 5: AI Pipeline (5/5 plans) — completed 2026-03-16
- [x] Phase 5.1: Measurements Field (2/2 plans) — completed 2026-03-16 *(inserted)*
- [x] Phase 6: Review, Edit, Export (3/3 plans) — completed 2026-03-16
- [x] Phase 7: Extension Batch Import (3/3 plans) — completed 2026-03-09
- [x] Phase 8: Offline Queue (2/2 plans) — completed 2026-03-16
- [x] Phase 9: Deferred Items (3/3 plans) — completed 2026-03-17

</details>

### 🚧 v1.1 Deploy (In Progress)

- [ ] Phase 10: Vercel Deployment (0/4 plans)

### Phase 10: Vercel Deployment

**Goal**: App is deployed to Vercel at a production URL with auto-deploy from main, CI pipeline enforcing quality gates, and Cloudflare Worker CORS locked to the production domain
**Depends on**: Phase 9
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04
**Success Criteria** (what must be TRUE):
  1. App is deployed to Vercel and accessible at a production URL; pushing to main triggers an automatic deploy
  2. GitHub Actions CI pipeline runs lint, typecheck, test, and build on every PR and push to main
  3. Cloudflare Worker CORS origin is restricted to the production Vercel domain (no wildcard `*`)
  4. Branch protection on main requires all CI checks to pass before a PR can be merged
**Plans:** 0/4 plans (not yet planned)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 2/2 | Complete | 2026-03-06 |
| 2. Audio Capture | v1.0 | 2/2 | Complete | 2026-03-06 |
| 3. Session Management | v1.0 | 3/3 | Complete | 2026-03-06 |
| 4. Cataloging Modes | v1.0 | 2/2 | Complete | 2026-03-06 |
| 5. AI Pipeline | v1.0 | 5/5 | Complete | 2026-03-16 |
| 5.1 Measurements | v1.0 | 2/2 | Complete | 2026-03-16 |
| 6. Review, Edit, Export | v1.0 | 3/3 | Complete | 2026-03-16 |
| 7. Extension Batch Import | v1.0 | 3/3 | Complete | 2026-03-09 |
| 8. Offline Queue | v1.0 | 2/2 | Complete | 2026-03-16 |
| 9. Deferred Items | v1.0 | 3/3 | Complete | 2026-03-17 |
| 10. Vercel Deployment | v1.1 | 0/4 | Not started | — |
