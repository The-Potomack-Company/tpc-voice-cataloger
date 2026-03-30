import { describe, it, expect, vi, beforeEach } from "vitest";
import { resizeImage } from "../utils/image";

// Mock createImageBitmap
const mockClose = vi.fn();
function mockCreateImageBitmap(
  _source: Blob, // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<{ width: number; height: number; close: () => void }> {
  return Promise.resolve({ width: 4000, height: 3000, close: mockClose });
}

// Mock OffscreenCanvas
const mockDrawImage = vi.fn();
const mockConvertToBlob = vi.fn().mockResolvedValue(
  new Blob(["fake-jpeg"], { type: "image/jpeg" }),
);

class MockOffscreenCanvas {
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getContext(_type: string) { // eslint-disable-line @typescript-eslint/no-unused-vars
    return { drawImage: mockDrawImage };
  }

  convertToBlob(options?: { type?: string; quality?: number }) {
    return mockConvertToBlob(options);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  // Install mocks
  (globalThis as Record<string, unknown>).createImageBitmap = mockCreateImageBitmap;
  (globalThis as Record<string, unknown>).OffscreenCanvas = MockOffscreenCanvas;
});

describe("resizeImage", () => {
  it("downscales to max dimension preserving aspect ratio", async () => {
    const file = new File(["test"], "photo.jpg", { type: "image/jpeg" });
    const result = await resizeImage(file, 2048);

    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe("image/jpeg");

    // Should have drawn with scaled dimensions: 4000x3000 -> 2048x1536
    expect(mockDrawImage).toHaveBeenCalledWith(
      expect.objectContaining({ width: 4000, height: 3000 }),
      0,
      0,
      2048,
      1536,
    );
  });

  it("works for thumbnail generation at 200px max dimension", async () => {
    const file = new File(["test"], "photo.jpg", { type: "image/jpeg" });
    const result = await resizeImage(file, 200);

    expect(result).toBeInstanceOf(Blob);
    // 4000x3000 -> 200x150
    expect(mockDrawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      0,
      200,
      150,
    );
  });

  it("returns original dimensions if already smaller than maxDimension", async () => {
    // Override mock for small image
    (globalThis as Record<string, unknown>).createImageBitmap = () =>
      Promise.resolve({ width: 800, height: 600, close: mockClose });

    const file = new File(["test"], "photo.jpg", { type: "image/jpeg" });
    await resizeImage(file, 2048);

    // Should use original dimensions
    expect(mockDrawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      0,
      800,
      600,
    );
  });

  it("outputs JPEG blob at 0.85 quality", async () => {
    const file = new File(["test"], "photo.jpg", { type: "image/jpeg" });
    await resizeImage(file, 2048);

    expect(mockConvertToBlob).toHaveBeenCalledWith({
      type: "image/jpeg",
      quality: 0.85,
    });
  });

  it("calls ImageBitmap.close() after drawing", async () => {
    const file = new File(["test"], "photo.jpg", { type: "image/jpeg" });
    await resizeImage(file, 2048);

    expect(mockClose).toHaveBeenCalled();
  });

  it("handles portrait orientation (taller than wide)", async () => {
    (globalThis as Record<string, unknown>).createImageBitmap = () =>
      Promise.resolve({ width: 3000, height: 4000, close: mockClose });

    const file = new File(["test"], "photo.jpg", { type: "image/jpeg" });
    await resizeImage(file, 2048);

    // 3000x4000 -> 1536x2048
    expect(mockDrawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      0,
      1536,
      2048,
    );
  });
});
