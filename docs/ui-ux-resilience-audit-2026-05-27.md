# UI/UX and Resilience Audit

Date: 2026-05-27

Scope: current worktree read-only source audit of the React/Vite/Supabase app, focused on user experience, error messages, retry and failure handling, and preventing data loss. This document records issues found in the app and suggests concrete fixes. It does not include code changes.

## Executive Summary

The app has strong foundations for resilience: local Dexie storage for audio/photos, a Supabase-backed session/item store, write-ahead queueing, photo upload queueing, offline banners, AI failed states, and confirmation dialogs for destructive actions.

The dominant risk is not lack of persistence. It is that many failure paths are silent, console-only, or visually optimistic. Users can believe work saved, exported, migrated, uploaded, or synced when the operation failed, reverted, or is stuck behind a local-only dependency.

The highest-value product fix is a shared operation-state model surfaced consistently in the UI:

- `saving`
- `saved`
- `queued locally`
- `sync blocked`
- `failed but preserved locally`
- `retrying`
- `failed permanently`

That model should be wired through edits, migration, export, recording, photo upload, AI processing, admin actions, and account management.

## Critical Issues

### 1. Migration Can Clear Local Metadata After Partial Failure

Evidence:

- `migrateToSupabase` counts skipped records, but still clears local metadata tables afterward.
- File: `src/db/migration.ts`
- Key behavior: skipped sessions/items are counted, then `db.sessions.clear()`, `db.houseVisitItems.clear()`, `db.saleItems.clear()`, and `db.exportHistory.clear()` run.

Why it matters:

If any session or item fails to migrate, the user can lose the local metadata needed to retry or manually recover. Photos and audio are preserved, but their meaningful session/item context can be damaged.

Suggested fix:

- Do not clear a local record until that exact record is proven migrated and mapped.
- Store failed migration records in a `migrationFailures` or similar Dexie table with original payload, error, and retry count.
- Mark migration as partial when `skipped > 0`.
- Provide a recovery UI that lists failed sessions/items and allows retry/export of the local copy.
- Add tests that prove skipped records remain recoverable.

### 2. Migration Success Copy Can Be False

Evidence:

- `MigrationSplash` shows `"All sessions are now synced to the server."` for any `complete` state.
- File: `src/components/MigrationSplash.tsx`
- `useDataMigration` sets `state: "complete"` even when `migrateToSupabase` returns skipped items.

Why it matters:

Users may trust that all historical work is safe on the server when some records were skipped.

Suggested fix:

- Treat `skipped > 0` as `partial` rather than `complete`.
- Show exact counts: migrated, skipped, still local.
- Require explicit user acknowledgement before continuing after partial migration.
- Offer retry and local export before allowing cleanup.

### 3. Silent Failed Saves Can Make Users Believe Data Was Saved

Evidence:

- `updateItemField` optimistically updates local state, then silently reverts on non-network errors.
- File: `src/stores/sessionStore.ts`
- Callers frequently ignore or only log failures, for example `ItemEntry` field saves call `.catch(console.error)`.
- File: `src/pages/ItemEntry.tsx`
- `EditableField` closes edit mode immediately after calling `onSave`.
- File: `src/components/EditableField.tsx`

Why it matters:

A user can edit title, description, estimate, measurements, etc., leave the field, see it briefly update, then have the value revert without an explanation. This is a direct data-loss and trust issue.

Suggested fix:

- Make field save APIs return structured results: `{ ok, queued, error, restoredValue }`.
- Keep the editor open or show an inline unsaved state until persistence succeeds or queues.
- If persistence fails, preserve the user's draft and show: `"Could not save. Your text is still here."`
- Provide retry and discard actions.
- Add tests for failed save preserving draft text.

### 4. Audio Save Failure Can Hang Recording Stop and Risk Losing Work

Evidence:

- `useAudioRecorder` resolves `stopRecording` only after successful `db.audio.add`.
- If `db.audio.add` fails, the catch logs `"Failed to save audio"` but does not resolve or reject the promise.
- File: `src/hooks/useAudioRecorder.ts`

