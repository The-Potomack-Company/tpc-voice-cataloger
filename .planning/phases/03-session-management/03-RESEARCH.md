# Phase 3: Session Management - Research

**Researched:** 2026-03-06
**Domain:** Dexie/IndexedDB persistence, React CRUD UI, session lifecycle management
**Confidence:** HIGH

## Summary

Phase 3 builds session CRUD, list display, auto-save, and lifecycle management on top of the existing Dexie database and React/Tailwind UI shell. The core challenge is straightforward: extend the Dexie schema with new fields (`status`, `notes`, `deletedAt`), build session creation/list/detail pages, and wire auto-save into existing recording flows. The existing codebase already has the `Session` type, `sessions` table, placeholder pages (`SessionsPage`, `NewSessionPage`), and routing -- so this phase is primarily about filling in the implementations.

The main technical concerns are: (1) Dexie schema migration from v1 to v2 without data loss, (2) live query performance with `useLiveQuery` for reactive lists, (3) swipe-to-delete gesture handling on mobile web, and (4) handling 300+ items per session in the detail view without jank.

**Primary recommendation:** Use Dexie v2 schema migration with upgrade function, `useLiveQuery` for all reactive data, hand-roll swipe-to-delete with pointer events (no extra dependency), and virtualize the session detail item list only if performance testing shows it is needed.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Name is required -- user must name the session before starting
- Mode picker (house visit vs sale) from Phase 1 design
- Optional notes field for anything they want to add
- After creation, drop straight into the first item recording screen -- no intermediate summary
- If user taps "New" while an active session exists, warn them ("You have an open session -- start a new one anyway?")
- Sorted by most recent first (by `updatedAt`)
- Active and completed sessions displayed in separate sections -- active on top, completed below
- Search bar at top to filter sessions by name
- Tapping a session opens a session detail screen (item list, metadata) -- not straight into recording
- Swipe-to-delete with double confirmation dialog
- Soft delete -- deleted sessions recoverable from Settings page
- Session name editable from both long-press on list and inside session detail screen
- Notes field editable anytime from session detail screen
- Save on meaningful events: item added, item deleted, session name/notes edited, recording saved
- No visual save indicator -- silent like Google Docs
- On app reopen, always land on sessions list (not auto-resume)
- If a recording was in progress when browser closed/crashed, flag that session with an interrupted indicator so user knows an item may have lost audio
- Explicit status: "Active" and "Completed" -- user manually marks a session complete
- Completing a session moves it to the completed section on the list
- Completed sessions can be reopened with a confirmation dialog ("This session was marked complete. Reopen it?")
- No automatic completion -- user decides when they're done

### Claude's Discretion
- Session detail screen layout and information hierarchy
- Search bar implementation details (debounce, highlight matching)
- Soft-delete recovery UI in Settings
- Interrupted session flag visual treatment
- Swipe gesture implementation and double-confirm dialog design
- Dexie schema migration for new Session fields (status, notes, deletedAt)
- Session creation form layout and validation

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SESS-01 | User can save a session and return to it later (persists across browser close) | Dexie/IndexedDB persistence is already in place; schema migration adds `status`, `notes`, `deletedAt` fields; `useLiveQuery` provides reactive reads |
| SESS-02 | User can view a list of saved sessions on the home screen | `useLiveQuery` with `.where('status')` compound queries; section separation (active/completed); search filtering |
| SESS-03 | User can resume a saved session and continue adding items | Session detail route with `sessionId` param; items linked via `sessionId` FK already defined in schema |
| SESS-04 | Session auto-saves after each item is recorded | Event-driven save on Dexie write operations; `updatedAt` timestamp updated on every meaningful mutation |

</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| dexie | ^4.3.0 | IndexedDB wrapper, session persistence | Already in use; sole source of truth per project decisions |
| dexie-react-hooks | ^4.2.0 | `useLiveQuery` for reactive data binding | Already installed; provides automatic re-render on DB changes |
| react-router | ^7.13.1 | Routing for session detail page | Already in use; pathname-based routing per project decisions |
| zustand | ^5.0.11 | UI state (active session tracking, form state) | Already in use; persisted via `zustand/middleware/persist` |
| tailwindcss | ^4.2.1 | Styling | Already in use |

### Supporting (No New Dependencies Needed)
This phase requires NO new npm dependencies. All functionality can be built with existing stack:
- Swipe-to-delete: Pointer events API (built into browsers)
- Search: Client-side string filtering on `useLiveQuery` results
- Confirmation dialogs: Custom modal components with Tailwind
- Long-press: `pointerdown` timer pattern

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled swipe | react-swipeable-list | Extra dependency for one feature; pointer events are sufficient for this use case |
| Hand-rolled search | fuse.js | Overkill for filtering by session name; simple `includes()` is enough |
| Hand-rolled virtualization | @tanstack/virtual | Only needed if 300+ items cause measurable jank; defer until proven necessary |

