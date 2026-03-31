# Phase 20: Fix House Session JSON Import on RFC - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the house session JSON import in the Chrome extension (TPC_AI_Cataloger) so it properly walks through RFC item pages sequentially — filling ALL fields AND uploading photos from the exported JSON — using the same Next/Add navigation pattern as the existing PortalUploadController photo upload workflow. Also investigate and fix any export-side issues in TPC_App if the JSON data is missing or malformed.

</domain>

<decisions>
## Implementation Decisions

### Photo upload handling
- **D-01:** Reuse the PortalUploadController pattern for photo uploads: decode base64 from JSON to File objects, inject via FileInjector, wait for UploadDetector confirmation, then move to next photo. Same proven sequential upload pattern already working for photo batches.
- **D-02:** Fill text fields FIRST (title, description, condition, estimate, measurements, department), THEN upload photos one by one, THEN Save + Next/Add. Text fill is instant; photos take time per upload.

### Navigation: Next vs Add
- **D-03:** Walk forward through existing items using Next button. Fall back to Add button when Next is disabled/missing and more items remain — same pattern as PortalUploadController.navigateToNext().
- **D-04:** Save the page (click Save, wait for reload) after filling fields + uploading photos, THEN click Next or Add. Same save-before-navigate pattern as existing importController house mode.

### Cross-repo scope
- **D-05:** Investigate and fix BOTH repos in this phase — TPC_App (export side) and TPC_AI_Cataloger (import side). Single phase ensures end-to-end pipeline works. The export JSON may have missing or malformed data that also needs fixing.

### Style dropdown (blocker fix)
- **D-06:** Always set the Style dropdown (`#template`) to "General" (value `"2"`) during import, regardless of current value. This prevents the "Please change the Style to General and retry" blocker. The selector is `#template` and the value for General is `"2"`.

### Field completeness
- **D-07:** Current text fields are correct: title, description, condition, estimate, measurements, department. No additional text fields needed beyond the Style fix (D-06).

### Claude's Discretion
- Base64-to-File conversion implementation details (Blob construction, MIME type detection)
- State recovery approach for the new photo-upload-during-import flow (extending existing chrome.storage pattern vs using IndexedDB like PortalUploadController)
- Whether to refactor processNextHouseItem into a step-based state machine (like sale mode) or keep the afterSave boolean pattern with photo sub-steps
- Error handling for individual photo upload failures (skip and continue vs retry)
- How to detect if export JSON is v1 format vs potential future versions

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Extension (TPC_AI_Cataloger)
- `C:/Users/maser/Projects/TPC_AI_Cataloger/src/content/modules/importController.js` — Current import logic; house mode processNextHouseItem needs photo upload + Style field fix
- `C:/Users/maser/Projects/TPC_AI_Cataloger/src/content/modules/portalUploadController.js` — Reference implementation for sequential photo upload (FileInjector, UploadDetector, Next/Add navigation, IndexedDB state recovery)
- `C:/Users/maser/Projects/TPC_AI_Cataloger/src/content/modules/formController.js` — getFormFields() and field filling patterns
- `C:/Users/maser/Projects/TPC_AI_Cataloger/src/config/constants.js` — RFC_SELECTORS, IMPORT_CONFIG, error messages

### TPC App (export)
- `src/utils/export.ts` — buildExportData() and ExportSchema JSON generation
- `src/db/types.ts` — ExportSchema interface definition (the JSON contract between both repos)

### Style dropdown HTML (from RFC page)
```html
<select id="template" name="template" value="2" onchange="ichanged(this.id);jsSubmit('Save Template')">
  <option value="2" selected="">General</option>
  <option value="3">Fine Art</option>
  <option value="5">Crafts/Jewelry</option>
  <option value="7">Antiques</option>
  <option value="4">HTML Editor</option>
  <option value="6">General - Separate Title</option>
  <option value="1">No Style</option>
</select>
```

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PortalUploadController` — Full working pattern for: base64/File injection via FileInjector, upload detection via UploadDetector, Next/Add navigation fallback, IndexedDB state persistence, ESC cancellation, progress bar updates
- `FileInjector.injectSingleFile(fileInput, file)` — Injects a single File object into RFC's file input
- `UploadDetector.waitForUpload({ timeout })` — Waits for RFC to confirm photo upload
- `NavigationHelper.clickSave()` / `NavigationHelper.clickNext()` — Save and navigate with retries
- `StorageHelper` / `IndexedDBHelper` — State persistence for page-reload recovery
- `setFieldIfPresent(field, value)` in importController — Already dispatches input+change events

### Established Patterns
- IIFE globals on `globalThis` — no build system, plain JS
- State recovery across page reloads via chrome.storage (import) or IndexedDB (portal upload)
- Optimistic state save BEFORE page-changing actions
- Tab isolation via getCurrentTabId()
- ESC key handler for cancellation

### Integration Points
- `importController.js` fillFieldsVerbatim() needs to also set `#template` to "2" (General)
- `importController.js` processNextHouseItem() needs photo upload sub-loop between field fill and Save
- Export side: verify buildExportData() includes all photos with correct base64 encoding
- Constants: add STYLE_FIELD selector `#template` to RFC_SELECTORS

### Key Bug: Photos Not Imported
The current `fillFieldsVerbatim()` only fills text fields. The `processNextHouseItem()` flow is: fill fields → save → next. Photos from the JSON are completely ignored. The fix adds a photo upload loop between "fill fields" and "save": fill fields → upload photos one-by-one → save → next/add.

</code_context>

<specifics>
## Specific Ideas

- The import should work like the existing photo upload flow in the extension — sequential, one item at a time, with proper page reload recovery
- Style dropdown (`#template`) must be set to General (value "2") to prevent save failures — this was a known blocker
- The `onchange` handler on `#template` triggers `jsSubmit('Save Template')` which may cause a page reload when changed — the import needs to handle this (set style, wait for potential reload, then continue filling)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 20-fix-house-session-json-import-on-rfc*
*Context gathered: 2026-03-30*
