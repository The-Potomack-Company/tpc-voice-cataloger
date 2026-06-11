# Phase 46 SPEC — photo-notes-capture-ui

**Milestone:** v1.4 Photo Notes
**Requirements:** PHN-01, PHN-02
**Scope:** client-only vertical slice — capture, persist, manage note pages; Process button terminates in a stub. Zero schema migrations, zero proxy changes, zero `items` writes.
**Written:** 2026-06-10 (planning session). Execution can start from this spec via `/gsd-plan-phase 46` (discuss-phase optional — gray areas below are pre-decided with rationale; flip any of them at plan time if the user disagrees).

<context>
v1.4 milestone intent + locked decisions: `.planning/ROADMAP.md` (v1.4 section) + `milestones/v1.4-REQUIREMENTS.md`. Risk register: `milestones/v1.4-RISKS.md`. This is the first phase of the photo-notes lane (capture → Phase 47 vision/segmentation → Phase 48 review queue → Phase 49 contract alignment → Phase 50 E2E/UAT).
</context>

## What this phase delivers

From the session detail screen of an active session, the cataloger taps "Photo notes",
photographs N pages of handwritten notes with the rear camera, sees them as an ordered
thumbnail list, can reorder/retake/delete pages, and the pages survive navigation, tab
kill, and offline periods. A "Process N pages" button is present, disabled offline,
and (this phase only) lands on a stub.

## Entry point

- **Where:** `src/pages/SessionDetail.tsx` — a "Photo notes" button in the session-level
  action area (sibling of the existing session actions, NOT inside ItemCard — notes
  pages belong to the session, not to any one item).
- **Visibility:** rendered only when `!isReadOnly` (same gate as the other mutating
  actions, `SessionDetail.tsx:109` area). Both modes (house and sale). Hidden when the
  dormant continuous-mode UI would be active (`continuousActive`) — same guard pattern,
  no interaction with `CONTINUOUS_MODE_ENABLED` (D-050 code untouched).
- **Badge:** when captured-but-unprocessed pages exist for the session, the button shows
  a count chip so a half-finished capture is rediscoverable.

## Capture surface

- **New route/screen** `src/pages/PhotoNotes.tsx` (full screen, not a modal — page lists
  with reorder need the room on phones; matches the ItemEntry full-screen precedent).
  Route nested under the session (e.g. `/session/:id/photo-notes`), pathname-based per
  the existing React Router v7 convention (no hash — iOS mic re-prompt decision).
- **Camera mechanism:** hidden `<input type="file" accept="image/*" capture="environment">`
  exactly like `src/components/PhotoCapture.tsx:95-99`. **No getUserMedia** — the app has
  never used it; the native picker handles permissions/EXIF/HEIC. Capture loop: after
  each shot the input re-opens optionally ("Add page" primary action) so multi-page
  capture is tap-tap-tap, not menu-diving. Picking from the photo library is allowed
  (same input, user choice in the OS sheet) — notes are sometimes photographed earlier.
- **Resize on ingest:** `resizeImage(file, 2048)` (`src/utils/image.ts`) — **2048, not
  the item-photo dimension**: handwriting legibility for the Phase 47 model call is the
  whole point; item photos optimize for upload size instead. Store the resized blob +
  a small thumbnail (reuse the existing thumbnail generation pattern from the photo
  pipeline).
- **Page list:** ordered thumbnails (page 1..N), each with: position number, retake
  (replaces blob in place, keeps position), delete (ConfirmDialog — destructive),
  drag-or-buttons reorder (SwipeableRow is for delete; reorder needs explicit up/down
  affordances for a11y — 44px targets).
- **Process button:** sticky footer, label "Process N pages", disabled when `N === 0`
  or offline (`navigator.onLine` + the app's existing online-status source if one is
  already centralized) with hint copy ("Processing needs a connection — pages are saved").
  This phase: tapping it hits `processNotes(sessionId)` stub that no-ops with a toast
  ("Processing lands in the next update") — keeps the wiring seam explicit for Phase 47.

## Persistence (Dexie only)

