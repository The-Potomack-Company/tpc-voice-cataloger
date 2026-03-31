# Phase 14: Data Migration - Research

**Researched:** 2026-03-18
**Domain:** Dexie-to-Supabase data migration, Zustand state management, offline-first write-ahead queue
**Confidence:** HIGH

## Summary

Phase 14 migrates the source of truth for session and item metadata from Dexie (IndexedDB) to Supabase Postgres. The existing Dexie database uses auto-increment integer IDs across 6 tables (`sessions`, `houseVisitItems`, `saleItems`, `photos`, `audio`, `exportHistory`), while Supabase uses UUID primary keys in a unified `items` table. Audio blobs and photos remain in Dexie, accessed via an ID mapping table that bridges Supabase UUIDs to Dexie integer IDs.

The migration involves three major workstreams: (1) rewriting the data access layer (`db/sessions.ts`, `db/items.ts`, `hooks/useSessions.ts`) to use Supabase queries with Zustand stores for reactivity, (2) building a one-time migration flow that pushes existing Dexie metadata to Supabase on first login, and (3) implementing a write-ahead queue for offline writes with optimistic UI updates. Approximately 10 components use `useLiveQuery` from Dexie and must switch to Zustand selectors.

The existing codebase is well-structured for this change: CRUD is centralized in `db/sessions.ts` and `db/items.ts`, and the typed Supabase client (`src/lib/supabase.ts`) is ready with `Database` generics. The Postgres schema already exists with RLS policies, CHECK constraints, and appropriate indexes.

**Primary recommendation:** Replace Dexie data access in-place, using Zustand stores for reactive reads and Supabase client for server writes. Keep Dexie only for blob storage (audio, photos) and the new ID mapping table.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Migration strategy**: Auto-migrate on first login; blocking splash with progress indicator; delete Dexie metadata after success; ID mapping table in Dexie for blob lookups; migration is one-time per device
- **Data access layer**: Replace in-place (rewrite `db/sessions.ts`, `db/items.ts`, update `hooks/useSessions.ts`); Zustand store + fetch for reactivity; unified `Item` type with `mode: 'house' | 'sale'`; full lifecycle statuses (`active | submitted | returned | exported`)
- **Offline & caching**: Write-ahead queue for offline writes; Zustand persists last-fetched data; separate queues (write-ahead for CRUD, audio stays as-is but writes AI results to Supabase); ordering enforced (write-ahead queue first on reconnect); last-write-wins conflict resolution
- **Zustand scope**: User ID in persist key (`tpc-ui-state-{userId}`, `tpc-sessions-{userId}`); migrate legacy state on first login; on logout state cleared from memory (localStorage stays)

### Claude's Discretion
- Exact write-ahead queue storage mechanism (Dexie table vs localStorage)
- Migration batch size and error retry logic
- Zustand store structure (single store vs separate session/item stores)
- How to handle migration failures for individual items (skip and log vs abort all)
- Exact "unsynced" indicator UI treatment
- Whether to show an "Offline" banner on the Sessions page when disconnected

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-03 | Session/item data is server-authoritative (Dexie retains audio/photos only) | All research sections support this: Supabase CRUD patterns, Zustand store architecture, migration flow, write-ahead queue, ID mapping for blobs |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.99.2 (installed) | Server queries, auth context, typed client | Already configured with Database generics; RLS policies active |
| zustand | 5.0.11 (installed) | Reactive state for sessions/items, persist middleware | Already used for uiStore and authStore; persist middleware for caching |
| dexie | 4.3.0 (installed) | Audio/photo blob storage, ID mapping table | Remains for binary data only; no new dependencies needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dexie-react-hooks | 4.2.0 (installed) | useLiveQuery for audio/photo components | Only for components that still read blobs (PhotoCapture, RecordingsList, ItemCard audio/photo counts) |
| react | 19.2.0 (installed) | Component framework | No changes needed |
| react-router | 7.13.1 (installed) | Routing (session/item IDs change from numeric to UUID in URLs) | Route params change from numeric to string UUIDs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zustand persist for caching | TanStack Query | TanStack Query has better cache invalidation but adds a new dependency and pattern; Zustand is already established in this codebase |
| Dexie table for write-ahead queue | localStorage | localStorage has 5MB limit and no indexing; Dexie table allows structured queries and cursor-based processing; **Recommendation: Use Dexie table** |
| Single Zustand store | Separate session/item stores | Single store is simpler but couples concerns; **Recommendation: Single `sessionStore` with sessions array and items-by-session map** since sessions and items are always accessed together |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  db/
    index.ts              # Dexie v7 schema (add idMapping table, keep audio/photos)
    types.ts              # Keep for Dexie blob types; add IdMapping type
    database.types.ts     # Supabase generated types (unchanged)
    sessions.ts           # REWRITE: Supabase CRUD, returns Supabase types
    items.ts              # REWRITE: Supabase CRUD, returns Supabase types
    migration.ts          # NEW: One-time Dexie->Supabase migration logic
  stores/
    uiStore.ts            # UPDATE: Dynamic persist key with userId
    authStore.ts          # Unchanged (no persist)
    sessionStore.ts       # NEW: Sessions + items Zustand store with persist
  hooks/
    useSessions.ts        # REWRITE: Zustand selectors instead of useLiveQuery
    useWriteAheadQueue.ts # NEW: Offline write queue processing
    useDataMigration.ts   # NEW: Hook to trigger/monitor one-time migration
  lib/
    supabase.ts           # Unchanged
  components/
    MigrationSplash.tsx   # NEW: Full-screen migration overlay
