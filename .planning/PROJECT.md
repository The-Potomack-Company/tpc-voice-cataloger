# TPC Speech Cataloger

## What This Is

A mobile-first internal app for The Potomack Company auction house that enables auctioneers to catalog items via speech-to-text instead of manual typing. It has two modes — house visit mode (item-by-item with photos) and sale cataloging mode (receipt number + description) — and exports structured data for batch import into RFC Invaluable via the existing TPC AI-Cataloging Chrome extension. The project also includes building the batch import feature in the extension.

## Core Value

Auctioneers can dictate catalog entries by voice and get structured, accurate auction catalog data faster than typing — with the entries flowing directly into RFC Invaluable.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Speech-to-text capture with tap-to-advance between items
- [ ] House visit mode: dictate item details + capture photos per item
- [ ] Sale cataloging mode: receipt number first, then item description
- [ ] AI parsing of natural speech into structured fields (title, description, condition, estimate, category)
- [ ] Review and edit transcribed entries before export
- [ ] Save and resume sessions across multiple sittings
- [ ] Offline support: record audio locally, process when connectivity returns
- [ ] Export structured JSON matching TPC extension format
- [ ] TPC extension batch import feature: accept exported file and fill items on RFC Invaluable
- [ ] Mobile-optimized UI (phone/tablet for on-site use)

### Out of Scope

- Real-time collaboration between multiple users — small team, not needed
- Video recording of items — photos sufficient
- Direct integration with RFC API (bypassing the extension) — leverage existing extension infrastructure
- OAuth/user accounts — internal tool for 2-5 people

## Context

- **Auction platform:** RFC Invaluable (`rfc.invaluable.com`) is where catalog entries live
- **Existing tooling:** TPC AI-Cataloging Chrome extension (Manifest V3) already automates single and batch catalog generation using Gemini AI from photos. It fills `#fld1` (title, ALL CAPS) and `#fld2` (description, lowercase) on RFC item pages
- **Receipt numbers:** Format `XXXXX-N` (e.g., `39135-2`), used to identify items in sale cataloging mode
- **Title convention:** ALL CAPS, format: `[PERIOD/STYLE] [MATERIAL] [ITEM TYPE]`
- **Description convention:** Lowercase, starts with "the", top-to-bottom physical features, formal auction language
- **Categories:** furniture (default), books, fashion — each has different cataloging conventions
- **Import endpoint discovered:** RFC has an inventory import page at `reports.r3?mm=data` with file upload, already mapped in extension constants but not yet implemented
- **Team size:** 2-5 auctioneers at The Potomack Company
- **Field conditions:** House visits may be at rural locations with poor connectivity

## Constraints

- **Platform**: Mobile-first (phone/tablet), must work as PWA or native-like web app
- **Offline**: Must handle no-connectivity scenarios — record audio, queue for processing
- **AI dependency**: Speech-to-text and field parsing require API calls (online), but recording must work offline
- **Integration**: Must produce output compatible with TPC AI-Cataloging extension's data format
- **Catalog format**: Output must conform to RFC Invaluable's title/description conventions

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Mobile-first PWA | Auctioneers need it on-site at houses, PWA avoids app store deployment | — Pending |
| AI-parsed speech (not raw transcription) | Natural speech needs structure extraction for catalog fields | — Pending |
| JSON export format | TPC extension already uses JSON throughout, natural fit | — Pending |
| Both apps in one project | Extension import feature is required for end-to-end workflow | — Pending |
| Button tap between items (not voice commands) | More reliable in noisy house environments | — Pending |

---
*Last updated: 2026-03-06 after initialization*
