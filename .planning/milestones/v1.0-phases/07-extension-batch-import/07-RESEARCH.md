# Phase 7: Extension Batch Import - Research

**Researched:** 2026-03-09
**Domain:** Chrome Extension (Manifest V3) batch form filling from imported JSON
**Confidence:** HIGH

## Summary

Phase 7 adds a JSON import capability to the existing TPC AI Cataloger Chrome extension. The extension already has well-established patterns for batch processing (BatchController), sequential navigation (PortalUploadController), field filling (FormController), state recovery across page reloads (StorageHelper/IndexedDBHelper), and progress/completion UI (ProgressBar/ConfirmationModal). The import controller is a new controller that reuses these existing components but does NOT call the AI -- it writes pre-reviewed data verbatim from the JSON file.

The work happens entirely in the TPC_AI_Cataloger repo. The shared contract between the PWA and extension is the `ExportSchema` TypeScript interface defined in TPC_App (`src/db/types.ts`). The import controller needs to parse this format, detect session mode (house vs sale), and route to the correct navigation path: receipt-based lookup for sale mode, walk-forward sequential for house visit mode.

**Primary recommendation:** Build a new `importController.js` following the exact IIFE/globalThis/Object.freeze pattern of existing controllers, reusing FormController for field writes, NavigationHelper for save/next, ProgressBar for progress, and ConfirmationModal for completion. Use chrome.storage.local for state recovery (JSON data is text-only, well under 5MB limit). Add a new "Import" tab to the popup with a file picker.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- File picker in the extension popup -- user exports JSON from PWA, saves to device, opens extension popup, clicks "Import" to pick the file
- No `reports.r3?mm=data` endpoint -- uses page-by-page injection like existing batch/portal controllers
- One export file = one session mode (house or sale, never mixed)
- New `importController.js` -- separate controller dedicated to JSON import
- Calls into existing `FormController` for field filling and `NavigationHelper` for save/navigation
- Does NOT modify or add modes to the existing `BatchController`
- Reuses existing `ProgressBar` and `ConfirmationModal` components
- Sale mode: reads receipt number from JSON, types into receipt input box on RFC edit form, navigates to lot, fills fields, saves, repeats. Skipped receipts listed in completion report
- House visit mode: portal-style sequential navigation (Next button). User manually navigates to first item before starting
- Fields written verbatim from JSON -- no transformation, no formatting, no casing changes, no `[AI Generated]` prefix
- Extension writes field values and dispatches input events (same as existing FormController pattern)
- Reuse existing ProgressBar and ConfirmationModal.showBatchCompletionModal for progress/completion UI
- State recovery across page reloads (same pattern as batch/portal controllers)
- Keep TPC_App and TPC_AI_Cataloger as separate repos -- shared contract is ExportSchema JSON format
- All Phase 7 implementation work happens in the TPC_AI_Cataloger repo

### Claude's Discretion
- Import button placement and styling in popup
- How receipt input box selector is discovered and added to constants
- State recovery implementation details (chrome.storage vs IndexedDB)
- How the import controller detects session mode from JSON and routes to correct path
- Error handling for malformed JSON files
- Whether to validate JSON schema before starting import

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXT-01 | TPC Chrome extension accepts an imported JSON file from the speech cataloger app | File picker in popup, FileReader API reads JSON, popup sends parsed data to content script via chrome.tabs.sendMessage |
| EXT-02 | Extension matches items to RFC Invaluable lots by receipt number | Sale mode: type receipt into receipt input box selector (to be discovered), navigate to lot. House visit mode: walk-forward with Next button |
| EXT-03 | Extension fills title and description fields on each matched RFC lot page | FormController field writing pattern -- set .value, dispatch input event. No prefix, no sanitizer, write verbatim |
| EXT-04 | Extension processes items in batch (navigate, fill, save, next) like existing batch mode | importController orchestrates loop with state recovery across page reloads, ProgressBar for progress, ConfirmationModal for completion |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chrome Extension APIs | Manifest V3 | Extension platform | Already in use, MV3 required |
| Plain JavaScript (IIFE) | ES2020+ | Application code | No build system -- established project convention |
| Jest | 30.2.0 | Testing | Already configured in project |