```

### Pattern 1: Zustand Session Store with Supabase Backend
**What:** A Zustand store that holds sessions and items in memory, persists to localStorage via persist middleware, and syncs with Supabase as source of truth.
**When to use:** All session/item reads across the app.
**Example:**
```typescript
// src/stores/sessionStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import type { Tables } from '../db/database.types';

type Session = Tables<'sessions'>;
type Item = Tables<'items'>;

interface SessionState {
  sessions: Session[];
  itemsBySession: Record<string, Item[]>;  // keyed by session UUID
  loading: boolean;
  lastFetched: number | null;

  // Actions
  fetchSessions: () => Promise<void>;
  fetchItems: (sessionId: string) => Promise<void>;
  createSession: (data: { name: string; mode: string; notes?: string }) => Promise<string>;
  updateSession: (id: string, changes: Partial<Session>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  createItem: (sessionId: string, mode: string, receiptNumber?: string) => Promise<string>;
  updateItemField: (itemId: string, field: string, value: string) => Promise<void>;
  deleteItem: (itemId: string, sessionId: string) => Promise<void>;

  // Optimistic helpers
  _optimisticUpdateSession: (id: string, changes: Partial<Session>) => void;
  _revertSession: (id: string, original: Session) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessions: [],
      itemsBySession: {},
      loading: false,
      lastFetched: null,

      fetchSessions: async () => {
        set({ loading: true });
        const { data, error } = await supabase
          .from('sessions')
          .select('*')
          .order('updated_at', { ascending: false });
        if (!error && data) {
          set({ sessions: data, loading: false, lastFetched: Date.now() });
        } else {
          set({ loading: false });
        }
      },

      // ... other actions follow same pattern
    }),
    {
      name: 'tpc-sessions',  // Will be updated to tpc-sessions-{userId}
      partialize: (state) => ({
        sessions: state.sessions,
        itemsBySession: state.itemsBySession,
        lastFetched: state.lastFetched,
      }),
    }
  )
);
```

### Pattern 2: Supabase CRUD with Optimistic Updates
**What:** Mutations update Zustand immediately (optimistic), then call Supabase. On error, revert Zustand state.
**When to use:** All create/update/delete operations.
**Example:**
```typescript
// Inside sessionStore actions
updateSession: async (id, changes) => {
  const { sessions } = get();
  const original = sessions.find(s => s.id === id);
  if (!original) return;

  // Optimistic update
  set({
    sessions: sessions.map(s =>
      s.id === id ? { ...s, ...changes, updated_at: new Date().toISOString() } : s
    ),
  });

  const { error } = await supabase
    .from('sessions')
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    // Revert on failure
    set({ sessions: sessions.map(s => s.id === id ? original : s) });
    console.error('Failed to update session:', error);
  }
},
```

### Pattern 3: Per-User Persist Key with Dynamic Switching
**What:** Zustand persist key includes userId. On login, call `setOptions` + `rehydrate` to load the correct user's cached data.
**When to use:** uiStore and sessionStore.
**Example:**
```typescript
// After successful login (in App.tsx or ProtectedRoute)
const userId = user.id;

