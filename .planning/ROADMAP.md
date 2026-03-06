# Roadmap: TPC Speech Cataloger

## Overview

The TPC Speech Cataloger is built in eight phases that follow a strict dependency chain: the PWA shell and data schema must exist before audio recording; audio recording must exist before AI processing; AI processing must exist before review/edit/export; export must exist before the Chrome extension can consume it; the offline queue enhances the working pipeline last. Each phase delivers a coherent, testable capability that an auctioneer can exercise before the next phase begins.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - PWA shell, Dexie schema, shared TypeScript types, pathname routing, Tailwind CSS 4 (completed 2026-03-06)
- [x] **Phase 2: Audio Capture** - Tap-to-record/stop with MediaRecorder, cross-platform audio blob storage in IndexedDB (completed 2026-03-06)
- [x] **Phase 3: Session Management** - Create, save, resume, and auto-save sessions across browser close and power loss (completed 2026-03-06)
- [ ] **Phase 4: Cataloging Modes** - House visit mode (sequential items + photos) and sale cataloging mode (receipt number + dictation)
- [ ] **Phase 5: AI Pipeline** - Gemini transcription and structured field extraction with TPC convention enforcement
- [ ] **Phase 6: Review, Edit, Export** - Review and inline-edit AI-parsed fields, then export versioned JSON for the extension
- [ ] **Phase 7: Extension Batch Import** - Chrome extension reads exported JSON and batch-fills RFC Invaluable lot pages
- [ ] **Phase 8: Offline Queue** - Audio queued locally when offline, processed automatically when connectivity returns

## Phase Details

### Phase 1: Foundation
**Goal**: Auctioneers can install the app on their phone and open a working shell with correct routing, persistent storage schema, and mobile-optimized layout
**Depends on**: Nothing (first phase)
**Requirements**: UX-01, UX-02, UX-03, UX-04
**Success Criteria** (what must be TRUE):
  1. User can add the app to their iOS or Android home screen and open it as a standalone PWA without browser chrome
  2. All interactive elements are reachable with one thumb without zooming, with tap targets no smaller than 48px
  3. App layout is usable in both portrait and landscape orientation without horizontal scrolling or overlapping controls
  4. Recording and navigation controls remain accessible when the phone is held in one hand
**Plans:** 2/2 plans complete
Plans:
- [x] 01-01-PLAN.md — Scaffold Vite project, PWA config, Dexie schema, TypeScript types, test infrastructure
- [x] 01-02-PLAN.md — App shell with bottom tab bar, routing, pages, install banner, walkthrough, device verification

### Phase 2: Audio Capture
**Goal**: Auctioneers can tap to record their voice for each item and see the audio stored locally, on both iOS Safari and Android Chrome
**Depends on**: Phase 1
**Requirements**: VOICE-01, VOICE-02, VOICE-03, VOICE-04
**Success Criteria** (what must be TRUE):
  1. User can tap once to start recording and tap again to stop — no held-press or voice command needed
  2. Recorded audio blob is written to IndexedDB immediately when recording stops (visible in DevTools Application tab)
  3. User sees a distinct active-recording indicator (e.g., pulsing dot, timer, or color change) while recording, which clears on stop
  4. Recording, storing, and playback of audio works on an iPhone running iOS Safari and on an Android device running Chrome without errors
**Plans:** 2/2 plans complete
Plans:
- [ ] 02-01-PLAN.md — Audio recording infrastructure: test scaffolds, MIME type detection, useAudioRecorder hook, recording store
- [ ] 02-02-PLAN.md — Recording UI components (button, indicator, toast) and page integration with device verification

### Phase 3: Session Management
**Goal**: Auctioneers can start a session, close the browser mid-house-visit, reopen the app, and continue exactly where they left off
**Depends on**: Phase 2
**Requirements**: SESS-01, SESS-02, SESS-03, SESS-04
**Success Criteria** (what must be TRUE):
  1. User can create a new session and return to it after closing and reopening the browser — all items are still present
  2. Home screen shows a list of all saved sessions with enough detail (mode, item count, date) to identify each one
  3. User can tap a saved session and resume adding items to it without losing previously recorded items
  4. After recording each item, the session saves automatically — no manual "Save" button required
**Plans:** 3/3 plans complete
Plans:
- [ ] 03-01-PLAN.md — Schema migration, session CRUD data layer, reactive hooks, reusable components (ConfirmDialog, SwipeableRow)
- [ ] 03-02-PLAN.md — Session creation form (NewSession page) and session list (Sessions page) with search, sections, swipe-to-delete
- [ ] 03-03-PLAN.md — Session detail page, Settings recovery, interrupted recording detection, visual verification

### Phase 4: Cataloging Modes
**Goal**: Auctioneers can use house visit mode to photograph and catalog items sequentially, or sale cataloging mode to enter receipt numbers before dictating each item
**Depends on**: Phase 3
**Requirements**: HOUSE-01, HOUSE-02, HOUSE-03, HOUSE-04, SALE-01, SALE-02, SALE-03
**Success Criteria** (what must be TRUE):
  1. User can start a house visit session, record a description, take one or more photos with the device camera, tap "Next Item", and see a fresh blank entry ready for the next item
  2. User can view a gallery of all photos attached to a specific item within the session
  3. User can start a sale cataloging session, enter a receipt number in XXXXX-N format, record a description, tap "Next Item", and see a new entry with a fresh receipt number field
  4. Receipt number from sale mode is carried through to each item's record and visible in the item list
