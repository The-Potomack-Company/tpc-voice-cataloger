# Requirements: TPC Speech Cataloger

**Defined:** 2026-03-06
**Core Value:** Auctioneers can dictate catalog entries by voice and get structured, accurate auction catalog data faster than typing — with entries flowing directly into RFC Invaluable.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Voice Capture

- [ ] **VOICE-01**: User can tap to start recording and tap again to stop for each item
- [ ] **VOICE-02**: User can record audio that is stored locally as audio blob in IndexedDB
- [ ] **VOICE-03**: User hears/sees clear feedback when recording is active vs stopped
- [ ] **VOICE-04**: Audio recording works on both iOS Safari and Android Chrome

### AI Processing

- [ ] **AI-01**: Recorded audio is sent to AI and returned as structured fields (title, description, condition, estimate, category) in a single step — no separate transcription
- [ ] **AI-02**: AI output follows TPC conventions (ALL CAPS title, lowercase "the"-starting description, formal auction language)
- [ ] **AI-03**: AI handles missing fields gracefully (null when not spoken, no hallucinated values)

### House Visit Mode

- [ ] **HOUSE-01**: User can start a house visit session and catalog items one by one
- [ ] **HOUSE-02**: User can capture one or more photos per item using device camera
- [ ] **HOUSE-03**: User can view a photo gallery for each item showing all captured photos
- [ ] **HOUSE-04**: User can tap "Next Item" to advance to a new blank entry

### Sale Cataloging Mode

- [ ] **SALE-01**: User can start a sale cataloging session
- [ ] **SALE-02**: User can enter a receipt number (format XXXXX-N) before dictating each item
- [ ] **SALE-03**: User can tap "Next Item" to advance to a new blank entry with receipt number field

### Review & Edit

- [ ] **EDIT-01**: User can view all items in a session as a scrollable list with AI-extracted fields
- [ ] **EDIT-02**: User can edit any field (title, description, condition, estimate, category) inline
- [ ] **EDIT-03**: User can delete an item from the session
- [ ] **EDIT-04**: User can re-record audio for an item to regenerate AI fields

### Session Management

- [ ] **SESS-01**: User can save a session and return to it later (persists across browser close)
- [ ] **SESS-02**: User can view a list of saved sessions on the home screen
- [ ] **SESS-03**: User can resume a saved session and continue adding items
- [ ] **SESS-04**: Session auto-saves after each item is recorded

### Offline Support

- [ ] **OFFL-01**: User can record audio when device has no internet connectivity
- [ ] **OFFL-02**: Recorded audio is queued locally and processed when connectivity returns
- [ ] **OFFL-03**: User sees clear indication of which items are queued vs processed
- [ ] **OFFL-04**: Queued items are processed automatically when device comes back online

### Export

- [ ] **EXPO-01**: User can export a session as a JSON file matching the TPC extension schema
- [ ] **EXPO-02**: Export includes all fields: title, description, condition, estimate, category, receipt number (if sale mode), photos (if house visit mode)
- [ ] **EXPO-03**: User can download the export file to device storage

### Extension Batch Import

- [ ] **EXT-01**: TPC Chrome extension accepts an imported JSON file from the speech cataloger app
- [ ] **EXT-02**: Extension matches items to RFC Invaluable lots by receipt number
- [ ] **EXT-03**: Extension fills title and description fields on each matched RFC lot page
- [ ] **EXT-04**: Extension processes items in batch (navigate, fill, save, next) like existing batch mode

### Mobile UX

- [ ] **UX-01**: App is installable as a PWA on phone and tablet
- [ ] **UX-02**: UI uses large tap targets (min 48px) optimized for thumb-zone interaction
- [ ] **UX-03**: App works in both portrait and landscape orientation
- [ ] **UX-04**: Recording and navigation controls are accessible one-handed

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
| VOICE-01 | — | Pending |
| VOICE-02 | — | Pending |
| VOICE-03 | — | Pending |
| VOICE-04 | — | Pending |
| AI-01 | — | Pending |
| AI-02 | — | Pending |
| AI-03 | — | Pending |
| HOUSE-01 | — | Pending |
| HOUSE-02 | — | Pending |
| HOUSE-03 | — | Pending |
| HOUSE-04 | — | Pending |
| SALE-01 | — | Pending |
| SALE-02 | — | Pending |
| SALE-03 | — | Pending |
| EDIT-01 | — | Pending |
| EDIT-02 | — | Pending |
| EDIT-03 | — | Pending |
| EDIT-04 | — | Pending |
| SESS-01 | — | Pending |
| SESS-02 | — | Pending |
| SESS-03 | — | Pending |
| SESS-04 | — | Pending |
| OFFL-01 | — | Pending |
| OFFL-02 | — | Pending |
| OFFL-03 | — | Pending |
| OFFL-04 | — | Pending |
| EXPO-01 | — | Pending |
| EXPO-02 | — | Pending |
| EXPO-03 | — | Pending |
| EXT-01 | — | Pending |
| EXT-02 | — | Pending |
| EXT-03 | — | Pending |
| EXT-04 | — | Pending |
| UX-01 | — | Pending |
| UX-02 | — | Pending |
| UX-03 | — | Pending |
| UX-04 | — | Pending |

**Coverage:**
- v1 requirements: 37 total
- Mapped to phases: 0
- Unmapped: 37 ⚠️

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-06 after initial definition*
