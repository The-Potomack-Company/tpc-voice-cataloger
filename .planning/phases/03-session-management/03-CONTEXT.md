# Phase 3: Session Management - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Create, save, resume, and auto-save sessions across browser close and power loss. Auctioneers can start a session, close the browser mid-house-visit, reopen the app, and continue exactly where they left off. No cataloging modes (Phase 4), no AI processing (Phase 5), no export (Phase 6) — just session CRUD, persistence, and recovery.

</domain>

<decisions>
## Implementation Decisions

### Session creation flow
- Name is required — user must name the session before starting
- Mode picker (house visit vs sale) from Phase 1 design
- Optional notes field for anything they want to add
- After creation, drop straight into the first item recording screen — no intermediate summary
- If user taps "New" while an active session exists, warn them ("You have an open session — start a new one anyway?")

### Session list & resuming
- Sorted by most recent first (by `updatedAt`)
- Active and completed sessions displayed in separate sections — active on top, completed below
- Search bar at top to filter sessions by name
- Tapping a session opens a session detail screen (item list, metadata) — not straight into recording
- Swipe-to-delete with double confirmation dialog
- Soft delete — deleted sessions recoverable from Settings page
- Session name editable from both long-press on list and inside session detail screen
- Notes field editable anytime from session detail screen

### Auto-save & crash recovery
- Save on meaningful events: item added, item deleted, session name/notes edited, recording saved
- No visual save indicator — silent like Google Docs
- On app reopen, always land on sessions list (not auto-resume)
- If a recording was in progress when browser closed/crashed, flag that session with an interrupted indicator so user knows an item may have lost audio

### Session lifecycle
- Explicit status: "Active" and "Completed" — user manually marks a session complete
- Completing a session moves it to the completed section on the list
- Completed sessions can be reopened with a confirmation dialog ("This session was marked complete. Reopen it?")
- No automatic completion — user decides when they're done

### Claude's Discretion
- Session detail screen layout and information hierarchy
- Search bar implementation details (debounce, highlight matching)
- Soft-delete recovery UI in Settings
- Interrupted session flag visual treatment
- Swipe gesture implementation and double-confirm dialog design
- Dexie schema migration for new Session fields (status, notes, deletedAt)
- Session creation form layout and validation

</decisions>

<specifics>
## Specific Ideas

- Sessions list should feel like a simple productivity app — not cluttered (carried from Phase 1)
- 300+ items per session is common for house visits — detail screen must handle long item lists
- The warn-on-new-while-active pattern prevents orphaned sessions from auctioneers who forget to complete

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Session` type in `src/db/types.ts` — already has `id, name, mode, createdAt, updatedAt` (needs `notes`, `status`, `deletedAt` fields added)
- Dexie `sessions` table with indexes on `mode, createdAt` — needs `status` index added
- `HouseVisitItem` and `SaleItem` types with `sessionId` foreign key — item-to-session relationship already defined
- `SessionsPage` in `src/pages/Sessions.tsx` — has empty state with "Start New Session" CTA, ready to be wired up
- `NewSession` page in `src/pages/NewSession.tsx` — exists as placeholder for creation flow
- Zustand store pattern established in `src/stores/uiStore.ts`
- Bottom tab bar and React Router v7 routing in place

### Established Patterns
- Dexie/IndexedDB as sole source of truth — all state persisted immediately, never held in React state only
- Auto-increment integer PKs (not UUID)
- Zustand for UI state management
- Tailwind CSS 4 with @theme blocks
- Dark mode via system preference

### Integration Points
- Session CRUD wires into existing Dexie `sessions` table
- Sessions list replaces the current empty state in `SessionsPage`
- "New" tab creation flow builds on existing `NewSession` page
- Phase 2 audio recording will be wrapped into session context (items belong to sessions)
- Phase 4 (Cataloging Modes) will add mode-specific item creation within sessions
- Phase 6 (Export) will read session + items for JSON export

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-session-management*
*Context gathered: 2026-03-06*
