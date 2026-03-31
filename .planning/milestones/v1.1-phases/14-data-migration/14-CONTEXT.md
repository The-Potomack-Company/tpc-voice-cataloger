# Phase 14: Data Migration - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Session and item metadata moves from Dexie (IndexedDB) to Supabase Postgres as the server-authoritative source of truth. Dexie retains only audio blobs and photos. Pages read/write sessions and items via Supabase. Offline create/edit is supported via a write-ahead queue that syncs on reconnect. Zustand persist keys are scoped per user to prevent state leakage between logins.

This phase does NOT add session assignment (Phase 15), session lifecycle workflows (Phase 16), or account management (Phase 13).

</domain>

<decisions>
## Implementation Decisions

### Migration strategy
- **Auto-migrate on first login**: After first successful login, automatically push all existing Dexie session/item metadata to Supabase in the background
- **Blocking splash with progress**: Show a full-screen "Migrating your data..." message with progress indicator (e.g., "12 of 45 items") during migration. User cannot interact until complete
- **Delete Dexie metadata after success**: Once Supabase confirms the data, remove session/item metadata from Dexie. Only audio blobs and photos remain in Dexie
- **ID mapping table in Dexie**: Create a small Dexie table mapping old integer itemId to new Supabase UUID. Audio/photo blobs keep their original integer itemId references. Lookup chain: Supabase UUID -> mapping table -> Dexie integer -> blob
- Migration is a one-time operation per device

### Data access layer
- **Replace in-place**: Rewrite `src/db/sessions.ts` and `src/db/items.ts` to call Supabase instead of Dexie. Update `src/hooks/useSessions.ts` to read from Zustand. Dexie imports remain only for audio/photo blob access
- **Zustand store + fetch for reactivity**: Create a Zustand session/item store. Pages read from the store (reactive). Mutations call Supabase, then update the store. No Supabase Realtime subscriptions needed for this phase
- **Unified Item type**: Single `Item` interface with `mode: 'house' | 'sale'` and nullable `receiptNumber`. Replaces separate `HouseVisitItem` and `SaleItem` types. Matches the unified Postgres `items` table
- **Full lifecycle statuses**: Update Session type to use all 4 statuses from Postgres now: `'active' | 'submitted' | 'returned' | 'exported'`. Phase 16 won't need to change the type

### Offline & caching
- **Write-ahead queue for offline writes**: Creates/edits go to a local queue when offline. Items appear immediately in Zustand with an "unsynced" marker. Queue replays to Supabase on reconnect (same fire-and-forget pattern as audio offline queue)
- **Zustand persists last-fetched data**: Session/item data cached in localStorage via Zustand persist. Offline users see their sessions as of last sync plus any locally-queued changes
- **Separate queues**: Write-ahead queue for session/item CRUD is a new module. Audio offline queue stays as-is but writes AI results to Supabase instead of Dexie. Ordering enforced by processing write-ahead queue first on reconnect (items must exist in Supabase before AI can update them)
- **Offline flow**: Record audio offline -> queue audio -> come online -> write-ahead queue syncs item to Supabase -> audio queue fires -> AI processes -> fields appear in Supabase
- **Conflict resolution**: Last-write-wins (acceptable for 2-5 person team with assigned sessions)

### Zustand scope
- **User ID in persist key**: Persist keys become `tpc-ui-state-{userId}` and `tpc-sessions-{userId}`. On login, store rehydrates from the correct key. On logout, state cleared from memory (localStorage data stays for next login as that user)
- **Migrate legacy state**: On first login, copy existing `tpc-ui-state` from localStorage to `tpc-ui-state-{userId}`, then delete the old key. Preserves walkthrough completion status

