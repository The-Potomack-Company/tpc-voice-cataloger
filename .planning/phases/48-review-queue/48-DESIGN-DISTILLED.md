## IA / ROUTE MAP

- Prototype shell
  - Primary rail: Home, Catalog, Ext, Setup. Home, Catalog, and Ext are clickable prototype workspaces; Setup is represented as a rail state only.
  - Top role switcher: Manager, Specialist, Admin, Dev. It changes Home content and Catalog scope/labels.
  - Global Chat: collapsed launcher shared by all roles.
  - Global confirmation modal: Dev mutation example with typed `CONFIRM`.

- Home
  - Manager Home: priority CRM queue/board for stale replies, evaluation waits, and consigner decisions.
    - Queue: priority-first ticket rows with triage/record/dispatch actions.
    - Board: same manager work as columns: Inquiry, Eval, Decision, Closed.
    - Ticket snapshot: selected ticket context and walkthrough state.
    - Ticket flow / triage: confirm item groups and triage note.
    - Ticket flow / dispatch: create scoped item tasks for specialist pools.
    - Ticket flow / decision: record accepted/declined consigner decisions.
  - Specialist Home: assigned task list and scoped item bundle workspace.
    - Task list: high-priority and department-grouped tasks only.
    - Task detail: per-item carousel, visible context, photos, estimate, notes, NFA, questions to manager, send to manager.
  - Admin Home: operational oversight, accounts, extension activity, and health.
    - CRM oversight: all visible tickets, priority first.
    - Accounts: Workspace domain and role/access controls.
    - Extension activity: meaningful batch/upload/import activity, not raw error feed.
    - Admin ops: purge/health and link to Cataloging review; review is explicitly moved out of Admin Home.
  - Dev Home: diagnostics and guarded mutation surface.
    - Health: Cloud Run API, Gmail poller, Database, AI proxy, Extension.
    - Logs: read-only anomaly drilldowns.
    - Confirmation model: every production mutation requires typed confirmation.

- Catalog
  - Final simplified Catalog list: a single searchable session list with role-dependent scope.
    - Manager/Admin: "All sessions", grouped by owner/date, with Review/Export/Sync filters and review strip cards.
    - Specialist: "My sessions", assigned or self-created sessions only; no review strip/filter bar; create-session FAB active.
    - Dev: "Catalog analytics", all sessions as read-only health/contract analytics; filters are All/Sync/Contracts.
  - Overview / Sessions desk: active sessions, drafts waiting, sync queue, admin review, walkthrough, offline/upload/synced status stack.
  - Voice capture: single-shot item entry, AI-filled fields, low-confidence estimate, blank condition, item-scoped photos.
  - Photo notes: flagged note-page slot for ordered handwritten page capture and processing.
  - Draft review: new queue for approve, edit-promote, discard.
  - Export/Admin: export readiness, draft holds, sync holds, user management, purge/health.
  - IA / contract: route map plus explicit contract changes wanted.
  - Role variation: Dev relabels Overview to Analytics, Export/Admin to Sync health, IA / contract to Contracts, and hides Voice capture, Photo notes, and Draft review workflow tabs from its Catalog view.

- Modeled app routes in the IA panel
  - `/`: Sessions - Active, submitted, returned, exported. Admin grouping by specialist stays tucked.
  - `/new`: New session - Sale cataloging session with a single capture path.
  - `/session/:id`: Session workspace - Voice capture spine, items list, photo-notes entry point.
  - `/session/:id/item/:itemId`: Item capture/edit - Audio, fields, per-item photos, AI status.
  - `/session/:id/photo-notes`: Note pages - Flagged slot; no layout jump while disabled.
  - `/session/:id/drafts`: Draft review - New queue: approve, edit-promote, discard.
  - `/settings`: Settings - Install, theme, account-level preferences.
  - `/admin/accounts`: Accounts - Admin-only, reachable from Export/Admin.
  - `dark flags`: Continuous mode - Reserved slot, hidden by default.

- Extension
  - Popup launcher: Skip/Append/Replace mode, generate catalog entry, start batch, upload photos, transform sheet, print invoices, current run progress.
  - RFC page surface: persistent TPC/Invoices/Upload actions.
  - Role variation: extension does not adapt by role; extension errors always appear for Dev and only become Admin-visible as meaningful operational activity.

## REVIEW QUEUE UX

