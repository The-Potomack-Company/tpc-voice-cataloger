# TPC Speech Cataloger

## What This Is

A mobile-first PWA for The Potomack Company auction house that enables auctioneers to catalog items by voice during house visits and sale prep. Two modes — house visit (sequential items + photos) and sale cataloging (receipt number + dictation) — feed a Gemini AI pipeline that extracts structured catalog fields (title, description, condition, estimate, category, measurements) and exports them as versioned JSON. An admin/specialist account system lets the admin import receipt lists, create sessions, and assign them to specialists — specialists record and submit, admin reviews, edits, and exports. A companion Chrome extension batch-imports the exported JSON into RFC Invaluable lot pages. Sessions persist across browser close, recordings queue offline and process on reconnect.

## Core Value

Auctioneers can dictate catalog entries by voice and get structured, accurate auction catalog data faster than typing — with the entries flowing directly into RFC Invaluable.

## Requirements

### Validated

- ✓ Speech-to-text capture with tap-to-advance between items — v1.0
- ✓ House visit mode: dictate item details + capture photos per item — v1.0
- ✓ Sale cataloging mode: receipt number first, then item description — v1.0
- ✓ AI parsing of natural speech into structured fields (title, description, condition, estimate, category) — v1.0
- ✓ Measurements extracted from speech and auto-formatted (N×N×N in./cm.) — v1.0
- ✓ Review and edit transcribed entries before export — v1.0
- ✓ Save and resume sessions across multiple sittings — v1.0
- ✓ Offline support: record audio locally, process when connectivity returns — v1.0
- ✓ Export structured JSON matching TPC extension format — v1.0
- ✓ TPC extension batch import: accept exported file and fill items on RFC Invaluable — v1.0
- ✓ Mobile-optimized UI (phone/tablet for on-site use) — v1.0
- ✓ Session archiving and export history with versioned filenames — v1.0
- ✓ Receipt number list import from CSV/XLSX to pre-populate sale sessions — v1.0

### Active

- [ ] Username/password authentication with admin and specialist roles
- [ ] Admin can create and manage specialist accounts
- [ ] Admin imports receipts, creates sessions, and assigns to specialists
- [ ] Specialists see only assigned sessions + their own created sessions
- [ ] Session lifecycle: Active → Submitted → Admin review (edit or send back) → Export
- [ ] Only admin can export JSON
- [ ] Admin can edit submitted sessions directly
- [ ] Deploy app to Vercel with auto-deploy from main (DEPLOY-01)
- [ ] CI pipeline: lint, typecheck, test, build via GitHub Actions (DEPLOY-02)
- [ ] Restrict Cloudflare Worker CORS to production Vercel domain (DEPLOY-03)
- [ ] Branch protection on main: require CI checks before merge (DEPLOY-04)

### Out of Scope

- Real-time collaboration between multiple users — small team, not needed
- Video recording of items — photos sufficient
- Direct integration with RFC API (bypassing the extension) — leverage existing extension infrastructure
- OAuth/SSO login — simple username/password sufficient for internal team
- On-device AI processing — model size too large for mobile; offline queue solves connectivity problem
- Barcode/QR scanning — receipt numbers are typed, not barcoded
- Auto-publish without review — AI errors require human review gate

## Current Milestone: v1.1 Accounts & Deploy

**Goal:** Add admin/specialist accounts with session assignment workflow, then deploy to production.

**Target features:**
- Username/password auth with admin + specialist roles
- Admin session assignment (import → create → assign → review → export)
- Specialist scoped view (assigned + own sessions only)
- Session submission lifecycle (active → submitted → admin review)
- Vercel deployment + CI pipeline + CORS lockdown

## Context

**Current state (v1.0):** 10 phases shipped, 9,166 LOC (TS/TSX/JS), 214 commits over 11 days.
Tech stack: React 19 + Vite 7 + TypeScript 5 + Tailwind CSS 4 + Zustand 5 + Dexie 4 (IndexedDB) + `@google/genai` 1.x + Cloudflare Worker proxy.
**v1.1 architecture note:** Accounts require a backend/database. Current app is fully client-side (IndexedDB). This milestone introduces Supabase (Postgres + Auth + RLS) as the server-side layer. Dexie retains audio blobs and photos only. Future dashboard planned as separate repo reading from same Supabase instance.

**Auction platform:** RFC Invaluable (`rfc.invaluable.com`) is where catalog entries live
**Existing tooling:** TPC AI-Cataloging Chrome extension (Manifest V3) extended with batch import feature (Phase 7)
**Receipt numbers:** Format `XXXXX-N` (e.g., `39135-2`), used to identify items in sale cataloging mode
**Title convention:** ALL CAPS, format: `[PERIOD/STYLE] [MATERIAL] [ITEM TYPE]`
**Description convention:** Lowercase, starts with "the", top-to-bottom physical features, formal auction language
**Team size:** 2-5 auctioneers at The Potomack Company
**Field conditions:** House visits may be at rural locations with poor connectivity

## Constraints

- **Platform**: Mobile-first (phone/tablet), must work as PWA
- **Offline**: Record audio without connectivity; queue for processing when online
- **AI dependency**: Speech-to-text and field parsing require API calls (online); recording works offline
- **Integration**: Must produce output compatible with TPC AI-Cataloging extension's data format
- **Catalog format**: Output must conform to RFC Invaluable's title/description conventions

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Mobile-first PWA | Auctioneers need it on-site at houses; PWA avoids app store deployment | ✓ Good — works on iOS + Android |
| AI-parsed speech (not raw transcription) | Natural speech needs structure extraction for catalog fields | ✓ Good — Gemini handles both steps in one call |
| JSON export format | TPC extension already uses JSON throughout; natural fit | ✓ Good — seamless extension integration |
| Both apps in one project | Extension import feature is required for end-to-end workflow | ✓ Good — shared types prevent schema drift |
| Button tap between items (not voice commands) | More reliable in noisy house environments | ✓ Good — no false activations |
| Cloudflare Worker proxy for Gemini | Keep API key off client; supports CORS | ✓ Good — but CORS still wildcard (DEPLOY-03) |
| Pathname-based routing (React Router v7) | Prevents iOS microphone re-prompts on hash navigation | ✓ Good — no re-prompt issues |
| Dexie PKs: ++id auto-increment | No cloud sync planned; simpler than UUID | ✓ Good |
| Tailwind CSS 4: @theme blocks only | No tailwind.config.js; per Tailwind 4 API | ✓ Good |
| Single Gemini call (transcription + extraction) | No separate Whisper step; lower latency | ✓ Good |
| Fire-and-forget AI processing | Non-blocking recording flow; errors displayed on item card | ✓ Good |
| Soft-delete sessions | Allows recovery; permanent delete is explicit | ✓ Good |
| SheetJS for CSV/XLSX import | Single library handles both formats | ✓ Good |
| Versioned export filenames | First export no suffix; subsequent -v2, -v3 | ✓ Good — avoids accidental overwrites |
| Supabase over Neon+Hono+BetterAuth | User familiar with Supabase; future dashboard reads from same DB; fewer moving parts | — Pending |

---
*Last updated: 2026-03-17 after v1.1 milestone start*
