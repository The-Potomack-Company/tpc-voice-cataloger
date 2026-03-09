# Phase 8: Offline Queue - Research

**Researched:** 2026-03-09
**Domain:** Offline detection, queue management, connectivity-aware processing
**Confidence:** HIGH

## Summary

Phase 8 adds offline awareness to an already-functional recording pipeline. Audio recording already saves to IndexedDB regardless of connectivity (Phase 2). AI processing via `processAudioWithAi()` already works online (Phase 5). This phase bridges the gap: detect offline state, set items to `"queued"` instead of triggering AI, and drain the queue automatically when connectivity returns.

The implementation surface is narrow. The core changes are: (1) add `"queued"` to `AiStatus`, (2) intercept `processAudioWithAi()` calls in `RecordButton` and `ItemCard` with an online check, (3) build a queue drain service that runs on `online` events, (4) add UI indicators for offline status and queued items, and (5) disable export when queued items exist. No new external libraries are needed -- this is pure browser API (`navigator.onLine`, `online`/`offline` events) plus existing Dexie queries.

**Primary recommendation:** Build a `useOnlineStatus()` hook for reactive connectivity state, a `drainQueue()` service function that queries Dexie for `aiStatus === "queued"` items and processes them with concurrency control, and wire the `online` event listener at the App level to trigger draining.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Add `"queued"` to `AiStatus` type: `pending | processing | done | failed | queued`
- When offline: recording saves normally, item gets `aiStatus: "queued"` instead of triggering `processAudioWithAi()`
- When online: existing `processAudioWithAi()` fires as before -- no change to online flow
- Queued items appear greyed out / muted in the item list with a "Queued" badge
- No queued item count on session cards -- status only visible at item level
- Queued items are locked (not editable) until AI processes them
- Parallel batch processing when connectivity returns (3-5 concurrent)
- Retry failed items twice, then mark as `"failed"` and skip to next
- Silent processing -- items flip from "Queued" to "Done" in background
- If connectivity drops mid-drain: pause processing, remaining items stay "queued", resume when online again
- Subtle wifi-off icon in the header/nav area -- always visible while offline, no text banner
- Recording button behaves identically online and offline
- Export button disabled when session has queued items, with message like "X items still queued"
- FIFO across all sessions -- process in order of `createdAt`
- No user-controlled prioritization

### Claude's Discretion
- Connectivity detection mechanism (`navigator.onLine` + `online`/`offline` events vs. ping-based)
- Queue processor architecture (service/hook, where it lives in the component tree)
- Concurrency limit for parallel processing (3-5 range)
- Wifi-off icon design and placement details
- How to associate queued items with their audio records for processing

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OFFL-01 | User can record audio when device has no internet connectivity | Recording already works offline (audio saves to IndexedDB). This phase ensures `aiStatus` is set to `"queued"` instead of calling AI when offline. |
| OFFL-02 | Recorded audio is queued locally and processed when connectivity returns | Queue drain service queries `aiStatus === "queued"` from both item tables, finds associated audio via `db.audio.where("itemId")`, calls `processAudioWithAi()` per item. |
| OFFL-03 | User sees clear indication of which items are queued vs processed | ItemCard shows greyed-out styling + "Queued" badge when `aiStatus === "queued"`. Wifi-off icon in AppLayout header when offline. |
| OFFL-04 | Queued items are processed automatically when device comes back online | `online` event listener triggers `drainQueue()`. Processes items FIFO by `createdAt`, 4 concurrent, with 2 retries per item. |
</phase_requirements>

## Standard Stack

### Core (already installed -- no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Browser `navigator.onLine` + events | N/A | Connectivity detection | Built-in, no library needed, supported in all target browsers |
| Dexie | ^4.3.0 | Query queued items, update status | Already the sole data layer |
| Zustand | ^5.0.11 | Reactive `isOnline` UI state | Already the UI state store |
| React | ^19.2.0 | Hooks for connectivity, UI rendering | Already the view layer |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `dexie-react-hooks` | ^4.2.0 | `useLiveQuery` for reactive queued item counts | Already used for all Dexie-reactive UI |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `navigator.onLine` + events | Periodic fetch/ping to server | More accurate but adds complexity, latency, server dependency. For this use case (queue drain on reconnect), the browser events are sufficient -- worst case is a brief delay before drain starts. |
| Zustand for `isOnline` | React context | Either works. Zustand is already established in the project and supports persist middleware if needed. |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  services/
    offlineQueue.ts       # drainQueue(), getQueuedItems(), queue drain logic
  hooks/
    useOnlineStatus.ts    # Reactive hook wrapping navigator.onLine + events
  stores/
    uiStore.ts            # Add isOnline field (existing store)
  db/
    types.ts              # Add "queued" to AiStatus (existing file)
  components/
    OfflineIndicator.tsx   # Wifi-off icon component
    ItemCard.tsx           # Add queued styling (existing file)
    RecordButton.tsx       # Add offline check (existing file)
  layouts/
    AppLayout.tsx          # Mount OfflineIndicator + queue drain effect (existing file)
  pages/
    SessionDetail.tsx      # Export button disabled logic (existing file)
