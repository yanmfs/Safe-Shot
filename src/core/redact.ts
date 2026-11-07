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

// JPEG codes 16x16 blocks. Growing each bar to whole blocks keeps the blocks under it solid, so
// compression cannot smear the original into the covered area.
export function alignRects(rects: Rect[], width: number, height: number, block = 16): Rect[] {
  return rects.flatMap((rect) => {
    const px = toPixelRect(rect, width, height);
    if (!px) return [];
    const x0 = Math.floor(px.x / block) * block;
    const y0 = Math.floor(px.y / block) * block;
    const x1 = Math.min(width, Math.ceil((px.x + px.w) / block) * block);
    const y1 = Math.min(height, Math.ceil((px.y + px.h) / block) * block);
    return [{ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }];
  });
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

// A JPEG ends with the EOI marker; anything after it could be a leftover of the uncropped file.
export function endsAtEoi(jpeg: Uint8Array): boolean {
  return (
    jpeg.length > 4 &&
    jpeg[0] === 0xff &&
    jpeg[1] === 0xd8 &&
    jpeg[jpeg.length - 2] === 0xff &&
    jpeg[jpeg.length - 1] === 0xd9
  );
}

// ---- styles -----------------------------------------------------------------------------------

export type RedactStyle = "solid" | "label" | "smudge";

// A region to hide. `label` is what a labelled bar says (the kind of data underneath).
export interface Mark {
  rect: Rect;
  label?: string;
}

type Rgb = readonly [number, number, number];

const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function median(values: number[]): number {
  if (values.length === 0) return 255;
  const sorted = [...values].sort((x, y) => x - y);
  return sorted[Math.floor(sorted.length / 2)] ?? 255;
}

// The colour of the page around a region: the median of a thin ring just outside it.
export function surroundings(image: Rgba, area: Rect): Rgb {
  const channels: number[][] = [[], [], []];
  const x0 = area.x - 2;
  const y0 = area.y - 2;
  const x1 = area.x + area.w + 1;
  const y1 = area.y + area.h + 1;
  const take = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
    const i = (y * image.width + x) * 4;
    for (let c = 0; c < 3; c++) channels[c]!.push(image.data[i + c] ?? 0);
  };
  for (let x = x0; x <= x1; x++) {
    take(x, y0);
    take(x, y1);
  }
  for (let y = y0 + 1; y < y1; y++) {
    take(x0, y);
    take(x1, y);
  }
  return [median(channels[0]!), median(channels[1]!), median(channels[2]!)];
}

// Separable box blur, three passes, which is close enough to a gaussian and cheap.
function blur(data: Float32Array, width: number, height: number, radius: number) {
  const tmp = new Float32Array(data.length);
  const pass = (src: Float32Array, dst: Float32Array, horizontal: boolean) => {
    const length = horizontal ? width : height;
    const lines = horizontal ? height : width;
    for (let line = 0; line < lines; line++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        const at = (k: number) => {
          const p = clamp(k, 0, length - 1);
          const idx = horizontal ? (line * width + p) * 4 : (p * width + line) * 4;
          return src[idx + c] ?? 0;
        };
        for (let k = -radius; k <= radius; k++) sum += at(k);
        for (let k = 0; k < length; k++) {
          const idx = horizontal ? (line * width + k) * 4 : (k * width + line) * 4;
          dst[idx + c] = sum / (2 * radius + 1);
          sum += at(k + radius + 1) - at(k - radius);
        }
      }
    }
  };
  for (let i = 0; i < 3; i++) {
    pass(data, tmp, true);
    pass(tmp, data, false);
  }
}

// How much of the tint a tile gets, from how far its tone is from the page. Only four levels
// survive, so what is left is "something was here", never the shape of letters.
const LEVELS = [0.06, 0.18, 0.3, 0.42] as const;

function level(distance: number): number {
  if (distance < 0.04) return LEVELS[0];
  if (distance < 0.15) return LEVELS[1];
  if (distance < 0.3) return LEVELS[2];
  return LEVELS[3];
}

/**
 * Replaces a region with a soft smudge: one flat tile per character width, four tones, then blurred
 * and faded into the page. The fade happens in a margin outside the region, so every pixel inside it
 * is fully replaced and nothing of the original can show at the edge.
 */
