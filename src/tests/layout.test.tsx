import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { describe, test, expect, beforeEach } from "vitest";
import { AppLayout } from "../layouts/AppLayout";
import { SessionsPage } from "../pages/Sessions";
import { NewSessionPage } from "../pages/NewSession";

// Render AppLayout with nested routes (as it expects an Outlet)
function renderAppLayout(route = "/") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<div>sessions-stub</div>} />
          <Route path="new" element={<div>new-stub</div>} />
          <Route path="settings" element={<div>settings-stub</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function renderWithRouter(ui: React.ReactElement, { route = "/" } = {}) {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
}

describe("AppLayout", () => {
  test("renders a nav element with 3 NavLink children", () => {
    renderAppLayout();
    const nav = document.querySelector("nav");
    expect(nav).toBeInTheDocument();
    const links = nav!.querySelectorAll("a");
    expect(links).toHaveLength(3);
  });

  test("each NavLink has min-h-12 and min-w-12 classes for 48px tap targets", () => {
    renderAppLayout();
    const nav = document.querySelector("nav");
    const links = nav!.querySelectorAll("a");
    links.forEach((link) => {
      expect(link.className).toContain("min-h-12");
      expect(link.className).toContain("min-w-12");
    });
  });

  test("tab bar nav has pb-[env(safe-area-inset-bottom)] for notched devices", () => {
    renderAppLayout();
    const nav = document.querySelector("nav");
    expect(nav!.className).toContain("pb-[env(safe-area-inset-bottom)]");
  });

  test("root container uses h-dvh class", () => {
    renderAppLayout();
    const rootDiv = document.querySelector("[data-testid='app-layout']");
    expect(rootDiv).toBeInTheDocument();
    expect(rootDiv!.className).toContain("h-dvh");
  });
});

describe("SessionsPage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("renders without crashing", () => {
    renderWithRouter(<SessionsPage />);
    expect(document.body).toBeTruthy();
  });
});

describe("NewSessionPage", () => {
  test("renders mode picker with House Visit and Sale Cataloging options", () => {
    renderWithRouter(<NewSessionPage />);
    expect(screen.getByText("House Visit")).toBeInTheDocument();
    expect(screen.getByText("Sale Cataloging")).toBeInTheDocument();
  });
});
