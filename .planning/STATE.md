---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Accounts & Deploy
status: verifying
stopped_at: Phase 20 context gathered
last_updated: "2026-03-30T15:19:29.897Z"
last_activity: 2026-03-30
progress:
  total_phases: 10
  completed_phases: 9
  total_plans: 31
  completed_plans: 31
  percent: 87
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-17)

**Core value:** Auctioneers can dictate catalog entries by voice and get structured, accurate auction catalog data faster than typing -- with entries flowing directly into RFC Invaluable.
**Current focus:** Phase 17 — deployment-ci

## Current Position

Phase: 18
Plan: Not started
Status: Phase complete — ready for verification
Last activity: 2026-03-30

Progress: [█████████░] 87%

## Performance Metrics

**Velocity (from v1.0):**

- Total plans completed: 29
- Average duration: ~5 min
- Total execution time: ~2.4 hours

**Recent Trend:**

- v1.0 averaged ~5 min/plan across 27 plans
- 14-01: 6 min (2 tasks, 8 files)
- 14-02: 7 min (2 tasks, 11 files)
- 14-03: 5 min (2 tasks, 7 files)
- 14-04: 12 min (2 tasks, 15 files)
- 14-05: 4 min (2 tasks, 5 files)
- 15-01: 5 min (2 tasks, 7 files)
- 15-02: 6 min (2 tasks, 5 files)
- 16-00: 2 min (1 task, 4 files)
- 16-01: 5 min (2 tasks, 5 files)
- 16-02: 4 min (2 tasks, 3 files)
- 16-03: 3 min (1 task, 2 files) -- human verification + UAT fixes
- 18-00: 1 min (1 task, 3 files) -- walkthrough test stubs
- 18-01: 3 min (2 tasks, 4 files) -- walkthrough data layer
- 18-02: 4 min (3 tasks, 4 files) -- walkthrough component rewrite
- 19-00: 2 min (2 tasks, 4 files) -- photo upload test stubs
- 19-01: 3 min (2 tasks, 5 files) -- photo upload infrastructure
- 19-02: 3 min (2 tasks, 4 files) -- UI integration (upload trigger, sync overlays)
- 19-03: 5 min (2 tasks, 6 files) -- URL fallback (signed URL display, export Storage download)
- 19-04: 15 min (2 tasks, 7 files) -- Photo migration service + E2E verification (includes human checkpoint)
- Trend: Stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v1.1] Supabase chosen over Hono + Better Auth + Drizzle + Neon -- user familiar with Supabase, future dashboard reads from same DB, fewer moving parts
- [v1.1] Dexie retains audio blobs and photos only; all session/item metadata moves to Supabase Postgres
- [v1.1] Supabase Auth handles login, sessions, roles (replaces Better Auth)
- [v1.1] RLS policies enforce role-based access server-side (replaces Hono middleware)
- [11-01] CHECK constraints on text columns for status/mode/role (no Postgres ENUMs)
- [11-01] Indexes on sessions.created_by, sessions.assigned_to, items.session_id for RLS performance
- [11-01] vi.stubEnv for Vitest env var mocking (esbuild transform limitation with import.meta.env assignment)
- [11-02] --linked flag required for supabase gen types when project is CLI-linked
- [11-02] Insertable/Updatable type aliases appended to generated types for backward compatibility
- [11-02] Consolidated .env into .env.local (all env vars in one gitignored file)
- [12-01] vi.hoisted() for mock variable hoisting in Vitest (required for vi.mock factory pattern)
- [12-01] Auth store uses no persist middleware (Supabase handles its own localStorage session persistence)
- [12-01] PWA config tests in separate pwa-config.test.ts alongside existing pwa-manifest.test.ts
- [12-02] useAuthStore selector pattern (s) => s.signIn for minimal re-renders in LoginPage
- [12-02] Error text displayed verbatim from Supabase -- no error type differentiation (Pitfall 4)
- [12-03] Validation order: min length check before password match check (fail fast on simpler condition)
- [13-01] Separate Edge Functions per operation (create, update, list) for independent deployability
- [13-01] Email column added to profiles (nullable) for efficient account listing
- [13-01] AdminRouteGuard queries profiles directly rather than extending authStore with profile data
- [13-01] Dual-layer deactivation: ban_duration on auth.users + is_active on profiles for defense in depth
- [13-02] Optimistic toggle updates with error revert for deactivation/reactivation
- [13-02] Settings queries profiles table for admin role detection (same pattern as AdminRouteGuard)
- [13-02] Inline expandable form with Discard toggle for specialist account creation
- [14-01] Compound index [newId+type] on idMapping for efficient lookup queries
- [14-01] Optimistic updates with revert-on-error pattern for all sessionStore mutation actions
- [14-01] Per-user persist scoping via setOptions + rehydrate (not store recreation)
- [14-02] getSessionById is synchronous (reads from in-memory Zustand store, not async Dexie query)
- [14-02] Removed soft-delete/archive functions; useDeletedSessions and useArchivedSessions return empty arrays
- [14-02] processAudioWithAi signature changed to (audioId, itemId: string, sessionId: string) for UUID compatibility
- [14-02] Export reads session/items from Supabase, photos/audio from Dexie via getDexieItemId bridge
- [14-03] Migration skips soft-deleted sessions; continues on individual item insert errors
- [14-03] Write-ahead queue stops on first failure to preserve FIFO ordering
- [14-03] AppLayout processes write-ahead queue BEFORE audio queue on reconnect
- [14-04] SessionCard updated to accept Tables<'sessions'> type (blocking dependency for Sessions.tsx)
- [14-04] ItemEntry.tsx retains useLiveQuery for photos (blobs stay in Dexie, ID mapping bridges lookups)
- [14-04] useAudioRecorder stores string UUID as Dexie itemId (Dexie accepts both number and string)
- [14-04] Removed archive/unarchive/soft-delete UI entirely (no soft-delete in Supabase schema)
- [14-fix] Replaced useShallow with useMemo in useSessions hooks -- useShallow causes infinite loop when persist middleware rehydrates (JSON.parse creates new object references)
- [14-fix] Optimistic createItem uses ai_status='pending' (not 'none') to match Supabase CHECK constraint
- [14-05] Photo queries use dexieItemId ?? itemId fallback to eliminate async race condition
- [14-05] gemini.ts uses .maybeSingle() + null bail-out for deleted items during AI processing
- [15-01] useUserRole hook extracted from AdminRouteGuard pattern for reuse across Sessions, NewSession, SessionDetail
- [15-01] Auto-assign sessions to current user when specialist (assignedTo defaults to userId in sessions.ts)
- [15-01] SessionCard admin variant uses optional props for backward compatibility (specialist view unchanged)
- [15-02] useNameMap hook called unconditionally (React hook rules) -- only admin uses the result
- [15-02] Admin reassignment uses sessionStore.updateSession directly (accepts full Partial including assigned_to)
- [15-02] Specialist view code kept exactly as-is with no modifications to spacing or structure
- [15-03] Admins skip "active session exists" warning (they always create while others are active)
- [15-03] "Unassigned" group sorted last in specialist grouping (not alphabetically)
- [15-03] Removed per-card "Assigned to" label -- collapsible group headers provide context
- [15-03] UUID-to-name resolution shows "Loading..." placeholder during fetch
- [16-01] Replaced useCompletedSessions with three individual lifecycle hooks (useSubmittedSessions, useReturnedSessions, useExportedSessions)
- [16-01] Removed useArchivedSessions entirely (no archive concept in Supabase schema)
- [16-01] SessionCard status pills reuse statusColors/statusLabels maps instead of inline ternary chains
- [16-01] Specialist Active section uses dynamic mt-6/mt-8 based on Needs Attention section visibility
- [16-02] Lifecycle buttons (Submit, Export, Return) placed in SessionDetail header area; Delete remains at bottom
- [16-02] Replaced direct db/sessions updateSession with sessionStore.updateSession for optimistic updates
- [16-02] isLifecycleLocked: specialist + submitted/exported = locked; admin never locked by status
- [16-02] ~~Export skips confirmation dialog (admin-only, direct action)~~ Reversed in 16-03 UAT
- [16-03] Export now requires confirmation dialog (UAT feedback -- prevent accidental exports)
- [16-03] Admin can re-export already-exported sessions (no status gate on export button)
- [16-03] Admin can reopen exported sessions back to active status (reversal path for corrections)
- [Phase 18]: RLS self-update policy on profiles allows users to update any column on own row (acceptable: UI does not expose dangerous columns, CHECK constraints protect role values)
- [18-02] Walkthrough receives role and onComplete as props from Sessions.tsx (not internal hook call)
- [18-02] Loading state defaults to showing page content (not walkthrough) to avoid flash for returning users
- [19-01] Photo upload concurrency of 2 (lower than audio queue's 4 due to larger payload size)
- [19-01] Exponential backoff: 4^retryCount * 1000ms (1s, 4s, 16s) with max 3 retries
- [19-01] Storage path convention: photos/{sessionId}/{itemId}/full-{sortOrder}.jpg
- [19-02] Fire-and-forget upload: enqueue + drain chained with .then(), not awaited in handleKeep UI flow
- [19-02] Failed thumbnail tap triggers retryFailedUploads instead of opening lightbox
- [19-03] usePhotoUrl checks blob (not blobUrl) to avoid React effect timing race with useBlobUrl
- [19-03] Export filters to upload_status='uploaded' photos only when downloading from Storage
- [19-03] Failed Storage downloads excluded gracefully (try/catch + null filter) rather than throwing
- [19-04] Migration timestamp renamed 20260320100000 -> 20260320200000 to avoid conflict with walkthrough migration
- [19-04] Storage upload upsert:true for idempotent retries (prevents 409 Conflict on retry)
- [19-04] database.types.ts regenerated UTF-8 to fix UTF-16 encoding build issue
- [Phase 17]: Derive loading state from role===undefined instead of separate boolean to avoid sync setState in effects
- [Phase 17]: useBlobUrl rewritten with useRef+useSyncExternalStore to eliminate sync setState in effects
- [Phase 17]: Deleted 4 stale Dexie test files rather than rewriting (session-store.test.ts covers session CRUD)
- [Phase 17]: item-list.test.tsx fully rewritten with Supabase mock pattern (old Dexie-based test was incompatible)
- [Phase 17]: Conditional basicSsl via defineConfig(({ command }) => ...) for production build compatibility
- [Phase 17]: Exported isAllowedOrigin/getCorsHeaders as named exports for direct unit testing
- [Phase 17]: *.vercel.app suffix match allows all preview deploys without env var updates
- [Phase 17-deployment-ci]: Branch protection (DEPLOY-04) deferred -- GitHub Free plan does not support branch protection on private repos

### Pending Todos

None yet.

### Blockers/Concerns

- ~~[Pre-Phase 14] Dexie-to-Supabase ID mapping strategy needs concrete design before implementation~~ RESOLVED in 14-01 (idMapping table + utility functions)
- [Pre-Phase 14] Offline session display strategy needs decision -- what data is cached locally when server is unreachable
- ~~[Pre-Phase 12] Service worker must exclude Supabase API routes from caching before first auth request reaches the browser~~ RESOLVED in 12-01

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260320-fj2 | House visit mode: navigate-on-tap cards, chevron read-only summary, edge navigation arrows | 2026-03-20 | 65fba78 | Verified | [260320-fj2-house-visit-mode-remove-dropdown-always-](./quick/260320-fj2-house-visit-mode-remove-dropdown-always-/) |
| 260320-ivg | Refresh Zustand store after AI processing so ItemEntry re-renders immediately | 2026-03-20 | eb553e3 | Verified | [260320-ivg-after-ai-finishes-processing-in-house-vi](./quick/260320-ivg-after-ai-finishes-processing-in-house-vi/) |
| 260320-jet | Smart rounding for estimate auto-formatting (log10-based magnitude-aware) | 2026-03-20 | e9d40c8 | Verified | [260320-jet-smart-rounding-for-estimate-autoformatti](./quick/260320-jet-smart-rounding-for-estimate-autoformatti/) |
| Phase 17 P01 | 6min | 2 tasks | 13 files |
| Phase 17 P02 | 12min | 2 tasks | 23 files |
| Phase 17 P03 | 2min | 2 tasks | 6 files |
| Phase 17-deployment-ci P04 | 3min | 1 tasks | 0 files |

### Roadmap Evolution

- Phases 11-17 added for v1.1 Accounts & Deploy milestone
- Phase 18 added: Update tutorial/walkthrough to be thorough
- Phase 19 added: Photo Upload to Supabase Storage with full offline support
- Phase 20 added: Fix house session .json import on RFC

## Session Continuity

Last session: 2026-03-30T15:19:29.891Z
Stopped at: Phase 20 context gathered
Resume file: .planning/phases/20-fix-house-session-json-import-on-rfc/20-CONTEXT.md