Why it matters:

If IndexedDB write fails due to quota, browser storage restrictions, or a transient browser error, the record button flow can hang and the captured blob may be lost with no user-visible recovery path.

Suggested fix:

- Reject or resolve `stopRecording` with an explicit failure result.
- Keep the blob in memory until the user can retry saving or intentionally discard.
- Show a blocking message: `"Recording could not be saved. Keep this page open and retry."`
- Add tests for Dexie write failure and promise settlement.

### 5. Offline AI Retry Depends on Local-Only Audio Without Explaining That Constraint

Evidence:

- Queued AI processing is driven by Supabase item status, but actual audio is read from Dexie on the current device.
- File: `src/services/offlineQueue.ts`
- If audio is not found locally, the item is marked failed.

Why it matters:

An admin or specialist on another device can see a queued item, but cannot process it because the audio blob exists only on the original device. The UI does not clearly explain this dependency.

Suggested fix:

- Label affected items: `"Audio saved on another device. Open this session on the recording device to process."`
- Do not automatically mark remote queued items as permanently failed simply because the current device lacks local audio.
- Consider uploading encrypted audio blobs or storing server-side AI job inputs if cross-device processing is required.

## High Severity Issues

### 6. Write-Ahead Queue Failures Block Later Writes Without User-Visible Status

Evidence:

- `processWriteAheadQueue` stops on the first failed entry to preserve FIFO ordering and only logs to console.
- File: `src/hooks/useWriteAheadQueue.ts`

Why it matters:

A permanent failure, such as RLS rejection or deleted parent record, can block every later queued write. Users see stale or optimistic data but no clear “sync blocked” state.

Suggested fix:

- Track queue health in UI: pending count, blocked count, last error.
- Distinguish transient network failures from permanent server/RLS/conflict failures.
- Show a global banner: `"3 changes could not sync. Review and retry."`
- Provide per-entry retry, discard, and conflict resolution.

### 7. New Session Creation Can Leave the User Stuck on Failure

Evidence:

- `NewSessionPage.doCreate` has `try/finally` but no catch or error state.
- File: `src/pages/NewSession.tsx`
- `createSession` can throw after reverting the optimistic add for non-network errors.

Why it matters:

If session creation fails for auth, RLS, validation, or server reasons, the user is left on the page with the button reset but no explanation.

Suggested fix:

- Add `createError` state.
- Preserve entered name, mode, notes, and assignee.
- Show retry with specific copy:
  - auth: `"Your session expired. Sign in again."`
  - permission: `"You do not have permission to create this session."`
  - server: `"Could not create session. Try again."`

### 8. Import Receipt List Is Not Transactional

Evidence:

- New sale session is created first, then each receipt creates an item and updates `receipt_number` one by one.
- File: `src/pages/NewSession.tsx`

Why it matters:

If the import fails halfway, the app may leave a partially created session with only some items. The toast says generic import failure and does not show what was created.

Suggested fix:

- Prefer a batch RPC/transaction for session plus receipt items.
- If client-side loop remains, collect per-row results and show a recovery summary:
  - created count
  - failed receipt numbers
  - retry failed rows
  - delete partial session

### 9. Export Failures Are Invisible to the User

Evidence:

- JSON export and spreadsheet export catch errors and only log to console.
- File: `src/pages/SessionDetail.tsx`

Why it matters:

Export is a core handoff path. If export fails, the user may not know whether a file was downloaded, history was recorded, or the session was marked exported.

Suggested fix:

- Show a persistent export error banner/toast with retry.
- Do not update session status to `exported` unless file generation and intended history write both succeed.
- If browser download succeeds but history insert fails, show a separate warning: `"File downloaded, but export history could not be saved."`

### 10. Export History Write Happens After Download and Is Not Checked Separately

Evidence:

- `exportSession` clicks the download link, then inserts into `export_history`.
- File: `src/utils/export.ts`

Why it matters:

The user may have a valid export file, but history can fail. Current catch treats the whole export as failed after download already occurred.