**Plans:** 1/2 plans executed
Plans:
- [ ] 04-01-PLAN.md — Utility functions (image resize, receipt validation, blob URL hook), session creation/list/detail pages with routing
- [ ] 04-02-PLAN.md — Item entry screen for both modes (photo capture, lightbox, receipt input, Next Item, back navigation)

### Phase 5: AI Pipeline
**Goal**: Recorded audio is automatically transcribed and parsed into structured catalog fields that follow TPC auction conventions, with no hallucinated values for fields not mentioned in the recording
**Depends on**: Phase 4
**Requirements**: AI-01, AI-02, AI-03
**Success Criteria** (what must be TRUE):
  1. After recording stops, structured fields (title, description, condition, estimate, category) appear in the item record without a separate transcription step
  2. Title output is in ALL CAPS following the TPC format ([PERIOD/STYLE] [MATERIAL] [ITEM TYPE]); description starts with "the" in lowercase formal auction language
  3. Fields not mentioned in the audio are stored as null — the app does not invent plausible values for unspoken details
**Plans:** 2 plans
Plans:
- [ ] 05-01-PLAN.md — DB migration (aiStatus), Zod schema for Gemini responses, Cloudflare Worker proxy
- [ ] 05-02-PLAN.md — Client-side AI processing service (audio to base64, proxy call, Zod validation, Dexie write)

### Phase 6: Review, Edit, Export
**Goal**: Auctioneers can review every AI-parsed item, correct any field inline, and export the session as a JSON file that the Chrome extension can consume
**Depends on**: Phase 5
**Requirements**: EDIT-01, EDIT-02, EDIT-03, EDIT-04, EXPO-01, EXPO-02, EXPO-03
**Success Criteria** (what must be TRUE):
  1. User can scroll through all items in a session and see all AI-extracted fields (title, description, condition, estimate, category) alongside the raw transcript for each item
  2. User can tap any field and edit it inline; changes persist immediately without a separate save action
  3. User can delete an item from the session; it is removed from the list and will not appear in the export
  4. User can tap "Re-record" on any item, record new audio, and have the AI fields regenerate from the new recording
  5. User can tap "Export" and receive a JSON file on their device containing all fields including receipt numbers (sale mode) and photo references (house visit mode), in the versioned TPC extension schema
**Plans:** 2 plans
Plans:
- [ ] 06-01-PLAN.md — Item CRUD data layer, export pipeline, EditableField component with tests
- [ ] 06-02-PLAN.md — Expandable item cards, inline editing UI, delete, re-record, export button on SessionDetail

### Phase 7: Extension Batch Import
**Goal**: The TPC Chrome extension accepts the exported JSON file and fills title and description fields on each matched RFC Invaluable lot page in batch, without manual copy-paste
**Depends on**: Phase 6
**Requirements**: EXT-01, EXT-02, EXT-03, EXT-04
**Success Criteria** (what must be TRUE):
  1. User can load the exported JSON file into the TPC Chrome extension (via file picker or `chrome.runtime.sendMessage` from the PWA)
  2. Extension matches each item to its RFC Invaluable lot by receipt number and navigates to that lot's edit page
  3. Extension fills the title field (`#fld1`) with the ALL CAPS value and the description field (`#fld2`) with the lowercase value from the JSON, verifying the write succeeded by reading the field value back
  4. Extension processes all matched items in sequence (navigate, fill, save, advance) and reports how many succeeded vs failed
**Plans**: TBD

### Phase 8: Offline Queue
**Goal**: Auctioneers at rural house visits can record audio without internet connectivity; the app queues recordings and processes them automatically when connectivity returns
**Depends on**: Phase 5
**Requirements**: OFFL-01, OFFL-02, OFFL-03, OFFL-04
**Success Criteria** (what must be TRUE):
  1. User can tap record and capture audio with the device in airplane mode or with no cellular signal — the recording completes and is stored locally without error
  2. Items recorded offline appear in the session list marked as "Queued" (not yet processed by AI)
  3. When the device regains internet connectivity, queued items are sent to AI and their fields are populated automatically — the user does not need to trigger this manually
  4. User can see a clear status indicator distinguishing queued items from fully processed items at all times
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/2 | Complete   | 2026-03-06 |
| 2. Audio Capture | 2/2 | Complete   | 2026-03-06 |
| 3. Session Management | 3/3 | Complete   | 2026-03-06 |
| 4. Cataloging Modes | 1/2 | In Progress|  |
| 5. AI Pipeline | 0/2 | Not started | - |
| 6. Review, Edit, Export | 0/2 | Not started | - |
| 7. Extension Batch Import | 0/TBD | Not started | - |
| 8. Offline Queue | 0/TBD | Not started | - |

### Phase 9: deffered items

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 8
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 9 to break down)
