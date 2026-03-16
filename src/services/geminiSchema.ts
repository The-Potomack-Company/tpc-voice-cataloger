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
  transcript: z
    .string()
    .nullable()
    .describe("Full verbatim transcript of everything the speaker said, or null if audio is unintelligible"),
});

export type CatalogFields = z.infer<typeof catalogFieldsSchema>;
export const catalogFieldsJsonSchema = toJSONSchema(catalogFieldsSchema);
