import { describe, it, expect } from "vitest";
import { formatEstimate } from "../utils/formatEstimate";

describe("formatEstimate", () => {
  it("returns null for null input", () => {
    expect(formatEstimate(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(formatEstimate("")).toBeNull();
  });

  it("formats single number 500 as range 400 - 600", () => {
    expect(formatEstimate("500")).toBe("400 - 600");
  });

  it("formats single number 750 as range 600 - 900", () => {
    expect(formatEstimate("750")).toBe("600 - 900");
  });

  it("formats single number 1200 as range 1000 - 1400", () => {
    expect(formatEstimate("1200")).toBe("1000 - 1400");
  });

  it("formats single number 5 as range 4 - 6 (no rounding for single digits)", () => {
    expect(formatEstimate("5")).toBe("4 - 6");
  });

  it("formats single number 15 as range 10 - 20 (rounds to 10s)", () => {
    expect(formatEstimate("15")).toBe("10 - 20");
  });

  it("formats number below 100 without rounding (50 -> 40 - 60)", () => {
    expect(formatEstimate("50")).toBe("40 - 60");
  });

  it("formats single number 8000 as range 6000 - 10000 (rounds to 1000s)", () => {
    expect(formatEstimate("8000")).toBe("6000 - 10000");
  });

  it("formats single number 50000 as range 40000 - 60000 (rounds to 10000s)", () => {
    expect(formatEstimate("50000")).toBe("40000 - 60000");
  });

  it("formats two-number range '300 to 500' as '300 - 500'", () => {
    expect(formatEstimate("300 to 500")).toBe("300 - 500");
  });

  it("strips dollar signs ('$200-300' -> '200 - 300')", () => {
    expect(formatEstimate("$200-300")).toBe("200 - 300");
  });

  it("sorts numbers low to high ('500 - 300' -> '300 - 500')", () => {
    expect(formatEstimate("500 - 300")).toBe("300 - 500");
  });

  it("passes through non-numeric text ('three hundred')", () => {
    expect(formatEstimate("three hundred")).toBe("three hundred");
  });

  it("uses min and max when 3+ numbers found ('200 to 300 to 400' -> '200 - 400')", () => {
    expect(formatEstimate("200 to 300 to 400")).toBe("200 - 400");
  });
});