Suggested fix:

- Split export generation/download from export history recording.
- Track and message each outcome independently.
- Consider recording history before status change, not necessarily before download.

### 11. Photo Save Failures Are Console-Only

Evidence:

- `PhotoCapture.handleKeep` catches photo resize/Dexie save errors and logs only.
- File: `src/components/PhotoCapture.tsx`

Why it matters:

If photo processing or local storage fails, the preview disappears and the user may think the photo was kept.

Suggested fix:

- Keep preview visible on save failure.
- Show `"Could not save photo. Retake, retry save, or discard."`
- Detect quota/storage errors and tell the user how to recover.

### 12. Photo Upload Metadata Can Duplicate or Fail Permanently After Successful Storage Upload

Evidence:

- Storage uploads use `upsert: true`, but the `photos` metadata row uses plain insert.
- File: `src/services/photoUploadQueue.ts`

Why it matters:

If storage upload succeeds but metadata insert fails, retry can encounter duplicate/conflict behavior and may mark an actually uploaded photo as failed.

Suggested fix:

- Use an upsert keyed by item/path or a unique constraint.
- Treat duplicate metadata as success when storage path matches.
- Store upload phase in queue entry to avoid redoing successful phases unnecessarily.

### 13. Photo Upload Retry UX Is Hidden Behind Thumbnail Tap

Evidence:

- Failed thumbnails trigger `retryFailedUploads()` when tapped.
- File: `src/components/PhotoCapture.tsx`
- `PhotoMigrationBanner` says “Tap thumbnails to retry.”
- File: `src/components/PhotoMigrationBanner.tsx`

Why it matters:

The retry action is not self-evident or accessible enough, especially for a critical “photos not uploaded” state.

Suggested fix:

- Add a visible retry button in the banner.
- Add accessible labels on failed thumbnail buttons.
- Show per-photo upload status and last error when possible.

### 14. Photo Migration Can Permanently Skip Photos

Evidence:

- `migrateExistingPhotos` skips photos when the Supabase item lookup returns no item, then sets the global migration complete flag.
- File: `src/services/photoMigration.ts`

Why it matters:

Unqueued photos may never be retried because the migration flag prevents future runs.

Suggested fix:

- Record skipped photo IDs and reasons.
- Do not set the global complete flag unless all photos are queued or explicitly dismissed.
- Show a recovery banner for skipped photos.

### 15. Photo Delete Is Optimistic Without Failure Recovery

Evidence:

- `PhotoLightbox.handleDelete` calls `onDelete` and immediately closes/advances UI.
- File: `src/components/PhotoLightbox.tsx`
- The current `onDelete` in item detail deletes from Dexie only.

Why it matters:

If local delete fails or if server metadata/storage remains, the UI may misrepresent state. Also, deleting local photo blobs can remove the easiest recovery path before remote cleanup is verified.

Suggested fix:

- Await delete and keep the dialog open while deleting.
- Show failure and retry.
- Decide whether deleting a photo should also delete remote storage/metadata or mark it for deletion queue.

### 16. Admin Route Failures Redirect Silently

Evidence:

- `AdminRouteGuard` ignores query errors and navigates home if role is not `admin`.
- File: `src/components/AdminRouteGuard.tsx`

Why it matters:

An admin with a temporary network or Supabase error can be redirected away with no explanation.

Suggested fix:

- Separate `forbidden` from `could not verify`.
- Show `"Could not verify admin access"` with retry.
- Keep user on the route during verification failure rather than silently redirecting.

### 17. Role Lookup Failure Silently Downgrades User

Evidence:

- `useUserRole` sets role to null on error.
- File: `src/hooks/useUserRole.ts`

Why it matters:

Network failure and “not admin” become indistinguishable. Admin-only affordances may disappear.

Suggested fix:

- Return `{ role, isAdmin, loading, error }`.
- Make pages decide whether to hide admin UI, show retry, or block.

### 18. Admin Account Loading Failures Are Partly Silent

Evidence:

- Session reassignment account loading catches with a silent fail.
- File: `src/pages/SessionDetail.tsx`
- Name map loading catches silently and falls back to UUIDs/loading labels.
- File: `src/hooks/useSessions.ts`

Why it matters:

Admin workflow can appear incomplete or confusing without saying the account list failed to load.

Suggested fix:

- Add explicit account-list error state.
- Disable reassignment with a retry button when accounts fail to load.
- Show `"Could not load assignee names"` rather than indefinite `"Loading..."`.

### 19. Account Creation Can Hide Refresh Failure

Evidence:

- `AccountManagementPage.handleCreate` closes and clears the form, then calls `fetchAccounts()` without awaiting/handling refresh result in the creation flow.
- File: `src/pages/AccountManagement.tsx`

Why it matters:

Account creation can succeed but the refreshed list may fail, leaving the admin unsure whether the account exists.

Suggested fix:

- Show success state independent of list refresh.
- If refresh fails, say `"Account created, but the list could not refresh."`
- Add retry refresh action.

### 20. Account Activation Toggle Rolls Back But Error Auto-Clears

Evidence:

- Activation/deactivation optimistically updates, reverts on failure, and shows an error that auto-clears after five seconds.
- File: `src/pages/AccountManagement.tsx`

Why it matters:

If an admin misses the temporary message, they may not know why the row changed back.

Suggested fix:

- Keep row-level error until dismissed or next attempt.
- Include the underlying reason when safe.
- Provide retry on the row.

### 21. Raw Supabase Login Errors Are Shown to Users

Evidence:

- `LoginPage` displays `error.message` directly.
- File: `src/pages/Login.tsx`

Why it matters:

Raw provider messages may be unclear, overly technical, or inconsistent.

Suggested fix:

- Map auth errors to user-safe messages:
  - invalid credentials
  - inactive account
  - network/service unavailable
  - too many attempts
- Log raw error separately for diagnostics.

### 22. Password Change Reuses Normal Sign-In Path

Evidence:

- Settings verifies current password by calling `signIn`.
- File: `src/pages/Settings.tsx`

Why it matters:

This can emit normal login analytics and potentially disturb auth/session behavior.

Suggested fix:

- Use a dedicated reauthentication or credential verification flow if available.
- Keep password-change side effects separate from login analytics.

### 23. Continuous Recording Failed Chunks Have No Real Retry UX

Evidence:

- `ContinuousModePanel` says failed chunks need retry.
- File: `src/components/ContinuousModePanel.tsx`
- Store has `retryChunk`, but it only marks pending and is not wired to reprocessing.
- File: `src/stores/continuousModeStore.ts`

Why it matters:

Continuous mode is high-risk because users may record for a long time hands-off. Failed chunks can mean missing catalog text.

Suggested fix:

- Preserve audio chunk references and expose “Retry failed chunks.”
- Show which item/chunk failed and whether audio is preserved.
- Prevent final “done” confidence until chunks drain or are explicitly dismissed.

### 24. Stopping Continuous Recording Has No Failure Recovery

Evidence:

- `useContinuousRecorder.stop` awaits recorder finalization and chunk drain without try/catch or user-visible failure handling.
- File: `src/hooks/useContinuousRecorder.ts`

Why it matters:

If finalization hangs or throws, the UI can get stuck in finalizing or lose clarity about whether audio was saved.

Suggested fix:

- Add finalization timeout and error state.
- Offer retry finalization and force stop with warning.
- Preserve master session audio and chunk buffer until resolved.

### 25. AI Retry Can Fail Silently When No Local Audio Exists

Evidence:

- `Retry All` skips stuck items with no local audio.
- File: `src/components/ItemList.tsx`
- Single-item retry is disabled when no latest audio exists, with only a title tooltip.
- File: `src/components/ItemCard.tsx`

Why it matters:

Users may see “Failed” but have no clear path forward.

Suggested fix:

- Replace disabled-only behavior with explanatory copy:
  `"No recording found on this device. Re-record or open on the recording device."`
