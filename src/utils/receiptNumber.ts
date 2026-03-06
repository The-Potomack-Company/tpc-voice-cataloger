/**
 * Pattern for valid receipt numbers: 5 digits, dash, 1+ digits.
 * Examples: "12345-1", "00001-99"
 */
export const RECEIPT_PATTERN = /^\d{5}-\d+$/;

/**
 * Validates a receipt number string against the XXXXX-N format.
 * Trims whitespace before testing.
 */
export function isValidReceiptNumber(value: string): boolean {
  return RECEIPT_PATTERN.test(value.trim());
}