// Session store: switch to user-scoped key
useSessionStore.persist.setOptions({ name: `tpc-sessions-${userId}` });
useSessionStore.persist.rehydrate();

// UI store: switch to user-scoped key
useUIStore.persist.setOptions({ name: `tpc-ui-state-${userId}` });
useUIStore.persist.rehydrate();
```

### Pattern 4: Write-Ahead Queue for Offline Writes
**What:** A Dexie table stores pending mutations when offline. On reconnect, process queue in order before audio queue fires.
**When to use:** Any create/update/delete when navigator.onLine is false.
**Example:**
```typescript
// src/db/index.ts -- add to Dexie schema
// v7: Add idMapping and writeAheadQueue tables
db.version(7).stores({
  sessions: '++id, mode, status, updatedAt, createdAt, deletedAt',
  houseVisitItems: '++id, sessionId, sortOrder, aiStatus, [sessionId+aiStatus]',
  saleItems: '++id, sessionId, receiptNumber, sortOrder, aiStatus, [sessionId+aiStatus]',
  photos: '++id, itemId, sortOrder',
  audio: '++id, itemId',
  exportHistory: '++id, sessionId, exportedAt',
  idMapping: '++id, oldId, newId, type',        // NEW
  writeAheadQueue: '++id, createdAt',            // NEW
});

// Queue entry shape
interface WriteAheadEntry {
  id?: number;
  table: 'sessions' | 'items';
  operation: 'insert' | 'update' | 'delete';
  payload: Record<string, unknown>;
  tempId?: string;      // Client-generated UUID for optimistic display
  createdAt: Date;
}
```

### Pattern 5: ID Mapping for Blob Lookups
**What:** A Dexie table mapping `{oldId, newId, type}` bridges Supabase UUIDs to Dexie integer IDs for audio/photo access.
**When to use:** Whenever a component needs to load audio or photos for a Supabase item.
**Example:**
```typescript
// src/db/types.ts -- add
interface IdMapping {
  id?: number;
  oldId: number;         // Original Dexie integer ID
  newId: string;         // Supabase UUID
  type: 'session' | 'item';
}

// Lookup function
async function getDexieItemId(supabaseItemId: string): Promise<number | null> {
  const mapping = await db.idMapping
    .where('newId')
    .equals(supabaseItemId)
    .first();
  return mapping?.oldId ?? null;
}