```

### Pattern 1: Online Status Hook
**What:** A custom hook that returns reactive `isOnline` boolean, synced with browser events and Zustand.
**When to use:** Any component needing to react to connectivity changes.
**Example:**
```typescript
// src/hooks/useOnlineStatus.ts
import { useEffect } from "react";
import { useUIStore } from "../stores/uiStore";

export function useOnlineStatus(): boolean {
  const isOnline = useUIStore((s) => s.isOnline);
  const setOnline = useUIStore((s) => s.setOnline);

  useEffect(() => {
    // Sync initial state
    setOnline(navigator.onLine);

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setOnline]);

  return isOnline;
}
```

### Pattern 2: Queue Drain with Concurrency Control
**What:** A service function that queries all `aiStatus === "queued"` items across both tables, sorts by `createdAt`, and processes them with bounded concurrency.
**When to use:** Called when `online` event fires or on app startup if items are queued.
**Example:**
```typescript
// src/services/offlineQueue.ts
import { db } from "../db";
import { processAudioWithAi } from "./gemini";
import type { HouseVisitItem, SaleItem } from "../db/types";

const CONCURRENCY = 4;
const MAX_RETRIES = 2;

let draining = false;

interface QueuedItem {
  id: number;
  itemType: "house" | "sale";
  createdAt: Date;
}

