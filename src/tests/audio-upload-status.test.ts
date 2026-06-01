// Wave-0 RED scaffold (Phase 32 plan 01). References ../hooks/useAudioUploadStatus,
// which plan 04 builds — EXPECTED to fail/not-resolve at this commit.
// Asserts the hook reactively returns pending/uploading/uploaded/failed/none for a
// given dexieAudioId, mirroring usePhotoUploadStatus.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const { mockFirst, mockEquals, mockWhere } = vi.hoisted(() => {
  const mockFirst = vi.fn();
  const mockEquals = vi.fn(() => ({ first: mockFirst }));
  const mockWhere = vi.fn(() => ({ equals: mockEquals }));
  return { mockFirst, mockEquals, mockWhere };
});

vi.mock("../db", () => ({
  db: {
    audioUploadQueue: { where: mockWhere },
  },
}));

// useLiveQuery runs its querier synchronously and returns the resolved value; mock
// it to surface whatever the querier resolves to so we can assert status mapping.
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: (querier: () => unknown) => {
    // The real hook is async; for the scaffold we capture the entry the querier
    // would resolve to via the mocked chain's synchronous return.
    void querier;
    return mockFirst.mock.results[0]?.value;
  },
}));

describe("useAudioUploadStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 'none' when there is no queue entry", async () => {
    mockFirst.mockReturnValue(undefined);
    const { useAudioUploadStatus } = await import("../hooks/useAudioUploadStatus");
    const { result } = renderHook(() => useAudioUploadStatus(10));
    expect(result.current).toBe("none");
  });

  it("returns 'none' when dexieAudioId is undefined", async () => {
    const { useAudioUploadStatus } = await import("../hooks/useAudioUploadStatus");
    const { result } = renderHook(() => useAudioUploadStatus(undefined));
    expect(result.current).toBe("none");
  });

  it.each(["pending", "uploading", "uploaded", "failed"] as const)(
    "reflects the queue entry status '%s'",
    async (status) => {
      mockFirst.mockReturnValue({ dexieAudioId: 10, status });
      const { useAudioUploadStatus } = await import(
        "../hooks/useAudioUploadStatus"
      );
      const { result } = renderHook(() => useAudioUploadStatus(10));
      expect(result.current).toBe(status);
    }
  );
});