// Usage in PhotoCapture, RecordingsList, ItemCard
const dexieItemId = await getDexieItemId(supabaseItem.id);
if (dexieItemId) {
  const photos = await db.photos.where('itemId').equals(dexieItemId).sortBy('sortOrder');
}
```

### Anti-Patterns to Avoid
- **Mixing Dexie and Supabase reads for same data:** After migration, session/item metadata MUST come from Zustand/Supabase only. Never fall back to Dexie for metadata.
- **Blocking the UI during Supabase writes:** Use optimistic updates. The user should never wait for a server round-trip to see their change.
- **Processing audio queue before write-ahead queue:** Items must exist in Supabase before the AI service can write results back. Always drain write-ahead queue first on reconnect.
- **Storing blobs in Zustand persist:** localStorage has a ~5MB limit. Audio blobs can be 1MB+ each. Zustand persist should only store metadata (the session/item objects from Supabase).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reactive state management | Custom event system for re-renders | Zustand selectors + `useShallow` | Zustand handles subscription granularity, prevents unnecessary re-renders |
| Offline detection | Custom polling mechanism | `navigator.onLine` + `online`/`offline` events | Already used in `uiStore.ts`; browser-native, reliable |
| Supabase query typing | Manual type annotations on queries | `supabase.from('table').select('*')` with Database generic | Types are auto-generated; manual typing drifts |
| UUID generation for temp items | Custom UUID function | `crypto.randomUUID()` | Browser-native, available in all target browsers (iOS 15.4+, Chrome 92+) |
| Data migration progress | Custom batching logic | Simple for-loop with progress callback | Migration is one-time, < 100 items typically; over-engineering adds risk |

**Key insight:** The Supabase client handles auth token injection automatically via the stored session. No manual token management needed for any query. RLS policies do the authorization.

## Common Pitfalls

### Pitfall 1: Route Params Change from Numbers to UUIDs
**What goes wrong:** Every `useParams` call currently parses `Number(sessionId)`. After migration, IDs are UUID strings. Forgetting to update a route handler causes NaN.
**Why it happens:** IDs permeate the entire app -- routes, component props, Dexie queries.
**How to avoid:** Systematic grep for `Number(sessionId)`, `Number(itemId)`, and `numericSessionId` / `numericItemId`. Update all at once.
**Warning signs:** Components showing "Loading..." forever or "Session not found."

### Pitfall 2: Dexie Tables Have No `deleted_at` or `archived_at` in Postgres
**What goes wrong:** Dexie sessions have `deletedAt` and `archivedAt` fields, but the Postgres `sessions` table has neither. Migrating soft-deleted or archived sessions would fail or create orphan data.
**Why it happens:** The Postgres schema was designed for v1.1 where session lifecycle is managed via status (`active | submitted | returned | exported`), not soft-delete.
**How to avoid:** During migration: skip soft-deleted sessions (they're in trash). For archived sessions, either skip them or migrate as status `active` (they had no real "archived" status in Postgres). The migration splash should inform the user how many sessions were migrated vs skipped.
**Warning signs:** Supabase insert errors on missing columns.

### Pitfall 3: Two Item Tables Merge into One
**What goes wrong:** Dexie has `houseVisitItems` and `saleItems` as separate tables. Postgres has a single `items` table with a `mode` column. ID collisions are possible (houseVisitItem id=5 and saleItem id=5 are different items).
**Why it happens:** Different schema design decisions between v1.0 and v1.1.
**How to avoid:** The ID mapping table must include `type: 'session' | 'item'` AND the source table info. During migration, process houseVisitItems and saleItems separately, each getting unique Supabase UUIDs.
**Warning signs:** Wrong photos/audio appearing on items (blob lookup returning wrong Dexie ID).

### Pitfall 4: Zustand persist.setOptions Does Not Clear Old Key
**What goes wrong:** Calling `setOptions({ name: 'new-key' })` + `rehydrate()` reads from the new key but does NOT remove data from the old key. Multiple user keys accumulate in localStorage.
**Why it happens:** Zustand persist was designed for static keys.
**How to avoid:** This is actually acceptable behavior for this use case -- each user's data stays in localStorage keyed by their userId. On logout, clear the in-memory state but let localStorage persist (per CONTEXT.md decision). On login as a different user, `setOptions` + `rehydrate` naturally loads that user's cached data.
**Warning signs:** If someone checks localStorage and sees multiple keys, that's expected, not a bug.

### Pitfall 5: Supabase Timestamps Are ISO Strings, Not Date Objects
**What goes wrong:** Dexie stores `createdAt` and `updatedAt` as JavaScript `Date` objects. Supabase returns them as ISO 8601 strings (`"2026-03-18T10:30:00.000Z"`). Components that call `.toLocaleDateString()` or `.getTime()` crash.
**Why it happens:** JSON serialization converts dates to strings.
**How to avoid:** The `formatDate` and `formatRelativeTime` functions in `SessionDetail.tsx` and `Settings.tsx` must be updated to accept `string | Date` and do `new Date(value)` conversion. Same for any component that reads `createdAt` or `updatedAt`.
**Warning signs:** "date.toLocaleDateString is not a function" runtime error.

### Pitfall 6: `created_by` Required on Session Insert
**What goes wrong:** The Postgres `sessions` table requires `created_by uuid not null`. The Dexie `createSession` function doesn't set any owner. Forgetting to add `created_by` to inserts causes RLS denials.
**Why it happens:** v1.0 had no concept of session ownership.
**How to avoid:** Every `supabase.from('sessions').insert(...)` MUST include `created_by: user.id` from the auth store.
**Warning signs:** `new row violates row-level security policy` error.

### Pitfall 7: Audio AI Processing Writes to Dexie, Not Supabase
**What goes wrong:** `src/services/gemini.ts` writes AI results (`aiStatus`, `title`, `description`, etc.) back to Dexie `houseVisitItems`/`saleItems` tables. After migration, these tables may be empty or stale.
**Why it happens:** The AI pipeline was built for Dexie-only architecture.
**How to avoid:** `gemini.ts` must be updated to write AI results to Supabase items table. The offline queue ordering decision (write-ahead first, then audio) ensures the item exists in Supabase before AI results arrive.
**Warning signs:** AI processing completes but fields don't appear in the UI.

### Pitfall 8: Export Utility Reads from Dexie
**What goes wrong:** `src/utils/export.ts` reads sessions, items, photos, and audio entirely from Dexie. Post-migration, session/item metadata is in Supabase while blobs remain in Dexie.
**Why it happens:** Export was built for Dexie-only.
**How to avoid:** Rewrite `buildExportData` to read session/item metadata from Supabase, then use the ID mapping table to fetch blobs from Dexie.
**Warning signs:** Export produces empty/stale data or crashes on missing Dexie records.

### Pitfall 9: New Items Created Post-Migration Have No Dexie Integer ID
**What goes wrong:** Items created after migration are born in Supabase with UUID IDs. They have no entry in the Dexie houseVisitItems/saleItems tables and thus no integer ID. Audio/photo blobs still use integer `itemId`.
**Why it happens:** Dexie's auto-increment IDs were used for blob association.
**How to avoid:** For post-migration items, store audio/photos using the Supabase UUID as the `itemId` key. Update Dexie schema to use `string` itemId for new blobs. OR: generate a synthetic integer ID for new items and create an ID mapping entry.
**Warning signs:** Photos/audio not appearing for newly created items.

## Code Examples

### Supabase Session CRUD
```typescript
// Fetch all sessions for current user (RLS handles filtering)
const { data: sessions, error } = await supabase
  .from('sessions')
  .select('*')
  .order('updated_at', { ascending: false });

