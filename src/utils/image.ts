/**
 * Resizes an image file to fit within maxDimension on its longest side,
 * preserving aspect ratio. Outputs a JPEG blob at 0.85 quality.
 *
 * Uses createImageBitmap (handles EXIF orientation automatically) and
 * OffscreenCanvas when available, with fallback to regular <canvas>.
 */
export async function resizeImage(
  file: File,
  maxDimension: number,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  // Calculate new dimensions preserving aspect ratio (only downscale)
  let newWidth = width;
  let newHeight = height;

  if (width > maxDimension || height > maxDimension) {
    if (width >= height) {
      // Landscape or square
      newWidth = maxDimension;
      newHeight = Math.round((height / width) * maxDimension);
    } else {
      // Portrait
      newHeight = maxDimension;
      newWidth = Math.round((width / height) * maxDimension);
    }
  }

  let blob: Blob;

  if (typeof OffscreenCanvas !== "undefined") {
    // Preferred path: OffscreenCanvas (no DOM needed)
    const canvas = new OffscreenCanvas(newWidth, newHeight);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);
    blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 });
  } else {
    // Fallback: regular canvas element
    const canvas = document.createElement("canvas");
    canvas.width = newWidth;
    canvas.height = newHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap as unknown as CanvasImageSource, 0, 0, newWidth, newHeight);
    blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
        "image/jpeg",
        0.85,
      );
    });
  }

  bitmap.close();
  return blob;
}