- List grouping: the designed queue appears inside Catalog and is also represented in the all-session list as draft holds. Manager/Admin see every specialist session; Specialist sees only assigned/self-created drafts; Dev sees analytics only. The draft queue list shows three states: `review`, `blank field`, and `blocked`.
- Draft rows: each row carries item number/title, short reason copy, and a badge. The examples are "004 Federal card table" with low estimate confidence and receipt acknowledgement required, "005 Gilt mirror" with blank condition/title confident, and "006 Pair side chairs" with duplicate page segment blocked.
- Draft detail: selected draft has a center detail panel with extracted fields and an editable text area before promotion, plus a right-side source evidence panel showing page content.
- Per-field confidence: fields render as rows with a label, value, and badge. High confidence uses percentage badges such as `96%` and `91%`; low confidence rows are visually warned with percentages such as `78%`; receipt number has an `ack` badge; blank fields show `Blank: not guessed` and `empty`.
- Approve/promote: `Approve -> promote` changes status copy to `Draft promoted into the normal item contract. Row is now immutable to reprocessing.`
- Edit-promote: `Edit then promote` uses the text area value and changes status copy to `Edited fields promoted into the normal item contract with reviewer acknowledgement.`
- Discard: `Discard` changes status copy to `Draft discarded. Row is immutable and excluded from later processing.`
- Receipt acknowledgement: receipt numbers extracted from notes require explicit reviewer acknowledgement; the prototype shows `receipt ack`, `3 receipt ack`, `Receipt no.`, and `ack` states.
- Duplicate block: reprocessing the same page-content segment should return an existing/blocked state instead of creating another draft. The blocked draft routes to existing immutable draft/action rather than presenting a normal promotion path.
- Receipt + duplicate-block surfaces: the Photo notes side panel explains receipt ack and duplicate-block rules; the Draft review source panel says promoted/discarded drafts do not reprocess and acknowledgement/duplicate-block states stay visible.
- Offline states: overview says writes are queued locally and review remains readable; Photo notes says pages are saved locally and processing waits for connection; Voice says item photos queue behind item metadata when offline; Export/Admin holds syncing sessions with queued writes.

## COMPONENT INVENTORY

- App shell / primary navigation: prototype rail/topbar maps to `src/layouts/AppLayout.tsx`, `src/ui/icons.tsx`, `src/components/OfflineIndicator.tsx`, `src/components/BlockedQueueBadge.tsx`, and route-level auth wrappers in `src/components/ProtectedRoute.tsx` / `src/components/AdminRouteGuard.tsx`.
- Role and access gates: role switcher is prototype-only, but real role behavior maps to `src/hooks/useUserRole.ts`, `src/pages/AccountManagement.tsx`, `src/services/adminApi.ts`, and `src/components/AdminRouteGuard.tsx`.
- Session list and grouping: Catalog single-list/session rows map to `src/pages/Sessions.tsx`, `src/components/SessionTile.tsx`, `src/components/SessionSearch.tsx`, `src/hooks/useSessions.ts`, and grouping helpers in `src/utils/groupByDate.ts`.
- Section/card/badge/button primitives: prototype `.section`, `.card`, `.badge`, `.btn`, `.metric`, and status chips map to `src/ui/Card.tsx`, `src/ui/Badge.tsx`, `src/ui/Button.tsx`, `src/ui/StatStrip.tsx`, `src/ui/Bar.tsx`, `src/ui/Eyebrow.tsx`, `src/ui/WarnBanner.tsx`, and token CSS under `src/ui/tokens/`.
- Session workspace and export/admin actions: modeled by `src/pages/SessionDetail.tsx`, `src/components/ItemList.tsx`, `src/components/ItemCard.tsx`, `src/components/ReturnDialog.tsx`, `src/components/ConfirmDialog.tsx`, and `src/components/ExportHistoryList.tsx`.
- Voice capture / item entry: maps to `src/pages/ItemEntry.tsx`, `src/components/RecordButton.tsx`, `src/components/RecordingIndicator.tsx`, `src/components/RecordingToast.tsx`, `src/ui/Waveform.tsx`, `src/components/ReceiptNumberInput.tsx`, and `src/components/EditableField.tsx`.
- Item field rows with confidence/blank states: current editable item fields map partly to `src/components/EditableField.tsx` and `src/components/ItemCard.tsx`; confidence-specific field rows are implied new composition over existing `Badge`, `Card`, and field primitives.
- Photo notes page capture: maps to `src/pages/PhotoNotes.tsx`, `src/hooks/useNotePages.ts`, `src/db/notePages.ts`, `src/hooks/useBlobUrl.ts`, `src/services/notesProcessing.ts`, and `src/services/processNotesWithAi.ts`.
- Draft persistence service: existing phase-47 client service is `src/services/itemDraftsApi.ts`; note processing normalization is in `src/services/processNotesWithAi.ts`.
- Draft review queue: no page/component currently maps directly to `/session/:id/drafts`; implied pieces are DraftList/DraftRow, DraftDetail, ConfidenceFieldRow, SourceEvidencePanel, DraftActionBar, and DraftActionReceipt built from existing `Button`, `Badge`, `Card`, `Modal`, and notification primitives.
- Offline/sync indicators: maps to `src/components/OfflineIndicator.tsx`, `src/hooks/useOnlineStatus.ts`, `src/hooks/useWriteAheadQueue.ts`, `src/services/offlineQueue.ts`, `src/services/photoUploadQueue.ts`, `src/services/audioUploadQueue.ts`, and upload status hooks.
- Confirmation modals: maps to `src/ui/Modal.tsx`, `src/components/ConfirmDialog.tsx`, and the Dev prototype's typed confirmation pattern.
- Dev diagnostics surfaces: prototype health/logs/contract cards do not have a direct app page; related backend/admin surfaces are `cataloger-api/src/server.js`, `src/components/BlockedQueueBadge.tsx`, tests under `src/tests/cataloger-api-*`, and API client services.
- Extension launcher/RFC surface: no direct `src/` app component found; modeled as an external extension UI concept.
- Global chat: no direct `src/` chat component found.