### Supporting (Existing -- Reuse)
| Component | File | Purpose | How Import Uses It |
|-----------|------|---------|-------------------|
| FormController | `src/content/modules/formController.js` | Field filling | `getFormFields()` to get `#fld1`/`#fld2`, then direct `.value =` and `dispatchEvent` |
| NavigationHelper | `src/utils/navigationHelper.js` | Save/Next clicks | `clickSave()` for saving, `clickNext()` for house-visit walk-forward |
| PageExtractor | `src/content/modules/pageExtractor.js` | Extract receipt/position | `extractReceiptNumber()` to verify navigation, `extractItemPosition()` for progress |
| ProgressBar | `src/components/progressBar.js` | Visual progress | `show()` with current/total/statistics/onCancel |
| ConfirmationModal | `src/components/confirmationModal.js` | Completion summary | `showBatchCompletionModal(statistics)` |
| StorageHelper | `src/utils/storageHelper.js` | chrome.storage wrapper | State recovery for import progress |
| DOMHelper | `src/utils/domHelper.js` | Notifications | `showSuccess()`, `showError()`, `showInfo()` |
| Logger | `src/utils/logger.js` | Structured logging | Throughout import controller |
| IndexedDBHelper | `src/utils/indexedDBHelper.js` | Large data storage | If JSON data exceeds chrome.storage limits (unlikely for text-only) |

### New Files Required
| File | Purpose |
|------|---------|
| `src/content/modules/importController.js` | Core import orchestration (IIFE, globalThis, Object.freeze) |
| Additions to `src/config/constants.js` | New selectors, storage keys, message actions for import |
| Additions to `src/popup/popup.html` | New "Import" tab with file picker UI |
| Additions to `src/popup/popup.js` | Import button handler, file reading, message sending |
| Additions to `src/content/content.js` | Message listener for import actions |
| Additions to `src/background/background.js` | None expected -- import is content-script-only (no AI calls) |
| Addition to `manifest.json` | Add importController.js to content_scripts array |

## Architecture Patterns

### Recommended Project Structure (Changes Only)
```
src/
  content/
    modules/
      importController.js   # NEW: JSON import orchestration
  popup/
    popup.html              # MODIFIED: add Import tab
    popup.js                # MODIFIED: add import handler
  config/
    constants.js            # MODIFIED: add import constants
  content/
    content.js              # MODIFIED: add import message handlers
```

### Pattern 1: IIFE Global Registration (Established Convention)
**What:** Every module is wrapped in an IIFE that registers on globalThis, then frozen
**When to use:** All new modules in this project
**Example:**
```javascript
// Source: Existing pattern from batchController.js, portalUploadController.js
(function () {
  'use strict';
  const global = typeof globalThis !== 'undefined' ? globalThis : self;

  // Private state (closure-scoped)
  let importStatus = 'idle';
  let importData = null;
  // ...

  // Public API
  global.ImportController = {
    async startImport(jsonData) { /* ... */ },
    async processNextItem() { /* ... */ },
    async cancelImport() { /* ... */ },
    getState() { /* ... */ },
    getStatistics() { /* ... */ },
    isRunning() { /* ... */ },
  };

  Object.freeze(global.ImportController);

  // Auto-resume on page load (same as batch/portal patterns)
  async function checkAndResumeImport() { /* ... */ }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(checkAndResumeImport, 100);
    });
  } else {
    setTimeout(checkAndResumeImport, 100);
  }

  Logger.info('Import Controller loaded');
})();
```

### Pattern 2: State Recovery Across Page Reloads
**What:** Save state to chrome.storage before any page-changing action (Save/Next click), auto-resume from saved state on page load
**When to use:** Any controller that survives page reloads
**Critical details from existing implementations:**
- BatchController uses `chrome.storage.local` (via StorageHelper) with `afterSave` flag to distinguish "just saved, need to click Next" from "just navigated, need to process current item"
- PortalUploadController uses IndexedDB because it stores File objects (not serializable to chrome.storage)
- Import controller should use `chrome.storage.local` since it stores only JSON text data (no File objects)
- State age check: reject saved state older than 30 seconds (batch) or 60 seconds (portal)
- Tab isolation: store `tabId` in state, verify on resume to prevent cross-tab interference
- Optimistic state save: save state BEFORE clicking Save/Next (page may reload immediately)

