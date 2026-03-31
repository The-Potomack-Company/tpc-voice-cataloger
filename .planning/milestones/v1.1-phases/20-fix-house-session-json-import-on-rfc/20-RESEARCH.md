# Phase 20: Fix House Session JSON Import on RFC - Research

**Researched:** 2026-03-30
**Domain:** Chrome extension DOM automation / cross-repo JSON import pipeline
**Confidence:** HIGH

## Summary

This phase fixes the house session JSON import in the TPC_AI_Cataloger Chrome extension so it uploads photos (not just text fields) and sets the Style dropdown to General. The export side (TPC_App) produces well-structured JSON with base64-encoded photos via `buildExportData()` -- the export format is correct and complete. The problem is entirely on the import side: `processNextHouseItem()` fills text fields then saves, completely ignoring the `photos` array in the JSON. The fix adds a photo upload sub-loop between field filling and save, reusing `FileInjector.injectSingleFile()` and `UploadDetector.waitForUpload()` from the existing PortalUploadController pattern.

A secondary fix is the Style dropdown (`#template`): if it is not set to "General" (value `"2"`), the `getFormFields()` call in `FormController` throws `"Please change the Style to General and retry"` because `#fld1` and `#fld2` are not present on the page when a different style is selected. The import must force-set `#template` to `"2"` and handle the resulting page reload (the `onchange` handler triggers `jsSubmit('Save Template')`) before filling fields.

**Primary recommendation:** Modify `importController.js` to (1) set Style to General and handle reload, (2) fill text fields, (3) upload photos sequentially via FileInjector/UploadDetector, (4) save, (5) navigate Next/Add. Add `#template` selector to `RFC_SELECTORS` in constants. Verify export data completeness from TPC_App side.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Reuse the PortalUploadController pattern for photo uploads: decode base64 from JSON to File objects, inject via FileInjector, wait for UploadDetector confirmation, then move to next photo. Same proven sequential upload pattern already working for photo batches.
- **D-02:** Fill text fields FIRST (title, description, condition, estimate, measurements, department), THEN upload photos one by one, THEN Save + Next/Add. Text fill is instant; photos take time per upload.
- **D-03:** Walk forward through existing items using Next button. Fall back to Add button when Next is disabled/missing and more items remain -- same pattern as PortalUploadController.navigateToNext().
- **D-04:** Save the page (click Save, wait for reload) after filling fields + uploading photos, THEN click Next or Add. Same save-before-navigate pattern as existing importController house mode.
- **D-05:** Investigate and fix BOTH repos in this phase -- TPC_App (export side) and TPC_AI_Cataloger (import side). Single phase ensures end-to-end pipeline works. The export JSON may have missing or malformed data that also needs fixing.
- **D-06:** Always set the Style dropdown (`#template`) to "General" (value `"2"`) during import, regardless of current value. This prevents the "Please change the Style to General and retry" blocker. The selector is `#template` and the value for General is `"2"`.
- **D-07:** Current text fields are correct: title, description, condition, estimate, measurements, department. No additional text fields needed beyond the Style fix (D-06).

### Claude's Discretion
- Base64-to-File conversion implementation details (Blob construction, MIME type detection)
- State recovery approach for the new photo-upload-during-import flow (extending existing chrome.storage pattern vs using IndexedDB like PortalUploadController)
- Whether to refactor processNextHouseItem into a step-based state machine (like sale mode) or keep the afterSave boolean pattern with photo sub-steps
- Error handling for individual photo upload failures (skip and continue vs retry)
- How to detect if export JSON is v1 format vs potential future versions

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Architecture Patterns

### Cross-Repo File Map

