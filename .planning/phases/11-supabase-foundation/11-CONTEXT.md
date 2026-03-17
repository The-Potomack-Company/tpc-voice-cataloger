# Phase 11: Supabase Foundation - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Supabase project is configured with Postgres schema and RLS policies, and the client SDK is installed in the app. This phase delivers the backend infrastructure: tables, RLS, profiles, and the client library wired up with environment variables. Authentication UI, data migration, and assignment logic are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Table structure
- **Items:** Single unified `items` table with a `mode` column ('house' | 'sale') and a nullable `receipt_number`. No separate `house_visit_items` / `sale_items` tables.
- **Sessions status:** Expanded to cover full lifecycle — `'active' | 'submitted' | 'returned' | 'exported'`. Single source of truth for session state.
- **Review notes:** `review_notes` text column on the `sessions` table. Overwritten each time admin returns a session (not a history/audit trail).
- **Sessions new columns:** `created_by uuid` (FK to auth.users), `assigned_to uuid nullable` (FK to auth.users).

### Role storage
- `profiles` table in the public schema: `id` (uuid, FK to auth.users), `role` ('admin' | 'specialist'), `display_name` (text, required), `is_active` (boolean), `created_at`.
- RLS policies join to `profiles` to check the current user's role — not JWT app_metadata.
- `display_name` is required at account creation (not optional / email fallback).

### ID strategy
- All Postgres PKs use UUIDs via `gen_random_uuid()` — sessions, items, export_history, profiles all use uuid PKs.
- Dexie auto-increment integer IDs are NOT preserved — Phase 14 migration generates fresh UUIDs for all migrated rows.
- This is intentional: Dexie IDs are local-only and have no cross-user meaning.

### Development setup
- Cloud Supabase project from day 1 (no local Docker / Supabase CLI local stack required).
- Credentials stored as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` (gitignored).
- SQL migration files checked into git (e.g., `supabase/migrations/` or `sql/`) so schema is versioned and reviewable.
- Supabase CLI used to generate TypeScript types (`supabase gen types typescript`) — typed Supabase client, not hand-written interfaces.

### Claude's Discretion
- Exact SQL file naming and directory structure (supabase/migrations/ vs sql/)
- Whether to use `supabase/config.toml` CLI project or just raw SQL files
- Specific RLS policy names and whether to use helper functions (e.g., `is_admin()`)
- Timestamps: `timestamptz` with `now()` defaults (standard Supabase practice)
- Whether to add indexes beyond PKs and FKs in Phase 11 (e.g., on sessions.assigned_to)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §v1.1 Backend Infrastructure — INFRA-01, INFRA-02 (the two requirements this phase covers)
- `.planning/REQUIREMENTS.md` §v1.1 Authentication — AUTH-01..04 (Phase 12, but schema must support it — profiles table, auth.users FK)

### Existing schema (Dexie, for reference during Postgres schema design)
- `src/db/types.ts` — Current Session, HouseVisitItem, SaleItem, ItemPhoto, ItemAudio, ExportHistoryRecord types
- `src/db/index.ts` — Dexie version history and index definitions

### Project decisions
- `.planning/PROJECT.md` §Key Decisions — Supabase choice rationale, Dexie retains audio/photos only
- `.planning/STATE.md` §Blockers/Concerns — ID mapping strategy note (relevant to UUID decision made here)

No external ADRs or design docs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/db/types.ts` — Existing TypeScript interfaces for Session, HouseVisitItem, SaleItem, ItemPhoto, ItemAudio. These define the field set that Postgres tables must cover (with additions for role/assignment).
- `src/db/index.ts` — Dexie schema history; shows how the schema evolved. Useful for understanding what fields exist and what's indexed.

### Established Patterns
- No Supabase SDK installed yet — `package.json` has no `@supabase/supabase-js` dependency. Phase 11 installs it fresh.
- Env vars: app currently uses `VITE_GEMINI_API_KEY` pattern — Supabase vars should follow the same `VITE_` prefix convention.
- TypeScript strict mode — generated Supabase types will fit naturally into the existing strict TS setup.

### Integration Points
- `src/db/index.ts` — Supabase client will be a peer to Dexie's `db` export (not a replacement). Phase 14 shifts session/item reads to Supabase; Phase 11 just installs and configures the client.
- `vite.config.ts` — No changes needed for Supabase; just env vars in `.env.local`.

</code_context>

<specifics>
## Specific Ideas

No specific UI or interaction references for this phase — it's pure infrastructure. Decisions are structural (schema, types, config).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-supabase-foundation*
*Context gathered: 2026-03-17*
