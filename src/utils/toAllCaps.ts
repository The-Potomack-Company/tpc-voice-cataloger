/**
 * Convert a string to ALL CAPS.
 *
 * - Empty string returns empty string
 */
export function toAllCaps(str: string): string {
  if (str === "") return "";

  return str.toUpperCase();
}