### Claude's Discretion
- Exact write-ahead queue storage mechanism (Dexie table vs localStorage)
- Migration batch size and error retry logic
- Zustand store structure (single store vs separate session/item stores)
- How to handle migration failures for individual items (skip and log vs abort all)
- Exact "unsynced" indicator UI treatment
- Whether to show an "Offline" banner on the Sessions page when disconnected

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` -- INFRA-03 (session/item data is server-authoritative, Dexie retains audio/photos only)

### Phase scope & success criteria
- `.planning/ROADMAP.md` -- Phase 14 goal and 4 success criteria

### Schema reference (Postgres target)
- `src/db/database.types.ts` -- Generated Supabase types: sessions (uuid PK, created_by, assigned_to, status, mode, name, notes, review_notes), items (uuid PK, session_id, mode, all catalog fields)
- `src/lib/supabase.ts` -- Typed Supabase client singleton

### Schema reference (Dexie source)
- `src/db/types.ts` -- Current Session, HouseVisitItem, SaleItem, ItemPhoto, ItemAudio, ExportHistoryRecord types (migration source)
- `src/db/index.ts` -- Dexie v6 schema with 6 tables: sessions, houseVisitItems, saleItems, photos, audio, exportHistory

### Data access layer (to be rewritten)
- `src/db/sessions.ts` -- Session CRUD functions (createSession, updateSession, softDeleteSession, etc.)
- `src/db/items.ts` -- Item CRUD functions (createBlankItem, updateItemField, deleteItem, appendToItemField)
- `src/hooks/useSessions.ts` -- Dexie useLiveQuery hooks for session lists and counts

### Components using Dexie directly (must be updated)
- `src/pages/ItemEntry.tsx` -- useLiveQuery for session, item, totalItems, photos, previousItem
- `src/pages/SessionDetail.tsx` -- useLiveQuery for queuedCount
- `src/components/ItemList.tsx` -- useLiveQuery for items by sessionId
- `src/components/ItemCard.tsx` -- useLiveQuery for audioData, photoCount
- `src/components/PhotoCapture.tsx` -- useLiveQuery for photos
- `src/components/RecordingsList.tsx` -- useLiveQuery for recordings
- `src/components/ExportHistoryList.tsx` -- useLiveQuery for exports
- `src/components/RecordButton.tsx` -- Direct Dexie table access for AI status update

### Offline queue (to be adapted)
- `src/hooks/useOfflineQueue.ts` -- Existing audio offline queue pattern (reference for write-ahead queue design)

### Zustand stores (to be scoped)
- `src/stores/uiStore.ts` -- Persist key `tpc-ui-state` with hasCompletedWalkthrough, recordingSessionId
- `src/stores/authStore.ts` -- Auth store (no persist, provides user ID for key scoping)

### Prior phase decisions
- `.planning/phases/11-supabase-foundation/11-CONTEXT.md` -- UUID PKs, unified items table, profiles table, RLS policies
- `.planning/phases/12-authentication/12-CONTEXT.md` -- Auth store architecture, Supabase session management

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/supabase.ts`: Typed Supabase client with `Database` generic -- ready for queries
- `src/stores/authStore.ts`: Provides `user.id` for per-user key scoping and `created_by` on new sessions
- `src/hooks/useOfflineQueue.ts`: Existing offline queue pattern -- reference architecture for the new write-ahead queue
- `src/components/ConfirmDialog.tsx`: Reusable for migration confirmation if needed

### Established Patterns
- **Zustand persist**: `uiStore.ts` uses `persist` middleware with `partialize` -- same pattern for new session/item store
- **Fire-and-forget processing**: Audio queue processes items without blocking UI -- write-ahead queue should follow same pattern
- **Data access modules**: `db/sessions.ts` and `db/items.ts` centralize all CRUD -- clean replacement targets
- **useLiveQuery pattern**: ~10 components use this for reactive Dexie reads -- all must switch to Zustand selectors

### Integration Points
- `src/pages/Sessions.tsx` -- Reads from `useActiveSessions`, `useCompletedSessions`, `useArchivedSessions` hooks
- `src/pages/SessionDetail.tsx` -- Reads session + items, writes via `updateSession`, `createBlankItem`
- `src/pages/NewSession.tsx` -- Calls `createSession`, `createBlankItem`
- `src/pages/ItemEntry.tsx` -- Heavy Dexie usage: session, item, photos, totalItems, previousItem queries
- `src/pages/Settings.tsx` -- Calls `restoreSession`, `permanentlyDeleteSession`
- `vite.config.ts` -- PWA/Workbox config (no changes expected)

</code_context>

<specifics>
## Specific Ideas

- Migration splash should be a simple full-screen overlay -- not a separate route. Consistent with the app's existing minimal aesthetic.
- Write-ahead queue should feel invisible to the user -- items appear immediately with optimistic updates, sync status is subtle (not disruptive).
- The ID mapping table in Dexie should be lightweight -- just `{oldId: number, newId: string, type: 'session' | 'item'}`. Queried when loading audio/photos for a Supabase item.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 14-data-migration*
*Context gathered: 2026-03-18*
