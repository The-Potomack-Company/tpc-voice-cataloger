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
- **[D-008](../../_workspace/Decisions/D-008-hub-vite-vercel-functions.md)** — Hub stays on Vite and adds Vercel Functions for /api server-side needs. No Next.js migration. Scraping (RFC) goes to Cloudflare Workers, not Vercel.
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
- **[D-037](../../_workspace/Decisions/D-037-v3-hub-merge-before-features.md)** — v3.0 hub merge ships before any new cross-app feature work on any TPC app. Hotfix lane stays open for production incidents. Sequencing reset established 2026-05-15 to prevent feature-churn and rework against the about-to-be-merged hub.
- **[D-038](../../_workspace/Decisions/D-038-single-supabase-dev-filter.md)** — Single Supabase project for both dev and prod. Dev data (users with empty email or `josh@potomackco.com`) is filtered out at the dashboard/analytics query layer. No separate staging project, no dev-account redirect, no migration approval gate beyond PR review + additive-only constraint. Pragmatic for current scope; revisit when usage grows or compliance demands isolation.
- **[D-041](../../_workspace/Decisions/D-041-analytics-uses-real-user-data.md)** — Analytics calculations (skip-reason rates, per-user usage curves, perf-improvement signals) must be based on real-user behaviour, not dev-account activity. The admin-visible "operational" surfaces (session list, invoice list, item review) are what the dev-data filter (D-038) protects. The raw analytics_events stream itself can stay hidden from direct admin browsing — admins consume analytics through curated dashboard widgets, not the raw event table.
- **[D-044](../../_workspace/Decisions/D-044-dual-vendor-pr-review.md)** — Every TPC PR gets both /codex:review AND Claude code-review before merge. Single-vendor review misses cross-vendor blind spots; in practice each vendor caught issues the other missed.
- **[D-045](../../_workspace/Decisions/D-045-crm-integrations-read-only.md)** — CRM Gmail and Streak integrations are read-only. Code in api/lib/crm/* must remain GET-only against both APIs — no write verbs, ever. Defense-in-depth alongside OAuth scope + allowlist.
- **[D-046](../../_workspace/Decisions/D-046-claude-owns-schema-auth-codex-barred.md)** — For parallel Claude+Codex execution, Claude owns schema migrations, type generation, and auth plumbing. Codex is barred from touching api/, supabase/, schema, and auth. Prevents Codex from breaking migrations or exposing service-role keys.
- **[D-047](../../_workspace/Decisions/D-047-continuous-recording-d037-exception.md)** — Continuous Session Recording (hands-off voice cataloging with wake-phrase item advance) approved as an urgent exception to D-037 merge-first policy. Inserted parallel to the CRM v0.5 demo, landed before the v3.0 hub merge gate. Scope contained to cataloger only — no schema or dashboard touch.
- **[D-048](../../_workspace/Decisions/D-048-crm-scratch-rebuild.md)** — Scrap the CRM v0.5 demo entirely — it didn't land. Rebuild the consignment CRM from scratch inside the hub, designed around TPC's real consignment workflow gathered directly from stakeholders, not ported from the demo. Only the Gmail-inbound read of consign@ carries forward. Streak is removed entirely — the new CRM replaces consignment tracking, it does not integrate with Streak. Demo schema, age-bump priority model, Streak stage filtering, and all demo frontend are abandoned. Requirements re-gathered via a stakeholder meeting (kit at Docs/CRM/) before any build.
- **[D-049](../../_workspace/Decisions/D-049-ai-proxy-cloud-run-host.md)** — The centralized AI proxy is hosted on Google Cloud Run (in the canonical GCP project gen-lang-client-0662587427), not a Cloudflare Worker. Overrides D-013's host attribute only; D-013's "one centralized AI proxy" principle is retained. Driven by D-043 (GCP consolidation) + the fact that the proxy is greenfield (no TPC proxy exists yet), so there is zero migration cost to starting on Cloud Run.
- **[D-054](../../_workspace/Decisions/D-054-tpc-daily-session-cadence.md)** — Move TPC from a start/end ritual per session to a once-a-day cadence — one /tpc-start in the morning, work freely across many sessions/agents/convos (passive A1–A5 hooks capture everything), and a single /tpc-end at EOD that day-sweeps all of the day's sessions (git history + chat transcripts + GSD state). tpc-start gains a once-a-day gate; tpc-end loops the two session-scoped steps over every session touched today; the dashboard TPC tile opens a real session cwd'd into ~/Projects/TPC with no auto-injection.
- **[D-055](../../_workspace/Decisions/D-055-hub-two-tab-home-cataloging-nav.md)** — Hub bottom nav is two tabs — Home (CRM + dashboard analytics) and Cataloging (the entire voice cataloging app). Replaces D-007's role-based adaptive landing as the top-level navigation structure.
- **[D-056](../../_workspace/Decisions/D-056-cataloger-ai-proxy-cloud-run-migration.md)** — Migrate the voice-cataloger off its in-repo Cloudflare Worker (tpc-gemini-proxy, proxy/) onto the shared tpc-ai-proxy Cloud Run service during v1.3 (cataloger Phase 40), ahead of D-049's "post-v3.0" timing but consistent with D-052's mature-independently policy. The cataloger's Supabase-JWT auth is PRESERVED across the move — D-014's bearer-verify is implemented on Cloud Run as part of this phase rather than deferred to its 39b post-v3.0 slot.
- **[D-057](../../_workspace/Decisions/D-057-crm-department-taxonomy.md)** — CRM routing departments = fine art, furniture, jewelry, asian art, decorative arts, rugs/tapestries/textiles, books and documents, native american, fashion. Plus an estates tag (distinct workflow, out of MVP). Specialists belong to one or more departments. Supersedes the D-036 five-department taxonomy.
- **[D-058](../../_workspace/Decisions/D-058-crm-google-chat-embedded.md)** — Embed the full Google Chat client (spaces + DMs) inside the hub as a primary internal comms surface (Laia <-> specialists, team). Write-capable integration — the one place the CRM is not read-only. Revisits the earlier "Chat = notifications only, not embedded in hub" call.
- **[D-059](../../_workspace/Decisions/D-059-crm-specialist-isolation-visibility.md)** — CRM specialists are isolated from the consigner (no identity/contact/threads) and see only items assigned to them or to their department pool — never another specialist's private assignment. All consigner traffic flows through Laia.
- **[D-060](../../_workspace/Decisions/D-060-gcp-migration-activation.md)** — Activate the GCP consolidation NOW (D-043 set GCP as the target but deferred it until post-cutover). Migrate off Supabase + Vercel onto Google Cloud. Build the CRM greenfield on GCP from day one; migrate the existing hub off Supabase auth-first, reusing the foundation the CRM builds. Target architecture introduces an API tier - client → Cloud Run API → Cloud SQL - replacing Supabase's client-direct-to-Postgres + RLS-from-JWT.
- **[D-061](../../_workspace/Decisions/D-061-auth-firebase-google-workspace-sso.md)** — Identity = Firebase Auth with Google sign-in, restricted to the potomackco.com Workspace domain. No passwords, no manual account creation — first Google sign-in auto-creates the user; authorization is an in-app role/membership assigned by admin/dev. Role hierarchy dev > admin > manager > specialist. Clean slate — delete existing test users, no transfer. Authn opens to the domain; authz stays gated.
- **[D-062](../../_workspace/Decisions/D-062-hub-domain-firebase-hosting.md)** — Production domain is app.potomackco.com on Firebase Hosting (custom domain, auto-SSL). Preview builds use Firebase Hosting preview channels (ephemeral *.web.app URLs, auto-expire, PR-commented via GitHub Action). Legacy app URLs 301 → app.potomackco.com at cutover. Supersedes D-009's promote-the-dashboard-Vercel-URL plan, which is moot under the GCP migration.
- **[D-063](../../_workspace/Decisions/D-063-invoice-fab-standalone-v23-defer-audit.md)** — Pull Feature B (Invoice fab) out of the v3-hub roadmap (was slated v3.2) into a standalone extension milestone v2.3 — RFC Power Features, alongside the relocated Phase 40 (parallel photo upload). Ships independently of the v3.0 hub. The DR-5 per-fetch Supabase audit trail is deferred to the v3 hub.

<!-- VAULT:decisions-end -->
## Current Milestone: v1.3 Maturation (LIVE track)

**Goal:** Harden the live-on-prod app independently while the v3.0 hub cutover stays deferred (D-052). Close the security, durability, performance, quality, and concurrency gaps surfaced by the 2026-05-27 consolidated audit + 2026-05-28 UAT, ship the durable-audio ask, and migrate off the Cloudflare Worker AI proxy onto the shared GCloud AI proxy — each phase shipping independently with its own UAT + tests.

**Predecessor:** v1.2 UI Overhaul — SHIPPED 2026-05-13 (PR #11, phases 22-30).

**Target phases (31-39 + proxy migration — full detail in `.planning/ROADMAP.md`):**
- Phase 31 — sec-profiles-self-update-hardening *(P0 🔴 LIVE on prod)*: lock down specialist self-promotion to admin (REVOKE broad UPDATE, column-scoped GRANT, role-guard trigger).
- Phase 32 — audio-blob-supabase-persistence *(🟠 NEW)*: durable audio in Supabase Storage, cross-device retry, audit trail.
- Phase 33 — offline-reliability *(🟠 REL-1..4)*: backoff + attempt cap, cross-tab claim/coordination, blocked-write surfacing, recorder always settles.
- Phase 34 — ios-memory-optimization *(🟠 PERF-1..3)*: chunked/out-of-band audio encode, bounded continuous-mode blob, hoisted Dexie subscriptions.
- Phase 35 — ai-correctness-track-2 *(🟡)*: `temperature=0`, confabulation guard, no-clobber on retry, list-view failure visibility.
- Phase 36 — ux-visibility-polish *(🟡)*: surface export/import/fetch/admin/login failures via the shared ErrorToast path.
- Phase 37 — a11y-foundation *(🟡)*: modal focus-trap, 44px touch targets, icon-button labels, non-swipe delete affordance.
- Phase 38 — migration-retryability *(🟡, was 999.2)*: idempotent + retryable Dexie→Supabase migration with partial-state banner.
- Phase 39 — optimistic-locking *(🔴 HIGH RISK, was 999.3)*: `updated_at` trigger + precondition writes + conflict reconciliation.
- Phase 40 — ai-proxy-cloud-run-migration *(NEW, cross-app)*: cut this app's AI traffic off the in-repo Cloudflare Worker (`proxy/` → `tpc-gemini-proxy`) onto the shared **`tpc-ai-proxy`** Cloud Run service (the-potomack-company / GCP `gen-lang-client-0662587427`) that now fronts AI for all TPC projects. Config-level URL cutover (`VITE_GEMINI_PROXY_URL`) + proxy `ALLOWED_ORIGINS` add + auth-model decision (preserve Supabase JWT vs interim origin+quota), then retire the Worker. Per D-056 (amends D-049), D-013/D-053/D-043; lands ahead of D-049's "post-v3.0" timing but consistent with D-052; Supabase JWT preserved.

**Out of milestone scope:** Information architecture changes (no nav restructure), feature additions beyond durable audio, and the v3.0 hub cutover (deferred — D-052).

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
- ✓ Unified TPC design tokens replace Tailwind 4 `@theme` (single source of truth in `src/ui/tokens/`, light + dark cascade via `.tpc` / `.tpc-dark`, system-pref dark-mode auto-flip with no FOUC, build-time guard rejects raw hex/oklch/font-family literals outside `src/ui/tokens/`) -- v1.2 (shipped 2026-05-13, PR #11: full design system — tokens, typography, LIB primitives, theme toggle, mockup-faithful screens, motion, WCAG AA)

### Active

v1.3 Maturation -- phases 31-39 + the AI-proxy migration, queued from the 2026-05-27 consolidated audit + 2026-05-28 UAT. Full phase detail in `.planning/ROADMAP.md`. Tracks:
- SEC -- profiles self-update hardening (Phase 31, P0 LIVE on prod)
- AUDIO -- durable audio in Supabase Storage + cross-device retry (Phase 32)
- REL -- offline-queue backoff, cross-tab coordination, blocked-write surfacing (Phase 33)
- PERF -- iOS memory / render-storm reduction (Phase 34)
- AI -- determinism, confabulation guard, no-clobber retry (Phase 35)
- UX -- surface previously-silent failures (Phase 36)
- A11Y -- focus-trap, touch targets, labels, non-swipe affordances (Phase 37)
- DATA -- migration retryability (Phase 38) + optimistic locking (Phase 39)
- PROXY -- migrate AI traffic from the Cloudflare Worker to the shared GCloud AI proxy

(v1.2 UI Overhaul -- TOKENS / TYPE / LIB / SCREEN / MOTION / A11Y -- SHIPPED 2026-05-13, PR #11.)

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
| Unified TPC design system (v1.2) | Single token source, EB Garamond/Inter/Plex Mono, 6 px radii, light + dark + system-follow | ✓ Good -- v1.2 shipped 2026-05-13 (PR #11) |
| Self-hosted fonts via `@fontsource` (v1.2) | Avoid Google CDN dependency, deterministic offline behavior, satisfies stricter CSP | ✓ Good -- v1.2 shipped 2026-05-13 (PR #11) |
| Replace Tailwind 4 `@theme` with unified tokens (v1.2) | Single source of truth; future dashboard repo consumes the same `src/ui/` primitives | ✓ Good -- Phase 22 shipped: 21 color vars + 3 radii + 3 fonts bridged via `@theme inline` over `.tpc` / `.tpc-dark` cascade; TOKENS-04 build-time guard live in CI |
| `@theme inline` (not `@theme`) for the bridge (v1.2) | Bridge resolves at use site, so `.tpc-dark` scoped overrides reach every Tailwind utility — required for class-based dark variant to work | ✓ Good -- Phase 22; cascade flips utilities without component changes |
| `.tpc-dark` class on `<html>` as the single dark-mode signal (v1.2) | Pre-paint inline script + runtime `initTheme` listener both manipulate one class idempotently; Phase 25 user-toggle UI can supersede without touching `index.html` | ✓ Good -- Phase 22; Phase 25 contract preserved via extensible `initTheme(opts?)` signature |
| Adopt mockup density verbatim (v1.2) | Drop the v1.0 48 px+ tap-target baseline in favour of designer-specified density | ✓ Shipped v1.2 -- note: Phase 37 (v1.3) restores 44px minimum touch targets for a11y |
| Migrate AI proxy Cloudflare Worker → Cloud Run (v1.3 Phase 40) | Cut the cataloger onto the shared `tpc-ai-proxy` Cloud Run service (the-potomack-company / GCP), retiring the in-repo CF Worker. Done in v1.3 ahead of D-049's "post-v3.0" timing (consistent with D-052); Supabase JWT auth preserved (D-014 pulled forward) — per **D-056** (amends D-049), D-013, D-053, D-043 | TBD -- v1.3 Phase 40 to be planned |
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
*Last updated: 2026-05-29 -- v1.2 UI Overhaul shipped (PR #11); v1.3 Maturation opened (phases 31-39 + AI-proxy GCloud migration queued).*
