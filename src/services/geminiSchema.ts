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
    .describe("Price estimate exactly as spoken, or null if not mentioned"),
  category: z
    .string()
    .nullable()
    .describe("Category exactly as spoken, or null if not mentioned"),
});

export type CatalogFields = z.infer<typeof catalogFieldsSchema>;
export const catalogFieldsJsonSchema = toJSONSchema(catalogFieldsSchema);
