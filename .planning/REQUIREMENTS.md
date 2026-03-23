# Requirements: TPC Speech Cataloger

**Defined:** 2026-03-06
**Core Value:** Auctioneers can dictate catalog entries by voice and get structured, accurate auction catalog data faster than typing -- with entries flowing directly into RFC Invaluable.

## v1.0 Requirements (Shipped)

All v1.0 requirements completed and validated.

### Voice Capture

- [x] **VOICE-01**: User can tap to start recording and tap again to stop for each item
- [x] **VOICE-02**: User can record audio that is stored locally as audio blob in IndexedDB
- [x] **VOICE-03**: User hears/sees clear feedback when recording is active vs stopped
- [x] **VOICE-04**: Audio recording works on both iOS Safari and Android Chrome

### AI Processing

- [x] **AI-01**: Recorded audio is sent to AI and returned as structured fields (title, description, condition, estimate, category) in a single step -- no separate transcription
- [x] **AI-02**: AI returns verbatim speech in structured fields; TPC formatting conventions (ALL CAPS title, formal description language) are applied in Phase 6 review
- [x] **AI-03**: AI handles missing fields gracefully (null when not spoken, no hallucinated values)

### Measurements

- [x] **MEAS-01**: AI extracts spoken measurements as structured numbers and formats them as `N x N x N in. (N x N x N cm.)` with auto cm conversion
- [x] **MEAS-02**: Formatting utility correctly handles inch fractions (1/4, 1/2, 3/4), cm rounding to one decimal, and 1-3 dimension counts
- [x] **MEAS-03**: Measurements field appears in ItemCard (editable), JSON export, and Gemini AI schema
- [x] **MEAS-04**: Chrome extension fills RFC Invaluable dimensions field (#dimetext/fld3) with measurements from imported JSON

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

- [x] **EDIT-01**: User can view all items in a session as a scrollable list with AI-extracted fields
- [x] **EDIT-02**: User can edit any field (title, description, condition, estimate, category) inline
- [x] **EDIT-03**: User can delete an item from the session
- [x] **EDIT-04**: User can re-record audio for an item to regenerate AI fields

### Session Management

- [x] **SESS-01**: User can save a session and return to it later (persists across browser close)
- [x] **SESS-02**: User can view a list of saved sessions on the home screen
- [x] **SESS-03**: User can resume a saved session and continue adding items
- [x] **SESS-04**: Session auto-saves after each item is recorded

### Offline Support

- [x] **OFFL-01**: User can record audio when device has no internet connectivity
- [x] **OFFL-02**: Recorded audio is queued locally and processed when connectivity returns
- [x] **OFFL-03**: User sees clear indication of which items are queued vs processed
- [x] **OFFL-04**: Queued items are processed automatically when device comes back online

### Export

- [x] **EXPO-01**: User can export a session as a JSON file matching the TPC extension schema
- [x] **EXPO-02**: Export includes all fields: title, description, condition, estimate, category, receipt number (if sale mode), photos (if house visit mode)
- [x] **EXPO-03**: User can download the export file to device storage

### Extension Batch Import

- [x] **EXT-01**: TPC Chrome extension accepts an imported JSON file from the speech cataloger app
- [x] **EXT-02**: Extension matches items to RFC Invaluable lots by receipt number
- [x] **EXT-03**: Extension fills title and description fields on each matched RFC lot page
- [x] **EXT-04**: Extension processes items in batch (navigate, fill, save, next) like existing batch mode

### Mobile UX

- [x] **UX-01**: App is installable as a PWA on phone and tablet
- [x] **UX-02**: UI uses large tap targets (min 48px) optimized for thumb-zone interaction
- [x] **UX-03**: App works in both portrait and landscape orientation
- [x] **UX-04**: Recording and navigation controls are accessible one-handed

### Receipt Import

- [x] **IMPORT-01**: Auctioneer can upload a CSV file and get receipt numbers parsed
- [x] **IMPORT-02**: Auctioneer can upload an XLSX file and get receipt numbers parsed
- [x] **IMPORT-03**: Invalid receipt numbers are silently skipped during import
- [x] **IMPORT-04**: Blank items are created for each valid receipt number in a new sale session

## v1.1 Requirements

Requirements for milestone v1.1 Accounts & Deploy. Each maps to roadmap phases.

### Authentication

- [x] **AUTH-01**: User can log in with email and password via Supabase Auth
- [x] **AUTH-02**: Auth session managed by Supabase (automatic token refresh)
- [x] **AUTH-03**: Unauthenticated users are redirected to login page
- [x] **AUTH-04**: User can change their own password

### Account Management

- [x] **ACCT-01**: Admin can create new specialist accounts with username and password
- [x] **ACCT-02**: Admin can view list of all accounts with roles
- [x] **ACCT-03**: Admin can deactivate a specialist account (blocks login without deleting)
- [x] **ACCT-04**: Account management page is only accessible to admin role

### Session Assignment

- [x] **ASGN-01**: Admin can assign a session to a specialist when creating it
- [x] **ASGN-02**: Specialist sees only sessions assigned to them and sessions they created
- [x] **ASGN-03**: Admin can reassign an active session to a different specialist
- [x] **ASGN-04**: Admin can view all sessions with assignee names and status

### Session Lifecycle

- [x] **LIFE-01**: Specialist can submit a completed session to admin for review
- [x] **LIFE-02**: Submitted sessions are locked for the specialist (read-only unless returned)
- [x] **LIFE-03**: Admin can edit item fields directly on submitted sessions
- [x] **LIFE-04**: Admin can return a submitted session to the specialist with review notes
- [x] **LIFE-05**: Returned sessions show review notes to the specialist
- [x] **LIFE-06**: Only admin can export session data as JSON

### Backend Infrastructure

- [x] **INFRA-01**: Supabase project configured with Postgres database and auth
- [x] **INFRA-02**: Row-level security (RLS) policies enforce role-based data access
- [x] **INFRA-03**: Session/item data is server-authoritative (Dexie retains audio/photos only)
- [x] **INFRA-04**: Service worker excludes Supabase API routes from caching

### Deployment

- [ ] **DEPLOY-01**: App deployed to Vercel with auto-deploy from main
- [ ] **DEPLOY-02**: CI pipeline: lint, typecheck, test, build via GitHub Actions
- [ ] **DEPLOY-03**: Cloudflare Worker CORS restricted to production Vercel domain
- [ ] **DEPLOY-04**: Branch protection on main: require CI checks before merge

### Photo Upload (Phase 19)

- [x] **PHOTO-UPLOAD-01**: Photos upload to Supabase Storage immediately after capture (fire-and-forget, non-blocking)
- [x] **PHOTO-UPLOAD-02**: Dedicated photo upload queue with bounded concurrency (2) and exponential backoff retry (3 attempts)
- [x] **PHOTO-UPLOAD-03**: Thumbnails show sync status overlay (uploading spinner, uploaded check, failed retry icon)
- [x] **PHOTO-UPLOAD-04**: Existing Dexie photos migrate to Storage automatically on app load (background, non-blocking)
- [x] **PHOTO-UPLOAD-05**: Photos display from local Dexie blob when available, falling back to Supabase signed URL
- [x] **PHOTO-UPLOAD-06**: Reconnection drain order is metadata -> photos -> audio
- [x] **PHOTO-UPLOAD-07**: Export reads local blobs first, downloads from Storage when missing
- [ ] **PHOTO-UPLOAD-08**: Human verification confirms end-to-end photo upload flow

## Future Requirements

Deferred to v1.2+. Tracked but not in current roadmap.

### Dashboard

- **DASH-01**: Separate web app reading from Supabase for cross-app analytics
- **DASH-02**: View session activity, specialist workload, import success rates

### Bulk Operations

- **BULK-01**: Bulk session assignment (split receipt list across multiple specialists)

### Audit

- **AUDT-01**: Activity log / audit trail for session lifecycle events

### AI Enhancements

- **AI-05**: Category-aware AI prompts (furniture/books/fashion use different extraction strategies)
- **AI-07**: Custom vocabulary injection for auctioneer-specific terminology

### Photo Enhancements

- **PHOTO-01**: User can reorder photos per item (drag to set hero shot)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time collaboration | Small team, serialized workflow (assign -> record -> submit -> review) eliminates need |
| Self-registration | Admin creates all accounts; no public signup |
| OAuth/SSO | Username/password sufficient for 2-5 person internal team |
| Offline session creation for assigned work | Assigned sessions require server; specialists can still create personal sessions offline |
| Video recording | Large files destroy offline queue; photos + voice sufficient |
| Direct RFC API integration | Leverage existing extension infrastructure |
| On-device AI processing | Model size too large for mobile; offline queue solves connectivity problem |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

### v1.0 (Complete)

| Requirement | Phase | Status |
|-------------|-------|--------|
| VOICE-01..04 | Phase 2 | Complete |
| AI-01..03 | Phase 5 | Complete |
| MEAS-01..04 | Phase 05.1 | Complete |
| HOUSE-01..04 | Phase 4 | Complete |
| SALE-01..03 | Phase 4 | Complete |
| EDIT-01..04 | Phase 6 | Complete |
| SESS-01..04 | Phase 3 | Complete |
| OFFL-01..04 | Phase 8 | Complete |
| EXPO-01..03 | Phase 6 | Complete |
| EXT-01..04 | Phase 7 | Complete |
| UX-01..04 | Phase 1 | Complete |
| IMPORT-01..04 | Phase 9 | Complete |

### v1.1 (Current)

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 11 | Complete |
| INFRA-02 | Phase 11 | Complete |
| AUTH-01 | Phase 12 | Complete |
| AUTH-02 | Phase 12 | Complete |
| AUTH-03 | Phase 12 | Complete |
| AUTH-04 | Phase 12 | Complete |
| INFRA-04 | Phase 12 | Complete |
| ACCT-01 | Phase 13 | Complete |
| ACCT-02 | Phase 13 | Complete |
| ACCT-03 | Phase 13 | Complete |
| ACCT-04 | Phase 13 | Complete |
| INFRA-03 | Phase 14 | Complete |
| ASGN-01 | Phase 15 | Complete |
| ASGN-02 | Phase 15 | Complete |
| ASGN-03 | Phase 15 | Complete |
| ASGN-04 | Phase 15 | Complete |
| LIFE-01 | Phase 16 | Complete |
| LIFE-02 | Phase 16 | Complete |
| LIFE-03 | Phase 16 | Complete |
| LIFE-04 | Phase 16 | Complete |
| LIFE-05 | Phase 16 | Complete |
| LIFE-06 | Phase 16 | Complete |
| DEPLOY-01 | Phase 17 | Pending |
| DEPLOY-02 | Phase 17 | Pending |
| DEPLOY-03 | Phase 17 | Pending |
| DEPLOY-04 | Phase 17 | Pending |
| PHOTO-UPLOAD-01 | Phase 19 | Complete |
| PHOTO-UPLOAD-02 | Phase 19 | Complete |
| PHOTO-UPLOAD-03 | Phase 19 | Complete |
| PHOTO-UPLOAD-04 | Phase 19 | Complete |
| PHOTO-UPLOAD-05 | Phase 19 | Complete |
| PHOTO-UPLOAD-06 | Phase 19 | Complete |
| PHOTO-UPLOAD-07 | Phase 19 | Complete |
| PHOTO-UPLOAD-08 | Phase 19 | Pending |

**Coverage:**
- v1.1 requirements: 34 total
- Mapped to phases: 34
- Unmapped: 0

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-20 after Phase 19 planning*
