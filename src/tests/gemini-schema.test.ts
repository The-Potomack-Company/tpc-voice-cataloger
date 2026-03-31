import { describe, it, expect } from "vitest";
import {
  catalogFieldsSchema,
  type CatalogFields,
  catalogFieldsJsonSchema,
} from "../services/geminiSchema";

describe("catalogFieldsSchema", () => {
  it("validates a valid Gemini response with all fields", () => {
    const input = {
      title: "Antique Oak Dresser",
      description: "A three-drawer oak dresser with brass handles",
      condition: "Good, minor scratches on top",
      estimate: "$200-300",
      category: "Furniture",
      measurements: "36 x 24 x 18 in. (91.4 x 61 x 45.7 cm.)",
      transcript: "Antique oak dresser, three drawers, brass handles, good condition with minor scratches",
    };

    const result = catalogFieldsSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(input);
    }
  });

  it("validates a response with all null fields", () => {
    const input = {
      title: null,
      description: null,
      condition: null,
      estimate: null,
      category: null,
      measurements: null,
      transcript: null,
    };

    const result = catalogFieldsSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      const data: CatalogFields = result.data;
      expect(data.title).toBeNull();
      expect(data.description).toBeNull();
      expect(data.condition).toBeNull();
      expect(data.estimate).toBeNull();
      expect(data.category).toBeNull();
      expect(data.measurements).toBeNull();
      expect(data.transcript).toBeNull();
    }
  });

  it("validates a response with mixed null and present fields", () => {
    const input = {
      title: "Silver Tea Set",
      description: null,
      condition: "Excellent",
      estimate: null,
      category: "Silverware",
      measurements: null,
      transcript: "Silver tea set, excellent condition",
    };

    const result = catalogFieldsSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Silver Tea Set");
      expect(result.data.description).toBeNull();
      expect(result.data.condition).toBe("Excellent");
      expect(result.data.estimate).toBeNull();
      expect(result.data.category).toBe("Silverware");
    }
  });

  it("validates measurements with weight and karats", () => {
    const input = {
      title: "Gold Ring",
      description: "14 karat gold ring",
      condition: "Excellent",
      estimate: "500",
      category: "JWL",
      measurements: "8 mm, 2.1 oz., 14kt",
      transcript: "Gold ring, fourteen karat, excellent condition",
    };
    const result = catalogFieldsSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.measurements).toBe("8 mm, 2.1 oz., 14kt");
    }
  });

  it("rejects measurements as array of numbers", () => {
    const input = {
      title: "Table",
      description: null,
      condition: null,
      estimate: null,
      category: null,
      measurements: [36, 24, 18],
      transcript: null,
    };
    const result = catalogFieldsSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects a response missing required keys", () => {
    const input = {
      title: "Something",
      description: "A thing",
      // missing condition, estimate, category
    };

    const result = catalogFieldsSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("produces a valid JSON Schema object", () => {
    expect(catalogFieldsJsonSchema).toBeDefined();
    expect(typeof catalogFieldsJsonSchema).toBe("object");
    // JSON Schema should have properties
    const schema = catalogFieldsJsonSchema as Record<string, unknown>;
    expect(schema).toHaveProperty("type");
    expect(schema).toHaveProperty("properties");
  });
});