```
TPC_App (export side):
  src/utils/export.ts          -- buildExportData(), blobToBase64()
  src/db/types.ts              -- ExportSchema interface (JSON contract)

TPC_AI_Cataloger (import side):
  src/config/constants.js      -- RFC_SELECTORS, IMPORT_CONFIG
  src/content/modules/importController.js   -- processNextHouseItem(), fillFieldsVerbatim()
  src/content/modules/portalUploadController.js  -- Reference pattern for photo upload loop
  src/utils/fileInjector.js    -- FileInjector.injectSingleFile()
  src/utils/uploadDetector.js  -- UploadDetector.waitForUpload()
  src/utils/navigationHelper.js -- NavigationHelper.clickSave(), clickNext()
```

### Pattern 1: Base64 Data URL to File Object Conversion
**What:** The export JSON stores photos as base64 data URLs (from `FileReader.readAsDataURL`). The import needs to convert these back to File objects for FileInjector.
**When to use:** Every photo in the import JSON
**Example:**
```javascript
// Export produces: "data:image/jpeg;base64,/9j/4AAQ..."
// Import needs to convert to File object:
function base64DataUrlToFile(dataUrl, filename) {
  const [header, base64Data] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*?);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const byteString = atob(base64Data);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new File([ab], filename, { type: mimeType });
}
```

### Pattern 2: Sequential Photo Upload (from PortalUploadController)
**What:** Upload one photo at a time: find file input, inject File via DataTransfer API, wait for MutationObserver to detect new image in `#picturePanel`, then proceed to next photo.
**When to use:** After text fields are filled, before Save
**Key sequence:**
1. `getFileInput()` -- find the `<input type="file">` via button selectors
2. `FileInjector.injectSingleFile(fileInput, file)` -- sets `fileInput.files` via DataTransfer, dispatches change event
3. `UploadDetector.waitForUpload({ timeout })` -- MutationObserver on `#picturePanel` watches for new `<img>` elements
4. Small delay (500ms) between uploads
5. Repeat for next photo

### Pattern 3: Style Dropdown with Page Reload
**What:** Setting `#template` value triggers `jsSubmit('Save Template')` via the `onchange` handler, causing a full page reload.
**When to use:** First step of processing each house item
**Implementation approach:**
1. Check current `#template` value
2. If already `"2"` (General), skip -- no reload needed
3. If different, set value to `"2"`, dispatch change event (triggers page reload)
4. Save import state with a new step marker (e.g., `step: 'style-set'`) BEFORE the change
5. On resume after reload, the style is now General -- proceed to fill fields

### Pattern 4: State Machine for House Mode (Recommended)
**What:** Refactor `processNextHouseItem()` from simple `afterSave` boolean to step-based state machine like sale mode.
**Why:** The addition of style-set and photo-upload sub-steps makes the boolean pattern inadequate. Sale mode already uses `step: 'navigate'|'fill'|'save'`.
**Recommended steps:**
```
'set-style'   -> Check/set #template to General (may reload)
'fill-fields' -> Fill all text fields
'upload-photos' -> Upload photos one by one (sub-index tracks position)
'save'        -> Click Save (page reloads)
'navigate'    -> Click Next or Add (page reloads)
```
**State storage addition:** `photoIndex` field alongside existing `currentIndex` to track photo upload progress within an item.

### Pattern 5: State Recovery Across Page Reloads
**What:** Import state persisted to chrome.storage before any page-changing action.
**Current pattern:** `saveImportState({ afterSave, step })` stores to `chrome.storage` via `StorageHelper`.
**Extension needed:** Add `photoIndex` and `step` fields to saved state for house mode (currently house mode only uses `afterSave` boolean).
**Note:** chrome.storage cannot store File objects (unlike IndexedDB). But since import photos come from JSON base64 strings stored in `importItems`, they can be reconstructed on resume from the stored items array. No need for IndexedDB -- chrome.storage pattern is sufficient.

