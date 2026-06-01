# Phase 7: Extension Batch Import - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Chrome extension accepts exported JSON from the speech cataloger PWA and fills title/description fields on matched RFC Invaluable lot pages in batch. Two import paths based on session mode: sale mode navigates by receipt number, house visit mode walks forward sequentially. No AI calls — data is pre-reviewed. Work happens in the TPC_AI_Cataloger repo (separate from TPC_App).

</domain>

<decisions>
## Implementation Decisions

### JSON loading method
- File picker in the extension popup — user exports JSON from PWA, saves to device, opens extension popup, clicks "Import" to pick the file
- No `reports.r3?mm=data` endpoint — uses page-by-page injection like existing batch/portal controllers
- One export file = one session mode (house or sale, never mixed)

### Architecture
- New `importController.js` — separate controller dedicated to JSON import
- Calls into existing `FormController` for field filling and `NavigationHelper` for save/navigation
- Does NOT modify or add modes to the existing `BatchController` — cleaner separation, avoids adding branching to already-complex batch state machine
- Reuses existing `ProgressBar` and `ConfirmationModal` components for progress/completion UI

### Sale mode import path (receipt-based navigation)
- Extension reads each item's receipt number from the JSON
- Types receipt number into the receipt input box on the RFC edit form (selector needs discovery at implementation time — not currently mapped in constants)
- Navigates to that lot's edit page
- Fills `#fld1` (title) and `#fld2` (description) with values from JSON
- Saves, then inputs the next receipt number and repeats
- If a receipt number doesn't match any lot on RFC: skip it, continue to next item
- Completion report lists specific skipped receipt numbers (not just a count)

### House visit mode import path (walk-forward)
- Uses portal-style sequential navigation (Next button)
- User manually navigates to the first item on RFC before starting import
- Extension fills title/description on each page, saves, clicks Next, repeats
- Same walk-forward pattern as existing `PortalUploadController`

### Field content handling
- Fields written verbatim from JSON — no transformation, no formatting, no casing changes
- No `[AI Generated]` prefix — data was already reviewed/edited by the auctioneer in Phase 6
- No TPC formatting applied (no ALL CAPS conversion, no "the"-prefixing) — RFC has no format requirements
- Extension writes field values and dispatches input events (same as existing `FormController` pattern)

### Progress and error reporting
- Reuse existing `ProgressBar` component (current/total, cancel button, ESC to cancel)
- Reuse existing `ConfirmationModal.showBatchCompletionModal` for completion summary
- Completion report shows success/skipped/error counts
- For sale mode: skipped items list includes the specific receipt numbers that weren't found
- State recovery across page reloads (same pattern as batch/portal controllers)

### Project structure
- Keep TPC_App (PWA) and TPC_AI_Cataloger (extension) as separate repos
- Shared contract is the `ExportSchema` JSON format — documented in both repos, not shared code
- All Phase 7 implementation work happens in the TPC_AI_Cataloger repo

### Claude's Discretion
- Import button placement and styling in popup
- How receipt input box selector is discovered and added to constants
- State recovery implementation details (chrome.storage vs IndexedDB)
- How the import controller detects session mode from JSON and routes to correct path
- Error handling for malformed JSON files
- Whether to validate JSON schema before starting import

</decisions>

<specifics>
## Specific Ideas

- The receipt input box already exists on the RFC edit item form — it accepts a receipt number and navigates to that lot. The extension just needs to find its selector and use it programmatically.
- The existing batch controller is already complex with state recovery across page reloads — adding import mode to it would make it harder to maintain. A separate controller keeps concerns clean.
- Sale mode items are the primary use case — house visit items going through the portal is secondary.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets (TPC_AI_Cataloger repo)
- `FormController.fillOrAppendFields()` — handles field filling with skip/append/overwrite modes; import can use direct field setting without the mode logic
- `FormController.getFormFields()` — returns `#fld1` (title) and `#fld2` (description) elements
- `NavigationHelper.clickSave()` — clicks Save button with retries
- `NavigationHelper.clickNext()` — clicks Next button, waits for page load
- `PageExtractor.extractReceiptNumber()` — reads receipt from `.pagetitle` (useful for verification after navigation)
- `PageExtractor.extractItemPosition()` — reads "X of Y" from List Items button
- `ProgressBar` component — show/hide/update progress with cancel support
- `ConfirmationModal.showBatchCompletionModal()` — completion summary with statistics
- `StorageHelper` / `IndexedDBHelper` — state persistence for page reload recovery
- `DOMHelper` — showSuccess/showError/showInfo/highlightFields notifications
- `Logger` — structured logging throughout

### Established Patterns
- IIFE globals on `globalThis` — no build system, plain JS
- State recovery via chrome.storage (batch) or IndexedDB (portal) across page reloads
- Tab isolation via `getCurrentTabId()` to prevent cross-tab interference
- ESC key handler for cancellation
- Optimistic state save before page-changing actions (click Save/Next)
- `Object.freeze()` on all public controller APIs

### Integration Points
- New file: `src/content/modules/importController.js` — loaded by content script on RFC pages
- New constants needed: receipt input box selector, import-specific storage keys, import message actions
- Popup UI: new "Import" button/section in `src/popup/popup.js` and `popup.html`
- Message passing: popup sends JSON data to content script via `chrome.runtime.sendMessage`
- ExportSchema from TPC_App (`src/db/types.ts`) defines the JSON contract — importController parses this format

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-extension-batch-import*
*Context gathered: 2026-03-06*