## Architecture Patterns

### New Routes Required
```
/                    -> SessionsPage (list, already exists)
/new                 -> NewSessionPage (creation form, already exists as placeholder)
/session/:id         -> SessionDetailPage (NEW - view session items, metadata)
/session/:id/record  -> RecordingPage (NEW - recording within session context)
```

### Recommended Project Structure
```
src/
├── db/
│   ├── index.ts          # Dexie instance (MODIFY: bump to v2 schema)
│   ├── types.ts          # Session type (MODIFY: add status, notes, deletedAt)
│   └── sessions.ts       # NEW: Session CRUD operations (create, update, softDelete, restore, getAll, getById)
├── pages/
│   ├── Sessions.tsx      # MODIFY: replace empty state with session list
│   ├── NewSession.tsx    # MODIFY: replace placeholder with creation form
│   ├── SessionDetail.tsx # NEW: session detail with item list
│   └── Settings.tsx      # MODIFY: add soft-delete recovery section
├── components/
│   ├── SessionCard.tsx       # NEW: session list item with swipe-to-delete
│   ├── SwipeableRow.tsx      # NEW: reusable swipe gesture wrapper
│   ├── SessionSearch.tsx     # NEW: search bar for filtering sessions
│   ├── ConfirmDialog.tsx     # NEW: reusable confirmation modal
│   └── SessionForm.tsx       # NEW: name/mode/notes form for creation + editing
├── hooks/
│   └── useSessions.ts       # NEW: custom hook wrapping useLiveQuery for sessions
└── stores/
    └── uiStore.ts            # MODIFY: add activeSessionId tracking (optional)
```

