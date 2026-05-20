# TPC Speech Cataloger

## What This Is

A mobile-first PWA for The Potomack Company auction house that enables auctioneers to catalog items by voice during house visits and sale prep. Two modes -- house visit (sequential items + photos) and sale cataloging (receipt number + dictation) -- feed a Gemini AI pipeline that extracts structured catalog fields (title, description, condition, estimate, category, measurements) with smart field merging and spoken punctuation conversion. An admin/specialist account system lets the admin import receipt lists, create sessions, and assign them to specialists -- specialists record and submit, admin reviews, edits, and exports. Photos upload to Supabase Storage with offline queue support. A companion Chrome extension batch-imports the exported JSON into RFC Invaluable lot pages, including photos. Sessions persist across browser close, recordings queue offline and process on reconnect. Deployed to Vercel with GitHub Actions CI.

## Core Value

Auctioneers can dictate catalog entries by voice and get structured, accurate auction catalog data faster than typing -- with the entries flowing directly into RFC Invaluable.


<!-- VAULT:decisions-start -->
<!-- Auto-generated from _workspace/Decisions/. Do not hand-edit this block. -->
<!-- To add or supersede a decision, edit the file under _workspace/Decisions/ and
     rerun: python3 /home/spoods/Projects/TPC/.claude/hooks/decisions-to-projects.py -->

## Cross-app decisions (active)

Decisions that apply to **app**. Bodies live in the vault — IDs only here.