**Example state shape for import:**
```javascript
{
  status: 'running',
  mode: 'sale',           // or 'house'
  items: [...],           // the full JSON items array
  currentIndex: 3,        // which item we're on
  statistics: { success: 2, skipped: 1, errors: 0 },
  skippedReceipts: ['39135-2'],  // sale mode: track which receipts weren't found
  tabId: 123,
  timestamp: Date.now(),
  afterSave: true,        // true = need to navigate to next; false = need to process current
}
```

### Pattern 3: Popup-to-ContentScript File Transfer
**What:** Popup reads JSON file via FileReader, sends parsed data to content script via chrome.tabs.sendMessage
**When to use:** EXT-01 -- loading the exported JSON
**Key constraints:**
- chrome.tabs.sendMessage has ~50MB practical message size limit (HIGH confidence -- verified via multiple sources)
- ExportSchema JSON with text-only fields (no photos/audio blobs in the import path) will be well under this limit
- Popup reads file with FileReader.readAsText(), JSON.parse(), then sends via chrome.tabs.sendMessage
- Content script receives in chrome.runtime.onMessage listener, passes to ImportController

**Example:**
```javascript
// In popup.js
async function handleImport() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const fileInput = document.getElementById('import-file-input');
  const file = fileInput.files[0];

  const text = await file.text();
  const jsonData = JSON.parse(text);

  // Validate schema version
  if (jsonData.version !== 1) {
    showLastResult(false, 'Unsupported export version');
    return;
  }

  const response = await chrome.tabs.sendMessage(tab.id, {
    action: TPC_CONSTANTS.MESSAGE_ACTIONS.START_IMPORT,
    data: jsonData,
  });

  if (response?.success) {
    window.close(); // Close popup, import runs on page
  }
}

// In content.js
if (request.action === TPC_CONSTANTS.MESSAGE_ACTIONS.START_IMPORT) {
  ImportController.startImport(request.data)
    .then(() => Logger.info('Import started'))
    .catch(error => Logger.error('Import start failed', { error: error.message }));
  sendResponse({ success: true });
  return true;
}
```

