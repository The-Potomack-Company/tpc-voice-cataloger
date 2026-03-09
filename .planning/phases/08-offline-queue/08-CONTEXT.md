# Phase 8: Offline Queue - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Audio queued locally when offline, processed automatically when connectivity returns. Recording already works offline (audio saves to IndexedDB regardless). This phase adds: offline detection, queue management, automatic reconnection processing, and UI indicators for queued vs processed items. No new recording features, no new AI logic — this wraps existing infrastructure with offline awareness.

</domain>

<decisions>
## Implementation Decisions

### Queue status model
- Add `"queued"` to `AiStatus` type: `pending | processing | done | failed | queued`
- When offline: recording saves normally, item gets `aiStatus: "queued"` instead of triggering `processAudioWithAi()`
- When online: existing `processAudioWithAi()` fires as before — no change to online flow

### Queue visibility
- Queued items appear greyed out / muted in the item list with a "Queued" badge
- No queued item count on session cards — status only visible at item level
- Queued items are locked (not editable) until AI processes them — fields are empty, nothing to edit

### Reconnection behavior
- Parallel batch processing when connectivity returns (3-5 concurrent)
- Retry failed items twice, then mark as `"failed"` and skip to next
- Silent processing — items flip from "Queued" to "Done" in background, no toast or progress bar (consistent with Phase 5's "fields populate silently" pattern)
- If connectivity drops mid-drain: pause processing, remaining items stay "queued", resume automatically when online again

### Offline detection UX
- Subtle wifi-off icon in the header/nav area — always visible while offline, no text banner
- Recording button behaves identically online and offline — auctioneer doesn't need to think about connectivity
- Export button disabled when session has queued items, with message like "X items still queued"

### Queue ordering
- FIFO across all sessions — process in the order items were recorded (by `createdAt`)
- No user-controlled prioritization

### Claude's Discretion
- Connectivity detection mechanism (`navigator.onLine` + `online`/`offline` events vs. ping-based)
- Queue processor architecture (service/hook, where it lives in the component tree)
- Concurrency limit for parallel processing (3-5 range)
- Wifi-off icon design and placement details
- How to associate queued items with their audio records for processing

</decisions>

<specifics>
## Specific Ideas

- Phase 5 decided: "No automatic retries — the fallback transcription ensures the words are captured." Phase 8 overrides this for queued items specifically — retry twice because the original failure was connectivity, not a processing error
- The existing `processAudioWithAi()` function in `src/services/gemini.ts` is the processing unit — queue drain should reuse it directly, not duplicate logic
- RecordButton in `src/components/RecordButton.tsx` is where `processAudioWithAi()` is called fire-and-forget — this is the intercept point for offline detection

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `processAudioWithAi()` (`src/services/gemini.ts`): Full pipeline — fetch audio, base64 encode, call proxy, validate with Zod, write to Dexie. Queue processor can call this directly per item.
- `AiStatus` type (`src/db/types.ts`): Already has `pending | processing | done | failed` — needs `queued` added
- `RecordButton` (`src/components/RecordButton.tsx`): Fire-and-forget call to `processAudioWithAi()` after `stopRecording()` — intercept point for offline check
- VitePWA + workbox already configured in `vite.config.ts` — asset caching works, service worker registered with autoUpdate

### Established Patterns
- Dexie/IndexedDB as sole source of truth — queued status stored in item records, survives browser close
- Zustand for UI state — offline status indicator can live here
- Fire-and-forget processing (Phase 5 pattern) — queue drain follows the same principle
- `useLiveQuery` for reactive UI updates — items will automatically re-render when `aiStatus` changes from `queued` to `done`

### Integration Points
- `RecordButton.handleClick()`: Check `navigator.onLine` before calling `processAudioWithAi()` — if offline, set `aiStatus: "queued"` instead
- `window.addEventListener('online', ...)`: Trigger queue drain when connectivity returns
- ItemCard component: Add greyed-out styling and "Queued" badge when `aiStatus === "queued"`
- Export button: Query for queued items in session, disable if count > 0

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-offline-queue*
*Context gathered: 2026-03-09*