## CONTRACT CHANGES WANTED

- `List endpoint shape`
  - Verbatim design wants: `Design needs draft list counts by status + low-confidence/receipt-ack/duplicate-block summary per session.`
  - Current merged API/client: `cataloger-api/src/server.js` exposes `/item-draft-batches` with `POST` only. It writes incoming draft rows and returns `{ ok: true, draftCount, skippedCount }`. `src/services/itemDraftsApi.ts` only calls `POST /item-draft-batches`. Session listing in `src/hooks/useSessions.ts` groups `sessions` by lifecycle status and `useSessionReviewCount` counts `items` needing review, not `item_drafts`.
  - Delta: there is no draft list endpoint shape, no per-session draft counts by draft `status`, no low-confidence count, no receipt-ack count, and no duplicate-block summary in the current client-facing API.

- `Action receipts`
  - Verbatim design wants: `Promote, edit-promote, discard responses should include immutable action acknowledgement and promoted_item_id when applicable.`
  - Current merged API/client: `cataloger-api/src/server.js` has no promote, edit-promote, or discard route. `src/services/itemDraftsApi.ts` has no action client. The generated Supabase type for `item_drafts` includes `promoted_item_id`, `status`, `receipt_number_acknowledged`, and `receipt_number_requires_review`, but the cataloger-api action surface does not return them. The only draft API response is `{ ok: true, draftCount, skippedCount }`.
  - Delta: action endpoints/responses and immutable action acknowledgements are absent; `promoted_item_id` exists in schema types but is not produced by any merged cataloger-api/client review action.

- `Duplicate-block payload`
  - Verbatim design wants: `Expose the existing draft id/status that blocked a duplicate page segment so the UI can route the reviewer.`
  - Current merged API/client: duplicate protection is implemented through PostgREST writes against `item_drafts` using `on_conflict=session_id,page_content_key,page_segment_index`. The server first `PATCH`es only rows with `status=eq.draft`; if no draft row changes, it `POST`s with `resolution=ignore-duplicates,return=representation`. Existing promoted/discarded/reviewed rows are skipped and reported only through `skippedCount`. `DuplicateDraftBatchError` exists client-side for HTTP 409, but the server's normal duplicate path reports counts, not the blocking row.
  - Delta: duplicate blocking is count-only from the client perspective; the current API does not return the existing draft `id`, existing draft `status`, or any route target for the reviewer.