### Pattern 1: Dexie Schema Migration (v1 -> v2)
**What:** Add `status`, `notes`, and `deletedAt` fields to the Session table; add `status` and `updatedAt` indexes.
**When to use:** At app startup when existing v1 database is detected.
**Example:**
```typescript
// src/db/index.ts
db.version(1).stores({
  sessions: "++id, mode, createdAt",
  houseVisitItems: "++id, sessionId, sortOrder",
  saleItems: "++id, sessionId, receiptNumber, sortOrder",
  photos: "++id, itemId, sortOrder",
  audio: "++id, itemId",
});

db.version(2).stores({
  sessions: "++id, mode, status, updatedAt, createdAt, deletedAt",
  // Other tables unchanged -- but MUST be re-declared
  houseVisitItems: "++id, sessionId, sortOrder",
  saleItems: "++id, sessionId, receiptNumber, sortOrder",
  photos: "++id, itemId, sortOrder",
  audio: "++id, itemId",
}).upgrade(tx => {
  return tx.table("sessions").toCollection().modify(session => {
    session.status = session.status || "active";
    session.notes = session.notes || "";
    // deletedAt left undefined (null = not deleted)
  });
});
```
**Source:** [Dexie Version.upgrade() docs](https://dexie.org/docs/Version/Version.upgrade())

### Pattern 2: Session CRUD with Auto-Save
**What:** Centralized data access layer that updates `updatedAt` on every mutation.
**When to use:** All session and item operations.
**Example:**
```typescript
// src/db/sessions.ts
import { db } from "./index";
import type { Session } from "./types";

export async function createSession(
  name: string,
  mode: "house" | "sale",
  notes: string = ""
): Promise<number> {
  const now = new Date();
  return await db.sessions.add({
    name,
    mode,
    status: "active",
    notes,
    createdAt: now,
    updatedAt: now,
  } as Session);
}

export async function updateSession(
  id: number,
  changes: Partial<Pick<Session, "name" | "notes" | "status">>
): Promise<void> {
  await db.sessions.update(id, {
    ...changes,
    updatedAt: new Date(),
  });
}

export async function softDeleteSession(id: number): Promise<void> {
  await db.sessions.update(id, {
    deletedAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function restoreSession(id: number): Promise<void> {
  await db.sessions.update(id, {
    deletedAt: undefined,
    updatedAt: new Date(),
  });
}

export async function permanentlyDeleteSession(id: number): Promise<void> {
  await db.transaction("rw", [db.sessions, db.houseVisitItems, db.saleItems, db.audio, db.photos], async () => {
    // Delete all related items, audio, photos
    const houseItems = await db.houseVisitItems.where("sessionId").equals(id).toArray();
    const saleItems = await db.saleItems.where("sessionId").equals(id).toArray();
    const allItemIds = [
      ...houseItems.map(i => ({ id: i.id!, type: "house" as const })),
      ...saleItems.map(i => ({ id: i.id!, type: "sale" as const })),
    ];
    for (const item of allItemIds) {
      await db.audio.where("itemId").equals(item.id).delete();
      await db.photos.where("itemId").equals(item.id).delete();
    }
    await db.houseVisitItems.where("sessionId").equals(id).delete();
    await db.saleItems.where("sessionId").equals(id).delete();
    await db.sessions.delete(id);
  });
}
```

### Pattern 3: useLiveQuery for Reactive Session List
**What:** Real-time updates to session list whenever data changes.
**When to use:** Sessions list page and session detail page.
**Example:**
```typescript
// src/hooks/useSessions.ts
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";

export function useActiveSessions() {
  return useLiveQuery(
    () => db.sessions
      .where("status").equals("active")
      .and(s => !s.deletedAt)
      .reverse()
      .sortBy("updatedAt"),
    [],
    [] // default value while loading
  );
}

export function useCompletedSessions() {
  return useLiveQuery(
    () => db.sessions
      .where("status").equals("completed")
      .and(s => !s.deletedAt)
      .reverse()
      .sortBy("updatedAt"),
    [],
    []
  );
}

export function useSessionItemCount(sessionId: number) {
  return useLiveQuery(async () => {
    const session = await db.sessions.get(sessionId);
    if (!session) return 0;
    if (session.mode === "house") {
      return db.houseVisitItems.where("sessionId").equals(sessionId).count();
    }
    return db.saleItems.where("sessionId").equals(sessionId).count();
  }, [sessionId], 0);
}
```

### Pattern 4: Swipe-to-Delete with Pointer Events
**What:** Touch/mouse swipe gesture revealing delete action behind list item.
**When to use:** Session list items.
**Example:**
```typescript
// SwipeableRow concept (simplified)
function SwipeableRow({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  const [offset, setOffset] = useState(0);
  const startX = useRef(0);
  const threshold = -80; // px to reveal delete button

  return (
    <div className="relative overflow-hidden"
      onPointerDown={(e) => { startX.current = e.clientX; }}
      onPointerMove={(e) => {
        const dx = e.clientX - startX.current;
        if (dx < 0) setOffset(Math.max(dx, -120));
      }}
      onPointerUp={() => {
        if (offset < threshold) {
          setOffset(-120); // snap open
        } else {
          setOffset(0); // snap closed
        }
      }}
    >
      {/* Delete button behind */}
      <div className="absolute right-0 inset-y-0 w-[120px] bg-red-500 flex items-center justify-center">
        <button onClick={onDelete}>Delete</button>
      </div>
      {/* Content slides */}
      <div style={{ transform: `translateX(${offset}px)`, transition: offset === 0 ? 'transform 0.2s' : 'none' }}>
        {children}
      </div>
    </div>
  );
}
```

### Pattern 5: Interrupted Session Detection
**What:** Detect when a recording was in progress when the app closed/crashed.
**When to use:** On app load, check for sessions with incomplete recordings.
**Example:**
```typescript
// Use Zustand persisted state to track "currently recording" state
// In uiStore.ts:
interface UIState {
  recordingSessionId: number | null;
  setRecordingSession: (id: number | null) => void;
}

// On app startup (in SessionsPage or App.tsx):
// If recordingSessionId is not null, that session had an interrupted recording
// Flag it visually in the sessions list
```

### Anti-Patterns to Avoid
- **Holding session data in React state instead of Dexie:** All session data MUST go through Dexie. Never `useState` for session fields that need persistence. Use `useLiveQuery` to read, Dexie operations to write.
- **Manual save buttons or debounced auto-save:** Save immediately on each meaningful event. Dexie writes are fast (< 5ms for single record updates). No need for debouncing.
- **Using `useEffect` to sync Dexie -> React state:** This creates stale data. `useLiveQuery` handles reactivity automatically.
- **UUID primary keys:** Project uses auto-increment integers (`++id`). Do not switch.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB persistence | Raw IndexedDB API | Dexie v4 | Transaction handling, cursor iteration, schema migration are complex |
| Reactive data binding | Manual useEffect + polling | `useLiveQuery` from dexie-react-hooks | Automatic subscription to IndexedDB changes, handles cleanup |
| Confirmation dialogs | Browser `confirm()` | Custom React modal component | Browser confirm blocks main thread, can't be styled, may not work in all PWA contexts |
| Form validation | Custom validation logic | HTML5 `required` + `pattern` attributes + minimal JS | Session name validation is simple (non-empty); no form library needed |

**Key insight:** This phase is fundamentally CRUD + UI. The persistence layer (Dexie) and reactivity layer (useLiveQuery) handle the hard parts. The implementation work is mostly building UI components and wiring them to Dexie operations.

## Common Pitfalls

### Pitfall 1: Dexie Schema Migration Losing Data
**What goes wrong:** Bumping version number without re-declaring ALL table schemas causes Dexie to drop un-declared tables.
**Why it happens:** Dexie interprets missing tables in a version declaration as "delete this table."
**How to avoid:** In `db.version(2).stores({...})`, re-declare ALL tables even if only one changed. Copy unchanged table schemas verbatim.
**Warning signs:** Tables disappearing after app update; empty database after migration.

### Pitfall 2: useLiveQuery Dependency Array Mistakes
**What goes wrong:** Live query doesn't update when it should, or updates too often causing re-render loops.
**Why it happens:** Forgetting to include reactive variables in the dependency array, or including objects/arrays that create new references each render.
**How to avoid:** Pass primitive values (numbers, strings) in the dependency array. For the default value (3rd argument), define it outside the component or use `useMemo`.
**Warning signs:** Stale data in UI; infinite re-render loops; "Maximum update depth exceeded" errors.

### Pitfall 3: Soft Delete Leaking into Queries
**What goes wrong:** Soft-deleted sessions appear in the active list.
**Why it happens:** Forgetting to filter out `deletedAt` in every query.
**How to avoid:** Centralize all session queries in a `useSessions` hook that always filters `deletedAt`. Never query `db.sessions` directly from components.
**Warning signs:** Deleted sessions reappearing in the list.

### Pitfall 4: Session Detail Jank with 300+ Items
**What goes wrong:** Rendering 300+ item cards causes scroll jank on mobile.
**Why it happens:** DOM node count exceeds what mobile browsers handle smoothly.
**How to avoid:** Start with a simple list. If performance testing shows jank, add `@tanstack/react-virtual` for windowed rendering. Don't pre-optimize.
**Warning signs:** Stuttering scrolling on session detail page with many items.

### Pitfall 5: Swipe Gesture Conflicts with Scroll
**What goes wrong:** Horizontal swipe triggers when user is trying to scroll vertically.
**Why it happens:** Not differentiating swipe direction before committing to the gesture.
**How to avoid:** Track both X and Y movement. Only activate horizontal swipe if `|dx| > |dy| * 1.5` within the first 10px of movement. Set `touch-action: pan-y` on the swipeable element to let the browser handle vertical scrolling.
**Warning signs:** Users unable to scroll the session list; accidental swipe-deletes.

### Pitfall 6: Orphaned Items After Session Delete
**What goes wrong:** Deleting a session leaves its items, audio, and photos in the database.
**Why it happens:** Not using a transaction to cascade the delete.
**How to avoid:** Use `db.transaction("rw", [...tables], ...)` to delete session + all related records atomically. Even for soft delete, the permanent delete (from Settings recovery) must cascade.
**Warning signs:** Storage growing even after deleting sessions; orphaned blobs consuming space.

## Code Examples

### Session Type Extension
```typescript
// src/db/types.ts - Updated Session interface
export interface Session {
  id?: number;
  name: string;
  mode: "house" | "sale";
  status: "active" | "completed";
  notes: string;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Search with Debounce
```typescript
// Simple search in sessions list
function SessionSearch({ onSearch }: { onSearch: (q: string) => void }) {
  const [query, setQuery] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const handleChange = (value: string) => {
    setQuery(value);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onSearch(value), 200);
  };

  return (
    <input
      type="search"
      value={query}
      onChange={e => handleChange(e.target.value)}
      placeholder="Search sessions..."
      className="w-full px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-800 ..."
    />
  );
}
```

### Confirmation Dialog
```typescript
// Reusable confirmation dialog
function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mx-4 max-w-sm w-full">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-gray-600 dark:text-gray-400">{message}</p>
        <div className="mt-6 flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg ...">{cancelLabel}</button>
          <button onClick={onConfirm}
            className={`px-4 py-2 rounded-lg ${destructive ? 'bg-red-500 text-white' : 'bg-accent text-white'}`}
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
```

### Long-Press Handler
```typescript
// Hook for long-press detection (session name edit from list)
function useLongPress(callback: () => void, ms = 500) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const onPointerDown = () => {
    timerRef.current = setTimeout(callback, ms);
  };
  const onPointerUp = () => {
    clearTimeout(timerRef.current);
  };
  return { onPointerDown, onPointerUp, onPointerLeave: onPointerUp };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dexie v3 class-based DB | Dexie v4 `EntityTable` generics | 2024 | Simpler type safety; already using v4 pattern |
