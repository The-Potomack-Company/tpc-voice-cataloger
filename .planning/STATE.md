---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: UI Overhaul
status: shipped
shipped_at: "2026-05-13"
superseded_by: "v3.0-hub-merge (tpc-hub repo)"
stopped_at: "v1.2 SHIPPED 2026-05-13 (PR #11 mega-PR covering phases 22-30, all 4/4 Phase 22 plans complete + downstream phases). v1.3 cancelled — work subsumed by cross-app v3.0 hub merge (see ../tpc-hub). This repo is in strangler-grace: hotfix lane only via /tpc-urgent until v3.0 cutover, then 301 → hub URL + 30-day archive."
last_updated: "2026-05-20T09:34:28-04:00"
last_activity: 2026-05-13 -- v1.2 closed out (PR #11); v1.3 cancelled in favor of v3.0 hub merge
progress:
  total_phases: 9
  completed_phases: 9
  total_plans: 4
  completed_plans: 4
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-28)

**Core value:** Auctioneers can dictate catalog entries by voice and get structured, accurate auction catalog data faster than typing -- with entries flowing directly into RFC Invaluable.
**Current focus:** v1.2 SHIPPED (closed 2026-05-13). Repo is in strangler-grace under v3.0 hub merge. **No new milestones here.**

## Current Position

Milestone: v1.2 UI Overhaul — SHIPPED 2026-05-13 (PR #11)
Status: All v1.2 phases delivered; repo frozen pending v3.0 hub cutover
Successor: ../tpc-hub (v3.0-hub-merge milestone)
Hotfix policy: /tpc-urgent lane open for prod regressions; no new feature work

Progress: [▓▓▓▓▓▓▓▓▓▓] 100% (v1.2 complete)

## Performance Metrics

**v1.2 UI Overhaul:** in flight

| Phase | Plan | Duration | Tasks | Files | Date |
|-------|------|----------|-------|-------|------|
| 22 | 01 | 7 min | 3 | 5 | 2026-04-30 |
| 22 | 04 | 5 min | 1 | 1 | 2026-04-30 |

**Historical (v1.0 + v1.1 combined):**

- Total plans completed: 63
- Total commits: 475
- Timeline: 25 days (2026-03-06 -> 2026-03-31)
- LOC delta: 33,636 (TS/TSX/JS) at v1.1 close

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

**Phase 22 Plan 04 decisions (2026-04-30):**

- Narrow per-file allowlist for the TOKENS-04 guard test itself (D-16 escape hatch — the file IS the fixture: its regex source code contains the literal patterns it scans for). Single-entry `ALLOW_FILES = [src/ui/__tests__/no-hardcoded-literals.test.ts]`; does NOT widen to all of `__tests__`.
- `/// <reference types="node" />` triple-slash directive at the top of `src/ui/__tests__/no-hardcoded-literals.test.ts` to opt only this file into Node typings under `tsconfig.app.json` (which doesn't load `@types/node` by default and includes `src/ui/__tests__/`, unlike `src/tests/` which is excluded).

### Pending Todos

None.

### Blockers/Concerns

- DEPLOY-04: Branch protection deferred (GitHub Free plan limitation on private repos) -- carried from v1.1
- Backlog item 999.1: Stream photos from Storage during extension import (large house visits balloon export JSON to 200-450MB) -- carried from v1.1
- Offline session display strategy still needs decision for future work -- carried from v1.1
- 18 pre-existing test failures (`localStorage.clear is not a function`) in `persist-scoping.test.ts` and `photo-migration.test.ts` -- discovered during Plan 22-01 verification; verified pre-existing at HEAD~3; tracked in `.planning/phases/22-foundation-tokens/deferred-items.md` -- not blocking Phase 22 plans 02/03/04

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260401-n74 | Fix AI parser interpreting karats as carrots - default to karats for auction house context | 2026-04-01 | dfa83c6 | | [260401-n74-fix-ai-parser-interpreting-karats-as-car](./quick/260401-n74-fix-ai-parser-interpreting-karats-as-car/) |
| 260401-n6a | AI parses spoken quote markers into actual quotation marks | 2026-04-01 | 5dbea9d | | [260401-n6a-ai-parses-spoken-quote-markers-into-actu](./quick/260401-n6a-ai-parses-spoken-quote-markers-into-actu/) |
| 260402-doe | Fix specialists unable to delete items - detect RLS silent failures in deleteItem/deleteSession | 2026-04-02 | c3710fa | | [260402-doe-specialists-unable-to-delete-items-from-](./quick/260402-doe-specialists-unable-to-delete-items-from-/) |
| 260402-dqf | Sale sessions same behavior as house sessions - full screen detail view with fields transcript and recording button, no photo upload | 2026-04-02 | 8a350ce | Needs Review | [260402-dqf-sale-sessions-same-behavior-as-house-ses](./quick/260402-dqf-sale-sessions-same-behavior-as-house-ses/) |
| 260402-dor | Ability to merge two items together into one | 2026-04-02 | a1a5816 | Verified | [260402-dor-ability-to-merge-two-items-together-into](./quick/260402-dor-ability-to-merge-two-items-together-into/) |
| 260407-ket | Add an extra export button that downloads a spreadsheet instead of the json | 2026-04-07 | de8f45a | | [260407-ket-add-an-extra-export-button-that-download](./quick/260407-ket-add-an-extra-export-button-that-download/) |
| 260407-ke7 | Jewelry karat vs carat differentiation in specialist | 2026-04-07 | bf56eda | | [260407-ke7-jewelry-karat-vs-carat-differentiation-i](./quick/260407-ke7-jewelry-karat-vs-carat-differentiation-i/) |

### Roadmap Evolution

- v1.0 MVP: Phases 1-9 + 5.1 (shipped 2026-03-17)
- v1.1 Accounts & Deploy: Phases 11-21 (shipped 2026-03-31)
- v1.2 UI Overhaul: in flight (started 2026-04-28, branch `milestone/v1.2-ui-overhaul`)

## Session Continuity

Last session: 2026-04-30T17:34:14.194Z
Stopped at: Phase 23 context gathered
Resume file: Phase 23 not yet planned — run `/gsd-transition` to advance, then plan Phase 23.
