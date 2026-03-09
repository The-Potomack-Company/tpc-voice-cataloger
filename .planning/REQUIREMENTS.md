# Requirements: TPC Speech Cataloger

**Defined:** 2026-03-06
**Core Value:** Auctioneers can dictate catalog entries by voice and get structured, accurate auction catalog data faster than typing — with entries flowing directly into RFC Invaluable.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Voice Capture

- [x] **VOICE-01**: User can tap to start recording and tap again to stop for each item
- [x] **VOICE-02**: User can record audio that is stored locally as audio blob in IndexedDB
- [x] **VOICE-03**: User hears/sees clear feedback when recording is active vs stopped
- [x] **VOICE-04**: Audio recording works on both iOS Safari and Android Chrome

### AI Processing

- [x] **AI-01**: Recorded audio is sent to AI and returned as structured fields (title, description, condition, estimate, category) in a single step — no separate transcription
- [x] **AI-02**: AI output follows TPC conventions (ALL CAPS title, lowercase "the"-starting description, formal auction language)
- [x] **AI-03**: AI handles missing fields gracefully (null when not spoken, no hallucinated values)

### House Visit Mode

- [x] **HOUSE-01**: User can start a house visit session and catalog items one by one
- [x] **HOUSE-02**: User can capture one or more photos per item using device camera
- [x] **HOUSE-03**: User can view a photo gallery for each item showing all captured photos
- [x] **HOUSE-04**: User can tap "Next Item" to advance to a new blank entry

### Sale Cataloging Mode

- [x] **SALE-01**: User can start a sale cataloging session
- [x] **SALE-02**: User can enter a receipt number (format XXXXX-N) before dictating each item
- [x] **SALE-03**: User can tap "Next Item" to advance to a new blank entry with receipt number field

### Review & Edit

- [ ] **EDIT-01**: User can view all items in a session as a scrollable list with AI-extracted fields
- [x] **EDIT-02**: User can edit any field (title, description, condition, estimate, category) inline
- [x] **EDIT-03**: User can delete an item from the session
- [ ] **EDIT-04**: User can re-record audio for an item to regenerate AI fields

### Session Management

- [x] **SESS-01**: User can save a session and return to it later (persists across browser close)
- [x] **SESS-02**: User can view a list of saved sessions on the home screen
- [x] **SESS-03**: User can resume a saved session and continue adding items
- [x] **SESS-04**: Session auto-saves after each item is recorded

### Offline Support

- [ ] **OFFL-01**: User can record audio when device has no internet connectivity
- [ ] **OFFL-02**: Recorded audio is queued locally and processed when connectivity returns
- [ ] **OFFL-03**: User sees clear indication of which items are queued vs processed
- [ ] **OFFL-04**: Queued items are processed automatically when device comes back online

### Export

- [x] **EXPO-01**: User can export a session as a JSON file matching the TPC extension schema
- [x] **EXPO-02**: Export includes all fields: title, description, condition, estimate, category, receipt number (if sale mode), photos (if house visit mode)
- [x] **EXPO-03**: User can download the export file to device storage

### Extension Batch Import

- [ ] **EXT-01**: TPC Chrome extension accepts an imported JSON file from the speech cataloger app
- [ ] **EXT-02**: Extension matches items to RFC Invaluable lots by receipt number
- [ ] **EXT-03**: Extension fills title and description fields on each matched RFC lot page
- [ ] **EXT-04**: Extension processes items in batch (navigate, fill, save, next) like existing batch mode

### Mobile UX

- [x] **UX-01**: App is installable as a PWA on phone and tablet
- [x] **UX-02**: UI uses large tap targets (min 48px) optimized for thumb-zone interaction
- [x] **UX-03**: App works in both portrait and landscape orientation
- [x] **UX-04**: Recording and navigation controls are accessible one-handed

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### AI Enhancements

- **AI-05**: Category-aware AI prompts (furniture/books/fashion use different extraction strategies)
- **AI-06**: Estimate extraction from natural speech ("three to five hundred" → $300–$500)
- **AI-07**: Custom vocabulary injection for auctioneer-specific terminology

