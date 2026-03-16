/**
 * Post-process AI estimate values into a consistent "low - high" range format.
 *
 * - Single number: +/-20% spread, rounded to nearest 100 if value >= 100
 * - Two+ numbers: min - max (no rounding)
 * - Non-numeric text: passthrough unchanged
 * - Null/empty: returns null
 */
export function formatEstimate(raw: string | null): string | null {
  if (raw === null || raw.trim() === "") {
    return null;
  }

  // Strip dollar signs and commas
  const cleaned = raw.replace(/[$,]/g, "");

  // Extract all numbers
  const matches = cleaned.match(/\d+(?:\.\d+)?/g);

  if (!matches || matches.length === 0) {
    // Non-numeric text: return original as-is
    return raw;
  }

  const numbers = matches.map(Number);

  if (numbers.length === 1) {
    const value = numbers[0];
    let low = value * 0.8;
    let high = value * 1.2;

    if (value >= 100) {
      low = Math.round(low / 100) * 100;
      high = Math.round(high / 100) * 100;
    }

    return `${low} - ${high}`;
  }

  // 2+ numbers: use min and max
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  return `${min} - ${max}`;
}