- Add a re-record CTA.

### 26. AI Failure Overwrites Description With Generic Fallback

Evidence:

- On AI processing error, `description` is set to `"AI processing failed - audio recorded, awaiting manual review"`.
- File: `src/services/gemini.ts`

Why it matters:

If description already contained user-entered or previously extracted content, this can overwrite useful data.

Suggested fix:

- Store AI error state separately from catalog fields.
- Never overwrite user-authored fields with status copy.
- Show processing failure in UI badges/banners, not in content fields.

## Medium Severity Issues

### 27. Generic Loading States Can Mask Errors

Evidence:

- `ItemEntryPage` shows `"Loading..."` and `"Loading item..."` without timeout or error state.
- File: `src/pages/ItemEntry.tsx`
- `SessionDetailPage` shows `"Session not found."` when session is undefined, which may also happen before fetch completes or after fetch failure.
- File: `src/pages/SessionDetail.tsx`

Why it matters:

Users cannot distinguish slow load, offline cached miss, permission issue, deleted record, or server failure.

Suggested fix:

- Track per-route load status: `loading`, `not-found`, `permission-denied`, `offline-unavailable`, `error`.
- Include retry and “back to sessions” actions.

### 28. Fetch Sessions and Fetch Items Fail Silently

Evidence:

- `fetchSessions` sets loading false and returns on error.
- `fetchItems` returns on error.
- File: `src/stores/sessionStore.ts`

Why it matters:

The UI can keep stale persisted data or show empty states without explaining the server fetch failed.

Suggested fix:

- Store `sessionsError` and `itemsErrorBySession`.
- Show stale-data banners: `"Showing saved data. Could not refresh."`
- Provide retry.

### 29. Invalid Receipt File Type Has No Message

Evidence:

- Unsupported file extensions reset input and return without feedback.
- File: `src/components/ImportReceiptsButton.tsx`

Why it matters:

Users can select a file and see nothing happen.

Suggested fix:

- Show `"Unsupported file type. Use CSV, XLSX, or XLS."`
- Keep the import control focused and ready to retry.

### 30. Receipt Input Trims on Every Keystroke

Evidence:

- `ReceiptNumberInput` calls `onChange(e.target.value.trim())`.
- File: `src/components/ReceiptNumberInput.tsx`

Why it matters:

Pasting or editing with leading/trailing spaces can behave unexpectedly.

Suggested fix:

- Preserve draft text while editing.
- Trim and validate on blur/save.

### 31. Receipt Validation Only Says Format

Evidence:

- Error copy is just `"Format: XXXXX-N"`.
- File: `src/components/ReceiptNumberInput.tsx`

Why it matters:

This is concise but not very instructive for field users.

Suggested fix:

- Use `"Use five digits, a dash, then item number, for example 39135-2."`

### 32. Swipe-to-Delete Is Not Discoverable or Fully Accessible

Evidence:

- `SwipeableRow` hides delete behind pointer swipe.
- File: `src/components/SwipeableRow.tsx`
- Session rows rely on swipe for delete from list.

Why it matters:

Keyboard users and users unfamiliar with swipe gestures may not find delete.

Suggested fix:

- Add a visible overflow/actions button per row.
- Provide keyboard-accessible delete.
- Keep swipe as a shortcut, not the only affordance.

### 33. Confirmation Dialogs Lack Modal Semantics

Evidence:

- `ConfirmDialog` portal uses plain divs without `role="dialog"`, `aria-modal`, focus trap, escape handling, or backdrop click handling.
- File: `src/components/ConfirmDialog.tsx`

Why it matters:

Screen reader and keyboard users may not receive proper modal context. Focus may remain behind the dialog.

Suggested fix:

- Add dialog semantics and focus management.
- Focus the least destructive action by default.
- Support Escape to cancel.

### 34. Return Dialog Also Lacks Full Modal Semantics and Async Failure Handling

Evidence:

- `ReturnDialog` uses a portal but no focus trap or async confirm state.
- File: `src/components/ReturnDialog.tsx`

