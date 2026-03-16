/**
 * Format an array of inch measurements into auction catalog format:
 * "N x N x N in. (N x N x N cm.)"
 *
 * - Common fractions (.25, .5, .75) display as 1/4, 1/2, 3/4
 * - Cm values round to 1 decimal, trailing .0 is dropped
 */

const FRACTION_MAP: Record<number, string> = {
  0.25: "1/4",
  0.5: "1/2",
  0.75: "3/4",
};

function inchesToCm(inches: number): string {
  const cm = Math.round(inches * 2.54 * 10) / 10;
  return cm % 1 === 0 ? String(cm) : String(cm);
}

function formatInch(value: number): string {
  const whole = Math.floor(value);
  const frac = Math.round((value - whole) * 100) / 100;

  if (frac === 0) return String(whole);

  const fractionStr = FRACTION_MAP[frac];
  if (fractionStr) {
    return whole === 0 ? fractionStr : `${whole} ${fractionStr}`;
  }

  return String(value);
}

export function formatMeasurements(inches: number[]): string {
  if (inches.length === 0) return "";

  const inParts = inches.map(formatInch).join(" x ");
  const cmParts = inches.map(inchesToCm).join(" x ");

  return `${inParts} in. (${cmParts} cm.)`;
}

/**
 * Parse a measurement string back into an array of inch values.
 * Returns null if unparseable, empty, or more than 3 dimensions.
 */
export function parseMeasurements(raw: string): number[] | null {
  if (!raw || raw.trim() === "") return null;

  // Strip parenthetical cm section
  let cleaned = raw.replace(/\(.*\)/, "").trim();
  // Strip "in." suffix
  cleaned = cleaned.replace(/\bin\.?\s*$/, "").trim();

  // Split on " x " (case-insensitive)
  const parts = cleaned.split(/\s*x\s*/i);

  if (parts.length === 0 || parts.length > 3) return null;

  const values: number[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) return null;

    // Handle fraction notation: "12 1/2" or standalone "1/4"
    const fractionMatch = trimmed.match(
      /^(\d+)?\s*(\d+)\/(\d+)$/
    );

    if (fractionMatch) {
      const whole = fractionMatch[1] ? Number(fractionMatch[1]) : 0;
      const num = Number(fractionMatch[2]);
      const den = Number(fractionMatch[3]);
      if (den === 0) return null;
      values.push(whole + num / den);
      continue;
    }

    // Plain number
    const num = Number(trimmed);
    if (isNaN(num)) return null;
    values.push(num);
  }

  if (values.length === 0 || values.length > 3) return null;

  return values;
}

/**
 * Reformat a measurement string. If parseable, formats to standard
 * auction catalog convention. If not parseable, returns as-is.
 */
export function reformatMeasurements(raw: string): string {
  if (!raw || raw.trim() === "") return "";

  const parsed = parseMeasurements(raw);
  if (!parsed) return raw;

  return formatMeasurements(parsed);
}
