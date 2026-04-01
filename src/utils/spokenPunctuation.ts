/**
 * Convert spoken quote markers into actual ASCII double-quote characters (0x22).
 *
 * Supported opening markers: "quote", "open quote" (case-insensitive)
 * Supported closing markers: "unquote", "close quote", "end quote" (case-insensitive)
 *
 * Unpaired opening markers (no closing marker found after them) are left as-is,
 * since the word "quote" is likely used as a noun in that context.
 */
export function applySpokenQuotes(text: string): string {
  if (!text) return text;

  // Strategy: iteratively find the first opening marker, then find the next
  // closing marker after it. Replace both, then repeat on the resulting string.
  // If no closing marker exists for an opening marker, skip it (noun usage).

  const openPattern = /\b(open\s+quote|quote)\b/i;
  const closePattern = /\b(unquote|close\s+quote|end\s+quote)\b/i;

  let result = text;
  let searchStart = 0;

  // Safety limit to prevent infinite loops
  for (let i = 0; i < 100; i++) {
    const remaining = result.slice(searchStart);
    const openMatch = openPattern.exec(remaining);
    if (!openMatch) break;

    const openIndex = searchStart + openMatch.index;
    const openEnd = openIndex + openMatch[0].length;

    // Look for closing marker after the opening marker
    const afterOpen = result.slice(openEnd);
    const closeMatch = closePattern.exec(afterOpen);
    if (!closeMatch) {
      // No closing marker found -- skip this opening marker (noun usage)
      searchStart = openEnd;
      continue;
    }

    const closeIndex = openEnd + closeMatch.index;
    const closeEnd = closeIndex + closeMatch[0].length;

    // Extract the text between markers
    const inner = result.slice(openEnd, closeIndex);

    // Trim single leading/trailing space from the inner text (the space
    // that separated the marker word from the content)
    const trimmedInner = inner.replace(/^ /, "").replace(/ $/, "");

    // Rebuild the string: before open + " + inner + " + after close
    result =
      result.slice(0, openIndex) +
      '"' +
      trimmedInner +
      '"' +
      result.slice(closeEnd);

    // Continue searching after the closing quote character we just inserted
    // +2 for the two quote characters, trimmedInner.length for the content
    searchStart = openIndex + 1 + trimmedInner.length + 1;
  }

  return result;
}
