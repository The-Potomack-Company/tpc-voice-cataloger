---
phase: 46-photo-notes-capture-ui
plan: 01
status: complete
---

# 46-01 SUMMARY — Dexie v13 notePages data layer

## Delivered
- `NotePage` type (`src/db/types.ts`): `{ id?, pageUid, sessionId, blob, thumbnail, sortOrder, status: "captured", createdAt }`. `sessionId` is the Supabase session UUID string; `pageUid` = `crypto.randomUUID()` (retake/reorder identity + Phase 47 idempotency key).
- `db.version(13)` (`src/db/index.ts`): adds `notePages: "++id, pageUid, sessionId, sortOrder"`. New empty table, no `.upgrade()` (v9/v11 precedent). v1–v12 blocks untouched.
- `src/db/notePages.ts` export surface (what Plan 02 binds to):
  - `getNotePages(sessionId): Promise<NotePage[]>` — ordered by sortOrder
  - `countNotePages(sessionId): Promise<number>`
  - `addNotePage({ sessionId, blob, thumbnail }): Promise<number>` — assigns pageUid + next sortOrder + status "captured"
  - `retakeNotePage(id, { blob, thumbnail })` — in place, keeps pageUid/sortOrder
  - `deleteNotePage(id)`
  - `reorderNotePages(orderedIds: number[])` — rewrites sortOrder 0..N-1 in one tx (NOTE: signature is `(orderedIds)` only — sessionId dropped as unused)
  - `deleteNotePagesForSession(sessionId)` — sweep
- Session-delete cleanup: `sessionStore.deleteSession` calls `deleteNotePagesForSession(id)` (best-effort) on Supabase-delete success.

## Tests
- `src/tests/note-pages.test.ts` (6) + `src/tests/db.test.ts` bumped 12→13 tables + v13 data-survival + index assertions. All green.

## Notes for downstream
- fake-indexeddb returns `{}` for stored Blobs in tests — assert identity/ordering/count invariants, not blob content.