| `liveQuery()` observable | `useLiveQuery()` hook | dexie-react-hooks 1.1+ | Direct React integration; no manual subscription |
| Manual IndexedDB transactions | Dexie `db.transaction()` | Always | Automatic rollback on error; cleaner code |

**Deprecated/outdated:**
- `Dexie.Observable` addon: replaced by built-in liveQuery in Dexie v4
- Class-based Dexie database definition: v4 uses `EntityTable` generic typing pattern (already in use)

## Open Questions

1. **Long-press vs context menu on desktop**
   - What we know: Long-press works on touch; desktop users expect right-click or hover menu
   - What's unclear: Whether desktop usage is a concern for this auctioneer-focused mobile PWA
   - Recommendation: Implement long-press for touch. For desktop, add an edit button/icon on hover. Low priority since primary use is mobile.

2. **Interrupted recording detection reliability**
   - What we know: Zustand persisted state can track "currently recording sessionId"
   - What's unclear: Whether browser crash reliably persists Zustand's localStorage write
   - Recommendation: Write `recordingSessionId` to localStorage immediately on recording start (Zustand persist does this). On next load, check if it's still set. If the recording completed normally, clear it. If it's still set on load, flag the session. This is reliable because localStorage writes are synchronous.

3. **Search performance with many sessions**
   - What we know: Simple string `includes()` is O(n) per keystroke
   - What's unclear: How many sessions a typical user accumulates
   - Recommendation: Use client-side filtering with `useLiveQuery`. For auctioneers doing a few sessions per week, even hundreds of sessions filter instantly. No need for full-text indexing.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vite.config.ts` (test section) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SESS-01 | Create session, persist across DB close/reopen | unit | `npx vitest run src/tests/sessions.test.ts -t "persist" -x` | No - Wave 0 |
| SESS-02 | List sessions with active/completed sections, search filter | unit + component | `npx vitest run src/tests/sessions.test.ts -t "list" -x` | No - Wave 0 |
| SESS-03 | Resume session, items still present | unit | `npx vitest run src/tests/sessions.test.ts -t "resume" -x` | No - Wave 0 |
| SESS-04 | Auto-save on item add/delete/edit | unit | `npx vitest run src/tests/sessions.test.ts -t "auto-save" -x` | No - Wave 0 |

### Additional Test Coverage
| Feature | Test Type | File |
|---------|-----------|------|
| Schema migration v1->v2 | unit | `src/tests/sessions.test.ts` |
| Soft delete + restore | unit | `src/tests/sessions.test.ts` |
| Cascading permanent delete | unit | `src/tests/sessions.test.ts` |
| Session CRUD operations | unit | `src/tests/sessions.test.ts` |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/tests/sessions.test.ts` -- covers SESS-01 through SESS-04 plus CRUD, migration, soft-delete
- [ ] Schema migration test: create v1 DB, upgrade to v2, verify existing records get default `status: "active"` and `notes: ""`