export async function getQueuedItems(): Promise<QueuedItem[]> {
  const houseItems = await db.houseVisitItems
    .where("aiStatus").equals("queued")
    .toArray();
  const saleItems = await db.saleItems
    .where("aiStatus").equals("queued")
    .toArray();

  const all: QueuedItem[] = [
    ...houseItems.map((i) => ({ id: i.id!, itemType: "house" as const, createdAt: i.createdAt })),
    ...saleItems.map((i) => ({ id: i.id!, itemType: "sale" as const, createdAt: i.createdAt })),
  ];

  return all.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

async function findAudioForItem(itemId: number): Promise<number | null> {
  // Get most recent audio record for the item
  const audios = await db.audio.where("itemId").equals(itemId).toArray();
  if (audios.length === 0) return null;
  // Return the last recorded audio (highest id = most recent)
  return audios[audios.length - 1].id!;
}

async function processWithRetry(item: QueuedItem): Promise<void> {
  const audioId = await findAudioForItem(item.id);
  if (audioId === null) {
    // No audio found -- mark as failed
    const table = item.itemType === "house" ? db.houseVisitItems : db.saleItems;
    await table.update(item.id, { aiStatus: "failed" });
    return;
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (!navigator.onLine) return; // Pause if offline again
    try {
      await processAudioWithAi(audioId, item.id, item.itemType);
      return; // Success
    } catch {
      if (attempt === MAX_RETRIES) {
        // Final failure -- processAudioWithAi already sets "failed"
        return;
      }
    }
  }
}

export async function drainQueue(): Promise<void> {
  if (draining) return; // Prevent concurrent drains
  draining = true;

  try {
    const items = await getQueuedItems();
    // Process in batches of CONCURRENCY
    for (let i = 0; i < items.length; i += CONCURRENCY) {
      if (!navigator.onLine) break; // Stop if offline
      const batch = items.slice(i, i + CONCURRENCY);
      await Promise.allSettled(batch.map(processWithRetry));
    }
  } finally {
    draining = false;
  }
}
```

### Pattern 3: Offline Check at Recording Stop
**What:** Before calling `processAudioWithAi()`, check `navigator.onLine`. If offline, set `aiStatus: "queued"` instead.
**When to use:** In RecordButton and ItemCard where AI processing is triggered.
**Example:**
```typescript
// In RecordButton handleClick and ItemCard handleMicClick:
const audioId = await stopRecording();
if (audioId != null) {
  if (navigator.onLine) {
    processAudioWithAi(audioId, itemId, itemType).catch(console.error);
  } else {
    const table = itemType === "house" ? db.houseVisitItems : db.saleItems;
    await table.update(itemId, { aiStatus: "queued" });
  }
}
```

### Pattern 4: Queue Drain on App Mount + Online Event
**What:** Wire the `online` event to trigger `drainQueue()`, and also drain on app startup (handles case where app was closed while items were queued and reopened with connectivity).
**When to use:** In AppLayout or a top-level effect.
**Example:**
```typescript
// In AppLayout or a dedicated useQueueDrain hook:
useEffect(() => {
  // Drain on mount if online and items exist
  if (navigator.onLine) {
    drainQueue();
  }

  const handleOnline = () => drainQueue();
  window.addEventListener("online", handleOnline);
  return () => window.removeEventListener("online", handleOnline);
}, []);
```

### Anti-Patterns to Avoid
- **Polling for connectivity:** Do not use `setInterval` to check `navigator.onLine`. The browser `online`/`offline` events are sufficient and more efficient.
- **Storing queue in Zustand:** The queue IS the Dexie items with `aiStatus === "queued"`. Do not duplicate this state in a Zustand store. Dexie is the source of truth; `useLiveQuery` makes it reactive.
- **Awaiting processAudioWithAi in the drain loop:** Use `Promise.allSettled` for the batch, not `Promise.all`, so one failure does not abort the entire batch.
- **Custom retry wrapper around processAudioWithAi:** The retry logic belongs in the queue drain service, not inside `processAudioWithAi()` itself. The existing function already handles errors by setting `"failed"` status -- the drain service needs to intercept before that happens (set status back to `"queued"` before retrying, or handle retry at the drain level by re-calling).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Connectivity detection | Custom ping/heartbeat system | `navigator.onLine` + `online`/`offline` events | Browser-native, zero overhead, sufficient for queue drain trigger |
| Queue persistence | Custom queue data structure | Dexie `aiStatus` field query | Items already in Dexie -- the "queue" is just a query filter |
| Reactive UI updates on status change | Custom event emitter | `useLiveQuery` on item tables | Already established pattern -- `aiStatus` changes trigger re-render automatically |
| Concurrency limiting | Custom semaphore/pool | Batch slicing with `Promise.allSettled` | Simple enough for 4 concurrent items, no need for a library |

**Key insight:** There is no separate "queue" data structure. The queue is a Dexie query: all items where `aiStatus === "queued"`, sorted by `createdAt`. This eliminates sync between queue and items, survives browser restarts, and leverages existing reactive hooks.

## Common Pitfalls

### Pitfall 1: navigator.onLine False Positives
**What goes wrong:** `navigator.onLine` returns `true` when connected to a network but without actual internet access (e.g., captive portal, local WiFi with no WAN).
**Why it happens:** The browser only checks for network interface status, not actual internet reachability.
**How to avoid:** Accept this limitation. The queue drain will attempt processing and fail -- the retry mechanism handles this gracefully (2 retries, then mark failed). For an internal tool used by 2-5 auctioneers, this is acceptable.
**Warning signs:** Items stuck in "processing" state when on a network without internet.

### Pitfall 2: Race Condition Between Offline Check and Network Call
**What goes wrong:** `navigator.onLine` returns `true` at check time, but network drops before `processAudioWithAi()` completes.
**Why it happens:** Connectivity state changes are asynchronous and unpredictable.
**How to avoid:** This is handled by the existing error handling in `processAudioWithAi()` -- it catches errors and sets `aiStatus: "failed"`. For queued items specifically, the drain service should check `navigator.onLine` between batches and pause if offline.
**Warning signs:** Items going to "failed" status shortly after reconnection.

### Pitfall 3: processAudioWithAi Sets "failed" on Network Errors
**What goes wrong:** The existing `processAudioWithAi()` catches ALL errors and sets `aiStatus: "failed"`. For queue drain retries, we need the error to propagate so we can retry.
**Why it happens:** Phase 5 designed the function for online-only use where retry was not needed.
**How to avoid:** Two options: (a) wrap `processAudioWithAi()` call and check if status became "failed" to retry, or (b) create a variant that throws on network error instead of catching. Recommend option (a) -- read the item status after each call, and if "failed", reset to "queued" and retry. This avoids modifying the existing function.
**Warning signs:** Items immediately going to "failed" without retries.

### Pitfall 4: Dexie aiStatus Index for Queue Queries
**What goes wrong:** Querying `where("aiStatus").equals("queued")` without an index is a full table scan.
**Why it happens:** The `aiStatus` field was added as an index in DB version 3, so this is already covered.
**How to avoid:** Already handled -- `aiStatus` is indexed in both `houseVisitItems` and `saleItems` tables (see `db/index.ts` version 3).
**Warning signs:** N/A -- already indexed.

### Pitfall 5: Multiple Queue Drains Running Simultaneously
**What goes wrong:** If `online` event fires multiple times rapidly, multiple drain processes run concurrently processing the same items.
**Why it happens:** Network flapping, user moving between WiFi coverage areas.
**How to avoid:** Use a module-level `draining` boolean flag as a mutex. `drainQueue()` checks the flag and returns immediately if already draining.
**Warning signs:** Same item processed multiple times, duplicate AI calls.

### Pitfall 6: Queued Items with No Audio Record
**What goes wrong:** An item has `aiStatus: "queued"` but no associated audio in `db.audio`.
**Why it happens:** Could happen if audio was deleted or recording failed but item was still created.
**How to avoid:** Queue drain must look up audio by `itemId` and handle the missing case (mark as "failed" with descriptive message).
**Warning signs:** Queue drain crashes or hangs on items without audio.

## Code Examples

### Adding "queued" to AiStatus
```typescript
// src/db/types.ts - line 12
export type AiStatus = "pending" | "processing" | "done" | "failed" | "queued";
```

### Extending uiStore with isOnline
```typescript
// src/stores/uiStore.ts - add to interface and store
interface UIState {
  // ... existing fields
  isOnline: boolean;
  setOnline: (online: boolean) => void;
}

// In create():
isOnline: navigator.onLine,
setOnline: (online: boolean) => set({ isOnline: online }),
```
Note: `isOnline` should NOT be persisted (it should reflect live state), so either exclude it from the persist middleware's `partialize` or use a separate non-persisted store slice.

### ItemCard Queued Styling
```typescript
// In ItemCard component - check aiStatus
const isQueued = item.aiStatus === "queued";

// Collapsed row: add opacity and badge
<div className={`... ${isQueued ? "opacity-50" : ""}`}>
  {/* ... existing content ... */}
  {isQueued && (
    <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
      Queued
    </span>
  )}
</div>

// Expanded section: hide editable fields for queued items
{isExpanded && !isQueued && (
  <div className="...">
    {/* EditableField components */}
  </div>
)}
{isExpanded && isQueued && (
  <div className="... text-gray-400 text-sm p-4 text-center">
    Waiting for connectivity to process...
  </div>
)}
```

### Export Button with Queued Check
```typescript
// In SessionDetail - query for queued count
const queuedCount = useLiveQuery(async () => {
  if (!session) return 0;
  const table = session.mode === "house" ? db.houseVisitItems : db.saleItems;
  return table.where({ sessionId, aiStatus: "queued" }).count();
}, [sessionId, session?.mode], 0);

// Disable export button
<button
  onClick={handleExportClick}
  disabled={exporting || queuedCount > 0}
  className="..."
>
  {queuedCount > 0
    ? `${queuedCount} item${queuedCount === 1 ? "" : "s"} still queued`
    : exporting ? "Exporting..." : "Export Session"}
</button>
```

### OfflineIndicator Component
```typescript
// src/components/OfflineIndicator.tsx
import { useOnlineStatus } from "../hooks/useOnlineStatus";

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="flex items-center justify-center py-1 bg-gray-100 dark:bg-gray-800"
         aria-live="polite" role="status">
      <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none"
           viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        {/* Wifi-off icon path */}
        <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 3l18 18M9.348 6.782A10.451 10.451 0 0112 6c2.873 0 5.504 1.154 7.413 3.024M5.636 9.024a10.398 10.398 0 011.712-1.242M7.758 12.758A6.001 6.001 0 0112 10.5c1.272 0 2.452.395 3.424 1.07M10.586 15.414a3.001 3.001 0 013.828-1M12 19.5v.75" />
      </svg>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Service Worker Background Sync API | `online`/`offline` events + app-level drain | Background Sync still limited browser support (Safari) | For PWA on iOS Safari + Android Chrome, app-level approach is more reliable |
| Separate offline queue database/table | Query existing data with status filter | N/A | No separate queue needed -- items ARE the queue |

**Deprecated/outdated:**
- **Background Sync API (workbox-background-sync):** Not recommended here. Safari/iOS support is limited and the app is already open during use. App-level queue drain is simpler and works everywhere.
- **Network Information API (`navigator.connection`):** Useful for bandwidth detection but not needed for simple online/offline. Also not supported in all target browsers.

## Open Questions

1. **Retry semantics with processAudioWithAi error handling**
   - What we know: `processAudioWithAi()` catches all errors and sets `aiStatus: "failed"`. The drain service needs retries.
   - What's unclear: Should we modify `processAudioWithAi()` to optionally throw, or should the drain service reset "failed" back to "queued" and re-call?
   - Recommendation: The drain service should handle retries externally. Before calling `processAudioWithAi()`, note the current attempt count. After the call, check if status is "failed" and retry by resetting to "queued" then re-calling. This avoids modifying the existing battle-tested function. Alternatively, the drain service can call the internal steps directly, but that couples it to implementation details.

2. **Audio lookup for queued items**
   - What we know: Audio records are linked to items by `itemId` in `db.audio`. An item can have multiple audio records (re-recording).
   - What's unclear: Which audio record should the queue drain process -- the most recent one?
   - Recommendation: Use the most recent audio record (highest `id` or latest `createdAt`) for the item, matching the behavior of RecordButton which always processes the just-recorded audio.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vite.config.ts` (test block) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OFFL-01 | Recording sets aiStatus="queued" when offline | unit | `npx vitest run src/tests/offline-queue.test.ts -t "sets queued when offline" -x` | No - Wave 0 |
| OFFL-02 | drainQueue processes queued items with audio lookup | unit | `npx vitest run src/tests/offline-queue.test.ts -t "drainQueue" -x` | No - Wave 0 |
| OFFL-03 | ItemCard shows queued badge and greyed styling | unit | `npx vitest run src/tests/offline-queue.test.ts -t "queued badge" -x` | No - Wave 0 |
| OFFL-03 | OfflineIndicator shows when offline | unit | `npx vitest run src/tests/offline-queue.test.ts -t "offline indicator" -x` | No - Wave 0 |
| OFFL-04 | drainQueue fires on online event | unit | `npx vitest run src/tests/offline-queue.test.ts -t "online event triggers drain" -x` | No - Wave 0 |
| OFFL-04 | Retry twice then fail | unit | `npx vitest run src/tests/offline-queue.test.ts -t "retry" -x` | No - Wave 0 |
| OFFL-04 | Concurrent limit respected | unit | `npx vitest run src/tests/offline-queue.test.ts -t "concurrency" -x` | No - Wave 0 |
| OFFL-02 | Export disabled when queued items exist | unit | `npx vitest run src/tests/offline-queue.test.ts -t "export disabled" -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/tests/offline-queue.test.ts --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/tests/offline-queue.test.ts` -- covers OFFL-01, OFFL-02, OFFL-03, OFFL-04
- [ ] Test setup: mock `navigator.onLine` and `online`/`offline` events in test helpers
- [ ] Mock for `processAudioWithAi` to control success/failure in drain tests

## Sources

### Primary (HIGH confidence)
- Project source code: `src/db/types.ts`, `src/db/index.ts`, `src/services/gemini.ts`, `src/components/RecordButton.tsx`, `src/components/ItemCard.tsx`, `src/stores/uiStore.ts`, `src/layouts/AppLayout.tsx`, `src/pages/SessionDetail.tsx`
- Phase 8 CONTEXT.md: User decisions and code context
- MDN `navigator.onLine`: Standard browser API, supported in all target browsers (iOS Safari 5+, Chrome 14+)
- MDN `online`/`offline` events: Window events fired when connectivity changes

### Secondary (MEDIUM confidence)
- Dexie compound queries with `where().equals()`: Verified via project's existing usage patterns (DB version 3 already indexes `aiStatus`)

### Tertiary (LOW confidence)
- None -- all findings verified against project source code and standard browser APIs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all browser-native APIs
- Architecture: HIGH -- extends existing patterns (Dexie queries, Zustand store, fire-and-forget processing)
- Pitfalls: HIGH -- identified from direct code analysis of existing `processAudioWithAi()` error handling

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- browser APIs, no fast-moving dependencies)
