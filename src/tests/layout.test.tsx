import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { describe, test, expect, beforeEach, vi } from "vitest";
import { AppLayout } from "../layouts/AppLayout";
import { SessionsPage } from "../pages/Sessions";
import { NewSessionPage } from "../pages/NewSession";

vi.mock("../lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: null, error: null })), order: vi.fn(() => Promise.resolve({ data: [], error: null })) })), order: vi.fn(() => Promise.resolve({ data: [], error: null })) })),
      // offlineQueue.drainQueue runs on layout mount: stale-reclaim (.update().eq().lt()) + DB-atomic claim (.update().eq().eq().select())
      update: vi.fn(() => ({ eq: vi.fn(() => ({ lt: vi.fn(() => Promise.resolve({ data: [], error: null })), eq: vi.fn(() => ({ select: vi.fn(() => Promise.resolve({ data: [], error: null })) })) })) })),
    })),
    auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: { id: "test-id" } }, error: null })), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) },
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
    removeChannel: vi.fn(),
  },
}));

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

  test("each NavLink uses .tpc-tab which guarantees 48px tap targets via tokens", () => {
    // Phase 26 reskin: the inline Tailwind `min-h-12 min-w-12` classes were
    // replaced by the `.tpc-tab` rule in src/ui/tokens/base.css which sets
    // `min-height: 48px; min-width: 48px;` directly. We verify the class is
    // applied; the 48px guarantee lives in the CSS rule.
    renderAppLayout();
    const nav = document.querySelector("nav");
    const links = nav!.querySelectorAll("a");
    links.forEach((link) => {
      expect(link.className).toContain("tpc-tab");
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
