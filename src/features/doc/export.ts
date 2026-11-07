import {
  alignRects,
  endsAtEoi,
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

const JPEG_QUALITY = 0.92;
// Per channel; the bars are neutral and block aligned, so only rounding is left.
const JPEG_TOLERANCE = 12;

async function encodeJpeg(image: Rgba): Promise<Uint8Array> {
  const canvas = new OffscreenCanvas(image.width, image.height);
  canvas
    .getContext("2d")
    ?.putImageData(
      new ImageData(new Uint8ClampedArray(image.data), image.width, image.height),
      0,
      0,
    );
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: JPEG_QUALITY });
  return new Uint8Array(await blob.arrayBuffer());
}

async function decodeImage(bytes: Uint8Array, type: string): Promise<Rgba> {
  const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type }));
  try {
    return bitmapToRgba(bitmap);
  } finally {
    bitmap.close();
  }
}

// Lossy, so the bars are grown to whole blocks first and the check allows a small tolerance.
export async function exportRedactedJpeg(
  source: ImageBitmap,
  rects: Rect[],
  color: BarColor,
): Promise<Uint8Array> {
  const image = bitmapToRgba(source);
  const aligned = alignRects(rects, image.width, image.height);
  paintBars(image, aligned, color);
  const jpeg = await encodeJpeg(image);

  if (!endsAtEoi(jpeg)) throw new VerificationError("trailing data after the JPEG end marker");
  const check = verifyBars(await decodeImage(jpeg, "image/jpeg"), rects, color, JPEG_TOLERANCE);
  if (!check.ok)
    throw new VerificationError(`${check.badPixels} pixels under the bars were not covered`);
  return jpeg;
}

export function exportName(original: string, format: "png" | "jpeg" = "png"): string {
  const base = original.replace(/\.[^.]+$/, "") || "image";
  return `${base}-safeshot.${format === "jpeg" ? "jpg" : "png"}`;
}