Why it matters:

Returning a session is a workflow state change. If it fails, the dialog closes via parent handler and no durable error is shown.

Suggested fix:

- Use shared async dialog primitive.
- Keep notes draft if return fails.
- Show row/session-level failure with retry.

### 35. Walkthrough Completion Has No Error Handling

Evidence:

- `Walkthrough` calls `onComplete` with no pending/error state.
- File: `src/components/Walkthrough.tsx`
- `useWalkthroughStatus` falls back to showing walkthrough on load error.

Why it matters:

Users may complete or skip the tutorial, then see it again later if persistence failed.

Suggested fix:

- Show `"Could not save tutorial status. Try again or continue for now."`
- Queue the walkthrough completion if offline.

### 36. Install Banner Dismissal Is Permanent Without Recovery

Evidence:

- `InstallBanner` stores `install-banner-dismissed=true` in localStorage.
- File: `src/components/InstallBanner.tsx`

Why it matters:

Users can dismiss installation guidance accidentally and have no Settings action to bring it back.

Suggested fix:

- Add Settings action: `"Install app"` or `"Show install instructions again."`
- Consider time-bound dismissal.

### 37. Recording Toast Overstates Durability

Evidence:

- `RecordingToast` says `"Recording saved"` after local Dexie save.
- File: `src/components/RecordingToast.tsx`

Why it matters:

The recording is saved locally on one device, not necessarily synced or backed up.

Suggested fix:

- Say `"Recording saved on this device"` or `"Recording saved locally"`.
- If server-backed audio is added later, distinguish local/server status.

### 38. Offline Indicator Is Icon-Only in Layout

Evidence:

- `OfflineIndicator` renders only an icon.
- File: `src/components/OfflineIndicator.tsx`
- Sessions page has a textual offline banner, but the layout-level indicator does not.

Why it matters:

On non-sessions routes, users may not understand the icon or know what will and will not sync.

Suggested fix:

- Add concise text or tooltip/accessible label: `"Offline - changes will sync later."`
- Include pending write count when available.

### 39. Search Shows a Filter Icon With No Filter Action

Evidence:

- `SessionSearch` displays a filter icon when no query is present, but it is not interactive.
- File: `src/components/SessionSearch.tsx`

Why it matters:

Users may expect filters and tap an inert icon.

Suggested fix:

- Remove the icon or implement filter options.
- If decorative, ensure it does not imply a control.

### 40. Continuous Mode Start Errors Are Not Surfaced in Parent UI

Evidence:

- `useContinuousRecorder.start` sets hook-local `error`, but `SessionDetailPage` does not display it near the continuous mode controls.
- Files: `src/hooks/useContinuousRecorder.ts`, `src/pages/SessionDetail.tsx`

Why it matters:

If continuous mode fails to start after creating an item, users may not see why.

Suggested fix:

- Surface continuous recorder error in `SessionDetailPage`.
- If start created an empty item before mic failure, offer to delete or keep it.

### 41. New Item Creation Failures From Navigation Are Console-Only

Evidence:

- `ItemEntryPage` creates `/item/new` and catches with `console.error`.
- File: `src/pages/ItemEntry.tsx`
- Next-arrow create failures also log only.

Why it matters:

The user can tap next/add and nothing useful appears.

Suggested fix:

- Show inline/toast failure: `"Could not create next item. Try again."`
- Preserve navigation state and avoid duplicate retries.

### 42. Merge Failure Is Console-Only

Evidence:

- `ItemList.handleMerge` catches and logs `"Merge failed"`.
- File: `src/components/ItemList.tsx`

Why it matters:

Merge is potentially destructive and multi-step. Failure can leave partial server/local state depending on where it occurred.

Suggested fix:

- Show merge error and keep selection.
- Make merge server-side transactional if possible.
- Add rollback or repair routine for partial merges.

### 43. Merge Operation Is Not Transactional

Evidence:

- `mergeItems` updates target, updates photos, updates Dexie blobs, deletes source, and then re-sorts with separate operations.
- File: `src/services/mergeItems.ts`