export function smudgeRect(image: Rgba, rect: Rect, tint: Rgb): void {
  const px = toPixelRect(rect, image.width, image.height);
  if (!px) return;
  const margin = Math.round(Math.max(3, px.h * 0.25));
  const x0 = Math.max(0, px.x - margin);
  const y0 = Math.max(0, px.y - margin);
  const x1 = Math.min(image.width, px.x + px.w + margin);
  const y1 = Math.min(image.height, px.y + px.h + margin);
  const w = x1 - x0;
  const h = y1 - y0;
  const bg = surroundings(image, { x: x0, y: y0, w, h });
  const bgLuma = luma(...bg);

  const tileW = Math.max(6, Math.round(px.h * 0.9));
  const tileH = h <= tileW * 2.5 ? h : tileW;
  const paint = new Float32Array(w * h * 4);
  for (let ty = 0; ty < h; ty += tileH) {
    for (let tx = 0; tx < w; tx += tileW) {
      let sum = 0;
      let count = 0;
      for (let y = ty; y < Math.min(h, ty + tileH); y++) {
        for (let x = tx; x < Math.min(w, tx + tileW); x++) {
          const i = ((y0 + y) * image.width + x0 + x) * 4;
          sum += luma(image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0);
          count++;
        }
      }
      const distance = Math.abs(sum / Math.max(1, count) - bgLuma) / 255;
      const k = level(distance);
      for (let y = ty; y < Math.min(h, ty + tileH); y++) {
        for (let x = tx; x < Math.min(w, tx + tileW); x++) {
          const i = (y * w + x) * 4;
          for (let c = 0; c < 3; c++) paint[i + c] = mix(bg[c]!, tint[c]!, k);
        }
      }
    }
  }
  blur(paint, w, h, Math.max(2, Math.round(Math.min(tileW, h) * 0.35)));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // 0 at the outer edge, 1 from one margin inwards, which is exactly where the region starts.
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
      const t = clamp(edge / margin, 0, 1);
      const mask = t * t * (3 - 2 * t);
      const i = ((y0 + y) * image.width + x0 + x) * 4;
      const p = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        image.data[i + c] = Math.round(mix(image.data[i + c] ?? 0, paint[p + c] ?? 0, mask));
      }
    }
  }
}

export function paintStyled(image: Rgba, marks: Mark[], style: RedactStyle, color: BarColor): void {
  const rects = marks.map((m) => m.rect);
  if (style === "smudge") {
    for (const rect of rects) smudgeRect(image, rect, BAR_RGB[color]);
  } else {
    paintBars(image, rects, color);
  }
}

// Text that was left intact has hard edges. A smudge never has a jump this big across a few pixels.
export function verifySmooth(image: Rgba, rects: Rect[], maxStep = 95): Verification {
  let bad = 0;
  for (const rect of rects) {
    const px = toPixelRect(rect, image.width, image.height);
    if (!px) continue;
    for (let y = px.y; y < px.y + px.h; y++) {
      for (let x = px.x; x < px.x + px.w - 2; x++) {
        const a = (y * image.width + x) * 4;
        const b = a + 8;
        const step = Math.max(
          Math.abs((image.data[a] ?? 0) - (image.data[b] ?? 0)),
          Math.abs((image.data[a + 1] ?? 0) - (image.data[b + 1] ?? 0)),
          Math.abs((image.data[a + 2] ?? 0) - (image.data[b + 2] ?? 0)),
        );
        if (step > maxStep) bad++;
      }
    }
  }
  return { ok: bad === 0, badPixels: bad };
}

// A labelled bar holds two colours only: the bar and the lettering on it.
export function verifyTwoColours(
  image: Rgba,
  rects: Rect[],
  bar: Rgb,
  ink: Rgb,
  tolerance = 0,
): Verification {
  let bad = 0;
  for (const rect of rects) {
    const px = toPixelRect(rect, image.width, image.height);
    if (!px) continue;
    for (let y = px.y; y < px.y + px.h; y++) {
      for (let x = px.x; x < px.x + px.w; x++) {
        const i = (y * image.width + x) * 4;
        const near = (target: Rgb) =>
          [0, 1, 2].every((c) => Math.abs((image.data[i + c] ?? 0) - target[c]!) <= tolerance);
        // Anti-aliased lettering is a blend of the two colours: the pixel sits on the line between them.
        const between = (() => {
          const axis = [0, 1, 2].reduce((best, c) =>
            Math.abs(ink[c]! - bar[c]!) > Math.abs(ink[best]! - bar[best]!) ? c : best,
          );
          const span = ink[axis]! - bar[axis]!;
          if (span === 0) return false;
          const t = ((image.data[i + axis] ?? 0) - bar[axis]!) / span;
          return (
            t >= -0.02 &&
            t <= 1.02 &&
            [0, 1, 2].every(
              (c) => Math.abs((image.data[i + c] ?? 0) - mix(bar[c]!, ink[c]!, t)) <= tolerance + 2,
            )
          );
        })();
        if (!near(bar) && !near(ink) && !between) bad++;
      }
    }
  }
  return { ok: bad === 0, badPixels: bad };
}