- **New Dexie table `notePages`** (schema version bump v12 → v13 in `src/db/index.ts`):

  ```ts
  interface NotePage {
    id?: number;            // ++id
    pageUid: string;        // uuid — stable identity for retake/reorder + Phase 47 idempotency
    sessionId: string;      // uuid FK (Supabase session id)
    blob: Blob;             // resized JPEG (maxDimension 2048)
    thumbnail: Blob;
    sortOrder: number;
    status: "captured";     // Phase 47 extends: "processing" | "processed"
    createdAt: string;      // ISO
  }
  ```

  Index: `++id, pageUid, sessionId, sortOrder`. Mirrors the existing `photos`/`audio`
  Dexie table shape (`src/db/types.ts:55-74`) so Phase 47's upload-queue reuse is
  mechanical.
- **No Supabase writes in this phase.** Durable page storage is the R-4 decision at
  Phase 47 (recommended: `photos` bucket `notes/{sessionId}/` prefix + `note_pages`
  table).
- **Offline:** capture path touches only Dexie → works offline by construction. No
  enqueue into the write/upload queues yet.
- **Cleanup:** deleting a page deletes the Dexie row. Session deletion cleanup of
  orphaned notePages rows: follow whatever the existing Dexie photo-cleanup pattern
  does (check `db.photos` lifecycle during planning); if none exists, add sessionId
  sweep on session delete for notePages only — do not expand scope to fix photos.

## State

- Component-local + Dexie `liveQuery` (the app's existing pattern for blob tables) —
  **no new Zustand store** for this phase. Phase 47 introduces processing state and can
  decide then whether a store is warranted.

## A11y (Phase 37 bar)

- All icon buttons labeled (`aria-label`); touch targets ≥ 44px; ConfirmDialog for
  delete; reorder operable without drag (up/down buttons); focus management on route
  enter/leave per existing page transitions; `prefers-reduced-motion` respected on any
  list animation.

## Out of scope for this phase

- Any Gemini/proxy call, any schema migration, any `items`/`item_drafts` write,
  any upload to Supabase Storage, draft review UI, confidence handling.
- Editing/cropping/rotating photos (retake covers it).
- iPad multi-column layout (phone-first; tablet inherits).

## Pre-decided gray areas (flip at plan time if user disagrees)

| Decision | Pick | Why |
|---|---|---|
| Modal vs full screen | Full screen + route | Reorderable lists on phones; ItemEntry precedent |
| getUserMedia live viewfinder | No — `<input capture>` | Matches PhotoCapture; zero new permission surface; iOS quirks avoided |
| Resize dimension | 2048 | Handwriting legibility for the Phase 47 model call |
| Page storage | Dexie only this phase | Keeps phase migration-free and executable immediately; durability is R-4/Phase 47 |
| Library picks allowed | Yes | Notes often photographed before the session; OS sheet gives it for free |
| New Zustand store | No | liveQuery suffices until processing state exists |

## UAT criteria (Phase 46)

1. Active session (house AND sale) shows "Photo notes"; a submitted/exported session does not.
2. Capture 3 pages on a phone → thumbnails appear in capture order, numbered.
3. Reorder page 3 to position 1 → order persists after navigating to an item and back.
4. Retake page 2 → new image, same position. Delete a page → confirm dialog → gone.
5. Kill the tab / relaunch the PWA → pages intact, order intact; entry button shows the page-count badge.
6. Airplane mode: capture two more pages (works); "Process" disabled with the saved-pages hint.
7. Back online: "Process N pages" enabled; tapping it shows the stub toast and changes no item data.
8. Screen reader pass: every control announced; reorder achievable without drag.

## Verification expectations for the executor

- Tests: Dexie v13 migration (upgrade from v12 with existing data), notePages CRUD +
  ordering invariants, offline gating of the Process button (mock `navigator.onLine`),
  read-only-session hiding. Component tests per the existing Vitest patterns in
  `src/tests/`.
- No change to: `geminiContinuous.ts`, `gemini.ts`, `items`/export/import code paths,
  Supabase schema, proxy config. CI green (lint, typecheck, test, build).
