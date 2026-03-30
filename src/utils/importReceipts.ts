import * as XLSX from "xlsx";
import { isValidReceiptNumber } from "./receiptNumber";

/**
 * Parse a CSV or XLSX file and extract valid receipt numbers from the first column.
 * Invalid formats, blanks, and duplicates are silently skipped.
 * Returns { valid: string[], skipped: number } for toast feedback.
 */
export async function parseReceiptNumbers(
  file: File,
): Promise<{ valid: string[]; skipped: number }> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const seen = new Set<string>();
  let skipped = 0;

  const valid: string[] = [];
  for (const row of rows) {
    const raw = String(row[0] ?? "").trim();
    if (!raw) {
      skipped++;
      continue;
    }
    if (!isValidReceiptNumber(raw)) {
      skipped++;
      continue;
    }
    if (seen.has(raw)) {
      skipped++;
      continue;
    }
    seen.add(raw);
    valid.push(raw);
  }

  return { valid, skipped };
}
