import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseReceiptNumbers } from "../utils/importReceipts";

/**
 * Helper: create a File from CSV text content
 */
function csvFile(content: string, name = "receipts.csv"): File {
  return new File([content], name, { type: "text/csv" });
}

/**
 * Helper: create a File from XLSX workbook data
 */
function xlsxFile(rows: unknown[][], name = "receipts.xlsx"): File {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new File([buf], name);
}

describe("parseReceiptNumbers", () => {
  it("parses CSV with valid receipt numbers and returns array of strings", async () => {
    const file = csvFile("12345-1\n12345-2\n12345-3");
    const result = await parseReceiptNumbers(file);
    expect(result.valid).toEqual(["12345-1", "12345-2", "12345-3"]);
    expect(result.skipped).toBe(0);
  });

  it("parses XLSX with valid receipt numbers and returns array of strings", async () => {
    const file = xlsxFile([["12345-1"], ["12345-2"], ["00001-99"]]);
    const result = await parseReceiptNumbers(file);
    expect(result.valid).toEqual(["12345-1", "12345-2", "00001-99"]);
    expect(result.skipped).toBe(0);
  });

  it("excludes invalid receipt numbers (wrong format)", async () => {
    const file = csvFile("12345-1\nabc\n1234-1\n12345-2");
    const result = await parseReceiptNumbers(file);
    expect(result.valid).toEqual(["12345-1", "12345-2"]);
    expect(result.skipped).toBe(2);
  });

  it("excludes blank rows from results", async () => {
    const file = csvFile("12345-1\n\n\n12345-2\n");
    const result = await parseReceiptNumbers(file);
    expect(result.valid).toEqual(["12345-1", "12345-2"]);
    expect(result.skipped).toBeGreaterThanOrEqual(2);
  });

  it("excludes duplicate receipt numbers (keeps first occurrence)", async () => {
    const file = csvFile("12345-1\n12345-2\n12345-1\n12345-3");
    const result = await parseReceiptNumbers(file);
    expect(result.valid).toEqual(["12345-1", "12345-2", "12345-3"]);
    expect(result.skipped).toBe(1);
  });

  it("returns empty array for file with no valid receipts", async () => {
    const file = csvFile("hello\nworld\n123");
    const result = await parseReceiptNumbers(file);
    expect(result.valid).toEqual([]);
    expect(result.skipped).toBe(3);
  });

  it("uses first column regardless of header row presence", async () => {
    const file = xlsxFile([
      ["Receipt Number", "Name"],
      ["12345-1", "Smith"],
      ["12345-2", "Jones"],
    ]);
    const result = await parseReceiptNumbers(file);
    // "Receipt Number" is not a valid receipt number, should be skipped
    expect(result.valid).toEqual(["12345-1", "12345-2"]);
    expect(result.skipped).toBe(1);
  });
});
