import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// CR-01: two synchronous runMigration() calls (a double-clicked splash Retry)
// must produce only ONE migrateToSupabase execution. Without the re-entrancy
// guard both calls would race a null idMapping read and double-insert.

const { mockMigrate, mockNeedsMigration } = vi.hoisted(() => ({
  mockMigrate: vi.fn(),
  mockNeedsMigration: vi.fn(),
}));

vi.mock("../db/migration", () => ({
  migrateToSupabase: mockMigrate,
  needsMigration: mockNeedsMigration,
}));

import { useDataMigration } from "../hooks/useDataMigration";

describe("useDataMigration re-entrancy guard (CR-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Auto-run effect must not fire a migration of its own for this test.
    mockNeedsMigration.mockResolvedValue(false);
  });

  it("two synchronous retry() calls run migrateToSupabase only once", async () => {
    // Gate the in-flight migration so both synchronous calls overlap.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mockMigrate.mockImplementation(async () => {
      await gate;
      return { migrated: 1, alreadyMigrated: 0, failed: 0, partial: false };
    });

    const { result } = renderHook(() => useDataMigration("user-123"));

    // Wait for the not-needed auto-check to settle so the only runs are ours.
    await waitFor(() => expect(result.current.state).toBe("not-needed"));

    // Fire twice in the SAME tick — simulates a double click before re-render.
    act(() => {
      result.current.retry();
      result.current.retry();
    });

    // Only ONE migration should have started despite two calls.
    expect(mockMigrate).toHaveBeenCalledTimes(1);

    await act(async () => {
      release();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.state).toBe("complete"));
    expect(mockMigrate).toHaveBeenCalledTimes(1);
  });

  it("a fresh retry() after the first completes is allowed (guard resets)", async () => {
    mockMigrate.mockResolvedValue({
      migrated: 1,
      alreadyMigrated: 0,
      failed: 0,
      partial: false,
    });

    const { result } = renderHook(() => useDataMigration("user-123"));
    await waitFor(() => expect(result.current.state).toBe("not-needed"));

    await act(async () => {
      await result.current.retry();
    });
    expect(mockMigrate).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.retry();
    });
    expect(mockMigrate).toHaveBeenCalledTimes(2);
  });
});
