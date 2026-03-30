/**
 * Post-process AI estimate values into a consistent "low - high" range format.
 *
 * - Single number: +/-20% spread, rounded to magnitude-appropriate units
 *   (10s, 100s, 1000s, etc.) using log10-based roundUnit
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

    if (value >= 10) {
      let roundUnit = 10 ** Math.floor(Math.log10(value));
      low = Math.round(low / roundUnit) * roundUnit;
      high = Math.round(high / roundUnit) * roundUnit;

      // Collapse guard: if rounding made low === high, step down one magnitude
      if (low === high && roundUnit >= 10) {
        roundUnit = roundUnit / 10;
        low = Math.round((value * 0.8) / roundUnit) * roundUnit;
        high = Math.round((value * 1.2) / roundUnit) * roundUnit;
      }
    }

    return `${low} - ${high}`;
  }

  // 2+ numbers: use min and max
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  return `${min} - ${max}`;
}
