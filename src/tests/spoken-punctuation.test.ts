import { describe, it, expect } from "vitest";
import { applySpokenQuotes, applySpokenBullets } from "../utils/spokenPunctuation";

describe("applySpokenQuotes", () => {
  it('converts "quote X unquote" to quoted text', () => {
    expect(applySpokenQuotes("quote 19th century unquote")).toBe(
      '"19th century"',
    );
  });

  it('converts "open quote X close quote" to quoted text', () => {
    expect(applySpokenQuotes("open quote fine condition close quote")).toBe(
      '"fine condition"',
    );
  });

  it('converts "open quote X end quote" to quoted text', () => {
    expect(applySpokenQuotes("open quote hello end quote world")).toBe(
      '"hello" world',
    );
  });

  it("leaves text without quote markers unchanged", () => {
    expect(applySpokenQuotes("no quotes here at all")).toBe(
      "no quotes here at all",
    );
  });

  it("is case-insensitive", () => {
    expect(applySpokenQuotes("Quote nice UNQUOTE")).toBe('"nice"');
    expect(applySpokenQuotes("OPEN QUOTE hello CLOSE QUOTE")).toBe('"hello"');
  });

  it("preserves surrounding text", () => {
    expect(applySpokenQuotes("a quote nice unquote table")).toBe(
      'a "nice" table',
    );
  });

  it("handles multiple pairs in a single string", () => {
    expect(
      applySpokenQuotes("quote red unquote and quote blue unquote"),
    ).toBe('"red" and "blue"');
  });

  it("leaves unpaired opening quote as-is (noun usage)", () => {
    expect(applySpokenQuotes("get a quote from the dealer")).toBe(
      "get a quote from the dealer",
    );
  });

  it("handles empty string", () => {
    expect(applySpokenQuotes("")).toBe("");
  });

  it("handles mixed marker styles", () => {
    expect(
      applySpokenQuotes("open quote first close quote and quote second unquote"),
    ).toBe('"first" and "second"');
  });
});

describe("applySpokenBullets", () => {
  it("converts a single bullet marker", () => {
    expect(applySpokenBullets("bullet: gilded frame")).toBe("• gilded frame");
  });

  it("converts multiple bullet markers", () => {
    expect(applySpokenBullets("bullet: gilded frame bullet: minor wear")).toBe(
      "• gilded frame\n• minor wear",
    );
  });

  it("preserves prose before the first bullet", () => {
    expect(
      applySpokenBullets("oak table bullet: cabriole legs bullet: worn finish"),
    ).toBe("oak table\n• cabriole legs\n• worn finish");
  });

  it("leaves text without bullet markers unchanged", () => {
    expect(applySpokenBullets("no bullets here at all")).toBe(
      "no bullets here at all",
    );
  });

  it("is case-insensitive", () => {
    expect(applySpokenBullets("BULLET: first BULLET: second")).toBe(
      "• first\n• second",
    );
  });

  it("handles trailing whitespace after bullet:", () => {
    expect(applySpokenBullets("bullet:  gilded frame")).toBe("• gilded frame");
  });

  it("handles empty string", () => {
    expect(applySpokenBullets("")).toBe("");
  });

  it("skips empty bullet segments", () => {
    expect(applySpokenBullets("bullet: ")).toBe("");
  });
});