### Anti-Patterns to Avoid
- **Uploading all photos at once:** RFC's file input does not support multiple files in a single injection. Must upload one at a time.
- **Not waiting for upload confirmation:** FileInjector.injectSingleFile triggers an async server upload on RFC's side. Without UploadDetector.waitForUpload, the next injection overwrites the pending upload.
- **Setting style without saving state first:** The `onchange` on `#template` triggers `jsSubmit('Save Template')` which reloads the page. If state is not saved, import progress is lost.
- **Assuming style is always General:** The style may be set to Fine Art, Antiques, etc. -- in which case `#fld1` and `#fld2` do not exist on the page.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File injection into input | DataTransfer construction | `FileInjector.injectSingleFile()` | Handles all RFC input patterns, dispatches correct events |
| Upload completion detection | Polling or timers | `UploadDetector.waitForUpload()` | MutationObserver-based, handles timeout, proven pattern |
| Save button click + wait | Direct DOM click | `NavigationHelper.clickSave()` | Has retry logic, configurable delay |
| Next/Add navigation | Custom button finding | `NavigationHelper.clickNext()` + Add button fallback | PortalUploadController.navigateToNext() pattern |
| State persistence | IndexedDB for import | `StorageHelper.set/get` (chrome.storage) | Import items contain base64 strings reconstructible on resume; no need for File object storage |

**Key insight:** All the hard parts (file injection, upload detection, navigation) are already implemented and proven in the PortalUploadController workflow. The import just needs to wire them together with base64-to-File conversion.

## Common Pitfalls

### Pitfall 1: Style Dropdown Page Reload
**What goes wrong:** Setting `#template` triggers `onchange="ichanged(this.id);jsSubmit('Save Template')"` which causes a full page reload. If import state is not saved, progress is lost.
**Why it happens:** RFC uses form submit for style changes, not AJAX.
**How to avoid:** Check if style is already "2" (General) before setting. If not, save state with step='set-style', then set the value. The onchange fires, page reloads, and checkAndResumeImport picks up.
**Warning signs:** Import silently stops after first item if style was not General.

### Pitfall 2: Base64 Data URL Format
**What goes wrong:** `blobToBase64()` in export.ts uses `FileReader.readAsDataURL()` which produces `"data:image/jpeg;base64,/9j/..."`. If the import tries to use `atob()` on the full string (including the `data:...;base64,` prefix), it will fail.
**Why it happens:** Data URLs have a prefix before the actual base64 content.
**How to avoid:** Split on comma: `const [header, base64Data] = dataUrl.split(',')` -- use `base64Data` for `atob()`, extract MIME from header.
**Warning signs:** `DOMException: Failed to execute 'atob'` or corrupted image files.

### Pitfall 3: Photo Upload Timing
**What goes wrong:** Injecting the next photo before the previous one finishes uploading causes the previous upload to be cancelled or overwritten.
**Why it happens:** RFC's file input processes one file at a time server-side.
**How to avoid:** Always `await UploadDetector.waitForUpload()` after each `FileInjector.injectSingleFile()`. Use the 500ms delay from `PORTAL_UPLOAD_CONFIG.PHOTO_UPLOAD_DELAY`.
**Warning signs:** Only the last photo appears on the item, or intermittent upload failures.

### Pitfall 4: Empty Photos Array
**What goes wrong:** Some items may have no photos (audio-only recordings). The photo upload loop must handle `item.photos.length === 0` gracefully.
**Why it happens:** House visit items can be voice-only with no camera captures.
**How to avoid:** Check `item.photos && item.photos.length > 0` before entering the photo upload loop. Skip straight to Save if no photos.

### Pitfall 5: State Recovery with Photo Sub-Index
**What goes wrong:** Page reloads during photo upload (e.g., RFC auto-refresh, network hiccup) lose track of which photo was being uploaded.
**Why it happens:** Current house mode state only stores `currentIndex` (item) but not photo position within item.
**How to avoid:** Add `photoIndex` to saved state. Use optimistic save BEFORE injection (same pattern as PortalUploadController). On resume, skip already-uploaded photos.

