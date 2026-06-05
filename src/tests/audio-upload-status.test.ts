// Wave-0 RED scaffold (Phase 32 plan 01). References ../hooks/useAudioUploadStatus,
// which plan 04 builds — EXPECTED to fail/not-resolve at this commit.
// Asserts the hook reactively returns pending/uploading/uploaded/failed/none for a
// given dexieAudioId, mirroring usePhotoUploadStatus.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const { mockFirst, mockWhere } = vi.hoisted(() => {
  const mockFirst = vi.fn();
  const mockEquals = vi.fn(() => ({ first: mockFirst }));
  const mockWhere = vi.fn(() => ({ equals: mockEquals }));
  return { mockFirst, mockWhere };
});

vi.mock("../db", () => ({
  db: {
    audioUploadQueue: { where: mockWhere },
  },
}));

// useLiveQuery invokes its querier and surfaces the resolved value. Invoke the
// querier (not mockFirst's prior result) so the test exercises the real reactive
// path — the query MUST run inside the callback for Dexie to track it.
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: (querier: () => unknown) => querier(),
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
