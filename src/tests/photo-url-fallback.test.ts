import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// --- Mocks ---
const { mockCreateSignedUrl } = vi.hoisted(() => {
  const mockCreateSignedUrl = vi.fn();
  return { mockCreateSignedUrl };
});

vi.mock("../lib/supabase", () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: mockCreateSignedUrl,
      })),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateSignedUrl.mockReset();
  // Default: resolve with no data (prevents .then crash on unexpected calls)
  mockCreateSignedUrl.mockResolvedValue({ data: null });
});

describe("usePhotoUrl", () => {
  it("returns blob URL when local blob is available", async () => {
    const { usePhotoUrl } = await import("../hooks/usePhotoUrl");

    const blob = new Blob(["photo"], { type: "image/jpeg" });
    const { result } = renderHook(() =>
      usePhotoUrl(blob, "photos/sess/item/full-0.jpg"),
    );

    // useBlobUrl creates an object URL from the blob
    await waitFor(() => {
      expect(result.current).toBeDefined();
      expect(result.current).toMatch(/^blob:/);
    });

    // Should never have called createSignedUrl since local blob was available
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });

  it("fetches signed URL when no local blob and storagePath provided", async () => {
    const { usePhotoUrl } = await import("../hooks/usePhotoUrl");

    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://storage.example.com/signed/photo.jpg" },
    });

    const { result } = renderHook(() =>
      usePhotoUrl(undefined, "photos/sess/item/full-0.jpg"),
    );

    await waitFor(() => {
      expect(result.current).toBe(
        "https://storage.example.com/signed/photo.jpg",
      );
    });

    expect(mockCreateSignedUrl).toHaveBeenCalledWith(
      "photos/sess/item/full-0.jpg",
      3600,
    );
  });

  it("returns undefined when neither blob nor storagePath available", async () => {
    const { usePhotoUrl } = await import("../hooks/usePhotoUrl");

    const { result } = renderHook(() => usePhotoUrl(undefined, undefined));

    // Should remain undefined
    expect(result.current).toBeUndefined();
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });

  it("prefers blob URL over signed URL when both available", async () => {
    const { usePhotoUrl } = await import("../hooks/usePhotoUrl");

    const blob = new Blob(["photo"], { type: "image/jpeg" });

    const { result } = renderHook(() =>
      usePhotoUrl(blob, "photos/sess/item/full-0.jpg"),
    );

    await waitFor(() => {
      expect(result.current).toBeDefined();
      expect(result.current).toMatch(/^blob:/);
    });

    // createSignedUrl should never be called when blob is available
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });
});