### Pattern 4: Sale Mode Receipt Navigation
**What:** Type a receipt number into the RFC receipt input box to navigate to a specific lot
**When to use:** Sale mode import -- each item has a receipt number
**Key discovery needed:** The receipt input box selector on the RFC edit form needs to be identified at implementation time. It is not currently mapped in constants.js
**Approach:**
1. During implementation, inspect the RFC edit form to find the receipt input selector
2. Add selector to `TPC_CONSTANTS.RFC_SELECTORS` (e.g., `RECEIPT_INPUT`)
3. For each item: set receipt input value, dispatch events, trigger form submission/navigation
4. After navigation, verify using `PageExtractor.extractReceiptNumber()` that the correct lot loaded
5. If receipt not found (page doesn't navigate or shows error), skip item and record in skippedReceipts

### Pattern 5: House Visit Mode Walk-Forward
**What:** Sequential processing using Next button (same as PortalUploadController)
**When to use:** House visit sessions
**Flow:** User navigates to first item manually -> start import -> fill fields -> clickSave -> clickNext -> fill next -> repeat
**Difference from sale mode:** No receipt-based lookup, just process items in order

### Pattern 6: Direct Field Writing (No AI Prefix)
**What:** Write field values verbatim -- no `[AI Generated]` prefix, no Sanitizer, no formatting
**When to use:** Import controller field filling (data was already reviewed)
**Key difference from existing FormController.fillFormFields():** Existing method prepends `[AI Generated]` prefix and calls Sanitizer. Import must bypass this.
**Approach:** Call `getFormFields()` to get elements, then write directly:
```javascript
const { titleField, descField } = FormController.getFormFields();
titleField.value = item.title || '';
titleField.dispatchEvent(new Event('input', { bubbles: true }));
descField.value = item.description || '';
descField.dispatchEvent(new Event('input', { bubbles: true }));
```

### Anti-Patterns to Avoid
- **Adding import mode to BatchController:** User decision explicitly forbids this. BatchController's state machine is already complex. Keep concerns separate.
- **Using FormController.fillFormFields() or fillOrAppendFields():** These prepend `[AI Generated]` prefix and run through Sanitizer. Import data is pre-reviewed and must be written verbatim.
- **Storing JSON in IndexedDB:** Unnecessary overhead. JSON text data fits comfortably in chrome.storage.local (5MB limit, typical export is <100KB). Only use IndexedDB if storing File/Blob objects.
- **Sending file via background script:** No need. Popup reads file directly with FileReader, sends parsed JSON to content script. Background script has no role in import (no AI calls).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Progress display | Custom progress UI | Existing ProgressBar component | Already has cancel button, statistics display, ESC handler |
| Completion summary | Custom modal | ConfirmationModal.showBatchCompletionModal | Already shows success/skipped/errors with styled modal |
| Page save | Custom save logic | NavigationHelper.clickSave() | Handles retries, timing delays |
| Next navigation | Custom next logic | NavigationHelper.clickNext() | Handles page load detection, retry, last-item check |
| Field element discovery | Manual querySelector | FormController.getFormFields() | Returns `#fld1` and `#fld2` with validation |
| Receipt extraction | Manual DOM parsing | PageExtractor.extractReceiptNumber() | Uses `.pagetitle` with regex -- proven pattern |
| Tab isolation | Custom tab tracking | getCurrentTabId() via background message | Established pattern in batch/portal |
| State persistence | Custom storage code | StorageHelper.set/get | Chrome storage wrapper, already used everywhere |
| ESC cancellation | Custom key listener | Follow batch/portal pattern (escHandler variable + document.addEventListener) | Consistent UX |

## Common Pitfalls

### Pitfall 1: Page Reload Destroys Script Context
**What goes wrong:** After clicking Save or Next, the RFC page reloads completely. All JavaScript state is lost.
**Why it happens:** RFC is a server-rendered page, not a SPA. Every form submission is a full page reload.
**How to avoid:** Save complete import state to chrome.storage.local BEFORE clicking Save/Next (optimistic state save). On page load, check for saved state and auto-resume. This is the exact pattern used by BatchController and PortalUploadController.
**Warning signs:** Import "stops" after first item -- means auto-resume is not working.

### Pitfall 2: Receipt Input Selector Not Found
**What goes wrong:** The receipt input box on RFC has no known selector in the constants -- it must be discovered by inspecting the live site.
**Why it happens:** Phase 0 discovery mapped form fields (`#fld1`, `#fld2`) and buttons but not the receipt navigation input.
**How to avoid:** During implementation, inspect the live RFC edit form. Look for an input near the receipt number display. Add the selector to constants.js. Include a fallback/error if selector not found.
**Warning signs:** Sale mode import fails on first item with "element not found" error.

### Pitfall 3: Cross-Tab Interference
**What goes wrong:** Two RFC tabs both try to resume an import from shared chrome.storage state.
**Why it happens:** chrome.storage.local is shared across all tabs. Both tabs run checkAndResumeImport on page load.
**How to avoid:** Store originating tabId in state. On resume, verify current tabId matches. If not, don't resume (let the original tab handle it).
**Warning signs:** Two tabs simultaneously processing items, duplicate saves.

### Pitfall 4: Writing AI Prefix on Import Data
**What goes wrong:** Import data gets `[AI Generated]` prefix prepended, corrupting the auctioneer's reviewed text.
**Why it happens:** Developer uses existing FormController.fillFormFields() which always prepends the prefix.
**How to avoid:** Do NOT use fillFormFields() or fillOrAppendFields(). Use getFormFields() to get DOM elements, then write .value directly. Dispatch input event manually.
**Warning signs:** Imported titles/descriptions show `[AI Generated]` prefix on RFC.

### Pitfall 5: JSON Schema Version Mismatch
**What goes wrong:** Extension tries to parse a future schema version it doesn't understand.
**Why it happens:** PWA may be updated to ExportSchema v2 before extension is updated.
**How to avoid:** Check `jsonData.version === 1` before processing. Show clear error if version is unsupported. This is a simple guard but prevents cryptic failures.
**Warning signs:** Fields are undefined or items array is missing/malformed.

### Pitfall 6: Session Mode Detection Failure
**What goes wrong:** Extension can't determine whether to use sale mode (receipt navigation) or house visit mode (walk-forward).
**Why it happens:** The `session.mode` field in ExportSchema might not be checked, or might have an unexpected value.
**How to avoid:** Read `jsonData.session.mode` -- it's "house" or "sale". Route to appropriate import path. Error if mode is neither.
**Warning signs:** Extension tries receipt-based navigation for house visit items (which have no receipt numbers).

## Code Examples

### Example 1: Reading Export JSON in Popup
```javascript
// Source: Standard FileReader API + existing popup patterns
const importFileInput = document.getElementById('import-file-input');

async function handleImportFile() {
  const file = importFileInput.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const jsonData = JSON.parse(text);

    // Validate version
    if (!jsonData.version || jsonData.version !== 1) {
      showLastResult(false, `Unsupported export version: ${jsonData.version || 'unknown'}`);
      return;
    }

    // Validate session mode
    const mode = jsonData.session?.mode;
    if (mode !== 'house' && mode !== 'sale') {
      showLastResult(false, `Invalid session mode: ${mode || 'missing'}`);
      return;
    }

    // Validate items exist
    if (!Array.isArray(jsonData.items) || jsonData.items.length === 0) {
      showLastResult(false, 'No items found in export file');
      return;
    }

    // Send to content script
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: TPC_CONSTANTS.MESSAGE_ACTIONS.START_IMPORT,
      data: jsonData,
    });

    if (response?.success) {
      showLastResult(true, `Import started: ${jsonData.items.length} items (${mode} mode)`);
      setTimeout(() => window.close(), 1000);
    } else {
      throw new Error(response?.error || 'Failed to start import');
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      showLastResult(false, 'Invalid JSON file');
    } else {
      showLastResult(false, error.message);
    }
  }
}
```

### Example 2: Import Controller Core Loop (Sale Mode)
```javascript
// Source: Adapted from BatchController.processNextItem() pattern
async processNextSaleItem() {
  if (isCancelled) return;
  if (currentIndex >= importItems.length) {
    await this.completeImport();
    return;
  }

  const item = importItems[currentIndex];
  const receiptNumber = item.receiptNumber;

  try {
    // Step 1: Type receipt into receipt input
    const receiptInput = document.querySelector(TPC_CONSTANTS.RFC_SELECTORS.RECEIPT_INPUT);
    if (!receiptInput) throw new Error('Receipt input not found');

    receiptInput.value = receiptNumber;
    receiptInput.dispatchEvent(new Event('input', { bubbles: true }));
    // Trigger navigation (may need form submit or button click -- TBD at implementation)

    // Step 2: Verify correct lot loaded
    const pageReceipt = PageExtractor.extractReceiptNumber();
    if (pageReceipt !== receiptNumber) {
      // Receipt not found -- skip
      skippedReceipts.push(receiptNumber);
      updateStatistics('skipped');
      currentIndex++;
      await saveImportState();
      await this.processNextSaleItem();
      return;
    }

    // Step 3: Fill fields verbatim (no prefix, no sanitizer)
    const { titleField, descField } = FormController.getFormFields();
    if (item.title) {
      titleField.value = item.title;
      titleField.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (item.description) {
      descField.value = item.description;
      descField.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Step 4: Update stats, save state, click Save
    updateStatistics('success');
    currentIndex++;
    await saveImportState(true); // afterSave = true
    await NavigationHelper.clickSave();
    // Page reloads -- auto-resume handles next item
  } catch (error) {
    updateStatistics('error');
    currentIndex++;
    await saveImportState();
    // Continue to next item
    await this.processNextSaleItem();
  }
}
```

### Example 3: Completion Report with Skipped Receipts
```javascript
// Source: Extended from ConfirmationModal.showBatchCompletionModal pattern
async completeImport() {
  importStatus = 'completed';
  await clearImportState();
  ProgressBar.hide();

  if (escHandler) {
    document.removeEventListener('keydown', escHandler);
    escHandler = null;
  }

  // For sale mode: enhance completion modal with skipped receipt details
  if (importMode === 'sale' && skippedReceipts.length > 0) {
    // Show custom completion with skipped receipt list
    const summaryContent = `
      <div style="text-align: center; padding: 10px;">
        <h3>Import Complete</h3>
        <div style="text-align: left; background: #f8f9fa; padding: 16px; border-radius: 4px;">
          <div><strong>Successful:</strong> ${statistics.success}</div>
          <div><strong>Skipped:</strong> ${statistics.skipped}</div>
          <div><strong>Errors:</strong> ${statistics.errors}</div>
        </div>
        ${skippedReceipts.length > 0 ? `
          <div style="text-align: left; margin-top: 12px;">
            <strong>Skipped receipts (not found on RFC):</strong>
            <ul style="margin-top: 4px;">
              ${skippedReceipts.map(r => `<li>${r}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;
    ModalComponent.show({
      title: 'Import Complete',
      content: summaryContent,
      buttons: [{ text: 'OK', variant: 'primary' }],
    });
  } else {
    // Standard completion modal
    await ConfirmationModal.showBatchCompletionModal(statistics);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manifest V2 background pages | Manifest V3 service workers | 2023 | Extension already uses MV3 -- no migration needed |
| chrome.storage sync (100KB limit) | chrome.storage.local (5MB default) | N/A | Import data fits in local storage easily |
| Custom build systems | Plain JS with IIFE patterns | Project convention | No bundler -- just add file to manifest.json content_scripts |

## Open Questions

1. **Receipt Input Box Selector**
   - What we know: The receipt input box exists on the RFC edit form and accepts a receipt number for navigation
   - What's unclear: The exact DOM selector (id, name, class) for this input element
   - Recommendation: Inspect the live RFC Invaluable edit form at implementation time. Add discovered selector to `TPC_CONSTANTS.RFC_SELECTORS.RECEIPT_INPUT`. If the input is not a standalone element but part of a form, also identify the submit mechanism (form.submit(), button click, etc.)

2. **Receipt Navigation Mechanism**
   - What we know: Typing a receipt number into the box navigates to that lot's edit page
   - What's unclear: Does it auto-navigate on input, or require pressing Enter/clicking a button?
   - Recommendation: Test on live site. The controller may need to dispatch a 'keydown' event with Enter key, or click a Go/Search button after setting the value.

3. **Save Button Behavior After Field Fill**
   - What we know: NavigationHelper.clickSave() clicks `#SaveButton` with retries
   - What's unclear: Whether Save causes a full page reload (like in batch mode) or stays on the same page
   - Recommendation: Assume full page reload (consistent with existing batch behavior). The afterSave flag in state recovery handles this.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30.2.0 + jsdom |
| Config file | `jest.config.js` (exists in TPC_AI_Cataloger root) |
| Quick run command | `npx jest --testPathPattern=importController --no-coverage` |
| Full suite command | `npx jest` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXT-01 | JSON file loading and validation in popup | unit | `npx jest tests/unit/content/importController.test.js -x` | No -- Wave 0 |
| EXT-02 | Receipt matching (sale mode) and walk-forward (house mode) | unit | `npx jest tests/unit/content/importController.test.js -x` | No -- Wave 0 |
| EXT-03 | Title/description field filling (verbatim, no prefix) | unit | `npx jest tests/unit/content/importController.test.js -x` | No -- Wave 0 |
| EXT-04 | Batch processing loop with state recovery | unit | `npx jest tests/unit/content/importController.test.js -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx jest --testPathPattern=import --no-coverage`
- **Per wave merge:** `npx jest`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/content/importController.test.js` -- covers EXT-01 through EXT-04
- [ ] Mock setup for chrome.storage.local, chrome.runtime.sendMessage, DOM elements (`#fld1`, `#fld2`, receipt input)
- [ ] Jest test infrastructure already exists -- no framework install needed

## Sources

### Primary (HIGH confidence)
- TPC_AI_Cataloger source code (direct inspection) -- batchController.js, portalUploadController.js, formController.js, navigationHelper.js, pageExtractor.js, constants.js, popup.js/html, content.js, background.js, storageHelper.js, indexedDBHelper.js
- TPC_App `src/db/types.ts` -- ExportSchema interface definition
- `manifest.json` -- Manifest V3 configuration, content_scripts loading order

### Secondary (MEDIUM confidence)
- [Chrome Extension Storage API docs](https://developer.chrome.com/docs/extensions/reference/api/storage) -- 5MB default limit for chrome.storage.local
- [Chrome Message Passing docs](https://developer.chrome.com/docs/extensions/develop/concepts/messaging) -- chrome.tabs.sendMessage for popup-to-content-script
- [Chrome Extension message size limits](https://hackernoon.com/large-files-transfers-between-parts-of-chrome-extensions-for-manifest-v3) -- ~50MB practical limit for sendMessage

### Tertiary (LOW confidence)
- Receipt input box selector -- needs live site inspection, not verified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- using only existing project components and patterns
- Architecture: HIGH -- directly adapting proven BatchController/PortalUploadController patterns
- Pitfalls: HIGH -- all pitfalls observed from existing controller implementations
- Receipt input selector: LOW -- not yet discovered, requires live site inspection

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- extension patterns are well-established)