- `Source evidence URLs`
  - Verbatim design wants: `Draft rows need resolvable source page thumbnails or signed URLs for side-by-side review.`
  - Current merged API/client: draft rows persist `source_page_refs` and `raw_ocr_text`. `src/services/processNotesWithAi.ts` sends `pageUid`, `sortOrder`, and `pageContentKey`; `src/db/notePages.ts` stores page blobs/thumbnails locally in Dexie; `src/pages/PhotoNotes.tsx` displays local thumbnails through `useBlobUrl`. The cataloger-api does not create or return source page thumbnail URLs or signed URLs for draft rows.
  - Delta: the current draft data has references and raw OCR text, but no resolvable evidence URL field in the API response surface.

- `Offline action policy`
  - Verbatim design wants: `Confirm whether draft promote/discard can be write-ahead queued or must be online-only.`
  - Current merged API/client: `PhotoNotesPage` disables processing while offline and shows `Processing needs a connection — pages are saved.` Existing write-ahead/offline services cover session/item writes, audio AI queueing, and photo/audio uploads. There are no draft promote/discard actions and no draft-action queue policy in `src/services/itemDraftsApi.ts`.
  - Delta: draft action offline behavior is undefined in the merged implementation; there is no current online-only enforcement or write-ahead queue for draft promote/discard.

- `Receipt numbers can appear as item fields and require explicit reviewer acknowledgement when extracted from notes.`
  - Verbatim design wants: `Receipt numbers can appear as item fields and require explicit reviewer acknowledgement when extracted from notes.`
  - Current merged API/client: `rowFromDraft` sets `receipt_number_requires_review: Boolean(draft.fields?.receipt_number)`. The database types include `receipt_number_acknowledged` and `receipt_number_requires_review`. The client persists `receipt_number` and confidence in `ItemDraftPayload`, but has no review UI or action endpoint to acknowledge the receipt number.
  - Delta: the flag storage exists, but acknowledgement is not exposed as a client action or action receipt.

- `Processing the same page-content segment again returns an existing/blocked state instead of creating a second draft.`
  - Verbatim design wants: `Processing the same page-content segment again returns an existing/blocked state instead of creating a second draft.`
  - Current merged API/client: re-emits against non-draft rows are left unchanged by the `status=eq.draft` guarded update and conflict-ignore insert. Tests cover skip behavior for `promoted`, `discarded`, and `reviewed` rows. The API response reports `skippedCount` but does not encode an `existing` or `blocked` state.
  - Delta: the current API prevents a second draft, but does not return the existing/blocked state described by the prototype.

- `Promoted and discarded drafts do not reprocess. Acknowledgement and duplicate-block states stay visible.`
  - Verbatim design wants: `Promoted and discarded drafts do not reprocess. Acknowledgement and duplicate-block states stay visible.`
  - Current merged API/client: the guarded batch write preserves non-draft rows by skipping updates unless `status=eq.draft`. No list endpoint currently returns promoted/discarded rows, receipt acknowledgement state, or duplicate-block state for visibility in review.
  - Delta: immutability on reprocess is partially present at the write guard; post-action visibility is absent from the client-facing API.

- `Sessions with unresolved drafts or queued writes should hold export.`
  - Verbatim design wants: `Sessions with unresolved drafts or queued writes should hold export.`
  - Current merged API/client: `SessionDetailPage` disables admin finalize/export when `queuedCount > 0`, where `queuedCount` is based on `items.ai_status === "queued"`. It does not inspect unresolved `item_drafts`. The prototype's export hold row for drafts has no current API-backed equivalent.
  - Delta: queued item work can hold export; unresolved draft rows cannot currently hold export through the merged client/API path.

- `Draft actions acked by cataloger-api.`
  - Verbatim design wants: `Draft actions acked by cataloger-api.`
  - Current merged API/client: cataloger-api acknowledges draft batch persistence only through `{ ok: true, draftCount, skippedCount }`; there are no draft action requests or action acknowledgements.
  - Delta: batch persistence acknowledgement exists; draft action acknowledgement does not.

- `CONTRACT CHANGES WANTED`
  - Verbatim design wants: `Endpoint shape, action receipts, duplicate-block payload, evidence URLs, offline policy.`
  - Current merged API/client: the available cataloger-api draft surface is limited to `POST /item-draft-batches`; phase-47 client services normalize/process notes and persist batches, but do not list drafts, perform actions, return evidence URLs, or define draft-action offline policy.
  - Delta: the prototype's Dev analytics contract summary spans endpoints and behaviors that are not present in the merged phase-47 client/API surface.

