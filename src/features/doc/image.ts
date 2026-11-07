import type { Rgba } from "../../core/redact";

export async function decodeImage(bytes: Uint8Array): Promise<ImageBitmap> {
  return createImageBitmap(new Blob([bytes as BlobPart]));
}

export function bitmapToRgba(bitmap: ImageBitmap): Rgba {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(bitmap, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  return { data, width, height };
}