### Pitfall 6: Import Items Array in Chrome Storage
**What goes wrong:** The full items array (with base64 photo blobs) may exceed chrome.storage limits.
**Why it happens:** `chrome.storage.local` has a 10MB limit by default (can be unlocked with `unlimitedStorage` permission). Base64 photos are ~33% larger than binary.
**How to avoid:** Check if the extension's manifest already declares `unlimitedStorage`. If not, add it. Alternatively, store items in IndexedDB (but this changes the recovery pattern significantly). The simpler path: verify manifest has the permission.

## Code Examples

### Base64 Data URL to File Conversion
```javascript
/**
 * Convert a base64 data URL (from TPC App export) to a File object for FileInjector
 * @param {string} dataUrl - Full data URL: "data:image/jpeg;base64,/9j/..."
 * @param {string} filename - Desired filename (e.g., "photo-1.jpg")
 * @returns {File} File object ready for FileInjector.injectSingleFile()
 */
function base64DataUrlToFile(dataUrl, filename) {
  const [header, base64Data] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*?);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const byteString = atob(base64Data);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new File([ab], filename, { type: mimeType });
}
```

### Photo Upload Sub-Loop (within processNextHouseItem)
```javascript
// After filling text fields, before Save:
const photos = item.photos || [];
for (let pi = photoIndex; pi < photos.length; pi++) {
  if (isCancelled) return;

  const photo = photos[pi];
  const file = base64DataUrlToFile(photo.blob, `photo-${pi + 1}.jpg`);

  const fileInput = getFileInput(); // Same function as PortalUploadController
  if (!fileInput) {
    Logger.error('ImportController: File input not found for photo upload');
    break; // Skip remaining photos, proceed to save
  }

  // Optimistic state save BEFORE injection
  photoIndex = pi + 1;
  await saveImportState({ step: 'upload-photos', photoIndex });

  const injectResult = FileInjector.injectSingleFile(fileInput, file);
  if (!injectResult.success) {
    Logger.warn('ImportController: Photo injection failed, skipping', { pi });
    continue;
  }

  const uploadResult = await UploadDetector.waitForUpload({
    timeout: TPC_CONSTANTS.PORTAL_UPLOAD_CONFIG.UPLOAD_TIMEOUT,
  });

  if (!uploadResult.success) {
    Logger.warn('ImportController: Photo upload timeout, skipping', { pi });
    continue;
  }

  // Delay between uploads
  await new Promise(r => setTimeout(r, TPC_CONSTANTS.PORTAL_UPLOAD_CONFIG.PHOTO_UPLOAD_DELAY));
}
```

### Style Dropdown Handling
```javascript
// At the start of processing each house item:
function ensureStyleIsGeneral() {
  const templateSelect = document.querySelector('#template');
  if (!templateSelect) {
    Logger.warn('ImportController: Style dropdown not found');
    return false; // Not on an item edit page
  }
  if (templateSelect.value === '2') {
    return true; // Already General, no reload needed
  }
  // Setting this triggers onchange -> jsSubmit('Save Template') -> page reload
  templateSelect.value = '2';
  templateSelect.dispatchEvent(new Event('change', { bubbles: true }));
  return false; // Page will reload
}
```

### Updated saveImportState for House Mode
```javascript
async function saveImportState(opts = {}) {
  await StorageHelper.set(TPC_CONSTANTS.STORAGE_KEYS.IMPORT_STATE, {
    status: importStatus,
    mode: importMode,
    currentIndex,
    statistics: { ...statistics },
    skippedReceipts: [...skippedReceipts],
    items: importItems,
    tabId: originatingTabId,
    timestamp: Date.now(),
    afterSave: opts.afterSave || false,
    step: opts.step || null,
    photoIndex: opts.photoIndex || 0, // NEW: track photo position within item
  });
}
```

## Export Side Verification (TPC_App)

