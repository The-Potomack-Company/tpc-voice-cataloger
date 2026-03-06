import { describe, it, expect } from "vitest";
import { RECEIPT_PATTERN, isValidReceiptNumber } from "../utils/receiptNumber";

describe("RECEIPT_PATTERN", () => {
  it("matches /^\\d{5}-\\d+$/", () => {
    expect(RECEIPT_PATTERN.source).toBe("^\\d{5}-\\d+$");
  });
});

describe("isValidReceiptNumber", () => {
  it('returns true for "12345-1"', () => {
    expect(isValidReceiptNumber("12345-1")).toBe(true);
  });

  it('returns true for "00001-99" (multi-digit suffix)', () => {
    expect(isValidReceiptNumber("00001-99")).toBe(true);
  });

  it('returns false for "1234-1" (only 4 digits before dash)', () => {
    expect(isValidReceiptNumber("1234-1")).toBe(false);
  });

  it('returns false for "12345" (no dash)', () => {
    expect(isValidReceiptNumber("12345")).toBe(false);
  });

  it('returns false for ""', () => {
    expect(isValidReceiptNumber("")).toBe(false);
  });

  it('handles trimmed input " 12345-1 "', () => {
    expect(isValidReceiptNumber(" 12345-1 ")).toBe(true);
  });

  it('returns false for "123456-1" (6 digits before dash)', () => {
    expect(isValidReceiptNumber("123456-1")).toBe(false);
  });

  it('returns false for "12345-" (no suffix digit)', () => {
    expect(isValidReceiptNumber("12345-")).toBe(false);
  });
});
