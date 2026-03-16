/**
 * Convert a string to Title Case (capitalize first letter of each word, lowercase the rest).
 *
 * - Empty string returns empty string
 * - Preserves spaces between words
 * - Handles single-word input
 */
export function toTitleCase(str: string): string {
  if (str === "") return "";

  return str
    .split(" ")
    .map((word) =>
      word.length === 0
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join(" ");
}
