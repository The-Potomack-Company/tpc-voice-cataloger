import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatStrip } from "../ui/StatStrip";

describe("StatStrip", () => {
  it("renders the eyebrow label, italic value, and optional total", () => {
    render(
      <StatStrip
        stats={[
          { label: "Transcribed", value: 38, total: 42 },
          { label: "Needs review", value: 4, total: 42, tone: "warn" },
          { label: "Elapsed", value: "42 min", showBar: false },
        ]}
      />,
    );

    expect(screen.getByText("Transcribed")).toBeInTheDocument();
    expect(screen.getByText("38")).toBeInTheDocument();
    expect(screen.getAllByText("/42").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("Elapsed")).toBeInTheDocument();
    expect(screen.getByText("42 min")).toBeInTheDocument();
  });

  it("renders mini Bar elements only when showBar is not false and total > 0", () => {
    const { container } = render(
      <StatStrip
        stats={[
          { label: "A", value: 5, total: 10 },
          { label: "B", value: 5, showBar: false },
        ]}
      />,
    );
    // role="progressbar" only renders for stats with totals + showBar !== false.
    expect(container.querySelectorAll('[role="progressbar"]').length).toBe(1);
  });

  it("uses the large variant class when large is true", () => {
    const { container } = render(
      <StatStrip
        large
        stats={[{ label: "X", value: 1, showBar: false }]}
      />,
    );
    expect(
      container.querySelector(".tpc-stat-strip-lg"),
    ).not.toBeNull();
  });
});