### ExportSchema Analysis
The `ExportSchema` in `src/db/types.ts` defines the JSON contract:
```typescript
items: Array<{
  title?: string;
  description?: string;
  condition?: string;
  estimate?: string;
  measurements?: string;
  department?: string;     // Maps from item.category in Supabase
  photos: Array<{
    blob: string;          // Base64 data URL from FileReader.readAsDataURL()
    sortOrder: number;
  }>;
}>;
```

### Export Data Flow (verified from source)
1. `buildExportData()` reads items from Supabase
2. For each item, reads photos from local Dexie (if available) or downloads from Supabase Storage
3. `blobToBase64()` uses `FileReader.readAsDataURL()` -- produces `"data:image/jpeg;base64,..."` format
4. Photos are ordered by `sortOrder`
5. Field mapping: Supabase `item.category` becomes export `department`

### Potential Export Issues to Verify
1. **Blob type:** If a photo was stored as ArrayBuffer in Dexie (not Blob), the `instanceof Blob` check handles it by wrapping in `new Blob([...])` -- this looks correct.
2. **Empty photos:** Items with no photos get `photos: []` -- this is correct, import must handle gracefully.
3. **Storage download failures:** Failed Storage downloads are filtered out (`null` filter) -- items may have fewer photos than expected. Not a bug, but import should not assume photo count.

**Export side verdict:** The export logic appears correct and complete. No export-side code changes are anticipated, but verification during testing is required.

## Recommended Implementation Approach

### State Machine Steps for House Mode
```
Step 1: 'set-style'      Check #template, set to "2" if needed (may reload)
Step 2: 'fill-fields'    Fill all text fields via fillFieldsVerbatim() + department
Step 3: 'upload-photos'  Upload photos sequentially (photoIndex tracks progress)
Step 4: 'save'           Click Save (page reloads)
Step 5: 'navigate'       Click Next or Add (page reloads), advance currentIndex
```

### State Recovery Flow
```
checkAndResumeImport() reads saved state:
  mode === 'house':
    step === 'set-style'      -> Style was set, page reloaded. Now style is General. Go to 'fill-fields'.
    step === 'fill-fields'    -> Should not normally resume here (no reload between set-style and fill).
    step === 'upload-photos'  -> Resume photo upload from photoIndex.
    step === 'save'           -> Save was clicked, page reloaded. Go to 'navigate'.
    step === 'navigate'       -> Next/Add was clicked, page reloaded. Process next item from 'set-style'.
    afterSave === true        -> Legacy: treat as step === 'navigate' (click Next).
```

### Constants Changes Needed
```javascript
// Add to RFC_SELECTORS:
STYLE_FIELD: '#template',
STYLE_GENERAL_VALUE: '2',
```

### getFileInput() Reuse
The `getFileInput()` function in `portalUploadController.js` is a private function (closure-scoped). Options:
1. **Extract to a shared utility** (e.g., `fileInputFinder.js`) -- cleaner but more files to change
2. **Duplicate the logic** in `importController.js` -- simpler, fewer moving parts
3. **Make it a method on FileInjector** -- most logical home since FileInjector already has `findFileInput(buttonSelector)`

**Recommendation:** Use `FileInjector.findFileInput()` directly with the button selectors from constants, plus the form-based fallback. This is already public API -- no duplication needed. The private `getFileInput()` in PortalUploadController is just a convenience wrapper around `FileInjector.findFileInput()`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual testing (Chrome extension -- no automated test framework in TPC_AI_Cataloger) |
| Config file | None -- extension has no test runner |
| Quick run command | Manual: load extension, import JSON, observe behavior |
| Full suite command | TPC_App side: `npm test` (Vitest) for export.ts |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01 | Photos uploaded via FileInjector/UploadDetector | manual | Load extension, import house JSON with photos | N/A |
| D-02 | Text fields filled before photos | manual | Observe fill order during import | N/A |
| D-03 | Next/Add navigation after save | manual | Import multi-item session, verify all items processed | N/A |
| D-04 | Save after fields+photos, then navigate | manual | Observe save-then-navigate sequence | N/A |
| D-05 | Export JSON has correct data | unit | `npx vitest run src/utils/export.test.ts` | Needs verification |
| D-06 | Style set to General | manual | Start import on page with non-General style | N/A |
| D-07 | All text fields filled | manual | Verify all fields populated during import | N/A |

