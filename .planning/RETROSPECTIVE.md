# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-17
**Phases:** 10 (including 1 inserted decimal phase) | **Plans:** 27

### What Was Built
- PWA shell with bottom-tab navigation, install banner, walkthrough, and 48px+ tap targets
- Tap-to-record audio on iOS Safari + Android Chrome with local IndexedDB storage
- Full session lifecycle — create, save, resume, complete, archive across browser close
- Two cataloging modes: house visit (photos + sequential items) and sale (receipt number + dictation)
- Gemini AI pipeline — single-call transcription + structured field extraction via Cloudflare Worker proxy
- Measurements field with auto-formatting (N×N×N in./cm.) flowing through UI, export, and Chrome extension
- Chrome extension batch import — fills RFC Invaluable lot pages by receipt number from exported JSON
- Offline queue — records without connectivity, auto-drains on reconnect
- Export history with versioned filenames, session archiving, receipt import from CSV/XLSX

### What Worked
- **GSD phase structure** kept work organized across 10 phases; each phase was independently testable before the next began
- **TDD for utilities** (measurements formatting, receipt validation, export pipeline) caught edge cases early and gave confidence during refactoring
- **Fire-and-forget AI pattern** kept the recording UX snappy — users aren't blocked waiting for Gemini
- **Zod schema validation** for Gemini responses prevented hallucinated/missing fields from propagating into UI
- **Decimal phase (5.1)** for measurements was a clean insertion — the numbering scheme handled the urgency without disrupting the phase sequence
- **Quick tasks** (11 total) handled small fixes and UX polish without interrupting phase execution

### What Was Inefficient
- **Deployment deferred** — DEPLOY-01 through DEPLOY-04 were written into requirements but never given a roadmap phase, so they carry into v1.1 as known gaps
- **ROADMAP progress table** went stale — Phase 5.1 and Phase 9 showed "In Progress" at milestone close because plan checkboxes weren't updated after summaries were written
- **one_liner fields in SUMMARY.md were null** — gsd-tools milestone CLI couldn't auto-populate accomplishments; required manual extraction
- **Phase dates wrong** — Phases 1–5 show "2010-03-06" in ROADMAP.md (year typo, should be 2026); accumulated over early phases and never corrected

### Patterns Established
- **Two cataloging modes from Phase 4** — house visit and sale cataloging patterns are now stable; future phases can extend them without changing the core item entry flow
- **Soft-delete for sessions** — archival flow (active → completed → archived → permanently deleted) is consistent throughout the app
- **SessionCardWithCount pattern** — per-row live queries for counts (items, audio, photos) avoid N+1 issues; apply to any future list that needs child counts
- **Versioned JSON schema** — `"version": 1` field on exports enables future schema migrations without breaking existing exported files

### Key Lessons
1. **Write DEPLOY requirements before Phase 1** — infra/CI requirements are easy to defer and hard to remember; put them in the roadmap with a phase from the start
2. **Keep ROADMAP progress table in sync** — update checkbox + completion date in the progress table whenever a plan gets a SUMMARY, not just when a phase is declared done
3. **Add one_liner to SUMMARY.md template** — the field exists in the schema but was never populated; either remove it or enforce it during execution so milestone CLI can auto-extract accomplishments
4. **Decimal phases work well for urgent insertions** — Phase 5.1 didn't disrupt numbering or dependencies; the pattern is proven

### Cost Observations
- Model mix: quality profile (Sonnet 4.6 for all phases)
- Sessions: ~11 days of work
- Notable: Phase execution averaged 7 min/plan; TDD phases (07-00, 05.1-01) were fastest due to pre-written test scaffolds

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 10 | 27 | First milestone — established all core patterns |

### Cumulative Quality

| Milestone | LOC | Key Coverage | Zero-Dep Additions |
|-----------|-----|--------------|-------------------|
| v1.0 | 9,166 | Utilities + data layer TDD | SheetJS, @google/genai |

### Top Lessons (Verified Across Milestones)

1. Plan deployment infrastructure from the start — it's always tempting to defer and always creates gaps
2. TDD for pure utilities (formatting, parsing, validation) pays off immediately — catch edge cases before they reach the UI
