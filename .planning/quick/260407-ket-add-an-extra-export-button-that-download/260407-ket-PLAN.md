---
phase: quick-260407-ket
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/utils/export.ts
  - src/pages/SessionDetail.tsx
  - src/components/ExportHistoryList.tsx
autonomous: true
must_haves:
  truths:
    - "Admin can download session data as .xlsx spreadsheet"
    - "Spreadsheet contains item fields (title, description, condition, estimate, measurements, department, transcript, receiptNumber, sortOrder, createdAt) but NOT photo/audio blobs"
    - "Spreadsheet export does not change session status or record in export_history"
    - "Re-export (.xlsx) button appears in export history alongside existing Re-export button"
  artifacts:
    - path: "src/utils/export.ts"
      provides: "exportSessionAsSpreadsheet function"
      contains: "exportSessionAsSpreadsheet"
    - path: "src/pages/SessionDetail.tsx"
      provides: "Export Spreadsheet button"
      contains: "Export Spreadsheet"
    - path: "src/components/ExportHistoryList.tsx"
      provides: "Re-export (.xlsx) button"
      contains: "Re-export (.xlsx)"
  key_links:
    - from: "src/pages/SessionDetail.tsx"
      to: "src/utils/export.ts"
      via: "import exportSessionAsSpreadsheet"
      pattern: "exportSessionAsSpreadsheet"
    - from: "src/components/ExportHistoryList.tsx"
      to: "src/utils/export.ts"
      via: "import exportSessionAsSpreadsheet"
      pattern: "exportSessionAsSpreadsheet"
---

<objective>
Add spreadsheet (.xlsx) export alongside the existing JSON export.

Purpose: Give admins a convenient way to get session data into a spreadsheet format for review/sharing without photo/audio blobs.
Output: New export function, two new buttons (SessionDetail + ExportHistoryList).
</objective>

<context>
@src/utils/export.ts
@src/pages/SessionDetail.tsx
@src/components/ExportHistoryList.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add exportSessionAsSpreadsheet function</name>
  <files>src/utils/export.ts</files>
  <action>
Add `exportSessionAsSpreadsheet(sessionId: string): Promise<void>` to `src/utils/export.ts`.

Implementation:
1. Import xlsx at top: `import * as XLSX from "xlsx";`
2. The function should:
   a. Call `buildExportData(sessionId)` to get the ExportSchema data.
   b. Create a workbook with `XLSX.utils.book_new()`.
   c. Create a "Session Info" sheet with session metadata as key-value rows:
      - Name, Mode, Status, Notes, Created At, Updated At, Exported At, Item Count
      - Use `XLSX.utils.aoa_to_sheet()` with a 2D array of [key, value] pairs.
      - Add to workbook: `XLSX.utils.book_append_sheet(wb, sessionSheet, "Session Info")`.
   d. Create an "Items" sheet from the items array. Map each item to a flat row object with keys: Title, Description, Condition, Estimate, Measurements, Department, Transcript, Receipt Number, Sort Order, Created At. Explicitly EXCLUDE photos and audio fields.
      - Use `XLSX.utils.json_to_sheet(rows)`.
      - Add to workbook: `XLSX.utils.book_append_sheet(wb, itemsSheet, "Items")`.
   e. Write the workbook to an array buffer: `XLSX.write(wb, { bookType: "xlsx", type: "array" })`.
   f. Create a Blob with type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
   g. Build filename using `sanitizeFilename(data.session.name)` with `.xlsx` extension (no versioning needed since this is a convenience export).
   h. Trigger download using the same anchor element pattern as `exportSession`.
3. Do NOT record in export_history. Do NOT change session status. This is a lightweight convenience export.
4. Also add `reExportSessionAsSpreadsheet` as an alias: `export const reExportSessionAsSpreadsheet = exportSessionAsSpreadsheet;`
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>exportSessionAsSpreadsheet function exists, compiles without errors, creates .xlsx from buildExportData output excluding photos/audio</done>
</task>

<task type="auto">
  <name>Task 2: Add spreadsheet export buttons to UI</name>
  <files>src/pages/SessionDetail.tsx, src/components/ExportHistoryList.tsx</files>
  <action>
**SessionDetail.tsx changes:**

1. Add import: `import { exportSessionAsSpreadsheet } from "../utils/export";` (add to existing import from that module).
2. Add state: `const [exportingXlsx, setExportingXlsx] = useState(false);`
3. Add handler after `handleExport`:
```
const handleExportSpreadsheet = async () => {
  setExportingXlsx(true);
  try {
    await exportSessionAsSpreadsheet(sessionId!);
  } catch (err) {
    console.error("Spreadsheet export failed:", err);
  } finally {
    setExportingXlsx(false);
  }
};
```
Note: This handler does NOT go through the confirmation dialog and does NOT update session status. It's a direct download action.

4. Add a new button immediately after the existing export button (after line ~376, inside the `isAdmin &&` guard). Use a similar style but with a spreadsheet icon (a table/grid SVG). Button text: "Export Spreadsheet". Disable when `exportingXlsx || queuedCount > 0`. Show spinner when exportingXlsx. Use `onClick={handleExportSpreadsheet}` directly (no confirmation dialog needed).

Button styling: Same pattern as the existing export button but use `border-green-600 text-green-600 hover:bg-green-600/10` to visually distinguish it. Use this SVG icon for a table/spreadsheet look:
```
<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
  <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v1.5c0 .621-.504 1.125-1.125 1.125" />
</svg>
```

**ExportHistoryList.tsx changes:**

1. Add import: `import { reExportSession, exportSessionAsSpreadsheet } from "../utils/export";` (replace existing import to include both).
2. Add a "Re-export (.xlsx)" button next to the existing "Re-export" button inside each export history row (line ~64-71). Place it before the existing Re-export button. Same styling but with `border-green-600 text-green-600 hover:bg-green-600/10` to match the spreadsheet button style. onClick calls `exportSessionAsSpreadsheet(sessionId)`.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>"Export Spreadsheet" button visible next to "Export Session" for admins. "Re-export (.xlsx)" button visible in export history rows. Both trigger .xlsx download without affecting session status or export_history.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with no errors
2. Open a session as admin, see both "Export Session" and "Export Spreadsheet" buttons
3. Click "Export Spreadsheet" -- downloads .xlsx file with Session Info and Items sheets
4. Verify .xlsx contains item fields but no photo/audio blob data
5. Session status unchanged after spreadsheet export
6. Export history section shows "Re-export (.xlsx)" button next to "Re-export"
</verification>

<success_criteria>
- Admin can download .xlsx spreadsheet with session info and item data (no blobs)
- Spreadsheet export is independent of JSON export workflow (no status change, no history record)
- Both re-export buttons work in export history
- TypeScript compiles cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/260407-ket-add-an-extra-export-button-that-download/260407-ket-SUMMARY.md`
</output>