### Sampling Rate
- **Per task commit:** Manual smoke test: export 1 house session with 2 items (1 photo each), import in extension
- **Per wave merge:** Full manual E2E: export session with 3+ items, multiple photos, verify all fields + photos on RFC
- **Phase gate:** Complete end-to-end test with real RFC portal

### Wave 0 Gaps
- [ ] Verify export.test.ts exists and covers photo export -- if not, add minimal test for buildExportData photo array
- [ ] No automated tests possible for Chrome extension side (manual-only)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Chrome browser | Extension testing | Assumed available | -- | -- |
| TPC_AI_Cataloger repo | Import side changes | Available at C:/Users/maser/Projects/TPC_AI_Cataloger/ | -- | -- |
| RFC Invaluable portal | E2E testing | External service | -- | Manual verification |

**Missing dependencies with no fallback:** None
**Missing dependencies with fallback:** None

## Open Questions

1. **chrome.storage size limit with base64 photos**
   - What we know: chrome.storage.local default limit is 10MB. `unlimitedStorage` permission removes this.
   - What's unclear: Whether the extension manifest already declares `unlimitedStorage`.
   - Recommendation: Check manifest.json during implementation. If missing, add the permission. A 20-item session with 3 photos each at ~500KB = ~30MB base64 -- exceeds 10MB limit.

2. **Style dropdown reload behavior**
   - What we know: The `onchange` handler calls `jsSubmit('Save Template')` which submits the form.
   - What's unclear: Whether this always causes a full page reload or sometimes an AJAX update.
   - Recommendation: Implement defensively -- save state before setting style, handle both reload and non-reload cases.

3. **Page state after style change reload**
   - What we know: After `jsSubmit('Save Template')`, the page reloads.
   - What's unclear: Whether the reloaded page retains the item position (same item) or redirects elsewhere.
   - Recommendation: Test manually. If it stays on same item (likely, since it's just saving the template), the import resumes from 'fill-fields' step.

## Sources

### Primary (HIGH confidence)
- `C:/Users/maser/TPC_App/src/utils/export.ts` -- export logic, blobToBase64 format verified
- `C:/Users/maser/TPC_App/src/db/types.ts` -- ExportSchema interface verified
- `C:/Users/maser/Projects/TPC_AI_Cataloger/src/content/modules/importController.js` -- current import logic, house mode flow
- `C:/Users/maser/Projects/TPC_AI_Cataloger/src/content/modules/portalUploadController.js` -- reference photo upload pattern
- `C:/Users/maser/Projects/TPC_AI_Cataloger/src/utils/fileInjector.js` -- FileInjector API
- `C:/Users/maser/Projects/TPC_AI_Cataloger/src/utils/uploadDetector.js` -- UploadDetector API
- `C:/Users/maser/Projects/TPC_AI_Cataloger/src/utils/navigationHelper.js` -- NavigationHelper API
- `C:/Users/maser/Projects/TPC_AI_Cataloger/src/config/constants.js` -- RFC_SELECTORS, IMPORT_CONFIG

### Secondary (MEDIUM confidence)
- Style dropdown HTML from CONTEXT.md (user-provided from RFC page inspection)

## Metadata

**Confidence breakdown:**
- Architecture: HIGH -- all source files read, patterns well-established in codebase
- Pitfalls: HIGH -- identified from actual code analysis (onchange handler, base64 format, storage limits)
- Export side: HIGH -- source code verified directly, no guesswork
- Style dropdown behavior: MEDIUM -- HTML provided by user, reload behavior needs live testing

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable domain, no library upgrades involved)
