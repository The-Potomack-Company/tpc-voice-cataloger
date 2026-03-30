# Project Research Summary

**Project:** TPC Speech Cataloger v1.1 — Accounts & Deploy
**Domain:** Adding multi-user auth, RBAC, and server-side session management to an existing offline-first PWA
**Researched:** 2026-03-17
**Confidence:** HIGH

## Executive Summary

TPC Speech Cataloger v1.0 is a fully working local-first PWA for auction cataloging — audio recording, AI transcription via Gemini, item editing, and JSON export all live in the browser using IndexedDB (Dexie). v1.1 is a tightly scoped milestone that introduces the first server-side layer: user accounts, role-based access (admin vs. specialist), session assignment and a review/approval workflow, server-side storage for session metadata and items, and public Vercel deployment. The defining architectural principle is that the server is authoritative for shared state (accounts, assignments, lifecycle), while the client remains authoritative for device-local concerns (audio blobs, photos, AI processing queue). This split is non-negotiable: moving audio and photos to the server would break offline recording at house visits.

The recommended stack additions are minimal and well-validated: Hono 4.x as the API framework (Web Standards-native, zero-config on Vercel, ~115ms cold starts via Fluid Compute), Better Auth 1.x with the username and admin plugins (username/password auth and two-role RBAC with no custom code, no per-MAU cost), Drizzle ORM with a Neon Postgres backend (type-safe SQL, no serverless cold-start penalty from Prisma's query engine binary, generous free tier for 2-5 users). All four technologies are officially supported together with documented integration points. The total addition is 4 production dependencies and 3 dev dependencies — a minimal footprint.

The most important risks are pre-existing patterns in the codebase that need to be addressed before going multi-user: the service worker must never cache API responses, the Zustand persist key must be user-scoped, the Cloudflare Worker CORS wildcard must be locked to the production domain, and role enforcement must live on the server — not just in the UI. None of these are complex changes, but each one is a security or data-integrity hole if missed. The largest single body of work is migrating the session list, session detail, and new session pages from reading Dexie directly to reading from the API.

---

## Key Findings

### Recommended Stack

The existing v1.0 stack (React 19, Vite 7, TypeScript, Tailwind 4, Zustand, Dexie 4, React Router 7, Zod, vite-plugin-pwa) remains entirely unchanged. v1.1 adds a backend alongside it, not instead of it. Dexie stays as the local data layer for audio blobs, photos, and the AI processing queue.

**Core technologies added:**
- **Hono 4.x** (`^4.12.8`): Lightweight API framework — Web Standards-native, zero-config Vercel Function via `fetch` export, native TypeScript, Hono RPC for end-to-end type safety. Outperforms Express (not serverless-native) and avoids tRPC complexity for this scale.
- **Better Auth 1.x** (`^1.5.5`): Authentication framework — username plugin for username/password sign-in (no email infrastructure), admin plugin for built-in `admin`/`user` roles and `createUser` API. Self-hosted, no vendor lock-in, native Hono integration. Supersedes the deprecated Lucia Auth.
- **Neon Postgres** (`@neondatabase/serverless ^1.0.2`): Serverless Postgres via HTTP driver — 0.5GB / 100 CU-hours free tier, scale-to-zero, Vercel Marketplace integration. Vercel Postgres is now Neon. Better than Supabase (no unnecessary bundled services) and PlanetScale (deprecated free tier).
- **Drizzle ORM** (`^0.45.1`): Type-safe SQL ORM — zero runtime binary, compiles to SQL, no 2-5 second cold start penalty from Prisma's query engine. Built-in Better Auth adapter, drizzle-kit migration tooling.
- **Vercel (platform)**: Zero-config SPA + serverless API hosting, preview deployments per PR, Neon integration, GitHub auto-deploy. Free Hobby tier sufficient for 2-5 users.

See [STACK.md](.planning/research/STACK.md) for full rationale, alternatives considered, and version compatibility matrix.

### Expected Features

**Must have for v1.1 (table stakes):**
- Username/password login — Better Auth username plugin; no email infrastructure needed
- Two roles: admin and specialist — Better Auth admin plugin provides `admin`/`user` roles out of the box
- Admin creates specialist accounts — `authClient.admin.createUser()`; no self-registration
- Admin creates sessions and assigns to specialists — extends NewSessionPage with assignee dropdown, POST to API
- Specialist scoped session view — server filters `WHERE assignedTo = currentUser OR createdBy = currentUser`
- Session submission by specialist — new "submitted" status, POST `/api/sessions/:id/submit`
- Admin review queue with inline editing — view submitted sessions, edit items, approve or return with notes
- Admin-only server-side export — server reads from Postgres, returns same JSON format as v1.0
- Vercel deployment with CI pipeline — lint, typecheck, test, build on every PR; auto-deploy to main
- Cloudflare Worker CORS lockdown — one-line change to restrict proxy to production domain only

**Should have shortly after (v1.1.x differentiators):**
- Password change (self-service) — `authClient.changePassword()`; specialists update own passwords without admin
- Session reassignment — admin changes assigned specialist on active session
- Admin submission queue/dashboard — dedicated view sorted by submission time with visible assignee name

**Defer to v1.2+:**
- Bulk session assignment (split receipt list across multiple specialists)
- Activity log / audit trail
- Photo upload to server (photos stay in Dexie for v1.1)

See [FEATURES.md](.planning/research/FEATURES.md) for the full workflow (happy path and edge cases) and anti-features to avoid.

### Architecture Approach

v1.1 introduces a server-authoritative model for shared state while fully preserving the local-first pattern for recording and AI. Session metadata, items, assignments, and export history move to Neon Postgres. Audio blobs, photos, and the AI processing queue stay in Dexie. A new sync bridge fires after AI processing completes to push structured item fields from Dexie to the server. Better Auth uses httpOnly session cookies — not localStorage JWTs — so there is no token management code and no XSS exposure from token theft. The existing React pages migrate from `useLiveQuery` (Dexie reactive) to `fetch`+`useEffect` with an `apiFetch` wrapper. TanStack Query is explicitly deferred — `useState`/`useEffect` is sufficient for 2-5 users.

**Major components:**
1. **Hono API** (`api/index.ts`) — single Vercel Function handling all `/api/*` routes: auth, session CRUD, assignment, lifecycle transitions, item sync, export
2. **Better Auth** (server + React client) — auth middleware, session cookies, role checking, admin user management via plugin APIs
3. **Drizzle ORM + Neon Postgres** — typed persistence for users, sessions (`catalog_sessions`), items (`catalog_items`), export history
4. **Dexie/IndexedDB** (client, unchanged) — audio blobs, photo blobs, AI processing queue; source of truth for recording
5. **Zustand** (client, extended) — add `authStore.ts` for user/role; user-scope existing persist keys on all stores
6. **Sync Bridge** (`syncBridge.ts`, new) — pushes AI-processed item fields to server after `aiStatus` transitions to `"done"`
7. **Session Lifecycle State Machine** (`canTransition(from, to, role)`) — server-enforced; prevents impossible transitions

See [ARCHITECTURE.md](.planning/research/ARCHITECTURE.md) for data flow diagrams, full Drizzle schema, component change matrix, and anti-patterns to avoid.

### Critical Pitfalls

1. **Service worker caches auth-gated API responses** — Add `navigateFallbackDenylist: [/^\/api\/.*/]` to VitePWA Workbox config immediately when the first API route is added. Without this, Workbox can serve stale user-specific session data to whoever logs in next — a data integrity and security violation.

2. **Client-side role checks without server enforcement** — Hiding the Export button is not security. Every admin endpoint must return 403 for non-admin sessions — enforced in Hono middleware. The UI hides buttons, route guards add defense-in-depth, but the server is the only real boundary.

3. **App breaks entirely when server is down** — Once login is required, offline behavior changes. After initial authentication, the session cookie persists. Subsequent launches offline should show cached data and keep recording functional. Hard rule: recording must never be blocked by server unavailability.

4. **Zustand persisted state leaks between users** — `tpc-ui-state` is not user-scoped. After user A logs out and user B logs in, Zustand serves A's preferences and potentially A's `recordingSessionId`. Fix: scope persist key to `tpc-ui-state-${userId}` and clear all stores on logout.

5. **Hono module imports fail on Vercel due to path resolution** — Relative imports from `api/index.ts` to `../server/*` may fail in Vercel's serverless bundler. Test `vercel build` locally before the first deployment. If resolution fails, move server code inside `api/` directory hierarchy.

See [PITFALLS.md](.planning/research/PITFALLS.md) for all 16 pitfalls with detection signals and the "Looks Done But Isn't" acceptance checklist.

---

## Implications for Roadmap

The dependency chain is clear from research: infrastructure and auth must exist before any feature work, and the client pages must be migrated to use the server before the assignment and review workflow features can be layered on. Suggested phase structure:

### Phase 1: Backend Infrastructure (Hono + Drizzle + Neon)

**Rationale:** Everything else depends on this. No auth, no sessions, no deployment without the API layer and database. Establishing this phase first also forces the `vercel.json` routing and `vercel build` validation that catches module resolution issues early (Pitfall #10) before any auth code exists.
**Delivers:** Working Hono serverless function on Vercel, Drizzle schema applied to Neon Postgres, `vercel.json` routing (API first, SPA catch-all), local dev workflow with Vite proxy or `vercel dev`.
**Addresses:** Foundation required by all subsequent features.
**Avoids:** Pitfall #10 (module import resolution) — test `vercel build` as part of this phase. Pitfall #5 (SPA 404 on refresh) — `vercel.json` rewrites are set here.

### Phase 2: Authentication (Better Auth + Login Page)

**Rationale:** All user-facing features require knowing who is logged in. Auth must be stable before session assignment or role-gating is possible. The local dev cookie cross-origin issue (Pitfall #9) must be solved here so subsequent phases do not debug phantom 401 errors.
**Delivers:** Login page, `AuthGuard` and `AdminGuard` route wrappers, Better Auth schema in Postgres (user/session/account tables), working session cookies, `authClient` with username + admin plugins, protected route tree in `App.tsx`.
**Uses:** Better Auth username + admin plugins, Drizzle adapter, Hono auth middleware.
**Avoids:** Pitfall #9 (cookie not sent cross-origin in dev) — Vite proxy established here. Pitfall #15 (email required) — placeholder email pattern `${username}@tpc.local` established. Pitfall #11 (role name mismatch) — `'user'` convention enforced in code from day one.

### Phase 3: Admin Account Management

**Rationale:** Specialists cannot be assigned sessions until their accounts exist. Admin must be able to create and manage accounts before the assignment workflow is built. Small, self-contained phase that validates the admin plugin API.
**Delivers:** UsersPage (admin-only), create/list/deactivate specialist accounts via Better Auth admin API, role-conditional navigation in AppLayout (username + role badge, logout button, admin-only tabs).
**Implements:** AdminGuard on `/users` route. Server-side role enforcement on `/api/users` endpoints.
**Avoids:** Pitfall #2 (UI-only role checks) — enforce admin role server-side on every `/api/users` endpoint from the start.

### Phase 4: Session API + Client Migration

**Rationale:** The existing session list, creation, and detail pages all read from Dexie. They must be migrated to the server API before the assignment and lifecycle workflow can be built. This is the highest-risk phase — widest blast radius in the existing codebase.
**Delivers:** `catalog_sessions` and `catalog_items` tables in Postgres. Session CRUD endpoints. SessionsPage, NewSessionPage, and SessionDetailPage fetching from API instead of Dexie. `apiFetch` wrapper (`credentials: 'include'`). Zustand `authStore`. User-scoped persist keys on all stores (fixes Pitfall #8). Service worker API exclusion configured (fixes Pitfall #1).
**Avoids:** Pitfall #3 (orphaned v1.0 Dexie data) — admin exports all v1.0 data before this phase deploys; clean server start is explicit. Pitfall #1 (SW caches API responses) — Workbox denylist added before first API call reaches the browser.

### Phase 5: Session Assignment Workflow

**Rationale:** With accounts, auth, and the session API stable, the core admin-to-specialist assignment workflow is buildable without risk to other functionality. Scoped view on the specialist side is a server-side filter change, not a new component.
**Delivers:** Assignee dropdown on NewSessionPage (admin-only), specialist scoped session view (server-filtered), `assignedTo`/`assignedBy` fields added to Dexie Session type (for offline cache of assignment state), session status badges with color coding.
**Implements:** `WHERE assignedTo = currentUser OR createdBy = currentUser` server filter, role-conditional session list sections for admin vs. specialist.

### Phase 6: Review Workflow (Submit / Return / Approve)

**Rationale:** Assignment enables this; it cannot be built before Phase 5. The session lifecycle state machine should be fully codified here before any endpoint is written — defining the transition table first prevents the implicit-transition drift that becomes a data integrity bug later.
**Delivers:** Submit button (specialist, on assigned sessions), review queue section (admin), inline item editing (admin on submitted sessions, reusing existing `EditableField`), return with review notes, approve/complete transition, `syncBridge.ts` (AI results from Dexie to server).
**Implements:** `canTransition(from, to, role)` server-side state machine. `syncBridge.ts` calling `offlineQueue.ts` after `aiStatus` transitions to `"done"`.
**Avoids:** Pitfall #6 (implicit lifecycle transitions) — define full transition table before writing any endpoint.

### Phase 7: Server-Side Export + CI/CD Hardening

**Rationale:** Export is admin-only and depends on items being server-resident (Phase 6). CI/CD and deployment gates belong together as the final hardening phase — grouping them ensures they are not deferred indefinitely.
**Delivers:** `/api/sessions/:id/export` endpoint (admin-only, 403 for specialists), `catalog_export_history` table, CI pipeline (lint + typecheck + test + build), Cloudflare Worker CORS lockdown to production domain, Vercel production deployment from main.
**Avoids:** Pitfall #2 (role enforcement) — export 403 verified in CI test suite. Pitfall #7 (CORS wildcard) — lockdown is a blocking deployment gate, not a "do it later" task.

### Phase Ordering Rationale

- Phases 1 and 2 are strictly sequential: no auth without infrastructure.
- Phase 3 must precede Phase 5: specialist accounts must exist before they can be assigned sessions.
- Phase 4 (client migration) must complete before Phase 5: the session API must exist before assignment fields can be written to it.
- Phase 6 depends on Phases 4 and 5 being stable: submission flow is meaningless without assignments, and the sync bridge needs items to exist on the server.
- Phase 7 is deliberately last: export depends on server-resident items (Phase 6), and CI/deployment hardening is a gate on shipping not a precondition for building.
- The audio recording path (Dexie + AI queue) is intentionally untouched throughout. Changes are limited to session metadata and items after AI processing completes.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (Session API + Client Migration):** Highest-risk phase. Migrating from Dexie `useLiveQuery` to `fetch`+`useEffect` across SessionsPage, SessionDetailPage, NewSessionPage, and ItemEntry is the most invasive change. The Dexie-to-server ID mapping strategy (Dexie auto-increment integers vs. Postgres serial integers) needs a concrete design before work begins. Needs detailed task breakdown.
- **Phase 6 (Sync Bridge):** The `syncBridge.ts` pattern (pushing AI results from Dexie to server after offline queue processing) is novel to this codebase. The exact integration point in `offlineQueue.ts` needs mapping before Phase 6 planning.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Backend Infrastructure):** Hono + Drizzle + Neon setup is fully documented with official guides. STACK.md has exact config.
- **Phase 2 (Authentication):** Better Auth + Hono integration is a documented pattern with working code examples already in ARCHITECTURE.md.
- **Phase 3 (Admin Account Management):** Better Auth admin plugin APIs are well-documented. Standard CRUD page pattern.
- **Phase 7 (CI/CD):** Standard Vercel + GitHub Actions. No novel patterns.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All dependencies verified on npm with current versions (published 2026-03-13/14). Official docs confirm all integration points. No experimental or alpha packages. |
| Features | HIGH | Features derived from PROJECT.md requirements plus direct codebase analysis of existing v1.0 pages. No speculation. |
| Architecture | HIGH | Data boundary (server vs. Dexie), auth flow, and component change matrix grounded in specific API docs. Established patterns (httpOnly cookies, state machines, sync bridge) — not novel approaches. |
| Pitfalls | HIGH | Each pitfall grounded in official docs (Workbox denylist, Neon scale-to-zero), Vercel community reports (module resolution), or direct codebase analysis (CORS wildcard in `proxy/src/index.ts`, persist key in `src/stores/uiStore.ts`). |

**Overall confidence:** HIGH

### Gaps to Address

- **Dexie-to-server ID mapping:** v1.0 Dexie uses auto-increment integer IDs; Postgres uses serial integers. When a session is created via API, the client receives a Postgres ID. The ItemEntry workflow and sync bridge need to reference the correct server IDs. A concrete mapping strategy (e.g., store server ID alongside Dexie ID in the local record) needs to be designed in Phase 4 planning before implementation begins.
- **Offline session display strategy:** Research recommends showing cached data when server is unreachable, but the exact caching mechanism (in-memory, sessionStorage, lightweight Dexie mirror of server responses) needs a concrete decision in Phase 4. "Show cached data" requires defining what data is cached and when.
- **Better Auth email placeholder validation:** Generating `${username}@tpc.local` satisfies Drizzle schema. Confirm this does not trigger email format validation or uniqueness conflicts on the Better Auth server side before finalizing the Phase 2 account creation flow.
- **Neon scale-to-zero UX:** First request after 5 minutes idle adds 1-3 seconds of latency on the login page. Acceptable for a 2-5 user internal tool, but a loading indicator on the login form should be added to Phase 2 scope to avoid "is it broken?" confusion.

---

## Sources

### Primary (HIGH confidence)
- [Hono on Vercel — official docs](https://vercel.com/docs/frameworks/backend/hono) — zero-config deployment, Fluid Compute, project structure
- [Vercel Functions API Reference](https://vercel.com/docs/functions/functions-api-reference) — `fetch` export, `api/` directory convention
- [Vite on Vercel — official docs](https://vercel.com/docs/frameworks/frontend/vite) — SPA rewrite config, vercel.json setup
- [Better Auth Hono Integration](https://better-auth.com/docs/integrations/hono) — mount handler, CORS config, session middleware
- [Better Auth Username Plugin](https://better-auth.com/docs/plugins/username) — username-based sign-in, email requirement quirk
- [Better Auth Admin Plugin](https://better-auth.com/docs/plugins/admin) — role field, createUser API, access control
- [Better Auth Installation](https://better-auth.com/docs/installation) — setup, Drizzle adapter config
- [Drizzle ORM + Neon setup](https://orm.drizzle.team/docs/get-started/neon-new) — neon-http driver, schema definition, migration approach
- [Neon Postgres Pricing](https://neon.com/pricing) — free tier: 0.5GB storage, 100 CU-hours/month, 5-minute scale-to-zero
- [Workbox navigateFallbackDenylist](https://vite-pwa-org.netlify.app/workbox/generate-sw) — excluding API routes from service worker
- [Vercel community — Hono module resolution](https://community.vercel.com/t/hono-api-on-vercel-crashes-with-err-module-not-found-when-importing-server-files/35901) — import path pitfall

### Secondary (codebase analysis)
- `vite.config.ts` — existing Workbox config (no API exclusion — needs fix in Phase 4)
- `proxy/src/index.ts` — existing CORS wildcard (needs lockdown in Phase 7)
- `src/stores/uiStore.ts` — existing persist key `tpc-ui-state` (needs user-scoping in Phase 4)
- `src/db/types.ts`, `src/db/sessions.ts` — existing Session type (needs `assignedTo`/`assignedBy` in Phase 5)
- `src/pages/Sessions.tsx`, `src/pages/SessionDetail.tsx`, `src/pages/NewSession.tsx` — pages to migrate from Dexie to API in Phase 4

---
*Research completed: 2026-03-17*
*Ready for roadmap: yes*
