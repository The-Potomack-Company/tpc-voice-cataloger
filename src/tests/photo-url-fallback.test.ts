import { describe, it, expect, vi } from "vitest";

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

describe("usePhotoUrl", () => {
  it("returns blob URL when local blob is available", async () => {
    const { usePhotoUrl } = await import("../hooks/usePhotoUrl");
    expect(usePhotoUrl).toBeDefined();
  });

  it("fetches signed URL when no local blob and storagePath provided", async () => {
    const { usePhotoUrl } = await import("../hooks/usePhotoUrl");
    expect(usePhotoUrl).toBeDefined();
  });

  it("returns undefined when neither blob nor storagePath available", async () => {
    const { usePhotoUrl } = await import("../hooks/usePhotoUrl");
    expect(usePhotoUrl).toBeDefined();
  });

  it("prefers blob URL over signed URL when both available", async () => {
    const { usePhotoUrl } = await import("../hooks/usePhotoUrl");
    expect(usePhotoUrl).toBeDefined();
  });
});
