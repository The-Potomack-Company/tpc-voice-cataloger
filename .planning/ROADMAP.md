# Roadmap: TPC Speech Cataloger

## Milestones

- ✅ **v1.0 MVP** -- Phases 1-9 + 5.1 (shipped 2026-03-17) -- See [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- 🚧 **v1.1 Accounts & Deploy** -- Phases 11-17 (in progress)

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

### 🚧 v1.1 Accounts & Deploy (In Progress)

**Milestone Goal:** Add admin/specialist accounts with session assignment workflow, then deploy to production.

- [x] **Phase 11: Supabase Foundation** - Postgres database, auth configuration, and RLS policies (completed 2026-03-18)
- [x] **Phase 12: Authentication** - Login page, session management, route protection, and service worker fix (completed 2026-03-18)
- [x] **Phase 13: Account Management** - Admin creates and manages specialist accounts (completed 2026-03-18)
- [x] **Phase 14: Data Migration** - Session and item data moves from Dexie to Supabase Postgres (completed 2026-03-18)
- [x] **Phase 15: Session Assignment** - Admin assigns sessions to specialists; specialists see scoped view (completed 2026-03-20)
- [x] **Phase 16: Session Lifecycle** - Submit, review, return, and admin-only export workflow (completed 2026-03-20)
- [x] **Phase 17: Deployment & CI** - Vercel deploy, GitHub Actions, CORS lockdown, branch protection (completed 2026-03-30)

## Phase Details

### Phase 11: Supabase Foundation
**Goal**: Supabase project is configured with Postgres schema and RLS policies ready for the application to connect
**Depends on**: Nothing (first phase of v1.1)
**Requirements**: INFRA-01, INFRA-02
**Success Criteria** (what must be TRUE):
  1. Supabase project exists with Postgres database containing tables for users, sessions, items, and export history
  2. RLS policies are defined and enforced -- admin role can read/write all rows, specialist role can only read/write rows assigned to or created by them
  3. Supabase client SDK is installed and configured in the app with environment variables for project URL and anon key
**Plans:** 2/2 plans complete
Plans:
- [x] 11-01-PLAN.md -- SQL migrations, SDK install, client singleton, placeholder types, and unit tests
- [x] 11-02-PLAN.md -- Cloud project setup, migration push, type generation, and RLS verification

### Phase 12: Authentication
**Goal**: Users can securely log in with email/password via Supabase Auth and unauthenticated users are blocked from the app
**Depends on**: Phase 11
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, INFRA-04
**Success Criteria** (what must be TRUE):
  1. User can log in with email and password on a dedicated login page
  2. Auth session persists across browser close and refreshes automatically (no re-login needed until explicit logout)
  3. Unauthenticated users are redirected to the login page when accessing any app route
  4. User can change their own password from a settings or profile area
  5. Service worker does not cache Supabase API routes (auth and data requests always reach the server)
**Plans:** 3/3 plans complete
Plans:
- [x] 12-01-PLAN.md -- Auth store, ProtectedRoute, App.tsx route wiring, main.tsx init, and service worker Supabase exclusion
- [x] 12-02-PLAN.md -- Login page with email/password form, error handling, and loading state
- [x] 12-03-PLAN.md -- Settings page Account section (Change Password) and Sign Out button

### Phase 13: Account Management
**Goal**: Admin can create, view, and deactivate specialist accounts so that specialists exist before session assignment
**Depends on**: Phase 12
**Requirements**: ACCT-01, ACCT-02, ACCT-03, ACCT-04
**Success Criteria** (what must be TRUE):
  1. Admin can create a new specialist account by providing a username and password
  2. Admin can view a list of all accounts showing username, role, and active/deactivated status
  3. Admin can deactivate a specialist account, which prevents that specialist from logging in without deleting their data
  4. The account management page is not accessible to specialist-role users (server-enforced, not just hidden in UI)
**Plans:** 2/2 plans complete
Plans:
- [x] 13-01-PLAN.md -- Edge Functions, DB migration, admin API service layer, and admin route guard
- [ ] 13-02-PLAN.md -- Account Management page UI, AccountRow component, Settings admin section, and route wiring

### Phase 14: Data Migration
**Goal**: Session and item metadata is server-authoritative in Supabase Postgres while Dexie retains only audio blobs and photos
**Depends on**: Phase 12
**Requirements**: INFRA-03
**Success Criteria** (what must be TRUE):
  1. SessionsPage, NewSessionPage, and SessionDetailPage read session and item data from Supabase Postgres instead of Dexie
  2. Creating, editing, and deleting sessions and items writes to Supabase Postgres as the source of truth
  3. Audio blobs and photos remain in Dexie (IndexedDB) and are not uploaded to the server
  4. Zustand persist keys are scoped per user so that logging out and logging in as a different user does not leak state
**Plans:** 5/5 plans complete
Plans:
- [x] 14-01-PLAN.md -- Dexie v7 schema, types, Zustand sessionStore, per-user persist scoping, ID mapping utilities
- [x] 14-02-PLAN.md -- Rewrite data access layer (sessions.ts, items.ts, useSessions.ts) and services (gemini, export, offline queue)
- [x] 14-03-PLAN.md -- One-time Dexie-to-Supabase migration, MigrationSplash UI, and write-ahead queue for offline writes
- [ ] 14-04-PLAN.md -- Update all pages and components from Dexie to Zustand/Supabase, human verification

### Phase 15: Session Assignment
**Goal**: Admin can assign sessions to specialists, and specialists see only the sessions relevant to them
**Depends on**: Phase 13, Phase 14
**Requirements**: ASGN-01, ASGN-02, ASGN-03, ASGN-04
**Success Criteria** (what must be TRUE):
  1. Admin can select a specialist to assign when creating a new session
  2. Specialist sees only sessions assigned to them plus sessions they created themselves
  3. Admin can reassign an active session to a different specialist
  4. Admin can view all sessions across all users with assignee name and current status visible
**Plans:** 3/3 plans complete
Plans:
- [x] 15-01-PLAN.md -- useUserRole hook, createSession assigned_to support, NewSession specialist dropdown, SessionCard admin variant
- [ ] 15-02-PLAN.md -- Role-aware Sessions page with admin specialist-grouped view, SessionDetail reassignment field
- [ ] 15-03-PLAN.md -- Human verification of all session assignment requirements

### Phase 16: Session Lifecycle
**Goal**: Sessions flow through a defined lifecycle -- specialists submit completed work, admin reviews and either edits/exports or returns with notes
**Depends on**: Phase 15
**Requirements**: LIFE-01, LIFE-02, LIFE-03, LIFE-04, LIFE-05, LIFE-06
**Success Criteria** (what must be TRUE):
  1. Specialist can submit a completed session, changing its status to "submitted"
  2. Submitted sessions are read-only for the specialist (locked until returned by admin)
  3. Admin can edit item fields directly on submitted sessions during review
  4. Admin can return a submitted session to the specialist with review notes that the specialist can see
  5. Only admin can export session data as JSON; specialists do not see or have access to the export function
**Plans:** 4/4 plans complete
Plans:
- [x] 16-00-PLAN.md -- Wave 0: test stub files for session-lifecycle, return-dialog, and use-user-role
- [x] 16-01-PLAN.md -- useUserRole hook, lifecycle session hooks, ReturnDialog component, SessionCard status pills, Sessions page lifecycle sections
- [x] 16-02-PLAN.md -- SessionDetail lifecycle controls (submit in header, read-only lock, admin review buttons in header, banners, export gating)
- [x] 16-03-PLAN.md -- Human verification of complete lifecycle workflow

### Phase 17: Deployment & CI
**Goal**: App is deployed to production on Vercel with automated quality gates and security hardening
**Depends on**: Phase 16
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04
**Success Criteria** (what must be TRUE):
  1. App is deployed to Vercel at a production URL and pushing to main triggers an automatic deploy
  2. GitHub Actions CI pipeline runs lint, typecheck, test, and build on every PR and blocks merge on failure
  3. Cloudflare Worker CORS origin is restricted to the production Vercel domain (no wildcard)
  4. Branch protection on main requires all CI checks to pass before a PR can be merged
**Plans:** 4/4 plans complete
Plans:
- [x] 17-01-PLAN.md -- Fix source-file ESLint and TypeScript errors (lint/type CI prerequisite)
- [x] 17-02-PLAN.md -- Fix test-file lint errors, delete stale tests, fix failing tests, conditional basicSsl, test script, vercel.json
- [x] 17-03-PLAN.md -- GitHub Actions CI workflow and Cloudflare Worker CORS lockdown with behavioral tests
- [x] 17-04-PLAN.md -- Branch protection via GitHub CLI and end-to-end deployment verification

## Progress

**Execution Order:** Phases execute in numeric order: 11 -> 12 -> 13 -> 14 -> 15 -> 16 -> 17

Note: Phase 14 depends on Phase 12 (not 13). Phases 13 and 14 could theoretically run in parallel, but sequential execution is safer since Phase 14 is high-risk and benefits from stable auth.

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
| 11. Supabase Foundation | v1.1 | 2/2 | Complete | 2026-03-18 |
| 12. Authentication | v1.1 | 3/3 | Complete | 2026-03-18 |
| 13. Account Management | v1.1 | 2/2 | Complete | 2026-03-18 |
| 14. Data Migration | 5/5 | Complete    | 2026-03-20 | - |
| 15. Session Assignment | 3/3 | Complete    | 2026-03-20 | - |
| 16. Session Lifecycle | v1.1 | Complete    | 2026-03-20 | 2026-03-20 |
| 17. Deployment & CI | v1.1 | 4/4 | Complete    | 2026-03-30 |

### Phase 18: Update tutorial/walkthrough to be thorough

**Goal:** Expand the existing 3-step intro walkthrough into a comprehensive, role-aware tutorial that covers the full app workflow, with completion state stored per-user in Supabase
**Depends on:** Phase 17
**Requirements**: WT-01, WT-02, WT-03, WT-04, WT-05, WT-06, WT-07, WT-08
**Success Criteria** (what must be TRUE):
  1. Walkthrough covers the full workflow: create session, choose mode, record items, review/edit, export to Chrome extension
  2. Admin users see shared steps plus admin-specific steps (account management, session assignment, review/export, receipt import)
  3. Specialist users see shared steps plus specialist-specific steps (submit work, review notes)
  4. Walkthrough completion state is stored in Supabase profiles table (not localStorage) and follows user across devices
  5. Back navigation, skip link, and progress counter work correctly
**Plans:** 3/3 plans complete

Plans:
- [x] 18-00-PLAN.md -- Wave 0: test stub files for walkthrough component and walkthrough-status hook
- [x] 18-01-PLAN.md -- Supabase migration (walkthrough_completed + RLS), useWalkthroughStatus hook, step definitions, database types
- [x] 18-02-PLAN.md -- Walkthrough.tsx rewrite, Sessions.tsx gate update, Settings.tsx reset update, uiStore cleanup

### Phase 19: Photo Upload to Supabase Storage with full offline support

**Goal:** Photos upload to Supabase Storage as the server-authoritative store, with local Dexie blobs as cache, a dedicated upload queue with offline support, and one-time migration of existing photos
**Depends on:** Phase 18
**Requirements**: PHOTO-UPLOAD-01, PHOTO-UPLOAD-02, PHOTO-UPLOAD-03, PHOTO-UPLOAD-04, PHOTO-UPLOAD-05, PHOTO-UPLOAD-06, PHOTO-UPLOAD-07, PHOTO-UPLOAD-08
**Success Criteria** (what must be TRUE):
  1. Photos upload to Supabase Storage immediately after capture (fire-and-forget, non-blocking)
  2. A dedicated photo upload queue handles offline queuing, bounded concurrency (2), and exponential backoff retry
  3. Thumbnails show sync status overlay (spinner for uploading, check for uploaded, retry for failed)
  4. Existing Dexie photos are migrated to Storage automatically on app load (background, non-blocking)
  5. Photos display from local Dexie blob when available, falling back to Supabase signed URL
  6. Reconnection drain order is metadata -> photos -> audio
  7. Export reads local blobs first, downloads from Storage when missing
  8. Human verification confirms end-to-end flow
**Plans:** 5/5 plans complete

Plans:
- [x] 19-00-PLAN.md -- Wave 0: test stub files for photo upload queue, migration, and URL fallback
- [x] 19-01-PLAN.md -- Supabase migration (photos table + bucket + RLS), Dexie v8 schema, photo upload queue service
- [x] 19-02-PLAN.md -- PhotoCapture upload trigger, AppLayout drain order, sync status overlay on thumbnails
- [x] 19-03-PLAN.md -- usePhotoUrl hook with signed URL fallback, export Storage download fallback
- [x] 19-04-PLAN.md -- Photo migration service, progress banner, human verification of end-to-end flow

### Phase 20: Fix house session .json import on RFC

**Goal:** House session JSON import in TPC_AI_Cataloger extension fills all text fields, uploads all photos, and handles the Style dropdown -- using the proven PortalUploadController pattern for sequential photo injection
**Depends on:** Phase 19
**Requirements**: D-01, D-02, D-03, D-04, D-05, D-06, D-07
**Success Criteria** (what must be TRUE):
  1. House session import fills all text fields (title, description, condition, estimate, measurements, department) on each RFC item page
  2. House session import uploads all photos from JSON sequentially via FileInjector/UploadDetector before saving
  3. Style dropdown is set to General (value "2") before fields are filled, handling page reload when style changes
  4. Import walks forward using Next button, falls back to Add when Next is unavailable
  5. Import state recovers across page reloads (style-set, photo upload mid-item, save, navigate)
  6. Export side (TPC_App) produces correct JSON with base64 photo data URLs
**Plans:** 2/2 plans complete

Plans:
- [x] 20-01-PLAN.md -- Constants + manifest update, importController state machine refactor with photo upload and style handling
- [x] 20-02-PLAN.md -- Export-side verification, human E2E verification of full import pipeline

### Phase 21: more granularity with description and transcription

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 20
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 21 to break down)
