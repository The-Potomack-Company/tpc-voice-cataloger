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

## Milestone: v1.1 — Accounts & Deploy

**Shipped:** 2026-03-31
**Phases:** 11 | **Plans:** 36 | **Tasks:** 66

### What Was Built
- Supabase backend with Postgres, Auth, Storage, RLS, and Edge Functions
- Admin/specialist account system with creation, deactivation, and role enforcement
- Session assignment workflow (admin assigns, specialist sees scoped view)
- Session lifecycle (submit, review, return-with-notes, admin-only export)
- Data migration from Dexie to Supabase for all session/item metadata
- Photo upload to Supabase Storage with offline queue, sync overlays, signed URL fallback
- Vercel deployment with GitHub Actions CI and Cloudflare Worker CORS lockdown
- Role-aware walkthrough with per-user completion stored in Supabase
- House session JSON import fix with photo upload, Style dropdown handling, state recovery
- AI granularity: measurements as rich format string, smart field merging, spoken punctuation

### What Worked
- **Supabase choice** simplified architecture significantly — Postgres + Auth + Storage + RLS in one platform replaced what would have been 4 separate services
- **RLS-first security model** eliminated the need for middleware; role enforcement is server-side and implicit
- **Phase 14 (data migration) sequential execution** was the right call — high-risk phase benefited from stable auth foundation
- **Photo upload queue pattern** (bounded concurrency + exponential backoff) handles flaky mobile connections gracefully
- **Smart field merging via AI prompt** avoided complex app-side merge logic — the AI returns final merged values directly
- **Wave 0 test stubs** (Phases 16, 18, 19) set up test scaffolding before implementation, speeding execution
- **YOLO mode** kept the milestone moving fast — 11 phases in 14 days with minimal gate overhead

### What Was Inefficient
- **ROADMAP checkbox drift** — several plan checkboxes (13-02, 14-04, 15-02, 15-03, 21-01/02/03) were never checked off even though summaries exist. Same issue from v1.0.
- **REQUIREMENTS checkbox drift** — GRAN-01 through GRAN-12 completed but never checked off in REQUIREMENTS.md
- **Progress table format inconsistencies** — Phases 14 and 15 had misaligned columns in the progress table
- **DEPLOY-04 GitHub Free limitation** discovered late — branch protection requirement couldn't be fulfilled on private repos
- **Phase scope creep** — v1.1 originally scoped as "Accounts & Deploy" (Phases 11-17) but grew to include walkthrough, photo upload, house import fix, and AI granularity (Phases 18-21)

### Patterns Established
- **Supabase as single backend** — Postgres + Auth + Storage + RLS + Edge Functions serves as the complete server layer
- **Dexie as blob cache only** — audio blobs and photo cache in IndexedDB; all metadata is server-authoritative
- **Edge Functions per operation** — separate create/update/list functions for independent deployability
- **Photo upload queue pattern** — bounded concurrency, exponential backoff, fire-and-forget with status overlays
- **AI context injection** — pass existing field values to Gemini for intelligent merge decisions
- **Prompt-only enhancements** — measurements format, merge rules, and punctuation all handled in system prompt

### Key Lessons
1. **Scope milestones tightly** — v1.1 grew from 7 to 11 phases. Future milestones should resist scope additions or explicitly re-scope.
2. **Automate checkbox updates** — ROADMAP and REQUIREMENTS checkboxes drifting is a recurring issue. Either automate or verify at phase completion.
3. **Check platform constraints early** — GitHub Free plan limitation on branch protection (DEPLOY-04) was discovered only at execution time.
4. **Supabase RLS is excellent for small-team apps** — role-based access "just works" without middleware for admin/specialist separation.
5. **AI prompt engineering > app-side logic** — smart merging, measurements formatting, and punctuation conversion all achieved through prompt changes alone.

### Cost Observations
- Model mix: quality profile throughout (Opus/Sonnet for planning, Sonnet for execution)
- Sessions: ~14 days of work across multiple sessions
- Notable: Wave 0 test stub phases (16-00, 18-00, 19-00) averaged 1-2 min/plan, dramatically speeding subsequent implementation

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 10 | 27 | First milestone — established all core patterns |
| v1.1 | 11 | 36 | Added Supabase backend, YOLO mode, Wave 0 test stubs |

### Cumulative Quality

| Milestone | LOC | Key Coverage | Zero-Dep Additions |
|-----------|-----|--------------|-------------------|
| v1.0 | 9,166 | Utilities + data layer TDD | SheetJS, @google/genai |
| v1.1 | 33,636 | Auth, lifecycle, photo upload, AI pipeline | @supabase/supabase-js, Edge Functions |

### Top Lessons (Verified Across Milestones)

1. Plan deployment infrastructure from the start — it's always tempting to defer and always creates gaps (v1.0 deferred DEPLOY-*, v1.1 discovered GitHub Free limitation late)
2. TDD for pure utilities (formatting, parsing, validation) pays off immediately — catch edge cases before they reach the UI
3. Keep ROADMAP/REQUIREMENTS checkboxes in sync — both milestones had checkbox drift where completed work wasn't reflected in docs
4. AI prompt engineering is more maintainable than app-side logic for extraction/formatting rules