- `Manager contract concern: session summary must expose ticket id, assigned specialist, draft blocker count, and export hold reason.`
  - Verbatim design wants: `Manager contract concern: session summary must expose ticket id, assigned specialist, draft blocker count, and export hold reason.`
  - Current merged API/client: session rows include lifecycle/status fields and `assigned_to`; `SessionsPage` can group by assignee for admin. There is no CRM ticket id, draft blocker count, or export hold reason in the current cataloger-api draft surface or session hooks.
  - Delta: assigned specialist is partially present; ticket id, draft blocker count, and export hold reason are absent from the current client-facing session summary.

- `Shared manager/admin contract concern: list sessions by specialist owner, status, draft blockers, sync state, and export readiness.`
  - Verbatim design wants: `Shared manager/admin contract concern: list sessions by specialist owner, status, draft blockers, sync state, and export readiness.`
  - Current merged API/client: `SessionsPage` lists sessions by status and can group admin view by assignee; sync state is represented indirectly by local queue indicators and item `ai_status`; export readiness is controlled locally by queued item count during finalize. Draft blockers are not joined into the session list.
  - Delta: specialist owner/status are partially present; draft blockers, unified sync state, and export readiness are not returned as one session-list contract.

- `Specialist contract concern: assigned session list must join Home tasks, item bundles, note-page drafts, and offline write status.`
  - Verbatim design wants: `Specialist contract concern: assigned session list must join Home tasks, item bundles, note-page drafts, and offline write status.`
  - Current merged API/client: specialist-visible sessions are scoped through auth/session data and local hooks; note pages live in Dexie and draft batches persist through `itemDraftsApi`; offline write status is local queue state. There is no joined specialist session/task/draft/offline API shape.
  - Delta: the data exists across separate client stores/services, but not as a joined assigned-session contract.

- `Admin contract concern: review endpoints need submitted, returned, exported, specialist, account, and action receipt fields.`
  - Verbatim design wants: `Admin contract concern: review endpoints need submitted, returned, exported, specialist, account, and action receipt fields.`
  - Current merged API/client: session lifecycle values `submitted`, `returned`, and `exported` exist; account listing exists at `GET /admin/list-users`; draft action receipts do not exist. Admin review is implemented through session status changes and export utilities, not a review endpoint returning those fields together.
  - Delta: lifecycle and account data are available separately; no combined admin review endpoint includes specialist/account/action receipt fields.

- `CONTRACT CHANGES WANTED belongs in Dev analytics/contracts, with workflow details summarized as system health.`
  - Verbatim design wants: `CONTRACT CHANGES WANTED belongs in Dev analytics/contracts, with workflow details summarized as system health.`
  - Current merged API/client: there is no Dev analytics/contracts app route in `src/App.tsx`; diagnostics are represented by tests, logs, local queue indicators, and cataloger-api code rather than a client contract-health surface.
  - Delta: the Dev-facing contract-health surface is not present in the merged app route map.

## OPEN QUESTIONS

- The Dev analytics strip says `6 open gaps`, but the explicit `CONTRACT CHANGES WANTED` panel lists five lines. Is receipt acknowledgement or export hold intended to be the sixth?
- Are Manager and Admin truly identical for the all-session Catalog list, or should Admin-only approval/export actions be hidden from Manager while preserving the same data scope?
- Who is allowed to approve/edit-promote/discard drafts: Specialist before submission, Admin after submission, or both depending on session status?
- Should `/session/:id/drafts` be a real route, an in-session panel, or only a Catalog filtered state?
- What fields are editable during `Edit then promote`: only description text, all extracted fields, receipt acknowledgement, or source attribution too?
- What exact immutable action receipt fields should be shown after promote/discard beyond `promoted_item_id`?
- Should duplicate-block rows appear in the draft queue as non-actionable blocked rows, or should they redirect immediately to the existing draft/action?
- Should source evidence URLs be generated from local Dexie blobs, uploaded note-page objects, or a server-side signing endpoint?
- How should export holds combine unresolved drafts, receipt acknowledgements, duplicate blocks, queued writes, and queued media uploads?
- Should Dev be able to inspect draft details read-only despite the prototype hiding Draft review workflow tabs in Dev Catalog?
