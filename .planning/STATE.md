---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Accounts & Deploy
status: executing
stopped_at: Completed 14-05-PLAN.md
last_updated: "2026-03-20T15:00:00.000Z"
last_activity: 2026-03-20 -- Fixed 4 UAT gaps (photo nav, race condition, 406 on delete, 400 on complete)
progress:
  total_phases: 8
  completed_phases: 4
  total_plans: 23
  completed_plans: 12
  percent: 52
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-17)

**Core value:** Auctioneers can dictate catalog entries by voice and get structured, accurate auction catalog data faster than typing -- with entries flowing directly into RFC Invaluable.
**Current focus:** v1.1 Accounts & Deploy -- Phase 14 (Data Migration) Plan 05 complete (gap closure)

## Current Position

Phase: 14 of 17 (Data Migration)
Plan: 5 of 5
Status: Phase 14 UAT gaps closed -- 4 fixes applied and migration pushed
Last activity: 2026-03-20 -- Fixed 4 UAT gaps (photo nav, race condition, 406 on delete, 400 on complete)

Progress: [█████░░░░░] 52%

## Performance Metrics

**Velocity (from v1.0):**
- Total plans completed: 28
- Average duration: ~5 min
- Total execution time: ~2.4 hours

**Recent Trend:**
- v1.0 averaged ~5 min/plan across 27 plans
- 14-01: 6 min (2 tasks, 8 files)
- 14-02: 7 min (2 tasks, 11 files)
- 14-03: 5 min (2 tasks, 7 files)
- 14-04: 12 min (2 tasks, 15 files)
- 14-05: 4 min (2 tasks, 5 files)
- Trend: Stable (14-05 gap closure)

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

### Pending Todos

None yet.

### Blockers/Concerns

- ~~[Pre-Phase 14] Dexie-to-Supabase ID mapping strategy needs concrete design before implementation~~ RESOLVED in 14-01 (idMapping table + utility functions)
- [Pre-Phase 14] Offline session display strategy needs decision -- what data is cached locally when server is unreachable
- ~~[Pre-Phase 12] Service worker must exclude Supabase API routes from caching before first auth request reaches the browser~~ RESOLVED in 12-01

### Roadmap Evolution

- Phases 11-17 added for v1.1 Accounts & Deploy milestone
- Phase 18 added: Update tutorial/walkthrough to be thorough

## Session Continuity

Last session: 2026-03-20T15:00:00.000Z
Stopped at: Completed 14-05-PLAN.md
Resume file: .planning/phases/14-data-migration/14-05-SUMMARY.md
