import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

// SC3 / T-38-04: the banner reads the SINGLE shared hook instance via
// useOutletContext — it must NEVER call useDataMigration/useLiveQuery (a second
// instance would spawn a parallel migration). These tests mock useOutletContext
// directly so the banner is exercised in isolation from the router.

const { mockUseOutletContext } = vi.hoisted(() => ({
  mockUseOutletContext: vi.fn(),
}));

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useOutletContext: mockUseOutletContext };
});

import { MigrationRetryBanner } from "../components/MigrationRetryBanner";

type Ctx = ReturnType<typeof import("../hooks/useDataMigration").useDataMigration>;

function ctx(partial: Partial<Ctx>): Ctx {
  return {
    state: "partial",
    current: 0,
    total: 0,
    migrated: 0,
    alreadyMigrated: 0,
    failed: 2,
    retry: vi.fn(),
    ...partial,
  } as Ctx;
}

describe("MigrationRetryBanner (SC3, D-07)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders 'N items not yet synced' + a Retry sync button when partial with failed > 0", () => {
    mockUseOutletContext.mockReturnValue(ctx({ state: "partial", failed: 2 }));
    render(<MigrationRetryBanner />);
    expect(screen.getByText("2 items not yet synced")).toBeTruthy();
    expect(
      screen.getByText("Your data is safe — retry to finish syncing."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /retry sync/i })).toBeTruthy();
  });

  it("singularizes for failed === 1", () => {
    mockUseOutletContext.mockReturnValue(ctx({ state: "partial", failed: 1 }));
    render(<MigrationRetryBanner />);
    expect(screen.getByText("1 item not yet synced")).toBeTruthy();
  });

  it("renders null when failed === 0", () => {
    mockUseOutletContext.mockReturnValue(ctx({ state: "partial", failed: 0 }));
    const { container } = render(<MigrationRetryBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders null when state is not 'partial'", () => {
    mockUseOutletContext.mockReturnValue(ctx({ state: "complete", failed: 2 }));
    const { container } = render(<MigrationRetryBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("clicking Retry sync invokes the context retry", () => {
    const retry = vi.fn();
    mockUseOutletContext.mockReturnValue(ctx({ state: "partial", failed: 2, retry }));
    render(<MigrationRetryBanner />);
    fireEvent.click(screen.getByRole("button", { name: /retry sync/i }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("dismiss hides the banner for the session", () => {
    mockUseOutletContext.mockReturnValue(ctx({ state: "partial", failed: 2 }));
    render(<MigrationRetryBanner />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByText("2 items not yet synced")).toBeNull();
  });
});
