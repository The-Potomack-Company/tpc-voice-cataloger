import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, test, expect, beforeEach } from "vitest";
import { AppLayout } from "../layouts/AppLayout";
import { SessionsPage } from "../pages/Sessions";
import { NewSessionPage } from "../pages/NewSession";

// Helper to render within a router context
function renderWithRouter(ui: React.ReactElement, { route = "/" } = {}) {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
}

describe("AppLayout", () => {
  test("renders a nav element with 3 NavLink children", () => {
    renderWithRouter(<AppLayout />);
    const nav = document.querySelector("nav");
    expect(nav).toBeInTheDocument();
    const links = nav!.querySelectorAll("a");
    expect(links).toHaveLength(3);
  });

  test("each NavLink has min-h-12 and min-w-12 classes for 48px tap targets", () => {
    renderWithRouter(<AppLayout />);
    const nav = document.querySelector("nav");
    const links = nav!.querySelectorAll("a");
    links.forEach((link) => {
      expect(link.className).toContain("min-h-12");
      expect(link.className).toContain("min-w-12");
    });
  });

  test("tab bar nav has pb-[env(safe-area-inset-bottom)] for notched devices", () => {
    renderWithRouter(<AppLayout />);
    const nav = document.querySelector("nav");
    expect(nav!.className).toContain("pb-[env(safe-area-inset-bottom)]");
  });

  test("root container uses h-dvh class", () => {
    renderWithRouter(<AppLayout />);
    // The root div of the layout should have h-dvh
    const rootDiv = document.querySelector("[data-testid='app-layout']");
    expect(rootDiv).toBeInTheDocument();
    expect(rootDiv!.className).toContain("h-dvh");
  });
});

describe("SessionsPage", () => {
  beforeEach(() => {
    // Reset the walkthrough state before each test
    localStorage.clear();
  });

  test("renders without crashing", () => {
    renderWithRouter(<SessionsPage />);
    // Should render either the walkthrough or the sessions content
    expect(document.body).toBeTruthy();
  });
});

describe("NewSessionPage", () => {
  test("renders mode picker with House Visit and Sale Cataloging options", () => {
    renderWithRouter(<NewSessionPage />);
    expect(screen.getByText(/House Visit/i)).toBeInTheDocument();
    expect(screen.getByText(/Sale Cataloging/i)).toBeInTheDocument();
  });
});
