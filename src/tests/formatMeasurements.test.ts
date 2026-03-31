import { describe, it, expect } from "vitest";
import {
  formatMeasurements,
  parseMeasurements,
  reformatMeasurements,
} from "../utils/formatMeasurements";

describe("formatMeasurements", () => {
  it("formats 3 dimensions", () => {
    expect(formatMeasurements([36, 24, 18])).toBe(
      "36 x 24 x 18 in. (91.4 x 61 x 45.7 cm.)"
    );
  });

  it("formats 1 dimension", () => {
    expect(formatMeasurements([12])).toBe("12 in. (30.5 cm.)");
  });

  it("formats 2 dimensions", () => {
    expect(formatMeasurements([24, 36])).toBe("24 x 36 in. (61 x 91.4 cm.)");
  });

  it("converts .5 to fraction 1/2", () => {
    expect(formatMeasurements([36.5])).toBe("36 1/2 in. (92.7 cm.)");
  });

  it("converts .25 to fraction 1/4", () => {
    expect(formatMeasurements([12.25])).toBe("12 1/4 in. (31.1 cm.)");
  });

  it("converts .75 to fraction 3/4", () => {
    expect(formatMeasurements([8.75])).toBe("8 3/4 in. (22.2 cm.)");
  });

  it("keeps uncommon decimals as-is", () => {
    expect(formatMeasurements([10.33])).toBe("10.33 in. (26.2 cm.)");
  });

  it("returns empty string for empty array", () => {
    expect(formatMeasurements([])).toBe("");
  });

  it("drops trailing .0 from cm values", () => {
    // 24 inches = 60.96 cm -> rounds to 61.0 -> displayed as 61
    expect(formatMeasurements([24])).toBe("24 in. (61 cm.)");
  });

  it("keeps one decimal when cm is not whole", () => {
    // 36 inches = 91.44 cm -> rounds to 91.4
    expect(formatMeasurements([36])).toBe("36 in. (91.4 cm.)");
  });
});

describe("parseMeasurements", () => {
  it("parses plain dimensions", () => {
    expect(parseMeasurements("36 x 24 x 18")).toEqual([36, 24, 18]);
  });

  it("parses formatted string with in/cm", () => {
    expect(
      parseMeasurements("36 x 24 x 18 in. (91.4 x 61 x 45.7 cm.)")
    ).toEqual([36, 24, 18]);
  });

  it("parses fraction notation", () => {
    expect(parseMeasurements("12 1/2 x 8")).toEqual([12.5, 8]);
  });

  it("parses standalone fraction", () => {
    expect(parseMeasurements("1/4")).toEqual([0.25]);
  });

  it("returns null for non-numeric text", () => {
    expect(parseMeasurements("irregular shape, see photos")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseMeasurements("")).toBeNull();
  });

  it("returns null for more than 3 dimensions", () => {
    expect(parseMeasurements("36 x 24 x 18 x 12")).toBeNull();
  });
});

describe("reformatMeasurements", () => {
  it("reformats parseable dimensions", () => {
    expect(reformatMeasurements("36 x 24")).toBe(
      "36 x 24 in. (91.4 x 61 cm.)"
    );
  });

  it("keeps unparseable text as-is", () => {
    expect(reformatMeasurements("irregular shape")).toBe("irregular shape");
  });

  it("returns empty string for empty input", () => {
    expect(reformatMeasurements("")).toBe("");
  });

  it("passes through rich format with weight and karats unchanged", () => {
    expect(reformatMeasurements("4 x 6 in. (10.2 x 15.2 cm.), 2.5 oz., 18kt")).toBe(
      "4 x 6 in. (10.2 x 15.2 cm.), 2.5 oz., 18kt"
    );
  });

  it("passes through mm format unchanged", () => {
    expect(reformatMeasurements("8 x 6 mm, 2.1 oz.")).toBe("8 x 6 mm, 2.1 oz.");
  });
});