### Photo Enhancements

- **PHOTO-01**: User can reorder photos per item (drag to set hero shot)

### Data Management

- **DATA-01**: Export history and session archive
- **DATA-02**: Condition report templates (pre-built phrases by category)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time streaming transcription | Incompatible with offline queue; batch processing is more reliable |
| Multi-user collaboration | 2-5 person team doesn't need real-time collaboration |
| User accounts / OAuth | Internal tool, no meaningful security gain |
| Direct RFC API integration | Leverage existing extension infrastructure |
| Video recording | Large files destroy offline queue; photos + voice sufficient |
| Voice commands for navigation | Unreliable in noisy house environments |
| Auto-publish without review | AI errors require human review gate |
| Barcode/QR scanning | Receipt numbers are typed, not barcoded |
| On-device AI processing | Model size too large for mobile; offline queue solves the connectivity problem |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| VOICE-01 | Phase 2 | Complete |
| VOICE-02 | Phase 2 | Complete |
| VOICE-03 | Phase 2 | Complete |
| VOICE-04 | Phase 2 | Complete |
| AI-01 | Phase 5 | Complete |
| AI-02 | Phase 5 | Complete |
| AI-03 | Phase 5 | Complete |
| HOUSE-01 | Phase 4 | Complete |
| HOUSE-02 | Phase 4 | Complete |
| HOUSE-03 | Phase 4 | Complete |
| HOUSE-04 | Phase 4 | Complete |
| SALE-01 | Phase 4 | Complete |
| SALE-02 | Phase 4 | Complete |
| SALE-03 | Phase 4 | Complete |
| EDIT-01 | Phase 6 | Pending |
| EDIT-02 | Phase 6 | Complete |
| EDIT-03 | Phase 6 | Complete |
| EDIT-04 | Phase 6 | Pending |
| SESS-01 | Phase 3 | Complete |
| SESS-02 | Phase 3 | Complete |
| SESS-03 | Phase 3 | Complete |
| SESS-04 | Phase 3 | Complete |
| OFFL-01 | Phase 8 | Pending |
| OFFL-02 | Phase 8 | Pending |
| OFFL-03 | Phase 8 | Pending |
| OFFL-04 | Phase 8 | Pending |
| EXPO-01 | Phase 6 | Complete |
| EXPO-02 | Phase 6 | Complete |
| EXPO-03 | Phase 6 | Complete |
| EXT-01 | Phase 7 | Pending |
| EXT-02 | Phase 7 | Pending |
| EXT-03 | Phase 7 | Pending |
| EXT-04 | Phase 7 | Pending |
| UX-01 | Phase 1 | Complete |
| UX-02 | Phase 1 | Complete |
| UX-03 | Phase 1 | Complete |
| UX-04 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 37 total
- Mapped to phases: 37
- Unmapped: 0 (100% coverage)

**Phase breakdown:**
- Phase 1 (Foundation): UX-01, UX-02, UX-03, UX-04 (4 requirements)
- Phase 2 (Audio Capture): VOICE-01, VOICE-02, VOICE-03, VOICE-04 (4 requirements)
- Phase 3 (Session Management): SESS-01, SESS-02, SESS-03, SESS-04 (4 requirements)
- Phase 4 (Cataloging Modes): HOUSE-01, HOUSE-02, HOUSE-03, HOUSE-04, SALE-01, SALE-02, SALE-03 (7 requirements)
- Phase 5 (AI Pipeline): AI-01, AI-02, AI-03 (3 requirements)
- Phase 6 (Review, Edit, Export): EDIT-01, EDIT-02, EDIT-03, EDIT-04, EXPO-01, EXPO-02, EXPO-03 (7 requirements)
- Phase 7 (Extension Batch Import): EXT-01, EXT-02, EXT-03, EXT-04 (4 requirements)
- Phase 8 (Offline Queue): OFFL-01, OFFL-02, OFFL-03, OFFL-04 (4 requirements)

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-06 after roadmap creation — traceability complete*
