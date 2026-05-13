/**
 * src/ui/__tests__/lib.test.tsx
 *
 * Phase 24 component-library unit tests.
 *
 * Each primitive is exercised for:
 *   - render output
 *   - canonical class name (.tpc-btn / .tpc-badge / etc.) so the token
 *     cascade reaches them
 *   - tone / variant / size modifier classes
 *   - a11y attributes (role, aria-*, label association)
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "../Button";
import { Badge } from "../Badge";
import { Input } from "../Input";
import { Card } from "../Card";
import { Eyebrow } from "../Eyebrow";
import { Bar } from "../Bar";
import { Placeholder } from "../Placeholder";
import { Icon, iconRegistry } from "../icons";

describe("Button", () => {
  it("renders as a button element with default primary variant + md size", () => {
    render(<Button>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn).toHaveClass("tpc-btn", "tpc-btn-primary");
    expect(btn).not.toHaveClass("tpc-btn-sm");
    expect(btn.getAttribute("type")).toBe("button");
  });

  it("applies secondary / ghost / danger variants and sm size class", () => {
    const { rerender } = render(<Button variant="secondary">A</Button>);
    expect(screen.getByRole("button")).toHaveClass("tpc-btn-secondary");

    rerender(<Button variant="ghost">A</Button>);
    expect(screen.getByRole("button")).toHaveClass("tpc-btn-ghost");

    rerender(<Button variant="danger" size="sm">A</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("tpc-btn-danger", "tpc-btn-sm");
  });

  it("applies full-width class when fullWidth is set", () => {
    render(<Button fullWidth>Wide</Button>);
    expect(screen.getByRole("button")).toHaveClass("tpc-btn-fullwidth");
  });
});

describe("Badge", () => {
  it("renders a span with tpc-badge class and default tone", () => {
    render(<Badge>Active</Badge>);
    const el = screen.getByText("Active");
    expect(el.tagName).toBe("SPAN");
    expect(el).toHaveClass("tpc-badge");
    expect(el).not.toHaveClass("tpc-badge-ok");
  });

  it("applies tone-specific class for ok / warn / err / info", () => {
    const { rerender } = render(<Badge tone="ok">x</Badge>);
    expect(screen.getByText("x")).toHaveClass("tpc-badge-ok");

    rerender(<Badge tone="warn">x</Badge>);
    expect(screen.getByText("x")).toHaveClass("tpc-badge-warn");

    rerender(<Badge tone="err">x</Badge>);
    expect(screen.getByText("x")).toHaveClass("tpc-badge-err");

    rerender(<Badge tone="info">x</Badge>);
    expect(screen.getByText("x")).toHaveClass("tpc-badge-info");
  });

  it("renders a dot when dot=true (with aria-hidden)", () => {
    const { container } = render(<Badge dot>3</Badge>);
    const dot = container.querySelector(".tpc-dot");
    expect(dot).not.toBeNull();
    expect(dot?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("Input", () => {
  it("renders an input with tpc-input class and associates a label", () => {
    render(<Input label="Name" placeholder="Type here" />);
    const input = screen.getByLabelText("Name");
    expect(input.tagName).toBe("INPUT");
    expect(input).toHaveClass("tpc-input");
  });

  it("sets aria-invalid + describes by error id when error is present", () => {
    render(<Input label="Email" error="Required" defaultValue="" />);
    const input = screen.getByLabelText("Email");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const errorEl = screen.getByRole("alert");
    expect(errorEl.id).toBe(describedBy);
  });

  it("describes by hint id when hint is present without error", () => {
    render(<Input label="Pass" hint="At least 6 characters" />);
    const input = screen.getByLabelText("Pass");
    expect(input.getAttribute("aria-invalid")).toBeNull();
    expect(input.getAttribute("aria-describedby")).toBeTruthy();
  });
});

describe("Card", () => {
  it("renders a div with tpc-card class by default", () => {
    const { container } = render(<Card>Hello</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.tagName).toBe("DIV");
    expect(card).toHaveClass("tpc-card");
  });

  it("renders polymorphically as a button when as='button'", () => {
    render(<Card as="button">Click</Card>);
    const card = screen.getByRole("button", { name: "Click" });
    expect(card).toHaveClass("tpc-card");
  });

  it("applies tone class for accent-wash / sand-wash", () => {
    const { container, rerender } = render(<Card tone="accent-wash">a</Card>);
    expect(container.firstChild).toHaveClass("tpc-card-accent-wash");
    rerender(<Card tone="sand-wash">a</Card>);
    expect(container.firstChild).toHaveClass("tpc-card-sand-wash");
  });

  it("applies interactive class when interactive=true", () => {
    const { container } = render(<Card interactive>a</Card>);
    expect(container.firstChild).toHaveClass("tpc-card-interactive");
  });
});

describe("Eyebrow", () => {
  it("renders with tpc-eyebrow class", () => {
    render(<Eyebrow>Section</Eyebrow>);
    expect(screen.getByText("Section")).toHaveClass("tpc-eyebrow");
  });
});

describe("Bar", () => {
  it("renders a progressbar with aria-valuenow clamped between min and max", () => {
    render(<Bar value={50} label="Sync" />);
    const bar = screen.getByRole("progressbar", { name: "Sync" });
    expect(bar).toHaveClass("bar-track");
    expect(bar.getAttribute("aria-valuenow")).toBe("50");
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
  });

  it("applies tone class to the fill element", () => {
    const { container } = render(<Bar value={20} tone="warn" />);
    const fill = container.querySelector(".bar-fill");
    expect(fill).not.toBeNull();
    expect(fill).toHaveClass("bar-fill-warn");
  });

  it("clamps over-max values and exposes meter role when meter=true", () => {
    render(<Bar value={200} max={100} meter label="Pct" />);
    const m = screen.getByRole("meter", { name: "Pct" });
    expect(m.getAttribute("aria-valuenow")).toBe("100");
  });
});

describe("Placeholder", () => {
  it("renders with tpc-placeholder class and label", () => {
    render(<Placeholder label="Image" />);
    expect(screen.getByText("Image")).toHaveClass("tpc-placeholder");
  });

  it("is aria-hidden when no label is provided", () => {
    const { container } = render(<Placeholder />);
    expect((container.firstChild as HTMLElement).getAttribute("aria-hidden")).toBe(
      "true",
    );
  });
});

describe("Icon", () => {
  it("renders an SVG for every registered icon name", () => {
    const names = Object.keys(iconRegistry);
    expect(names.length).toBeGreaterThanOrEqual(40);
    for (const name of names) {
      const { container, unmount } = render(<Icon name={name as never} />);
      const svg = container.querySelector("svg");
      expect(svg, `icon "${name}" must render an SVG`).not.toBeNull();
      unmount();
    }
  });

  it("sets role='img' and aria-label when a label is provided", () => {
    render(<Icon name="play" aria-label="Play recording" />);
    const svg = screen.getByLabelText("Play recording");
    expect(svg.getAttribute("role")).toBe("img");
  });

  it("is aria-hidden by default (decorative)", () => {
    const { container } = render(<Icon name="search" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });
});
