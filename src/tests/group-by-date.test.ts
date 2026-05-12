/**
 * Date-grouping utility used by Sessions list (SCREEN-01).
 */
import { describe, it, expect } from "vitest";
import { groupByDate, sessionShortId } from "../utils/groupByDate";

describe("groupByDate", () => {
  const NOW = new Date("2026-05-12T15:00:00Z");
  // Make stable buckets relative to NOW
  const today = "2026-05-12T09:00:00Z";
  const yesterday = "2026-05-11T12:00:00Z";
  const lastFriday = "2026-05-08T10:00:00Z";
  const earlier = "2026-03-04T10:00:00Z";

  it("groups items into Today / Yesterday / This week / Earlier-month buckets", () => {
    const items = [
      { id: "a", t: today },
      { id: "b", t: yesterday },
      { id: "c", t: lastFriday },
      { id: "d", t: earlier },
    ];
    const groups = groupByDate(items, (i) => i.t, NOW);
    const labels = groups.map((g) => g.label);
    expect(labels[0]).toContain("Today");
    expect(labels[1]).toContain("Yesterday");
    expect(labels[2]).toBe("This week");
    expect(labels[3]).toBe("March");
    // Items routed correctly
    expect(groups[0].items.map((i) => i.id)).toEqual(["a"]);
    expect(groups[1].items.map((i) => i.id)).toEqual(["b"]);
    expect(groups[2].items.map((i) => i.id)).toEqual(["c"]);
    expect(groups[3].items.map((i) => i.id)).toEqual(["d"]);
  });

  it("returns an empty list for empty input", () => {
    expect(groupByDate([] as { t: string }[], (i) => i.t, NOW)).toEqual([]);
  });
});

describe("sessionShortId", () => {
  it("builds a TPC- prefix for sale and HSE- prefix for house", () => {
    expect(
      sessionShortId({
        id: "deadbeef-1111-2222-3333-4444555566ab",
        mode: "sale",
      }),
    ).toBe("TPC-66AB");
    expect(
      sessionShortId({
        id: "deadbeef-1111-2222-3333-4444555566cd",
        mode: "house",
      }),
    ).toBe("HSE-66CD");
  });
});