// Create a session
const { data, error } = await supabase
  .from('sessions')
  .insert({
    name: 'Smith Estate',
    mode: 'house',
    notes: '',
    created_by: user.id,  // REQUIRED by RLS
  })
  .select()
  .single();

// Update a session
const { error } = await supabase
  .from('sessions')
  .update({ name: 'New Name', updated_at: new Date().toISOString() })
  .eq('id', sessionId);

// Delete a session (cascade deletes items in Postgres)
const { error } = await supabase
  .from('sessions')
  .delete()
  .eq('id', sessionId);
```

### Supabase Item CRUD
```typescript
// Fetch items for a session
const { data: items, error } = await supabase
  .from('items')
  .select('*')
  .eq('session_id', sessionId)
  .order('sort_order', { ascending: true });

// Create an item
const { data, error } = await supabase
  .from('items')
  .insert({
    session_id: sessionId,
    mode: 'house',
    sort_order: nextSortOrder,
  })
  .select()
  .single();

// Update a single field
const { error } = await supabase
  .from('items')
  .update({ title: 'NEW TITLE' })
  .eq('id', itemId);
```

### Zustand Selector Pattern (replacing useLiveQuery)
```typescript
// Before (Dexie):
const session = useLiveQuery(() => db.sessions.get(numericSessionId), [numericSessionId]);