Why it matters:

If one step fails after earlier steps succeed, items/photos/audio can become inconsistent.

Suggested fix:

- Move merge to a Supabase RPC/transaction for server records.
- Track local media reassignment separately with recovery.
- Add validation after merge and show repair action if needed.

### 44. Account Row Toggle Loading Uses Ellipsis Only

Evidence:

- `AccountRow` renders `…` while toggling.
- File: `src/components/AccountRow.tsx`

Why it matters:

Screen readers and users may not understand what is happening.

Suggested fix:

- Use `"Deactivating..."` / `"Reactivating..."`.
- Add `aria-busy`.

### 45. UI Uses Mixed Token and Raw Tailwind/Gray Styling

Evidence:

- Several components use hardcoded Tailwind gray/red classes outside the token primitives, for example `EditableField`, `ConfirmDialog`, `ReturnDialog`, `PhotoCapture`, `ReceiptNumberInput`, and `RecordingsList`.

Why it matters:

This can create inconsistent visual states, contrast drift, and dark-mode mismatches.

Suggested fix:

- Move remaining components to shared token primitives.
- Add visual or lint coverage for raw gray/red usage outside token files.

## Accessibility and Layout Issues

### 46. Small Default Button/Input Touch Targets in Primitive CSS

Evidence:

- `.tpc-btn` default padding is 6px 12px and font-size 12.5px.
- `.tpc-input` default padding is 6px 10px and font-size 13px.
- File: `src/ui/tokens/base.css`

Why it matters:

Some buttons are given `min-h-12`, but the primitive itself does not guarantee comfortable touch targets. On mobile, smaller controls can be harder to use.

Suggested fix:

- Make the primitive default to at least 44px height for interactive controls, or define explicit compact variants only where justified.

### 47. Letter Spacing and Negative Letter Spacing Conflict With Accessibility/Design Guidance

Evidence:

- `.tpc-eyebrow` uses `letter-spacing: 0.14em`.
- `.tpc-display` uses `letter-spacing: -0.01em`.
- File: `src/ui/tokens/base.css`

Why it matters:

Excessive or negative letter spacing can reduce readability and conflicts with the stated design instruction that letter spacing should be 0.

Suggested fix:

- Revisit typography tokens for readability.
- Use weight/size/color for hierarchy instead of letter spacing.

### 48. Modals Do Not Trap Focus

Evidence:

- `ConfirmDialog`, `ReturnDialog`, `PhotoLightbox`, and `ItemPeekModal` do not implement focus trapping.

Why it matters:

Keyboard users can tab into background controls while a modal is open.

Suggested fix:

- Add a shared accessible modal primitive.
- Trap focus, restore prior focus on close, support Escape, and label the dialog.

### 49. Some Icon Buttons Lack Tooltips or Visible Labels

Evidence:

- Multiple icon-only buttons have aria labels but no visible tooltip, for example close/delete controls in lightbox and back icon buttons.

Why it matters:

Aria labels help assistive tech but sighted users may need discoverability.

Suggested fix:

- Add tooltip support for icon-only controls.

### 50. Inert Decorative Text May Be Confusing in Login Monogram

Evidence:

- Login monogram contains visible `"P"` with `aria-hidden`.
- File: `src/pages/Login.tsx`

Why it matters:

Mostly low risk, but visual-only brand marks should not be confused with app content in tests or selection.

Suggested fix:

- Keep decorative, but use CSS/background if it should not be meaningful.

## Test Coverage Gaps

### 51. Tests Verify Migration Mechanics But Not Data Recovery Guarantees

Evidence:

- `data-migration.test.ts` verifies skipped item counts and local table clearing.
- It does not fail when skipped data would be cleared.

Suggested fix:

- Add tests that skipped data remains locally recoverable.
- Add tests that UI shows partial migration, not success.

### 52. Tests Verify Write-Ahead FIFO Stop But Not User-Visible Sync Block

Evidence:

