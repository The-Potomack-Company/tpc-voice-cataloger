# Phase 9: Deferred Items - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Three deferred enhancements that improve the cataloging workflow: (1) receipt number list import to pre-populate sale sessions from a spreadsheet, (2) AI estimate extraction to parse spoken prices into structured dollar ranges, and (3) export history with session archiving to track past exports and declutter the session list.

</domain>

<decisions>
## Implementation Decisions

### Receipt Number List Import
- Auctioneer uploads a spreadsheet (CSV/XLSX) containing one column of receipt numbers
- On upload, blank items are auto-created in the session — one per receipt number, no preview/review step
- Auctioneer then walks through the pre-created items and dictates each one
- This applies to sale cataloging mode only
- Manager-to-cataloger push (sending lists to specific catalogers) is deferred to a future milestone

### Estimate Extraction
- AI parses spoken price estimates into a structured low/high dollar range
- The `estimate` field changes from a free-text string to a structured `{ low: number, high: number }` representation
- When a single value is spoken (e.g., "about five hundred"), auto-generate a ±20% spread ($400–$600)
- When a range is spoken (e.g., "three to five hundred"), use the stated values ($300–$500)
- Display format: "$300–$500" in the UI
- Editable inline like all other fields (title, description, condition, category)
- Gemini schema needs updating to return structured estimate instead of raw string

### Export History & Session Archive
- Track each export: session name, export date, item count
- Export history list is expandable — tap to see individual items from that export
- Re-export from history (rebuild and download the same session again)
- Archived sessions are hidden from the main session list
- Separate "Archive" section or tab to view archived sessions
- Completing + exporting a session should offer to archive it

### Claude's Discretion
- Spreadsheet parsing library choice (e.g., SheetJS/xlsx vs. Papa Parse for CSV)
- Archive UI placement (separate tab vs collapsible section vs filter toggle)
- Export history storage schema (new Dexie table vs. metadata on session)
- How to handle the estimate field migration (string → structured) for existing items

</decisions>

<specifics>
## Specific Ideas

- Receipt number format remains XXXXX-N as validated by existing `receiptNumber.ts` utility
- Estimate display as dollar range like "$300–$500" — simple, no currency selector needed
- Export history should be expandable rows, not a separate page

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/utils/receiptNumber.ts`: RECEIPT_PATTERN regex and `isValidReceiptNumber()` — use for validating imported receipt numbers from spreadsheet
- `src/utils/export.ts`: `buildExportData()` and `exportSession()` — extend for export history tracking and re-export
- `src/components/EditableField.tsx`: Inline editing component — reuse for estimate range editing
- `src/components/ReceiptNumberInput.tsx`: Existing receipt input component — reference for validation UX
- `src/components/SessionCard.tsx` + `SessionSearch.tsx`: Session list components — extend with archive filter
- `src/components/ItemCard.tsx`: Expandable item cards — pattern for expandable export history rows

### Established Patterns
- Dexie/IndexedDB as sole data store — export history and archive state will use Dexie tables
- Dexie migrations with version bumps — needed for estimate field type change and new export history table
- `useLiveQuery` for reactive data — session list and export history will follow this pattern
- Blob-to-base64 via FileReader for export — already handles cross-browser edge cases

### Integration Points
- `src/services/geminiSchema.ts`: `catalogFieldsSchema` needs estimate field updated from string to structured object
- `src/services/gemini.ts`: Gemini prompt needs instruction to extract numeric estimates
- `src/db/types.ts`: `estimate` field on HouseVisitItem/SaleItem changes from `string` to structured type; ExportSchema needs update
- Session list page: needs archive filter/toggle
- Session detail page: needs "Import Receipt Numbers" action for sale mode sessions

</code_context>

<deferred>
## Deferred Ideas

### Removed from backlog (not needed)
- Category-aware AI prompts (AI-05) — removed per user decision
- Photo reordering / drag to set hero shot (PHOTO-01) — removed per user decision
- Multimodal input (photos + audio to Gemini) — removed per user decision
- Custom vocabulary injection (AI-07) — removed per user decision
- Condition report templates (DATA-02) — removed per user decision

### Future milestone
- Manager-to-cataloger receipt list push — future role-based feature

</deferred>

---

*Phase: 09-deffered-items*
*Context gathered: 2026-03-09*
