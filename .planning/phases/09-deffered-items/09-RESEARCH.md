# Phase 9: Deferred Items - Research

**Researched:** 2026-03-16
**Domain:** Spreadsheet import, AI estimate extraction, export history/archival
**Confidence:** HIGH

## Summary

Phase 9 implements three independent enhancements: (1) receipt number list import from CSV/XLSX files to pre-populate sale sessions, (2) structured estimate extraction where the AI returns `{ low, high }` dollar ranges instead of free-text strings, and (3) export history tracking with session archiving. All three features build on the existing Dexie/IndexedDB data layer, React component patterns, and Gemini AI pipeline already in the codebase.

The primary technical challenges are: choosing a spreadsheet parsing library that handles both CSV and XLSX in-browser, migrating the `estimate` field from string to structured object across types/schema/UI/export, and designing the export history Dexie table with re-export capability. None of these are high-risk -- the codebase already has well-established patterns for Dexie migrations, inline editing, and export.

**Primary recommendation:** Use SheetJS (xlsx) for spreadsheet parsing (handles both CSV and XLSX in one library), add a new `exportHistory` Dexie table, and extend the Gemini schema to return structured estimates with a Dexie v4 migration for the field type change.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Receipt Number List Import: CSV/XLSX upload, auto-create blank items per receipt number, no preview/review step, sale mode only
- Estimate Extraction: AI returns structured `{ low: number, high: number }`, single value gets +/-20% spread, display as "$300-$500", editable inline
- Export History & Session Archive: Track each export (session name, date, item count), expandable rows showing items, re-export from history, archived sessions hidden from main list, separate Archive section, export+complete offers archive

### Claude's Discretion
- Spreadsheet parsing library choice (e.g., SheetJS/xlsx vs. Papa Parse for CSV)
- Archive UI placement (separate tab vs collapsible section vs filter toggle)
- Export history storage schema (new Dexie table vs. metadata on session)
- How to handle the estimate field migration (string -> structured) for existing items

### Deferred Ideas (OUT OF SCOPE)
- Category-aware AI prompts (AI-05) -- removed per user decision
- Photo reordering / drag to set hero shot (PHOTO-01) -- removed per user decision
- Multimodal input (photos + audio to Gemini) -- removed per user decision
- Custom vocabulary injection (AI-07) -- removed per user decision
- Condition report templates (DATA-02) -- removed per user decision
- Manager-to-cataloger receipt list push -- future role-based feature
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AI-06 | Estimate extraction from natural speech ("three to five hundred" -> $300-$500) | Gemini schema update, structured estimate type, migration strategy |
| DATA-01 | Export history and session archive | New Dexie table, archive status on Session, UI patterns |
| (NEW) | Receipt number list import from spreadsheet | SheetJS library, file input, batch item creation |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Dexie | ^4.3.0 | IndexedDB wrapper for all data | Already sole data store; migrations, useLiveQuery |
| dexie-react-hooks | ^4.2.0 | Reactive queries | useLiveQuery pattern used everywhere |
| Zod | ^4.3.6 | Schema validation | Already validates Gemini responses |
| React | ^19.2.0 | UI framework | Project standard |

### New for Phase 9
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| SheetJS (xlsx) | ^0.20.x | Parse CSV and XLSX files in-browser | Receipt number import feature |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SheetJS | PapaParse | PapaParse is CSV-only; user specified CSV/XLSX support. SheetJS handles both formats with one library. |
| SheetJS | Manual CSV split | Fragile for edge cases (quoted fields, BOM, encoding). Not worth hand-rolling. |

