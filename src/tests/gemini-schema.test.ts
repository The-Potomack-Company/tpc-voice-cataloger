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
    }
  });

  it("validates a response with mixed null and present fields", () => {
    const input = {
      title: "Silver Tea Set",
      description: null,
      condition: "Excellent",
      estimate: null,
      category: "Silverware",
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
