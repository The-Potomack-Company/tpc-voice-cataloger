---
phase: 46-photo-notes-capture-ui
plan: 02
status: complete
---

# 46-02 SUMMARY — Photo-notes capture UI

## Delivered
- Route: `session/:sessionId/photo-notes` → `PhotoNotesPage` (`src/App.tsx`), sibling of the item route inside the AppLayout/ProtectedRoute group.
- `src/pages/PhotoNotes.tsx` — full-screen page: hidden `<input capture="environment">` capture loop (resize 2048 + 200 thumb via `resizeImage`), ordered numbered page list, a11y up/down reorder (`reorderNotePages`), in-place retake (shared input + `retakeTargetRef`), ConfirmDialog delete, sticky offline-gated "Process N pages" footer → `processNotes(sessionId)` + local stub toast.
- `src/hooks/useNotePages.ts` — `useNotePages(sessionId)` (liveQuery ordered list) + `useNotePageCount(sessionId)` (badge).
- `src/services/notesProcessing.ts` — `processNotes(sessionId: string): Promise<void>` inert seam (Phase 47 swaps the body).
- `src/pages/SessionDetail.tsx` — "Photo notes" secondary action in the lifecycle stack, gated `!isReadOnly && !continuousActive` (both modes), with a `<Badge>` chip when `useNotePageCount > 0`. Navigates to the route.

## Seams for Phase 47
- Real pipeline replaces the body of `processNotes(sessionId)` — call site + offline gate already wired.
- `NotePage.status` extends `"captured" → "processing" | "processed"`; `pageUid` is the idempotency key.
- Entry gate + badge already reflect captured-but-unprocessed pages.

## Tests
- `src/tests/photo-notes.test.tsx` (7): numbered/ordered render, reorder persistence, confirm-delete, Process gating (count 0 / offline+hint / online→spy+toast, no item write).
- `src/tests/session-detail-photo-notes.test.tsx` (5): entry visibility (active house+sale), hidden when read-only, badge, navigation.

## Gate
lint clean · tsc clean · 745 tests pass (4 skipped pre-existing) · build OK.
