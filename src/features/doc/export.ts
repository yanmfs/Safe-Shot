import {
  alignRects,
  BAR_RGB,
  endsAtEoi,
  endsAtIend,
  paintBars,
  verifyBars,
  verifySmooth,
  verifyTwoColours,
  type BarColor,
  type Mark,
  type RedactStyle,
  type Rgba,
} from "../../core/redact";
import { bitmapToRgba } from "./image";
import { inkFor, renderMarks } from "./render";

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

export interface ExportOptions {
  style: RedactStyle;
  color: BarColor;
  // Called for the smudge style with the finished picture. It returns the indexes of marks whose data
  // can still be read; those are covered with solid bars before the file is written.
  recheck?: (image: Rgba, marks: Mark[]) => Promise<number[]>;
}

export interface Exported {
  bytes: Uint8Array;
  // Marks that could still be read after smudging and were turned into solid bars.
  hardened: number;
}

// Smudged marks that a second reading can still make out become solid bars, so a smudge never
// ships a leak. Returns how many had to change.
async function harden(image: Rgba, marks: Mark[], options: ExportOptions): Promise<number> {
  if (options.style !== "smudge" || !options.recheck) return 0;
  const leaking = await options.recheck(image, marks);
  paintBars(
    image,
    leaking.flatMap((i) => (marks[i] ? [marks[i].rect] : [])),
    options.color,
  );
  return leaking.length;
}

function verify(decoded: Rgba, marks: Mark[], options: ExportOptions, tolerance: number) {
  const rects = marks.map((m) => m.rect);
  if (options.style === "smudge") return verifySmooth(decoded, rects, tolerance > 0 ? 120 : 95);
  if (options.style === "label") {
    return verifyTwoColours(
      decoded,
      rects,
      BAR_RGB[options.color],
      inkFor(options.color),
      tolerance,
    );
  }
  return verifyBars(decoded, rects, options.color, tolerance);
}

// The exported file is decoded again and checked before anyone gets it: what is under each mark must
// be what the style promises, and nothing may trail the end of the file.
export async function exportRedacted(
  source: ImageBitmap,
  marks: Mark[],
  options: ExportOptions,
): Promise<Exported> {
  const image = bitmapToRgba(source);
  renderMarks(image, marks, options.style, options.color);
  const hardened = await harden(image, marks, options);
  const png = await encodePng(image);

  if (!endsAtIend(png)) throw new VerificationError("trailing data after IEND");
  const check = verify(await decodePng(png), marks, options, 0);
  if (!check.ok) {
    throw new VerificationError(`${check.badPixels} pixels under the marks were not as promised`);
  }
  return { bytes: png, hardened };
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

// Lossy, so solid bars are grown to whole blocks first and the check allows a small tolerance.
// Smudges are already smooth, so JPEG only needs the tolerance.
export async function exportRedactedJpeg(
  source: ImageBitmap,
  marks: Mark[],
  options: ExportOptions,
): Promise<Exported> {
  const image = bitmapToRgba(source);
  const grown =
    options.style === "smudge"
      ? marks
      : alignRects(
          marks.map((m) => m.rect),
          image.width,
          image.height,
        ).map((rect, i) => ({ rect, label: marks[i]?.label }));
  renderMarks(image, grown, options.style, options.color);
  const hardened = await harden(image, grown, options);
  const jpeg = await encodeJpeg(image);

  if (!endsAtEoi(jpeg)) throw new VerificationError("trailing data after the JPEG end marker");
  const decoded = await decodeImage(jpeg, "image/jpeg");
  const check = verify(decoded, marks, options, JPEG_TOLERANCE);
  if (!check.ok) {
    throw new VerificationError(`${check.badPixels} pixels under the marks were not as promised`);
  }
  return { bytes: jpeg, hardened };
}

export function exportName(original: string, format: "png" | "jpeg" = "png"): string {
  const base = original.replace(/\.[^.]+$/, "") || "image";
  return `${base}-safeshot.${format === "jpeg" ? "jpg" : "png"}`;
}
