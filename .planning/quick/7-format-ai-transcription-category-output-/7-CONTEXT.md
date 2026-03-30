# Quick Task 7: Format AI transcription category output for RFC import - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Task Boundary

Format AI transcription category output to store specific RFC department codes (AA, BKS, CER, JWL, etc.) instead of verbatim spoken text. When a plain word is spoken (e.g., "ceramics"), parse it into the matching RFC department code (e.g., "CER"). Also apply Title Case to item titles.

</domain>

<decisions>
## Implementation Decisions

### Category = RFC Department Code
- **Store specific RFC department codes** in the category field, NOT the 3 broad categories
- When auctioneer says "American Art" → store "AA", "ceramics" → "CER", "books" → "BKS", "jewelry" → "JWL"
- The cataloger extension will always be precise with department codes
- **Both layers**: Update Gemini system prompt with the full department code list AND add a TS fallback mapper

### Department Code List (from RFC Invaluable)
Full valid codes: AA, AMER, AWFA, ANT, AAR, 0001, ASD, ASN, ASNP, BKS, CER, IND, CLK, CNS, DEC, DRW, ENT, EA, FASH, FIS, FRN, MDF, PER, GAR, GEN, GLS, ITS, ISL, JWL, LIT, MANU, MAP, MA, MUS, NAT, TXTL, PND, PNT, PEN, MIN, REL, RUG, SPT, SIL, TAP, TRI, WINE

### Fallback Mapper
- TS post-processing maps common spoken words → department codes
- Uses keyword matching (e.g., "furniture" → "FRN", "silver" → "SIL", "rugs" → "RUG")
- Default to "FRN" (Furniture General) when no match found

### Title Formatting
- Apply Title Case (capitalize first letter of each word) to titles via TypeScript post-processing
- This is a code-side transformation, not an AI prompt change

### Claude's Discretion
- Exact spoken-word-to-department-code mapping table
- Placement of utility functions

</decisions>

<specifics>
## Specific Ideas

### RFC Department Codes (from Invaluable)
Full list of RFC departments available: AA, AMER, AWFA, ANT, AAR, 0001, ASD, ASN, ASNP, BKS, CER, IND, CLK, CNS, DEC, DRW, ENT, EA, FASH, FIS, FRN, MDF, PER, GAR, GEN, GLS, ITS, ISL, JWL, LIT, MANU, MAP, MA, MUS, NAT, TXTL, PND, PNT, PEN, MIN, REL, RUG, SPT, SIL, TAP, TRI, WINE

### Extension Category IDs
- `furniture` → "Furniture & Decorative Arts"
- `books` → "Books & Manuscripts"
- `fashion` → "Fashion & Accessories"

### Department-to-Category Mapping (from categories.json)
- books: BKS, MANU, MAP
- fashion: FASH, JWL, TXTL
- furniture: FRN, PER, DEC, MDF, CER, GLS, SIL, CLK, LIT, RUG, TAP, GAR, ASN, ASD

</specifics>
