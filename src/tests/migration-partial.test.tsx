import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, render, screen, cleanup } from "@testing-library/react";

// SC3 / D-07: the hook must thread migration.ts's `partial` flag into a distinct
// "partial" state and the splash must render honest partial copy — never the
// full-success string when items were skipped.

const { mockNeedsMigration, mockMigrateToSupabase } = vi.hoisted(() => ({
  mockNeedsMigration: vi.fn(),
  mockMigrateToSupabase: vi.fn(),
}));

vi.mock("../db/migration", () => ({
  needsMigration: mockNeedsMigration,
  migrateToSupabase: mockMigrateToSupabase,
}));

import { useDataMigration } from "../hooks/useDataMigration";
import { MigrationSplash } from "../components/MigrationSplash";

const FULL_SUCCESS = "All sessions are now synced to the server.";
const PARTIAL_COPY = "Some items couldn't be migrated. Your data is safe.";

describe("useDataMigration partial honesty (SC3, D-07)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNeedsMigration.mockResolvedValue(true);
  });
  afterEach(() => cleanup());

  it("drives state to 'partial' when result.partial is true (skipped > 0)", async () => {
    mockMigrateToSupabase.mockResolvedValue({
      migrated: 3,
      skipped: 2,
      partial: true,
    });

    const { result } = renderHook(() => useDataMigration("user-1"));

    await waitFor(() => expect(result.current.state).toBe("partial"));
    expect(result.current.skipped).toBe(2);
    expect(result.current.migrated).toBe(3);
  });

  it("drives state to 'complete' on a clean run (partial false, skipped 0)", async () => {
    mockMigrateToSupabase.mockResolvedValue({
      migrated: 5,
      skipped: 0,
      partial: false,
    });

    const { result } = renderHook(() => useDataMigration("user-1"));

    await waitFor(() => expect(result.current.state).toBe("complete"));
    expect(result.current.skipped).toBe(0);
  });
});

describe("MigrationSplash partial copy (SC3, D-07)", () => {
  afterEach(() => cleanup());

  const noop = () => {};

  it("renders honest partial copy and NOT the full-success string for state='partial'", () => {
    render(
      <MigrationSplash
        state="partial"
        current={3}
        total={5}
        skipped={2}
        onRetry={noop}
        onSkip={noop}
        onComplete={noop}
      />,
    );

    expect(screen.getByText(PARTIAL_COPY)).toBeTruthy();
    expect(screen.queryByText(FULL_SUCCESS)).toBeNull();
  });

  it("renders the success copy for state='complete'", () => {
    render(
      <MigrationSplash
        state="complete"
        current={5}
        total={5}
        skipped={0}
        onRetry={noop}
        onSkip={noop}
        onComplete={noop}
      />,
    );

    expect(screen.getByText(FULL_SUCCESS)).toBeTruthy();
  });
});