// After (Zustand):
const session = useSessionStore((s) => s.sessions.find(sess => sess.id === sessionId));
```

### Migration One-Time Flow
```typescript
// src/db/migration.ts
export async function migrateToSupabase(
  userId: string,
  onProgress: (current: number, total: number) => void,
): Promise<{ migrated: number; skipped: number }> {
  // 1. Check if already migrated (idMapping table has entries)
  const existingMappings = await db.idMapping.count();
  if (existingMappings > 0) return { migrated: 0, skipped: 0 };

  // 2. Read all non-deleted Dexie sessions
  const dexieSessions = await db.sessions
    .filter(s => !s.deletedAt)
    .toArray();

  let migrated = 0;
  let skipped = 0;
  const totalItems = /* count all items across sessions */;

  for (const dexieSession of dexieSessions) {
    // 3. Insert session to Supabase
    const { data: newSession, error } = await supabase
      .from('sessions')
      .insert({
        name: dexieSession.name,
        mode: dexieSession.mode,
        status: 'active',
        notes: dexieSession.notes,
        created_by: userId,
      })
      .select()
      .single();

    if (error) { skipped++; continue; }

    // 4. Create ID mapping for session
    await db.idMapping.add({
      oldId: dexieSession.id!,
      newId: newSession.id,
      type: 'session',
    });

    // 5. Migrate items for this session
    const houseItems = await db.houseVisitItems
      .where('sessionId').equals(dexieSession.id!).toArray();
    const saleItems = await db.saleItems
      .where('sessionId').equals(dexieSession.id!).toArray();
    const allItems = [...houseItems, ...saleItems];

    for (const item of allItems) {
      const { data: newItem, error: itemError } = await supabase
        .from('items')
        .insert({
          session_id: newSession.id,
          mode: dexieSession.mode,
          title: item.title ?? null,
          description: item.description ?? null,
          // ... all fields
          sort_order: item.sortOrder,
        })
        .select()
        .single();

      if (!itemError && newItem) {
        await db.idMapping.add({
          oldId: item.id!,
          newId: newItem.id,
          type: 'item',
        });
        migrated++;
      } else {
        skipped++;
      }

      onProgress(migrated + skipped, totalItems);
    }
  }

  // 6. Delete migrated metadata from Dexie (keep audio, photos, idMapping)
  await db.sessions.clear();
  await db.houseVisitItems.clear();
  await db.saleItems.clear();
  await db.exportHistory.clear();

  return { migrated, skipped };
}
```

### Write-Ahead Queue Processing
```typescript
// src/hooks/useWriteAheadQueue.ts
export function useWriteAheadQueue() {
  const isOnline = useUIStore(s => s.isOnline);

  useEffect(() => {
    if (!isOnline) return;

    const processQueue = async () => {
      const entries = await db.writeAheadQueue
        .orderBy('createdAt')
        .toArray();

      for (const entry of entries) {
        try {
          if (entry.operation === 'insert') {
            await supabase.from(entry.table).insert(entry.payload);
          } else if (entry.operation === 'update') {
            await supabase.from(entry.table).update(entry.payload).eq('id', entry.payload.id);
          } else if (entry.operation === 'delete') {
            await supabase.from(entry.table).delete().eq('id', entry.payload.id);
          }
          await db.writeAheadQueue.delete(entry.id!);
        } catch (err) {
          console.error('Queue processing failed for entry:', entry.id, err);
          break;  // Stop processing on first failure to maintain order
        }
      }
    };

    processQueue();
  }, [isOnline]);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dexie `useLiveQuery` for reactive reads | Zustand selectors for reactive reads | This phase | ~10 components change their data source |
| Two separate item tables (house/sale) | Single `items` table with `mode` column | Phase 11 (schema) / Phase 14 (client) | Unified Item type, simpler queries |
| Client-only data in IndexedDB | Server-authoritative Postgres + client cache | This phase | Enables multi-user features (Phase 15-16) |
| Session status: `active \| completed` | Session status: `active \| submitted \| returned \| exported` | Phase 14 (type update) | Future-proofs for Phase 16 lifecycle |
| Numeric auto-increment IDs | UUID primary keys | Phase 14 (client migration) | All route params, component props change type |

**Deprecated/outdated after this phase:**
- `useLiveQuery` for session/item data (replaced by Zustand selectors; kept for audio/photo blobs)
- `HouseVisitItem` and `SaleItem` types (replaced by unified `Item` type from Supabase)
- `db.sessions`, `db.houseVisitItems`, `db.saleItems` for metadata reads (Dexie tables cleared after migration)
- `db.exportHistory` in Dexie (moved to Supabase `export_history` table)
- Numeric session/item IDs in route params

## Open Questions

1. **Post-migration audio/photo storage: Integer vs UUID itemId?**
   - What we know: Pre-migration blobs use Dexie integer itemId. Post-migration items have UUID IDs only. The ID mapping table bridges old items.
   - What's unclear: Should new audio/photos (recorded after migration) use the Supabase UUID as itemId directly in Dexie? Or should we generate synthetic integer IDs?
   - Recommendation: Store new audio/photos with Supabase UUID as string itemId. This requires updating the Dexie `photos` and `audio` table schemas to accept `string | number` for itemId. The lookup is simpler: for new items, use UUID directly; for migrated items, use ID mapping table.

2. **Export history migration**
   - What we know: Dexie has `exportHistory` table. Postgres has `export_history` table with `exported_by` UUID.
   - What's unclear: Should we migrate existing export history? It references old integer session IDs.
   - Recommendation: Migrate export history during one-time migration (map sessionId via idMapping). Set `exported_by` to the migrating user's ID. If this fails for any record, skip it -- export history is informational only.

3. **Handling concurrent migration across devices**
   - What we know: If user has the app on phone and tablet, both might trigger migration on first login.
   - What's unclear: Could this create duplicate sessions in Supabase?
   - Recommendation: Since this is a 2-5 person team with typically one device per person, accept the risk. If duplicates occur, the admin can delete them manually. An idempotency check (check if mapping exists before inserting) provides basic protection.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vite.config.ts` (test section) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-03a | Session CRUD via Supabase (create, read, update, delete) | unit | `npx vitest run src/tests/supabase-sessions.test.ts -x` | No - Wave 0 |
| INFRA-03b | Item CRUD via Supabase (create, read, update, delete) | unit | `npx vitest run src/tests/supabase-items.test.ts -x` | No - Wave 0 |
| INFRA-03c | Zustand session store (selectors, optimistic updates, revert) | unit | `npx vitest run src/tests/session-store.test.ts -x` | No - Wave 0 |
| INFRA-03d | ID mapping lookup (Supabase UUID -> Dexie integer ID) | unit | `npx vitest run src/tests/id-mapping.test.ts -x` | No - Wave 0 |
| INFRA-03e | One-time migration (Dexie -> Supabase, progress, cleanup) | unit | `npx vitest run src/tests/data-migration.test.ts -x` | No - Wave 0 |
| INFRA-03f | Write-ahead queue (enqueue offline, process on reconnect) | unit | `npx vitest run src/tests/write-ahead-queue.test.ts -x` | No - Wave 0 |
| INFRA-03g | Per-user Zustand persist key scoping | unit | `npx vitest run src/tests/persist-scoping.test.ts -x` | No - Wave 0 |
| INFRA-03h | Gemini AI writes results to Supabase instead of Dexie | unit | `npx vitest run src/tests/gemini-pipeline.test.ts -x` | Yes (needs update) |
| INFRA-03i | Export reads from Supabase + Dexie blobs | unit | `npx vitest run src/tests/export.test.ts -x` | Yes (needs update) |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/tests/supabase-sessions.test.ts` -- covers INFRA-03a (mock Supabase client for session CRUD)
- [ ] `src/tests/supabase-items.test.ts` -- covers INFRA-03b (mock Supabase client for item CRUD)
- [ ] `src/tests/session-store.test.ts` -- covers INFRA-03c (Zustand store behavior)
- [ ] `src/tests/id-mapping.test.ts` -- covers INFRA-03d (Dexie idMapping table queries)
- [ ] `src/tests/data-migration.test.ts` -- covers INFRA-03e (migration flow with mocked Supabase)
- [ ] `src/tests/write-ahead-queue.test.ts` -- covers INFRA-03f (queue storage and processing)
- [ ] `src/tests/persist-scoping.test.ts` -- covers INFRA-03g (dynamic persist key)
- [ ] Update `src/tests/gemini-pipeline.test.ts` -- covers INFRA-03h (AI writes to Supabase)
- [ ] Update `src/tests/export.test.ts` -- covers INFRA-03i (hybrid Supabase+Dexie export)
- [ ] Shared test helper for mocking Supabase client responses

## Component Migration Inventory

Every component using `useLiveQuery` from Dexie must be updated. This is the complete list:

| Component | Current Dexie Usage | Migration Action |
|-----------|-------------------|-----------------|
| `pages/Sessions.tsx` | `useActiveSessions`, `useCompletedSessions`, `useArchivedSessions` hooks | Replace with Zustand selectors; status filtering in store |
| `pages/SessionDetail.tsx` | `useSession`, `useSessionItemCount`, `useLiveQuery` for queuedCount | Replace with Zustand selectors; queuedCount from items array filter |
| `pages/NewSession.tsx` | `useActiveSessions` for warning, `createSession`, `createBlankItem` | Replace with Zustand store actions |
| `pages/ItemEntry.tsx` | 5 `useLiveQuery` calls (session, item, totalItems, photos, previousItem) | Session/item from Zustand; photos stay Dexie (via ID mapping) |
| `pages/Settings.tsx` | `useDeletedSessions` hook, `restoreSession`, `permanentlyDeleteSession` | Soft-delete concept changes (Postgres has no deletedAt); reassess |
| `components/ItemList.tsx` | `useLiveQuery` for items by sessionId | Replace with Zustand selector |
| `components/ItemCard.tsx` | `useLiveQuery` for audioData and photoCount | Audio/photo counts stay Dexie (via ID mapping); item props from parent |
| `components/PhotoCapture.tsx` | `useLiveQuery` for photos | Stays Dexie (photos are blobs); needs ID mapping for new items |
| `components/RecordingsList.tsx` | `useLiveQuery` for audio recordings | Stays Dexie (audio is blob data); needs ID mapping |
| `components/ExportHistoryList.tsx` | `useLiveQuery` for export history | Replace with Supabase query |
| `components/RecordButton.tsx` | Direct `db.houseVisitItems`/`db.saleItems` table access for aiStatus | Replace with Supabase update via store action |
| `services/gemini.ts` | `db.audio.get()` (keep), `table.update()` for AI results (change) | Audio read stays Dexie; field writes go to Supabase |
| `utils/export.ts` | Full Dexie reads for session, items, photos, audio | Session/items from Supabase; photos/audio from Dexie via ID mapping |
| `hooks/useAudioRecorder.ts` | `db.audio.add()` for blob storage | Stays Dexie (blob data); but itemId must support UUID for new items |

## Sources

### Primary (HIGH confidence)
- **Supabase Postgres schema**: `supabase/migrations/` -- sessions, items, export_history tables verified
- **Supabase RLS policies**: `supabase/migrations/20260318000005_rls_policies.sql` -- specialist/admin access verified
- **Supabase generated types**: `src/db/database.types.ts` -- Tables, Insert, Update types verified
- **Dexie schema**: `src/db/index.ts` -- 6 tables, v6, auto-increment integer PKs
- **Existing CRUD**: `src/db/sessions.ts`, `src/db/items.ts` -- complete function inventory
- **Existing hooks**: `src/hooks/useSessions.ts` -- 6 hooks all using useLiveQuery
- **Existing stores**: `src/stores/uiStore.ts` (persist), `src/stores/authStore.ts` (no persist)
- **Component audit**: All 14 files with Dexie imports manually reviewed

### Secondary (MEDIUM confidence)
- [Zustand persist docs](https://zustand.docs.pmnd.rs/reference/middlewares/persist) -- `setOptions`, `rehydrate`, `skipHydration` API
- [Zustand dynamic name discussion](https://github.com/pmndrs/zustand/discussions/474) -- Dynamic persist key pattern
- [Zustand v5 persist discussion](https://github.com/pmndrs/zustand/discussions/2805) -- v5-specific persist behavior

### Tertiary (LOW confidence)
- Post-migration audio itemId strategy (UUID vs synthetic integer) -- no precedent found; recommendation based on reasoning

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and verified, no new dependencies
- Architecture: HIGH -- patterns derived from existing codebase patterns (uiStore persist, authStore structure, Dexie schema), Supabase types verified
- Pitfalls: HIGH -- identified through systematic code review of all 14 Dexie-dependent files, schema comparison between Dexie and Postgres
- Migration flow: MEDIUM -- one-time migration logic is custom; batch size and error handling need implementation-time tuning
- Write-ahead queue: MEDIUM -- pattern is similar to existing audio offline queue but new implementation; edge cases (partial sync, queue ordering) need careful testing

**Research date:** 2026-03-18
**Valid until:** 2026-04-17 (stable -- no external dependency changes expected)
