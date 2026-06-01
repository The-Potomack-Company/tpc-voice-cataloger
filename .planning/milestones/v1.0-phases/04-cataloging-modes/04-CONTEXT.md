# Phase 4: Cataloging Modes - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

House visit mode (sequential items + photos) and sale cataloging mode (receipt number + dictation). Auctioneers can use either mode to catalog items one by one within a session, with mode-specific capture (photos for house visits, receipt numbers for sales). No AI processing (Phase 5), no field editing/export (Phase 6) — just the item-by-item capture workflow for both modes.

</domain>

<decisions>
## Implementation Decisions

### Item entry screen layout
- Stacked layout: context area at top, record button at bottom
- House visit mode: camera button + horizontal scrollable photo thumbnail strip at top, record button at bottom
- Sale cataloging mode: receipt number text input at top (full `XXXXX-N` format, typed manually each time), record button at bottom
- Context strip shows item number (e.g., "Item 3 of 12") and captured content
- Camera button sits above the thumbnail strip in the top context area, not near the record button

### Photo capture flow (house visit mode only)
- Native camera app via `<input type="file" capture="environment">` — opens phone's camera, returns photo to app
- Quick preview after capture with Keep/Retake buttons before photo is added to the strip
- Photos land in horizontal thumbnail strip immediately after Keep
- Tap thumbnail opens full-screen lightbox with swipe left/right navigation and trash icon to delete
- Photos resized to ~2048px max dimension before storage (carried from Phase 1)
- No photo reordering in this phase (deferred to v2 PHOTO-01)

### Receipt number input (sale cataloging mode only)
- Single editable text input field, user types full `XXXXX-N` receipt number each time
- No auto-increment, no split fields — receipt numbers come from a pre-existing list
- Receipt number is required before recording (field at top of screen)

### Next Item progression
- Instant advance — tap "Next Item", screen clears to fresh blank entry immediately, no confirmation or summary
- Warn if current item is completely empty (no recording, no photos): "This item has no recording or photos. Skip it?"
- Back button to return to previous item — opens fully editable (can add photos, re-record, delete photos)

### Item list in session detail
- Compact rows: item number, capture indicator icons (mic icon if recorded, camera icon with photo count if house visit), receipt number if sale mode
- Tapping an item opens the fully editable item entry screen (consistent with back button behavior)
- Must handle 300+ items efficiently for large house visit sessions

### Claude's Discretion
- "Next Item" button placement and styling
- Back button placement and styling
- Photo thumbnail sizing and spacing in the strip
- Keep/Retake preview layout and animation
- Empty item warning dialog design
- Lightbox transition animation and gesture handling
- Receipt number field validation timing (on blur vs on submit)
- Item counter display format and positioning
- How the session detail screen integrates the "add new item" action alongside the item list

</decisions>

<specifics>
## Specific Ideas

- Receipt numbers are pre-identified from a list — auctioneers look at a physical receipt and type the number, they don't generate them sequentially
- 300+ photos per house visit session is common — photo storage and thumbnail rendering must handle this scale
- The workflow is "snap and move on" — speed over photo quality review, hence instant add with quick Keep/Retake gate
- Both modes share the same record button from Phase 2 (large red circle, morphs to square, timer + red border glow)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `RecordButton` component (`src/components/RecordButton.tsx`) — large red circle record button with morph-to-square behavior
- `RecordingIndicator` component (`src/components/RecordingIndicator.tsx`) — timer + red border glow during recording
- `RecordingToast` component (`src/components/RecordingToast.tsx`) — "Recording saved" toast with play button
- `useAudioRecorder` hook (`src/hooks/useAudioRecorder.ts`) — MediaRecorder integration, auto-save to Dexie
- `audio.ts` utility (`src/utils/audio.ts`) — MIME type detection, audio helpers
- `HouseVisitItem` and `SaleItem` types in `src/db/types.ts` — separate tables with mode-specific fields already defined
- `ItemPhoto` type in `src/db/types.ts` — photo storage with blob, thumbnail, sortOrder, linked by itemId + itemType
- `ItemAudio` type in `src/db/types.ts` — audio storage with blob, mimeType, durationMs
- Dexie database with `itemPhotos` and `audioBlobs` tables ready
- `ConfirmDialog` component (Phase 3) — reusable for empty item warning

### Established Patterns
- Dexie/IndexedDB as sole source of truth — photos and audio written immediately, never held in React state only
- Auto-increment integer PKs (not UUID)
- Zustand for UI state management
- Tailwind CSS 4 with @theme blocks
- Dark mode via system preference
- Pathname-based routing (React Router v7)
- Auto-save on meaningful events (Phase 3 pattern)

### Integration Points
- Item entry screen builds on existing session detail page from Phase 3
- Recording UI (button, indicator, toast) already exists — integrates into item entry screen
- Items belong to sessions via `sessionId` foreign key (Phase 3)
- Phase 5 (AI Pipeline) will read stored audio blobs and process them
- Phase 6 (Review/Edit) will add AI field display and inline editing to the item view

</code_context>

<deferred>
## Deferred Ideas

- Import a list of receipt numbers to pre-populate sale session items (auto-create items from a receipt number list, then each can be edited with voice memo) — future phase
- Photo reordering / drag to set hero shot — v2 (PHOTO-01)

</deferred>

---

*Phase: 04-cataloging-modes*
*Context gathered: 2026-03-06*