## Sources

### Primary (HIGH confidence)
- Project codebase: `src/db/index.ts`, `src/db/types.ts`, `src/pages/Sessions.tsx`, `src/pages/NewSession.tsx` -- current schema and UI state
- [Dexie Version.upgrade() docs](https://dexie.org/docs/Version/Version.upgrade()) -- schema migration pattern
- [Dexie.version() docs](https://dexie.org/docs/Dexie/Dexie.version()) -- version declaration requirements
- [useLiveQuery() docs](https://dexie.org/docs/dexie-react-hooks/useLiveQuery()) -- reactive query API

### Secondary (MEDIUM confidence)
- [Dexie pagination discussion](https://github.com/dexie/Dexie.js/discussions/1554) -- large collection handling patterns
- [useLiveQuery re-render prevention](https://github.com/dexie/Dexie.js/discussions/1661) -- dependency array best practices
- [react-swipeable-list npm](https://www.npmjs.com/package/react-swipeable-list) -- evaluated but not recommended (hand-roll instead)

### Tertiary (LOW confidence)
- None -- all findings verified against official docs or codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and in use; no new dependencies needed
- Architecture: HIGH -- patterns follow existing codebase conventions (Dexie as source of truth, useLiveQuery, Zustand for UI state)
- Pitfalls: HIGH -- Dexie migration pitfalls well-documented; performance concerns addressable with known solutions
- Swipe gesture: MEDIUM -- hand-rolled approach is standard but needs careful touch-action handling to avoid scroll conflicts

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable domain, no fast-moving dependencies)
