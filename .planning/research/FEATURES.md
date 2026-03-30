# Feature Research: Accounts, Auth & Session Assignment

**Domain:** Role-based session management for internal auction cataloging tool
**Researched:** 2026-03-17 (updated with concrete stack: Better Auth admin/username plugins)
**Confidence:** HIGH

## Context

This covers NEW features for v1.1 only. v1.0 features (cataloging modes, AI pipeline, export, offline queue, archiving) are shipped and working. v1.1 introduces server-side state for the first time.

## Feature Landscape

### Table Stakes (Must Exist for Multi-User Workflow)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Username/password login | Only auth method for 2-5 internal users. PROJECT.md rules out OAuth/SSO. | LOW | Better Auth username plugin handles this. `authClient.signIn.username({ username, password })`. No email verification needed. |
| Two roles: admin and specialist | Entire workflow hinges on this split. | LOW | Better Auth admin plugin provides `admin` and `user` roles by default. Map `user` -> "Specialist" in UI labels. |
| Admin creates specialist accounts | Specialists do not self-register. Admin provisions accounts. | LOW | `authClient.admin.createUser({ name, username, password, role: 'user' })`. Admin-only UsersPage. |
| Admin creates sessions and assigns to specialists | Core assignment workflow. | MEDIUM | Extends existing NewSessionPage with assignee dropdown. POST to `/api/sessions` with `assignedTo`. |
| Specialist sees only assigned + own sessions | Scoped visibility prevents cross-specialist data access. | MEDIUM | Server filters: `WHERE assignedTo = currentUser OR createdBy = currentUser`. Admin sees all. |
| Session submission by specialist | Specialist marks session "submitted" for admin review. | LOW | New status value. POST `/api/sessions/:id/submit`. Button on SessionDetailPage (specialist only). |
| Admin review of submitted sessions | Admin views submitted sessions, reviews items, edits inline. | MEDIUM | Reuses existing `EditableField` component. "Submitted" section on SessionsPage. |
| Admin sends session back with feedback | Return to specialist with correction notes. | LOW | POST `/api/sessions/:id/return { notes }`. Status -> "returned". Notes displayed as banner. |
| Only admin can export JSON | Export is the final gate. | LOW | UI hides export button for non-admin. Server enforces role check on export endpoint. |
| Admin can edit submitted sessions directly | Fix minor issues without round-tripping. | LOW | Reuse existing inline edit. Admin has edit access regardless of status. |
| Persistent login across browser close | Should not re-enter credentials each time. | LOW | Better Auth uses httpOnly session cookies with 7-day expiry. Automatic. |
| Logout | Sign out, especially on shared devices. | LOW | `authClient.signOut()`. Better Auth clears session cookie server-side. |

### Differentiators (Quality of Life)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "Returned" status with review notes | Admin attaches specific feedback ("re-record item 3") so specialist knows what to fix. | LOW | Single text field on send-back action. Banner on SessionDetailPage. |
| Session status badges with color coding | Visual distinction: Active (green), Submitted (blue), Returned (amber), Approved (gray). | LOW | Extends existing badge pattern in `SessionCard.tsx`. |
| Admin dashboard with submission queue | Dedicated view of sessions awaiting review, sorted by submission time. | MEDIUM | New section on SessionsPage. Surfaces actionable work. |
| Specialist name on session cards | Admin sees assignee without opening session. | LOW | Add username to `SessionCard`. |
| Password change (self-service) | Specialists update own password without bothering admin. | LOW | Settings page form. Better Auth supports password update via `authClient.changePassword()`. |
| Session reassignment | Admin changes assigned specialist on active session. | LOW | Dropdown on SessionDetailPage (admin only). PUT to update `assignedTo`. |

### Anti-Features (Do NOT Build)

| Feature | Why Problematic | Alternative |
|---------|-----------------|-------------|
| Full RBAC permission system | 2 roles for 2-5 people. Permission matrix is massive over-engineering. | Better Auth admin plugin's built-in `admin`/`user` roles. |
| Email-based account recovery | No email infrastructure. 2-5 people in same office. | Admin resets password via `authClient.admin.setUserPassword()`. Walk down the hall. |
| Self-registration / sign-up page | Internal tool. Open registration is a security risk. | Admin creates accounts manually. |
| OAuth / SSO | Explicitly out of scope per PROJECT.md. | Username/password via Better Auth username plugin. |
| Real-time notifications (WebSocket) | 2-5 concurrent users. Not worth the infrastructure. | Session list refreshes on page load. Manual refresh button. |
| Multi-level approval chain | One admin, 2-4 specialists. Single gate is the workflow. | Single admin review: submitted -> approved/returned. |
| Per-item submit/review granularity | Session is the unit of work for export. Item-level creates partial-approval complexity. | Review at session level. Admin edits individual items within submitted session. |
| Offline authentication | Auth requires server. Allowing offline login means trusting cached credentials. | Require online for login. Once authenticated, session cookie persists. Offline recording still works. |
| Specialist-to-specialist session transfer | Bypasses admin oversight. | Specialist asks admin to reassign. |

## Feature Dependencies