- **[D-001](../../_workspace/Decisions/D-001-shared-supabase.md)** — All three TPC apps read/write the same Supabase project; RLS is the only boundary.
- **[D-002](../../_workspace/Decisions/D-002-tpc-app-owns-auth.md)** — TPC Voice Cataloger is the auth-of-record; dashboard shares the same Supabase auth; cataloger maps Chrome Identity to Supabase users at write time.
- **[D-003](../../_workspace/Decisions/D-003-anon-key-public-rls-boundary.md)** _(scope: schema)_ — Treat the Supabase anon key as public; security comes entirely from RLS. Service-role keys never appear in client bundles.
- **[D-005](../../_workspace/Decisions/D-005-hub-strangler-merge.md)** — v3 merges voice-cataloger + dashboard into tpc-hub via strangler pattern — old apps stay in prod until hub reaches feature parity, then 30-day grace before archive.
- **[D-006](../../_workspace/Decisions/D-006-hub-fork-from-cataloger.md)** — tpc-hub repo is forked from tpc-voice-cataloger (heavier app, owns auth per D-002); dashboard screens are ported into the fork; both old repos archived at cutover.
- **[D-007](../../_workspace/Decisions/D-007-hub-adaptive-layout.md)** — Hub uses adaptive per-route layout (specialist default → /sessions, admin → /admin/activity). No explicit Field/Office mode toggle.
- **[D-008](../../_workspace/Decisions/D-008-hub-vite-vercel-functions.md)** — Hub stays on Vite and adds Vercel Functions for /api server-side needs. No Next.js migration. Scraping (RFC) goes to Cloudflare Workers, not Vercel.
- **[D-009](../../_workspace/Decisions/D-009-hub-url-promotion.md)** — At cutover, current tpc-dashboard URL becomes the primary hub URL. Voice-cataloger URL 301s to hub. Custom domain deferred.
- **[D-010](../../_workspace/Decisions/D-010-monorepo-hybrid-scope.md)** — tpc-hub is a Turborepo monorepo (apps/* + packages/*). The extension stays in its own repo so it can move and release independently.
- **[D-011](../../_workspace/Decisions/D-011-monorepo-turborepo-pnpm.md)** — tpc-hub monorepo uses Turborepo + pnpm workspaces. Turbo gives task caching + remote cache; aligns with Vercel-native flows (matches next-forge starter).
- **[D-012](../../_workspace/Decisions/D-012-shared-pkg-accretion.md)** — Shared packages in tpc-hub are accreted, not extracted upfront. Day 1 = @tpc/shared-types only. UI/utils/hooks get a package only when a second consumer actually exists.
- **[D-013](../../_workspace/Decisions/D-013-tpc-ai-proxy-rename.md)** — Centralize all AI-provider traffic through one Cloudflare Worker. Rename existing tpc-gemini-proxy → tpc-ai-proxy to future-proof for mixed providers (Gemini + Claude + OpenAI per task strengths).
- **[D-014](../../_workspace/Decisions/D-014-tpc-ai-proxy-jwt-auth.md)** — tpc-ai-proxy authenticates callers with Supabase JWTs only. JWKS cached in Workers KV ~1hr. CORS-only legacy path is removed entirely once migration completes.
- **[D-015](../../_workspace/Decisions/D-015-tpc-ai-proxy-full-logging.md)** — tpc-ai-proxy logs every AI request to private.api_usage (user_id, ts, model, tokens_in/out, cost_usd, app_source). Full logging for first 6 months while learning usage patterns; sampling later if needed.
- **[D-016](../../_workspace/Decisions/D-016-feature-b-no-supabase-cache.md)** — Invoice fab (Feature B) reads invoices live from RFC every time. No replication to Supabase. RFC stays sole owner of invoice data.
- **[D-017](../../_workspace/Decisions/D-017-feature-b-fab-placement.md)** — Invoice fab UI = button injected into RFC's header bar + Alt+Shift+I shortcut. Mirrors the existing Alt+Shift+G cataloging shortcut convention. No floating overlay.
- **[D-018](../../_workspace/Decisions/D-018-feature-b-print-tabs.md)** — Bulk-print N invoices opens N tabs via chrome.tabs.create(). Extension privilege bypasses popup blocker; each tab shows the browser's native print dialog. Matches RFC's existing one-invoice-per-tab behaviour.
- **[D-019](../../_workspace/Decisions/D-019-feature-c-admin-confirm-trigger.md)** — Batch writes (v3.3 auto-flow voice-cataloger → RFC) are triggered by an admin-only Confirm button after specialist review. Specialists submit; admins approve and trigger.
- **[D-020](../../_workspace/Decisions/D-020-feature-c-approved-status-naming.md)** — Session status after admin confirmation is 'approved' (data model), not 'confirmed' or 'batch_queued'. UI button stays labeled "Confirm".
- **[D-022](../../_workspace/Decisions/D-022-feature-c-undo-authority.md)** — Only the admin who originally confirmed a batch can undo it. RFC fallback when extension unavailable = Supabase reverts immediately + banner shows "RFC needs manual cleanup" with deep-links per item.
- **[D-023](../../_workspace/Decisions/D-023-feature-d-rfc-worker-bot.md)** — RFC receipt prefill (Feature D) runs through a Cloudflare Worker with a dedicated RFC bot account. Worker holds the RFC session + re-auth. Hub/extension/phone all call the Worker — works everywhere (mobile Chrome doesn't support extensions).
- **[D-024](../../_workspace/Decisions/D-024-feature-d-on-blur-trigger.md)** — RFC prefill fires on blur of the receipt# field. Single predictable fetch — no debounce-while-typing, no explicit button.
- **[D-025](../../_workspace/Decisions/D-025-feature-d-silent-fill-except-photos.md)** — RFC prefill silently fills all session fields except photos. Specialist edits inline if needed; photos require an explicit choice (overwrite vs keep).
- **[D-026](../../_workspace/Decisions/D-026-feature-d-bot-account-scope.md)** — One RFC bot account used by all Workers. Different Worker names per workload (tpc-rfc-proxy read-only, tpc-rfc-write-proxy for batch writes / portal upload). One credential to rotate; per-Worker visibility into which feature wrote what.
- **[D-027](../../_workspace/Decisions/D-027-feature-d-bot-write-rule.md)** — RFC bot writes only on explicit user action (admin confirms a batch, user clicks Upload). No autonomous bot writes. Audit table preserves the triggering user.
- **[D-028](../../_workspace/Decisions/D-028-crm-email-hybrid-cc.md)** — CRM email handling — inbound on shared consign@, outbound from specialist's Workspace email with Reply-To and consign@ always CC'd. Hybrid pattern keeps the team in the loop on multi-department consignments.
- **[D-029](../../_workspace/Decisions/D-029-crm-incremental-ship.md)** — Feature E (CRM) ships incrementally in v0.5 → v0.6 → v0.7 slices, not as one big-bang launch. Each slice exposes something testable so assumptions get validated against real consignment email early.
- **[D-033](../../_workspace/Decisions/D-033-extension-cicd-tag-push.md)** — Extension publish to Chrome Web Store triggers on git tag push (e.g. v3.5.1), not on every merge. Manual final approval click in CWS dashboard remains (API can't auto-publish private extensions).
- **[D-034](../../_workspace/Decisions/D-034-tpc-owned-cloud-infra.md)** — All TPC cloud infrastructure (Cloudflare Workers, Vercel projects, third-party APIs) is owned by TPC-controlled accounts, never by personal accounts. Mitigates key-person risk if an individual leaves or their account is locked.
- **[D-035](../../_workspace/Decisions/D-035-feature-e-gmail-sa-dwd.md)** — Feature E v0.5 CRM poller authenticates to Gmail API via a TPC-owned GCP service account with Google Workspace domain-wide delegation, impersonating the shared consign@ inbox. Read-only scope. Worker-friendly (no refresh-token rotation; hand-rolled JWT signed via Web Crypto). Outbound (v0.7+) uses a separate per-user OAuth surface, never this SA.
- **[D-036](../../_workspace/Decisions/D-036-crm-five-department-taxonomy.md)** — CRM v0.5 multi-tag department classifier uses five departments — furniture, decarts, books, fashion, art_sculpture. Diverges from the extension's 4-category photo classifier by splitting out art_sculpture as a discrete category. Extension may additively adopt the same taxonomy later if cataloging volume warrants it.
- **[D-037](../../_workspace/Decisions/D-037-v3-hub-merge-before-features.md)** — v3.0 hub merge ships before any new cross-app feature work on any TPC app. Hotfix lane stays open for production incidents. Sequencing reset established 2026-05-15 to prevent feature-churn and rework against the about-to-be-merged hub.
- **[D-038](../../_workspace/Decisions/D-038-single-supabase-dev-filter.md)** — Single Supabase project for both dev and prod. Dev data (users with empty email or `josh@potomackco.com`) is filtered out at the dashboard/analytics query layer. No separate staging project, no dev-account redirect, no migration approval gate beyond PR review + additive-only constraint. Pragmatic for current scope; revisit when usage grows or compliance demands isolation.
- **[D-039](../../_workspace/Decisions/D-039-aws-migration-deferred.md)** — Long-term direction is to consolidate hosting under a single TPC-owned AWS account (apps + DB + workers) once the v3.0 hub is stable and adoption widens. For MVP / strangler window, the current split (Vercel for apps, Supabase for DB, Cloudflare for workers) is acceptable. Re-surface this decision when the cost / coordination of three vendors starts costing more than the AWS-consolidation lift.
- **[D-040](../../_workspace/Decisions/D-040-admin-only-account-creation.md)** — All TPC accounts are admin-provisioned. There is no public sign-up surface and there never will be — the product is an internal auction-house tool, not a public app. Forgot-password is a useful affordance that can be added post-v3.0; the account-creation workflow itself (specialist invite + initial password set) can ship after the v3.0 merge stabilises.
- **[D-041](../../_workspace/Decisions/D-041-analytics-uses-real-user-data.md)** — Analytics calculations (skip-reason rates, per-user usage curves, perf-improvement signals) must be based on real-user behaviour, not dev-account activity. The admin-visible "operational" surfaces (session list, invoice list, item review) are what the dev-data filter (D-038) protects. The raw analytics_events stream itself can stay hidden from direct admin browsing — admins consume analytics through curated dashboard widgets, not the raw event table.
- **[D-042](../../_workspace/Decisions/D-042-crm-v05-demo-on-dashboard.md)** — One-time override of D-037 (merge-first policy) — build a CRM v0.5 demo slice on the current tpc-dashboard for an internal TPC-team demo this week. Demo is throwaway scaffolding except for the Supabase schema; production CRM v0.5 still ships into the hub at v3.5 per the locked roadmap. App-password Gmail auth replaces D-035 SA+DWD for the demo only. After demo, hub merge work resumes in exact order it was paused (Phase 02 punch-out → Phase 03 plan).

<!-- VAULT:decisions-end -->
## Current Milestone: v1.2 UI Overhaul

**Goal:** Adopt the unified TPC design system end-to-end -- replace existing Tailwind 4 `@theme` styling with new tokens (cool near-white surfaces, teal-blue primary accent, EB Garamond italic display, Inter UI, IBM Plex Mono metadata, 6 px radii), ship a reusable component library, restyle every screen, and add motion + WCAG AA polish -- without changing the app's information architecture or feature set.

**Target features:**
- Unified design tokens (light + dark + system-follow) replace existing Tailwind 4 `@theme` blocks as the single source of truth
- Self-hosted typography (EB Garamond / Inter / IBM Plex Mono via `@fontsource`) -- no Google Fonts CDN dependency
- Reusable component library in `src/ui/` (Button, Badge, Card, Input, Eyebrow, Display, Bar, Placeholder, Mono numerics) consumed by every screen
- Mockup-faithful restyle of Sessions list, Recording, and Review screens
- Extrapolated restyle of unmocked screens (item detail/edit, admin accounts, admin assignments, admin review queue, login, walkthrough) -- derived from tokens & primitives, reviewed per phase
- Live recording pulse + real waveform render + screen transitions (respecting `prefers-reduced-motion`)
- WCAG AA contrast verification across light + dark token sets
- Theme toggle in Settings + auto-follow OS preference

**Out of milestone scope:** Information architecture changes (no nav restructure), admin/specialist UX divergence, feature additions, and the v1.0 48 px+ tap-target baseline (mockup density adopted verbatim).

## Requirements

### Validated

- ✓ Speech-to-text capture with tap-to-advance between items -- v1.0
- ✓ House visit mode: dictate item details + capture photos per item -- v1.0
- ✓ Sale cataloging mode: receipt number first, then item description -- v1.0
- ✓ AI parsing of natural speech into structured fields (title, description, condition, estimate, category) -- v1.0
- ✓ Measurements extracted from speech and auto-formatted (N x N x N in./cm.) -- v1.0
- ✓ Review and edit transcribed entries before export -- v1.0
- ✓ Save and resume sessions across multiple sittings -- v1.0
- ✓ Offline support: record audio locally, process when connectivity returns -- v1.0
- ✓ Export structured JSON matching TPC extension format -- v1.0
- ✓ TPC extension batch import: accept exported file and fill items on RFC Invaluable -- v1.0
- ✓ Mobile-optimized UI (phone/tablet for on-site use) -- v1.0
- ✓ Session archiving and export history with versioned filenames -- v1.0
- ✓ Receipt number list import from CSV/XLSX to pre-populate sale sessions -- v1.0
- ✓ Username/password authentication with admin and specialist roles -- v1.1
- ✓ Admin can create and manage specialist accounts -- v1.1
- ✓ Admin imports receipts, creates sessions, and assigns to specialists -- v1.1
- ✓ Specialists see only assigned sessions + their own created sessions -- v1.1
- ✓ Session lifecycle: Active -> Submitted -> Admin review (edit or send back) -> Export -- v1.1
- ✓ Only admin can export JSON -- v1.1
- ✓ Admin can edit submitted sessions directly -- v1.1
- ✓ CI pipeline: lint, typecheck, test, build via GitHub Actions -- v1.1
- ✓ Restrict Cloudflare Worker CORS to production Vercel domain -- v1.1
- ✓ House session import with photos, Style dropdown handling, and state recovery -- v1.1
- ✓ Photo upload to Supabase Storage with offline queue and sync status -- v1.1
- ✓ Role-aware walkthrough stored per-user in Supabase -- v1.1
- ✓ Smart field merging for re-recordings (non-destructive) -- v1.1
- ✓ Measurements as rich format string (dimensions, mm, weight, karats) -- v1.1
- ✓ Spoken punctuation conversion by AI across all fields -- v1.1
- ✓ Unified TPC design tokens replace Tailwind 4 `@theme` (single source of truth in `src/ui/tokens/`, light + dark cascade via `.tpc` / `.tpc-dark`, system-pref dark-mode auto-flip with no FOUC, build-time guard rejects raw hex/oklch/font-family literals outside `src/ui/tokens/`) -- v1.2 Phase 22 (TOKENS-01, TOKENS-02, TOKENS-04 -- visual smoke pending)

### Active

v1.2 UI Overhaul -- see `.planning/REQUIREMENTS.md` for the full REQ-ID list. Categories:
- TOKENS -- token system replacement, dark mode, theme toggle
- TYPE -- self-hosted font pipeline (EB Garamond / Inter / IBM Plex Mono)
- LIB -- shared component library in `src/ui/`
- SCREEN -- per-screen restyle (mockup-faithful + extrapolated)
- MOTION -- live waveform, recording pulse, screen transitions, reduced-motion compliance
- A11Y -- WCAG AA contrast pass, focus rings, reduced-motion fallbacks

### Out of Scope

- Real-time collaboration between multiple users -- small team, not needed
- Video recording of items -- photos sufficient
- Direct integration with RFC API (bypassing the extension) -- leverage existing extension infrastructure
- OAuth/SSO login -- simple username/password sufficient for internal team
- On-device AI processing -- model size too large for mobile; offline queue solves connectivity problem
- Barcode/QR scanning -- receipt numbers are typed, not barcoded
- Auto-publish without review -- AI errors require human review gate
- Branch protection on main -- GitHub Free plan does not support on private repos (DEPLOY-04)

## Current State

**Shipped:** v1.1 Accounts & Deploy (2026-03-31)
**Codebase:** 33,636 LOC (TS/TSX/JS), 475 commits over 25 days (2026-03-06 -> 2026-03-31)
**Tech stack:** React 19 + Vite 7 + TypeScript 5 + Tailwind CSS 4 + Zustand 5 + Supabase (Postgres + Auth + Storage + RLS + Edge Functions) + Dexie 4 (audio/photos) + @google/genai 1.x + Cloudflare Worker proxy
**Deployed:** Vercel (auto-deploy from main) + GitHub Actions CI
**Extension:** TPC AI-Cataloging Chrome extension (Manifest V3) with batch import for sale and house sessions

## Context

**Auction platform:** RFC Invaluable (`rfc.invaluable.com`) is where catalog entries live
**Existing tooling:** TPC AI-Cataloging Chrome extension extended with batch import (v1.0 Phase 7) and house session import with photos (v1.1 Phase 20)
**Receipt numbers:** Format `XXXXX-N` (e.g., `39135-2`), used to identify items in sale cataloging mode
**Title convention:** ALL CAPS, format: `[PERIOD/STYLE] [MATERIAL] [ITEM TYPE]`
**Description convention:** Lowercase, starts with "the", top-to-bottom physical features, formal auction language
**Team size:** 2-5 auctioneers at The Potomack Company
**Field conditions:** House visits may be at rural locations with poor connectivity
**Architecture:** Supabase is server-authoritative for session/item metadata, auth, and photos. Dexie retains audio blobs and photo cache only. Future dashboard planned as separate repo reading from same Supabase instance.

## Constraints

- **Platform**: Mobile-first (phone/tablet), must work as PWA
- **Offline**: Record audio without connectivity; queue for processing when online
- **AI dependency**: Speech-to-text and field parsing require API calls (online); recording works offline
- **Integration**: Must produce output compatible with TPC AI-Cataloging extension's data format
- **Catalog format**: Output must conform to RFC Invaluable's title/description conventions

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Mobile-first PWA | Auctioneers need it on-site at houses; PWA avoids app store deployment | ✓ Good -- works on iOS + Android |
| AI-parsed speech (not raw transcription) | Natural speech needs structure extraction for catalog fields | ✓ Good -- Gemini handles both steps in one call |
| JSON export format | TPC extension already uses JSON throughout; natural fit | ✓ Good -- seamless extension integration |
| Both apps in one project | Extension import feature is required for end-to-end workflow | ✓ Good -- shared types prevent schema drift |
| Button tap between items (not voice commands) | More reliable in noisy house environments | ✓ Good -- no false activations |
| Cloudflare Worker proxy for Gemini | Keep API key off client; supports CORS | ✓ Good -- CORS locked to production origins |
| Pathname-based routing (React Router v7) | Prevents iOS microphone re-prompts on hash navigation | ✓ Good -- no re-prompt issues |
| Tailwind CSS 4: @theme blocks only | No tailwind.config.js; per Tailwind 4 API | ✓ Good |
| Single Gemini call (transcription + extraction) | No separate Whisper step; lower latency | ✓ Good |
| Fire-and-forget AI processing | Non-blocking recording flow; errors displayed on item card | ✓ Good |
| SheetJS for CSV/XLSX import | Single library handles both formats | ✓ Good |
| Versioned export filenames | First export no suffix; subsequent -v2, -v3 | ✓ Good |
| Supabase over Neon+Hono+BetterAuth | User familiar with Supabase; future dashboard reads from same DB; fewer moving parts | ✓ Good -- simplified architecture significantly |
| Dexie retains audio/photos only | All metadata server-authoritative in Supabase; Dexie for large blobs | ✓ Good -- clean separation |
| RLS policies for access control | Server-enforced role-based access; no middleware needed | ✓ Good -- admin/specialist isolation works |
| Edge Functions per operation | Separate create/update/list for independent deployability | ✓ Good -- clean separation |
| Photo upload queue with offline support | Fire-and-forget with bounded concurrency and backoff | ✓ Good -- non-blocking UX |
| Smart field merging via AI | Existing values passed as context; AI returns merged result | ✓ Good -- non-destructive re-recordings |
| Measurements as rich format string | Supports dimensions, mm, weight, karats in one field | ✓ Good -- flexible without schema changes |
| Unified TPC design system (v1.2) | Single token source, EB Garamond/Inter/Plex Mono, 6 px radii, light + dark + system-follow | TBD -- v1.2 in flight |
| Self-hosted fonts via `@fontsource` (v1.2) | Avoid Google CDN dependency, deterministic offline behavior, satisfies stricter CSP | TBD -- v1.2 in flight |
| Replace Tailwind 4 `@theme` with unified tokens (v1.2) | Single source of truth; future dashboard repo consumes the same `src/ui/` primitives | ✓ Good -- Phase 22 shipped: 21 color vars + 3 radii + 3 fonts bridged via `@theme inline` over `.tpc` / `.tpc-dark` cascade; TOKENS-04 build-time guard live in CI |
| `@theme inline` (not `@theme`) for the bridge (v1.2) | Bridge resolves at use site, so `.tpc-dark` scoped overrides reach every Tailwind utility — required for class-based dark variant to work | ✓ Good -- Phase 22; cascade flips utilities without component changes |
| `.tpc-dark` class on `<html>` as the single dark-mode signal (v1.2) | Pre-paint inline script + runtime `initTheme` listener both manipulate one class idempotently; Phase 25 user-toggle UI can supersede without touching `index.html` | ✓ Good -- Phase 22; Phase 25 contract preserved via extensible `initTheme(opts?)` signature |
| Adopt mockup density verbatim (v1.2) | Drop the v1.0 48 px+ tap-target baseline in favour of designer-specified density | TBD -- monitor field-use feedback |
| Extrapolate unmocked screens (v1.2) | Item detail/edit, admin views, login, walkthrough derived from tokens & primitives in discuss-phase reviews | TBD -- per-phase approval gate |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check -- still the right priority?
3. Audit Out of Scope -- reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-30 -- Phase 22 (Foundation Tokens) shipped; visual smoke pending*
