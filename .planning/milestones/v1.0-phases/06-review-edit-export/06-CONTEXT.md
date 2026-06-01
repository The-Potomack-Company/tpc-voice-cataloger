# Phase 6: Review, Edit, Export - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Review all AI-parsed items in a session, correct any field inline, and export the session as versioned JSON for the Chrome extension. Items can also be created and populated manually without audio. No TPC formatting applied — fields stay as Gemini returns them. No batch import into RFC (Phase 7), no offline queue (Phase 8).

</domain>

<decisions>
## Implementation Decisions

### Review list layout
- Expandable cards — compact rows by default, tap to expand and see all fields
- Collapsed row shows: item number (or receipt number for sale mode) + title + description preview
- Expanded card shows all fields: title, description, condition, estimate, category — all visible, no secondary collapsible sections
- Must handle 300+ items efficiently (carried from Phase 4)

### Inline editing
- Tap field to edit in-place — field text becomes editable input right where it is
- Silent auto-save on blur, no save button (consistent with Phase 3 pattern for session name/notes)
- All fields always editable by typing, regardless of whether they were populated by AI or manually

### TPC formatting
- No auto-formatting at all — fields stay exactly as Gemini returns them (verbatim speech)
- No format button, no format-on-export
- Auctioneer can manually edit fields if they want to change casing or wording

### Re-record and multi-input
- Re-record appends new AI results to existing field content (space/newline separator between old and new)
- Old fields stay visible during re-recording and processing — not cleared
- Record button (small mic icon) available on collapsed card view for quick re-recording without expanding
- Recording is not the only way to add info — all fields are directly typeable
- Fully manual item creation supported — "Add Item" button creates a blank item with all fields editable by hand, no audio required

### Item deletion
- User can delete an item from the session (EDIT-03)
- Deleted items removed from list and excluded from export
- Use ConfirmDialog for delete confirmation (existing component)

### Export trigger and delivery
- Export button available from both session detail page and review screen
- Any session can be exported — active sessions show a warning ("This session is still active. Export anyway?")
- Delivery via Web Share API (`navigator.share`) — share sheet includes Save to Files/Downloads on both iOS and Android
- Export uses existing `ExportSchema` from `src/db/types.ts` (versioned JSON, `"version": 1`)
- Photo inclusion strategy deferred to research — researcher should investigate how existing TPC extension uploads photos to RFC Invaluable and what format/size RFC accepts

### Claude's Discretion
- Expandable card animation and transition
- Compact row layout and spacing details
- "Add Item" button placement and styling
- Mic icon size and placement on collapsed cards
- Export button styling and placement on both screens
- Warning dialog text for active session export
- How delete action is triggered (swipe, button in expanded card, etc.)
- Field input types (input vs textarea) per field

</decisions>

<specifics>
## Specific Ideas

- Multiple recordings build up item content over time — auctioneer might record title first, then come back and add condition details in a second recording
- Manual item creation supports the case where an auctioneer wants to type an entry without speaking (e.g., copying from a written list)
- Web Share API chosen because share sheet on iOS/Android natively includes "Save to Files" — covers both sharing and downloading in one mechanism
- Photo export format needs research because photos also need to be uploaded to RFC Invaluable for house visit items — not just packaged in JSON

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ExportSchema` interface (`src/db/types.ts`) — versioned JSON schema already defined with session, items, photos, audio arrays
- `RecordButton` component (`src/components/RecordButton.tsx`) — large red circle record button, reusable for re-record
- `useAudioRecorder` hook (`src/hooks/useAudioRecorder.ts`) — recording lifecycle, auto-save to Dexie
- `ConfirmDialog` component (`src/components/ConfirmDialog.tsx`) — reusable for delete and export warning confirmations
- `SwipeableRow` component (`src/components/SwipeableRow.tsx`) — potential use for swipe-to-delete on item cards
- `SessionCard` component (`src/components/SessionCard.tsx`) — existing card pattern to reference for review cards
- `HouseVisitItem` and `SaleItem` types with nullable title, description, condition, estimate, category fields

### Established Patterns
- Inline editing with silent auto-save on blur (Phase 3: session name/notes)
- Dexie/IndexedDB as sole source of truth — edits written immediately
- Auto-increment integer PKs
- Zustand for UI state management
- Tailwind CSS 4 with @theme blocks
- Dark mode via system preference
- Soft delete pattern with deletedAt field (Phase 3)

### Integration Points
- Review screen builds on existing session detail page from Phase 3
- Items linked to sessions via `sessionId` foreign key
- AI pipeline (Phase 5) writes fields to item records — this phase reads and allows editing them
- `aiStatus` field on items (Phase 5) indicates processing state — review can show appropriate state
- Export generates JSON matching `ExportSchema` for Phase 7 extension import
- Recording UI (button, indicator, toast) integrates into review cards for re-record

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-review-edit-export*
*Context gathered: 2026-03-06*
