/**
 * Map spoken category words to RFC Invaluable department codes.
 *
 * The AI is prompted to return department codes directly, but this mapper
 * acts as a safety net to normalize any verbatim text the AI might still return.
 * Unknown/unmatched categories default to "FRN" (Furniture).
 */

/** All valid RFC Invaluable department codes. */
export const VALID_DEPARTMENT_CODES = new Set([
  "AA", "AMER", "AWFA", "ANT", "AAR", "0001", "ASD", "ASN", "ASNP",
  "BKS", "CER", "IND", "CLK", "CNS", "DEC", "DRW", "ENT", "EA",
  "FASH", "FIS", "FRN", "MDF", "PER", "GAR", "GEN", "GLS", "ITS",
  "ISL", "JWL", "LIT", "MANU", "MAP", "MA", "MUS", "NAT", "TXTL",
  "PND", "PNT", "PEN", "MIN", "REL", "RUG", "SPT", "SIL", "TAP",
  "TRI", "WINE",
]);

/** Mapping of common spoken words/phrases (lowercased) to department codes. */
export const KEYWORD_TO_CODE: Record<string, string> = {
  "american art": "AA",
  "american": "AMER",
  "western": "AWFA",
  "antiquities": "ANT",
  "antiques": "ANT",
  "arms": "AAR",
  "armour": "AAR",
  "armor": "AAR",
  "art": "0001",
  "asian decorative": "ASD",
  "asian": "ASN",
  "books": "BKS",
  "book": "BKS",
  "ceramics": "CER",
  "ceramic": "CER",
  "pottery": "CER",
  "indian": "IND",
  "clocks": "CLK",
  "clock": "CLK",
  "coins": "CNS",
  "coin": "CNS",
  "decorative": "DEC",
  "dec arts": "DEC",
  "drawings": "DRW",
  "prints": "DRW",
  "photographs": "DRW",
  "photography": "DRW",
  "entertainment": "ENT",
  "european": "EA",
  "fashion": "FASH",
  "clothing": "FASH",
  "fishing": "FIS",
  "furniture": "FRN",
  "modern furniture": "MDF",
  "period furniture": "PER",
  "garden": "GAR",
  "general": "GEN",
  "glass": "GLS",
  "glassware": "GLS",
  "islamic": "ISL",
  "jewelry": "JWL",
  "jewellery": "JWL",
  "lighting": "LIT",
  "chandeliers": "LIT",
  "chandelier": "LIT",
  "manuscripts": "MANU",
  "manuscript": "MANU",
  "autographs": "MANU",
  "maps": "MAP",
  "atlas": "MAP",
  "modern art": "MA",
  "musical": "MUS",
  "instruments": "MUS",
  "native american": "NAT",
  "textiles": "TXTL",
  "textile": "TXTL",
  "paintings decorative": "PND",
  "paintings": "PNT",
  "painting": "PNT",
  "fine art": "PNT",
  "pens": "PEN",
  "pen": "PEN",
  "miniatures": "MIN",
  "miniature": "MIN",
  "religious": "REL",
  "icons": "REL",
  "rugs": "RUG",
  "rug": "RUG",
  "carpet": "RUG",
  "sculpture": "SPT",
  "sculptures": "SPT",
  "silver": "SIL",
  "silverware": "SIL",
  "tapestries": "TAP",
  "tapestry": "TAP",
  "tribal": "TRI",
  "wine": "WINE",
  "spirits": "WINE",
};

/**
 * Keywords sorted by length descending so longer phrases match first
 * (e.g., "modern furniture" matches before "furniture").
 */
const SORTED_KEYWORDS = Object.keys(KEYWORD_TO_CODE).sort(
  (a, b) => b.length - a.length,
);

/**
 * Map a raw category string to an RFC department code.
 *
 * Resolution order:
 * 1. Null/empty -> "FRN"
 * 2. Direct department code match (case-insensitive) -> return uppercased
 * 3. Exact keyword match (lowercased) -> mapped code
 * 4. Substring keyword match (longest first) -> mapped code
 * 5. No match -> "FRN"
 */
export function mapCategoryToCode(raw: string | null): string {
  if (raw === null || raw.trim() === "") {
    return "FRN";
  }

  // Check if it's already a valid department code
  const upper = raw.trim().toUpperCase();
  if (VALID_DEPARTMENT_CODES.has(upper)) {
    return upper;
  }

  const lower = raw.trim().toLowerCase();

  // Exact keyword match
  if (KEYWORD_TO_CODE[lower] !== undefined) {
    return KEYWORD_TO_CODE[lower];
  }

  // Substring match (longest keywords first)
  for (const keyword of SORTED_KEYWORDS) {
    if (lower.includes(keyword)) {
      return KEYWORD_TO_CODE[keyword];
    }
  }

  // Default fallback
  return "FRN";
}
