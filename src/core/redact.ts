export interface Rgba {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type BarColor = "black" | "white" | "gray";

export const BAR_RGB: Record<BarColor, readonly [number, number, number]> = {
  black: [0, 0, 0],
  white: [255, 255, 255],
  gray: [128, 128, 128],
};

// Rounds outwards so a bar never leaves a sliver of the original on its edge.
export function toPixelRect(rect: Rect, width: number, height: number): Rect | null {
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(width, Math.ceil(rect.x + rect.w));
  const y1 = Math.min(height, Math.ceil(rect.y + rect.h));
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

export function paintBars(image: Rgba, rects: Rect[], color: BarColor): void {
  const [r, g, b] = BAR_RGB[color];
  for (const rect of rects) {
    const px = toPixelRect(rect, image.width, image.height);
    if (!px) continue;
    for (let y = px.y; y < px.y + px.h; y++) {
      for (let x = px.x; x < px.x + px.w; x++) {
        const i = (y * image.width + x) * 4;
        image.data[i] = r;
        image.data[i + 1] = g;
        image.data[i + 2] = b;
        image.data[i + 3] = 255;
      }
    }
  }
}

export interface Verification {
  ok: boolean;
  badPixels: number;
}

// `tolerance` is per channel; lossy formats move a solid colour by a few levels.
export function verifyBars(
  image: Rgba,
  rects: Rect[],
  color: BarColor,
  tolerance = 0,
): Verification {
  const expected = BAR_RGB[color];
  let badPixels = 0;
  const sums = [0, 0, 0];
  let counted = 0;
  for (const rect of rects) {
    const px = toPixelRect(rect, image.width, image.height);
    if (!px) continue;
    for (let y = px.y; y < px.y + px.h; y++) {
      for (let x = px.x; x < px.x + px.w; x++) {
        const i = (y * image.width + x) * 4;
        counted++;
        let off = false;
        for (let c = 0; c < 3; c++) {
          const value = image.data[i + c] ?? 0;
          sums[c] = (sums[c] ?? 0) + value;
          if (Math.abs(value - expected[c]!) > tolerance) off = true;
        }
        if (off) badPixels++;
      }
    }
  }
  const meanOff =
    counted > 0 &&
    tolerance > 0 &&
    sums.some((s, c) => Math.abs(s / counted - expected[c]!) > tolerance / 2);
  return { ok: badPixels === 0 && !meanOff, badPixels };
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// A PNG that keeps bytes after IEND can hide the uncropped original (the aCropalypse bug).
export function endsAtIend(png: Uint8Array): boolean {
  if (png.length < 20 || PNG_SIGNATURE.some((b, i) => png[i] !== b)) return false;
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let offset = 8;
  while (offset + 12 <= png.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    const next = offset + 12 + length;
    if (next > png.length) return false;
    if (type === "IEND") return next === png.length;
    offset = next;
  }
  return false;
}