```
[Better Auth Setup (server + client)]
    |
    +--enables--> [Username/Password Login]
    |                 |
    |                 +--enables--> [Role-Based UI Filtering]
    |                                   |
    |                                   +--enables--> [Specialist Scoped View]
    |                                   +--enables--> [Admin-Only Export]
    |
    +--enables--> [Admin Account Management]
                      |
                      +--enables--> [Specialist Account Provisioning]

[Hono API + Drizzle + Neon Setup]
    |
    +--requires--> [Better Auth Setup] (auth middleware)
    |
    +--enables--> [Session CRUD Endpoints]
                      |
                      +--enables--> [Session Assignment (admin assigns)]
                      |                 |
                      |                 +--requires--> [Specialist accounts exist]
                      |                 +--requires--> [Existing receipt import flow]
                      |
                      +--enables--> [Session Submission Workflow]
                                        |
                                        +--enables--> [Admin Review Queue]
                                        +--enables--> [Send Back with Notes]
                                        +--enables--> [Server-Side Export]
```

## Impact on Existing v1.0 Features

| Existing Feature | Impact | Migration Path |
|-----------------|--------|----------------|
| Session creation | Admin-only for assigned sessions; specialist can create own | POST to API instead of Dexie. Add `assignedTo` field for admin. |
| Session list | Must filter by user role | Fetch from API instead of Dexie `useLiveQuery`. Server filters by role. |
| Session detail | New actions: Submit (specialist), Approve/Return (admin) | Fetch from API. Add role-conditional buttons. |
| Export | Admin-only, server-side | Fetch export JSON from `/api/sessions/:id/export` instead of Dexie. |
| Receipt import | Same parsing, different storage target | `importReceipts.ts` parsing stays. Items POST to API instead of Dexie. |
| Item recording | Unchanged -- still writes to local Dexie | Add sync bridge to push AI results to server after processing. |
| Offline queue | Unchanged -- still works for AI processing | No change. Auth cookie persists for offline period. |
| Session archiving | Admin archives after export | Call API instead of Dexie. Same UX. |

## MVP Recommendation (v1.1 Scope)

### Must Have for v1.1

- [ ] Hono API + Drizzle + Neon Postgres setup
- [ ] Better Auth with username + admin plugins
- [ ] Login page with username/password
- [ ] Admin creates and manages specialist accounts
- [ ] Admin creates sessions with specialist assignment
- [ ] Specialist scoped session view (assigned + own)
- [ ] Session submission by specialist
- [ ] Admin review: view submitted sessions, edit items, approve or send back
- [ ] Send back with review note
- [ ] Admin-only export (server-side)
- [ ] Vercel deployment with auto-deploy from main
- [ ] CI pipeline (lint, typecheck, test, build)
- [ ] Cloudflare Worker CORS lockdown

### Add Shortly After (v1.1.x)

- [ ] Password change (self-service)
- [ ] Session reassignment
- [ ] Admin submission queue/dashboard view

### Defer (v1.2+)

- [ ] Bulk session assignment (split receipt list)
- [ ] Activity log / audit trail
- [ ] Photo upload to server (currently stays in Dexie)

## Workflow Reference

### The Happy Path

```
Admin logs in
  -> Imports receipt CSV (existing feature, now goes to API)
  -> Creates session with name, mode, notes (existing flow, now via API)
  -> Assigns session to Specialist A (NEW: assignee dropdown)
  -> Session status: "active"

Specialist A logs in
  -> Sees assigned session in their list (NEW: filtered view)
  -> Opens session, records items (existing: audio -> Dexie -> AI)
  -> AI results sync to server (NEW: sync bridge)
  -> Reviews and edits AI output (existing inline edit)
  -> Clicks "Submit for Review" (NEW)
  -> Session status: "submitted"

Admin logs in
  -> Sees session in "Submitted" section (NEW)
  -> Opens session, reviews items (existing inline edit UI)
  -> Option A: Approves -> Exports JSON (server-side export)
  -> Option B: Sends back with note -> Session status: "returned" (NEW)

If sent back:
  Specialist A sees "Returned" session with admin note (NEW)
  -> Makes corrections
  -> Re-submits
  -> Cycle repeats until approved
```

### Edge Cases

| Scenario | Resolution |
|----------|-----------|
| Specialist creates own session (not assigned by admin) | Allowed. Has `createdBy` but no `assignedTo`. Can still submit. |
| Admin creates session without assigning | Allowed. Admin works it themselves. No submission needed. |
| Specialist tries to export | UI hides button. Server returns 403. |
| Admin edits active session (not submitted) | Allowed. Admin has full access. |
| Multiple specialists on same session | Not supported. One specialist per session. Split into multiple sessions. |

## Sources

- [Better Auth Admin Plugin](https://better-auth.com/docs/plugins/admin) -- role field, createUser, role-based access (HIGH confidence)
- [Better Auth Username Plugin](https://better-auth.com/docs/plugins/username) -- username sign-in (HIGH confidence)
- Codebase analysis: `src/db/types.ts`, `src/db/sessions.ts`, `src/pages/Sessions.tsx`, `src/pages/SessionDetail.tsx`, `src/pages/NewSession.tsx`, `src/utils/export.ts`

---
*Feature research for: TPC Speech Cataloger v1.1 -- Accounts, Auth & Session Assignment*
*Researched: 2026-03-17*