- `write-ahead-queue.test.ts` confirms entries remain when first fails.
- No test requires visible blocked state or retry UI.

Suggested fix:

- Add UI/store tests for queue status exposure.
- Add tests for permanent error classification.

### 53. Audio Recorder Tests Do Not Cover Dexie Save Failure

Evidence:

- `audio-recorder.test.ts` covers successful stop/save and mic permission errors.
- No test covers `db.audio.add` rejection.

Suggested fix:

- Add test that stop promise settles and UI receives an error.
- Assert blob is not silently discarded.

### 54. Photo Upload Tests Do Not Cover Duplicate Metadata or UI Recovery

Evidence:

- `photo-upload-queue.test.ts` covers retry count and failed state.
- No test covers duplicate metadata after storage upload or user-visible retry messaging.

Suggested fix:

- Add tests for idempotent metadata writes.
- Add component tests for failed upload banner/button behavior.

### 55. Visual E2E Tests Skip Most Authenticated UX Without Supabase Env

Evidence:

- Playwright tests skip protected routes when `SUPABASE_URL` is absent.
- Files: `tests/e2e/visual-smoke.spec.ts`, `tests/e2e/mockup-fidelity.spec.ts`

Why it matters:

CI may not catch layout/regression issues in the core authenticated workflows.

Suggested fix:

- Add mocked/auth-seeded E2E mode or component-level screenshots for protected screens.
- Run at mobile and desktop widths.

### 56. Visual Tests Do Not Assert Error, Retry, Empty, or Offline States

Evidence:

- Current visual tests focus on branding, token cascade, and screenshots.

Suggested fix:

- Add visual states for:
  - offline with pending writes
  - sync blocked
  - AI failed with and without local audio
  - photo upload failed
  - migration partial
  - export failed
  - admin account load failed

## Recommended Implementation Themes

### A. Shared Operation State

Create a shared pattern for async operations. Every operation that changes user data should expose:

- current status
- last error
- whether user data is preserved locally
- retry action
- discard action when appropriate

Use this for:

- item field saves
- session name/notes/status saves
- create session/item
- delete session/item/photo
- import receipts
- export
- migration
- AI processing
- photo upload
- account management

### B. Never Store Status Messages in Content Fields

AI failure currently writes fallback copy into `description`. Status should live in status/error fields, not catalog content.

### C. Separate Local Durability From Server Sync

Use copy that tells the truth:

- `"Saved locally"`
- `"Queued for sync"`
- `"Synced"`
- `"Sync failed"`
- `"Only available on this device"`

### D. Transactional or Recoverable Multi-Step Workflows

Make these transactional where possible:

- receipt import
- merge items
- migration
- export status/history update

Where transaction is not possible, add recovery records and UI.

### E. Accessible Modal and Action Primitive

Replace ad hoc modal/action handling with shared primitives that include:

- focus trap
- Escape handling
- `role="dialog"`
- `aria-modal`
- async confirm states
- error display
- destructive action safeguards

### F. Error Copy Guidelines

Use user-oriented messages:

- What happened
- Whether their data is safe
- What they can do next
- Whether retry is likely to help

Example:

`"Could not sync this description. Your edit is saved on this device and will retry when the connection returns."`

Better than:

`"Failed to fetch"` or a raw provider error.

## Suggested Priority Order

1. Fix migration partial-failure data retention and messaging.
2. Add user-visible save failure handling for field/session edits.
3. Fix audio save failure handling so recordings cannot silently disappear or hang.
4. Expose write-ahead queue blocked/pending status globally.
5. Fix export failure messaging and status update sequencing.
6. Clarify local-only audio/photo limitations across devices.
7. Add explicit photo upload retry controls and idempotent metadata writes.
8. Add async/error-capable modal primitive.
9. Improve admin role/account load failure states.
10. Add test coverage for failure/retry/partial/offline states.

## Completion Notes

This audit inspected the current app source, including routes, components, hooks, services, stores, database migration code, Supabase edge functions, and relevant unit/e2e tests. The audit was read-only until this markdown report was requested and created.
