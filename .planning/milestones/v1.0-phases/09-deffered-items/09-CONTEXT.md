# Phase 9: Deferred Items - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Two deferred enhancements that improve the cataloging workflow: (1) receipt number list import from CSV/XLSX spreadsheets to pre-populate sale sessions on the session creation screen, and (2) export history tracking with session archiving to track past exports, re-export, and declutter the session list.

**Removed from scope (already implemented):**
- AI estimate extraction (AI-06) — handled by `formatEstimate()` utility (quick task 6)
- Offline queue — Phase 8 complete

</domain>

<decisions>
## Implementation Decisions

### Receipt Number Spreadsheet Import
- Import option appears on the NewSession page **only when Sale mode is selected** — hidden for House Visit mode
- Accepts both CSV and XLSX files containing a single column of receipt numbers in `XXXXX-N` format
- **Instant create** — no preview step. Parse file, create session with pre-populated blank items, navigate to session detail
- Invalid receipt numbers (wrong format, duplicates, blank rows) are silently skipped
- After creation, show toast: "12 items created, 3 entries skipped" (skip count only if > 0)
- Session name is always manually entered by the auctioneer — import does not auto-fill from filename
- Auctioneer then walks through pre-created items and dictates each one

### Export History
- Each export creates a history record in Dexie: session ID, export date, item count
- History displayed as expandable section at the bottom of SessionDetail page
- Each row shows: "Mar 16, 2026 — 12 items" with a Re-export button
- Re-export **regenerates fresh** JSON from current session state (no snapshot storage)
- Filename uses version suffix: `tpc-session-{id}-v{n}.json` — each re-export increments so files coexist in Downloads
- First export remains `tpc-session-{id}.json` (v1 implicit), subsequent exports add `-v2`, `-v3`, etc.

### Session Archive
- After a successful export, prompt "Archive this session?" via ConfirmDialog
- Archived sessions hidden from main session list
- **Collapsible "Archived" section** below active sessions — collapsed by default, tap to expand (consistent with existing completed sessions pattern)
- Archived sessions are **read-only** (consistent with completed session locking from quick task 9)
- Un-archiving moves session back to active list **and** unlocks it for editing
- Archive implemented as `archivedAt` timestamp on Session record (similar to soft-delete `deletedAt` pattern)

### Claude's Discretion
- Spreadsheet parsing library choice (SheetJS/xlsx vs Papa Parse for CSV)
- Export history Dexie table schema details
- Archive section styling and animation
- Toast component implementation for import feedback

</decisions>

<specifics>
## Specific Ideas

- Receipt number format remains `XXXXX-N` as validated by existing `receiptNumber.ts` utility
- Export history rows should be expandable — consistent with ItemCard expand pattern
- Archive prompt after export should feel like a natural "done with this" moment, not intrusive
- Collapsible archived section should match the existing completed sessions section chevron pattern

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/utils/receiptNumber.ts`: RECEIPT_PATTERN regex and `isValidReceiptNumber()` — validates imported receipt numbers
- `src/utils/export.ts`: `buildExportData()` and `exportSession()` — extend for history tracking and versioned filenames
- `src/components/ConfirmDialog.tsx`: Modal dialog — reuse for archive prompt after export
- `src/components/EditableField.tsx`: Inline editing component — reference for export history row pattern
- `src/components/SessionCard.tsx` + `SessionSearch.tsx`: Session list components — extend with archive section
- `src/pages/NewSession.tsx`: Session creation page — import button integrates here conditionally for sale mode

### Established Patterns
- Dexie/IndexedDB as sole data store — export history table and `archivedAt` field use Dexie
- Dexie migrations with version bumps — needed for new export history table and archivedAt field
- `useLiveQuery` for reactive data — session list and export history follow this pattern
- Soft-delete with `deletedAt` field — archive follows same pattern with `archivedAt`
- Completed sessions section with collapsible chevron — archived section mirrors this
- Toast-style feedback used throughout — import result feedback follows same pattern

### Integration Points
- `src/pages/NewSession.tsx`: Conditional import button when sale mode selected
- `src/pages/SessionDetail.tsx`: Export history section + archive prompt after export
- `src/pages/Sessions.tsx` (or equivalent): Archived sessions collapsible section
- `src/db/index.ts`: New Dexie version with export history table + archivedAt on sessions
- `src/db/types.ts`: ExportHistoryRecord type, archivedAt on Session type

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
*Context gathered: 2026-03-16*