**Recommendation (Claude's Discretion -- Spreadsheet Library):** Use **SheetJS (xlsx)** because the user requirement explicitly includes XLSX support. PapaParse only handles CSV. SheetJS parses both CSV and XLSX with a single API: `XLSX.read(data) -> workbook -> sheet -> column`. The community edition (CE) is Apache-2.0 licensed and sufficient for reading a single column of receipt numbers.

**Installation:**
```bash
npm install xlsx
```

## Architecture Patterns

### Dexie Schema Changes (Version 4)

The database needs a v4 migration for two changes:

1. **New `exportHistory` table** -- tracks each export event
2. **Session `archivedAt` field** -- marks sessions as archived (no index needed initially, filtered in queries like `deletedAt`)

```typescript
// New types
export interface EstimateRange {
  low: number;
  high: number;
}

export interface ExportHistoryRecord {
  id?: number;
  sessionId: number;
  sessionName: string;
  sessionMode: "house" | "sale";
  itemCount: number;
  exportedAt: Date;
}
```

**Recommendation (Claude's Discretion -- Export History Schema):** Use a **new `exportHistory` Dexie table** rather than metadata on Session. Reasons:
- A session can be exported multiple times; one-to-many relationship is natural as a table
- Keeps the Session type clean
- Enables querying export history independently (e.g., "show all exports")
- Expandable rows need to rebuild export data on-demand via `buildExportData()` -- no need to store item snapshots (items are still in Dexie)

**Recommendation (Claude's Discretion -- Estimate Migration):** For existing items with string estimates:
- The Dexie v4 upgrade function should scan all house/sale items
- If `estimate` is a non-null string, attempt to parse it as a number or range
- If parseable (e.g., "500" -> `{ low: 400, high: 600 }` with 20% spread), convert
- If not parseable (e.g., "negotiable"), set to `null` and store the raw text in a temporary `estimateRaw` field or just leave as-is since it was free text anyway
- Simpler approach: just set any existing string estimate to `null` during migration. These are internal tool entries, not customer-facing data. The auctioneer can re-record.

### Recommended Changes by Feature

#### 1. Receipt Number Import
```
src/
├── utils/
│   └── importReceipts.ts      # Parse spreadsheet, validate, return string[]
├── components/
│   └── ImportReceiptsButton.tsx # File input + trigger import
└── pages/
    └── SessionDetail.tsx       # Add import button (sale mode only)
```

#### 2. Estimate Extraction
```
src/
├── db/
│   ├── types.ts                # estimate: string -> EstimateRange | null
│   └── index.ts                # v4 migration
├── services/
│   ├── geminiSchema.ts         # estimate field -> object { low, high }
│   └── gemini.ts               # Update field mapping
├── components/
│   ├── EstimateField.tsx       # Display "$300-$500", inline edit both values
│   └── ItemCard.tsx            # Use EstimateField instead of EditableField for estimate
└── utils/
    ├── export.ts               # Update estimate in export schema
    └── estimateFormat.ts       # formatEstimate(), parseEstimate() helpers
```

#### 3. Export History & Archive
```
src/
├── db/
│   ├── types.ts                # ExportHistoryRecord, Session.archivedAt
│   └── index.ts                # v4 migration adds exportHistory table
├── hooks/
│   └── useSessions.ts          # Add useArchivedSessions(), filter archived from active/completed
├── components/
│   ├── ExportHistoryList.tsx    # Expandable rows per export
│   └── ArchiveSection.tsx      # Collapsible section in Sessions page
├── pages/
│   ├── Sessions.tsx            # Add archive section, filter archived sessions
│   └── SessionDetail.tsx       # After export+complete, offer to archive
└── utils/
    └── export.ts               # Record export in history table after exportSession()
```

### Pattern: Estimate Field Component

The estimate field needs a custom component since it is no longer a simple string:

```typescript
// EstimateField.tsx
interface EstimateFieldProps {
  value: EstimateRange | null;
  onSave: (range: EstimateRange) => void;
}

// Display: "$400-$600" or "No estimate"
// Edit mode: two number inputs (low / high) side by side
// Reuse EditableField pattern (tap to edit, blur to save)
```

### Pattern: File Input for Spreadsheet Upload

```typescript
// ImportReceiptsButton.tsx
// Hidden <input type="file" accept=".csv,.xlsx,.xls" />
// On file select: read with FileReader, parse with XLSX.read()
// Extract first column values, validate each with isValidReceiptNumber()
// Call createBlankItem() for each valid receipt number, setting receiptNumber field
// Show toast with count of items created + any skipped invalid numbers
```

### Anti-Patterns to Avoid
- **Storing full export snapshots in history:** The items are already in Dexie. Re-export rebuilds from live data via `buildExportData()`. Storing snapshots wastes storage and creates staleness.
- **Complex estimate parsing in the UI:** Keep all estimate string-to-range parsing in a single utility. The UI should only deal with `{ low, high }` objects.
- **Separate archive page/route:** The context says "expandable rows, not a separate page" for export history. Similarly, archive should be a collapsible section on the existing Sessions page, not a new route.

**Recommendation (Claude's Discretion -- Archive UI Placement):** Use a **collapsible section** at the bottom of the Sessions page (below Active and Completed), matching the existing Completed section pattern. This is consistent with the current UI: Active (always visible) -> Completed (collapsible, expanded by default) -> Archived (collapsible, collapsed by default). A filter toggle would hide session counts; a separate tab adds navigation complexity.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV/XLSX parsing | Custom split/regex parser | SheetJS `XLSX.read()` | Handles BOM, encoding, quoted fields, XLSX binary format |
| Receipt number validation | New regex | Existing `isValidReceiptNumber()` from `receiptNumber.ts` | Already tested and in use |
| Blob-to-base64 for re-export | New implementation | Existing `blobToBase64()` from `export.ts` | Already handles cross-browser edge cases |
| Dollar formatting | Manual string concatenation | `Intl.NumberFormat` or simple template | Locale-aware currency display |

**Key insight:** This phase is mostly wiring new features into existing patterns. The codebase already has Dexie migrations, inline editing, export utilities, and receipt number validation. Reuse aggressively.

## Common Pitfalls

### Pitfall 1: SheetJS Bundle Size
**What goes wrong:** SheetJS full build is ~500KB. For a PWA this matters.
**Why it happens:** Default import pulls in write capabilities, all format encoders.
**How to avoid:** Import only the read functionality: `import * as XLSX from 'xlsx/xlsx.mini'` or use tree-shaking. The mini build is ~200KB. For this use case (read one column from CSV/XLSX), the mini build is sufficient.
**Warning signs:** Bundle size increase in build output.

### Pitfall 2: Estimate Field Type Mismatch in Export Schema
**What goes wrong:** The `ExportSchema` currently has `estimate?: string`. Changing to structured breaks the Chrome extension import.
**Why it happens:** The extension reads the JSON export and maps fields to form inputs.
**How to avoid:** Update `ExportSchema` to export estimate as a formatted string `"$300-$500"` for backward compatibility. The structured type is internal to Dexie; the export flattens it. This way the extension doesn't need changes.
**Warning signs:** Extension import breaking after estimate change.

### Pitfall 3: Dexie Migration with Existing Data
**What goes wrong:** v4 migration fails or corrupts data if estimate field migration is too aggressive.
**Why it happens:** Existing items have `estimate: string | undefined`. Migration needs to handle both.
**How to avoid:** Make migration defensive. Check type before converting. Leave null/undefined as-is. Only attempt conversion on non-empty strings. Log skipped items.
**Warning signs:** Console errors on app load after schema version bump.

### Pitfall 4: Archive vs. Soft Delete Confusion
**What goes wrong:** Archive and soft delete (deletedAt) overlap conceptually, leading to items that are both archived and deleted.
**Why it happens:** Both hide sessions from the main list.
**How to avoid:** Keep them distinct: `archivedAt` hides from Active/Completed but shows in Archive section. `deletedAt` hides from everything except Settings recovery. An archived session can be un-archived. A deleted session can be restored. They serve different purposes.
**Warning signs:** Sessions disappearing from all views.

### Pitfall 5: File Input on iOS Safari
**What goes wrong:** `<input type="file">` accept attribute is advisory, not enforced on iOS.
**Why it happens:** Safari lets users pick any file type regardless of accept attribute.
**How to avoid:** Validate file extension after selection. Show error toast if unsupported file type.
**Warning signs:** App crashes when user selects a PDF instead of CSV/XLSX.

## Code Examples

### SheetJS: Parse Receipt Numbers from File
```typescript
// Source: SheetJS documentation
import * as XLSX from 'xlsx';

export async function parseReceiptNumbers(file: File): Promise<string[]> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  // Convert to array of arrays, get first column
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  return rows
    .map(row => String(row[0] ?? '').trim())
    .filter(val => val.length > 0);
}
```

### Dexie v4 Migration
```typescript
// Source: Existing codebase pattern (db/index.ts v2 -> v3 migration)
db.version(4)
  .stores({
    sessions: "++id, mode, status, updatedAt, createdAt, deletedAt",
    houseVisitItems: "++id, sessionId, sortOrder, aiStatus",
    saleItems: "++id, sessionId, receiptNumber, sortOrder, aiStatus",
    photos: "++id, itemId, sortOrder",
    audio: "++id, itemId",
    exportHistory: "++id, sessionId, exportedAt",
  })
  .upgrade(async (tx) => {
    // Migrate estimate fields from string to structured
    const migrateEstimates = async (tableName: string) => {
      await tx.table(tableName).toCollection().modify((item) => {
        if (typeof item.estimate === 'string' && item.estimate.length > 0) {
          // Attempt parse; on failure, null it out
          item.estimate = null;
        }
      });
    };
    await migrateEstimates('houseVisitItems');
    await migrateEstimates('saleItems');
  });
```

### Updated Gemini Schema for Structured Estimate
```typescript
// Updated catalogFieldsSchema
export const catalogFieldsSchema = z.object({
  title: z.string().nullable()
    .describe("Item title exactly as spoken, or null if not mentioned"),
  description: z.string().nullable()
    .describe("Item description exactly as spoken, or null if not mentioned"),
  condition: z.string().nullable()
    .describe("Condition exactly as spoken, or null if not mentioned"),
  estimate: z.object({
    low: z.number().describe("Low end of price estimate in dollars"),
    high: z.number().describe("High end of price estimate in dollars"),
  }).nullable()
    .describe("Price estimate as dollar range. Single value: use +-20% spread. Range: use stated values. Null if not mentioned."),
  category: z.string().nullable()
    .describe("Category exactly as spoken, or null if not mentioned"),
});
```

### Estimate Display Formatting
```typescript
export function formatEstimate(estimate: EstimateRange | null): string {
  if (!estimate) return '';
  return `$${estimate.low.toLocaleString()}\u2013$${estimate.high.toLocaleString()}`;
}

// For export: flatten to string for backward compatibility
export function estimateToExportString(estimate: EstimateRange | null): string | undefined {
  if (!estimate) return undefined;
  return `$${estimate.low}-$${estimate.high}`;
}
```

### Export History Recording
```typescript
// After successful export in export.ts
export async function recordExport(sessionId: number, sessionName: string, mode: "house" | "sale", itemCount: number): Promise<void> {
  await db.exportHistory.add({
    sessionId,
    sessionName,
    sessionMode: mode,
    itemCount,
    exportedAt: new Date(),
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Free-text estimate field | Structured { low, high } range | This phase | Enables price-aware filtering, consistent display |
| No export tracking | Export history table | This phase | Enables re-export, audit trail |
| Active/Completed/Deleted sessions | Active/Completed/Archived/Deleted | This phase | Declutters session list |

## Open Questions

1. **Re-export from history: live data or snapshot?**
   - What we know: CONTEXT.md says "rebuild and download the same session again"
   - Recommendation: Re-export from live data using existing `buildExportData()`. If the session items have been edited since last export, the re-export reflects current state. This is simpler and avoids storing large snapshots. The "history" provides the trigger, not a frozen copy.

2. **Estimate migration for existing items**
   - What we know: Internal tool with likely few items in production
   - Recommendation: Set existing string estimates to `null` during migration. Simple, safe, no data corruption risk. Users can re-record or manually enter ranges.

3. **Gemini prompt update for estimate extraction**
   - What we know: Current prompt says "extract exactly as spoken." Structured estimate requires numeric parsing.
   - Recommendation: Update the system prompt to instruct Gemini to extract numeric dollar estimates and return structured `{ low, high }`. Update the JSON schema to enforce the object type. Gemini should handle natural language like "three to five hundred" natively.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vite.config.ts` (test section) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AI-06a | Gemini schema returns structured estimate | unit | `npx vitest run src/tests/gemini-schema.test.ts -t "estimate"` | Needs update |
| AI-06b | Single value gets +/-20% spread | unit | `npx vitest run src/tests/estimate-format.test.ts` | Wave 0 |
| AI-06c | Range values used as-is | unit | `npx vitest run src/tests/estimate-format.test.ts` | Wave 0 |
| AI-06d | Estimate displays as "$300-$500" | unit | `npx vitest run src/tests/estimate-format.test.ts` | Wave 0 |
| DATA-01a | Export creates history record | unit | `npx vitest run src/tests/export-history.test.ts` | Wave 0 |
| DATA-01b | Re-export from history | unit | `npx vitest run src/tests/export-history.test.ts` | Wave 0 |
| DATA-01c | Archive hides session from main list | unit | `npx vitest run src/tests/sessions.test.ts -t "archive"` | Needs update |
| DATA-01d | Un-archive restores to main list | unit | `npx vitest run src/tests/sessions.test.ts -t "archive"` | Needs update |
| IMPORT-01 | CSV receipt numbers parsed | unit | `npx vitest run src/tests/import-receipts.test.ts` | Wave 0 |
| IMPORT-02 | XLSX receipt numbers parsed | unit | `npx vitest run src/tests/import-receipts.test.ts` | Wave 0 |
| IMPORT-03 | Invalid receipt numbers skipped | unit | `npx vitest run src/tests/import-receipts.test.ts` | Wave 0 |
| IMPORT-04 | Blank items created per valid receipt | unit | `npx vitest run src/tests/import-receipts.test.ts` | Wave 0 |
| MIGRATE-01 | Dexie v4 migration succeeds | unit | `npx vitest run src/tests/db.test.ts -t "v4"` | Needs update |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/tests/estimate-format.test.ts` -- covers AI-06b, AI-06c, AI-06d (formatEstimate, parseEstimate)
- [ ] `src/tests/export-history.test.ts` -- covers DATA-01a, DATA-01b (export history CRUD)
- [ ] `src/tests/import-receipts.test.ts` -- covers IMPORT-01 through IMPORT-04 (spreadsheet parsing + validation)
- [ ] Update `src/tests/gemini-schema.test.ts` -- covers AI-06a (structured estimate in schema)
- [ ] Update `src/tests/sessions.test.ts` -- covers DATA-01c, DATA-01d (archive/un-archive)
- [ ] Update `src/tests/db.test.ts` -- covers MIGRATE-01 (v4 migration)

## Sources

### Primary (HIGH confidence)
- Project codebase: `src/db/index.ts`, `src/db/types.ts`, `src/services/geminiSchema.ts`, `src/services/gemini.ts`, `src/utils/export.ts`, `src/utils/receiptNumber.ts` -- direct inspection of current implementation
- Project context: `09-CONTEXT.md` -- locked decisions and discretion areas

### Secondary (MEDIUM confidence)
- [SheetJS documentation](https://www.npmjs.com/package/xlsx) -- API for reading CSV/XLSX files
- [PapaParse](https://www.papaparse.com/) -- evaluated as CSV-only alternative
- [npm trends comparison](https://npmtrends.com/csv-parse-vs-exceljs-vs-node-xlsx-vs-papaparse-vs-xlsx) -- download/popularity data

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all existing libraries well-understood from codebase inspection; SheetJS is well-established
- Architecture: HIGH -- all three features follow existing patterns (Dexie migrations, inline editing, export utils)
- Pitfalls: HIGH -- identified from direct codebase analysis (type migration, export schema compatibility, bundle size)

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable domain, no fast-moving dependencies)
