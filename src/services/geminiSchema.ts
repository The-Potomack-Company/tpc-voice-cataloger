import { z, toJSONSchema } from "zod";

export const catalogFieldsSchema = z.object({
  title: z
    .string()
    .nullable()
    .describe("Item title exactly as spoken, or null if not mentioned"),
  description: z
    .string()
    .nullable()
    .describe("Item description exactly as spoken, or null if not mentioned"),
  condition: z
    .string()
    .nullable()
    .describe("Condition exactly as spoken, or null if not mentioned"),
  estimate: z
    .string()
    .nullable()
    .describe("Price estimate as a numeric value or range (e.g. '500' or '300 to 500'). Strip dollar signs. Return just the number(s). Null if not mentioned."),
  category: z
    .string()
    .nullable()
    .describe("The RFC department code that best matches the spoken category. Valid codes: AA, AMER, AWFA, ANT, AAR, 0001, ASD, ASN, ASNP, BKS, CER, IND, CLK, CNS, DEC, DRW, ENT, EA, FASH, FIS, FRN, MDF, PER, GAR, GEN, GLS, ITS, ISL, JWL, LIT, MANU, MAP, MA, MUS, NAT, TXTL, PND, PNT, PEN, MIN, REL, RUG, SPT, SIL, TAP, TRI, WINE. Return null if not mentioned."),
  measurements: z
    .string()
    .nullable()
    .describe("Formatted measurements string combining dimensions, weight, and karats/carats. Dimensions in inches: 'N x N in. (N x N cm.)' with auto cm conversion. Diameter (when speaker says 'diameter', 'in diameter', 'across', 'dia.', or 'diam.' — round/cylindrical items like plates, bowls, vases, mirrors, coins): 'N in. (N cm.) diameter' with auto cm conversion, single value only. Millimeters only when speaker says 'mm' or 'millimeters': 'N x N mm' (no conversion). Weight: 'N oz.' or 'N g'. Gold purity (karat): 'Nkt' (e.g., '14kt'). Gem weight (carat): 'Nct' (e.g., '1.5ct'). Combine all in one string separated by ', '. Example: '4 x 6 in. (10.2 x 15.2 cm.), 2.5 oz., 18kt', '1.5ct, 0.8 oz.', or '8 in. (20.3 cm.) diameter, 12 oz.'. IMPORTANT: In auction context, 'karats'/'carats'/'carrots' means gold purity (Nkt) or gem weight (Nct), never the vegetable. Use context to determine which. Return null if no measurements mentioned."),
  transcript: z
    .string()
    .nullable()
    .describe("Full verbatim transcript of everything the speaker said, or null if audio is unintelligible"),
  receipt_number: z
    .string()
    .nullish()
    .describe("Receipt number in XXXXX-N format (5-digit lot prefix, dash, 1+ digit suffix). Extract when speaker says 'receipt number' or 'lot number' followed by digits. Spoken digit-by-digit ('three nine two five six') → digit string ('39256'). Spoken group numbers ('twenty-two') → digits ('22'). 'dash' or 'hyphen' → '-'. Example: 'receipt number three nine two five six dash twenty-two' → '39256-22'. Return null if not mentioned."),
  new_item_detected: z
    .object({
      triggered: z.boolean(),
      receipt_number: z.string().nullish(),
    })
    .nullish()
    .describe("Continuous session wake-phrase signal. Set triggered true when the speaker says 'new item', 'next item', or a similar boundary phrase. Include the next item's receipt number when spoken."),
});

export type CatalogFields = z.infer<typeof catalogFieldsSchema>;
export const catalogFieldsJsonSchema = toJSONSchema(catalogFieldsSchema);
