import {
  endsAtIend,
  paintBars,
  verifyBars,
  type BarColor,
  type Rect,
  type Rgba,
} from "../../core/redact";
import { bitmapToRgba } from "./image";

export class VerificationError extends Error {}

async function encodePng(image: Rgba): Promise<Uint8Array> {
  const canvas = new OffscreenCanvas(image.width, image.height);
  canvas
    .getContext("2d")
    ?.putImageData(
      new ImageData(new Uint8ClampedArray(image.data), image.width, image.height),
      0,
      0,
    );
  const blob = await canvas.convertToBlob({ type: "image/png" });
  return new Uint8Array(await blob.arrayBuffer());
}

async function decodePng(png: Uint8Array): Promise<Rgba> {
  const bitmap = await createImageBitmap(new Blob([png as BlobPart], { type: "image/png" }));
  try {
    return bitmapToRgba(bitmap);
  } finally {
    bitmap.close();
  }
}

// The exported file is decoded again and checked before anyone gets it: every pixel under a bar
// must be the bar colour, and nothing may trail the IEND chunk.
export async function exportRedacted(
  source: ImageBitmap,
  rects: Rect[],
  color: BarColor,
): Promise<Uint8Array> {
  const image = bitmapToRgba(source);
  paintBars(image, rects, color);
  const png = await encodePng(image);

  if (!endsAtIend(png)) throw new VerificationError("trailing data after IEND");
  const check = verifyBars(await decodePng(png), rects, color);
  if (!check.ok)
    throw new VerificationError(`${check.badPixels} pixels under the bars were not covered`);
  return png;
}

export function exportName(original: string): string {
  const base = original.replace(/\.[^.]+$/, "") || "image";
  return `${base}-safeshot.png`;
}
