import type { Box, OcrPage } from "./detect";
import type { Rgba } from "./redact";

const luminance = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

export function meanLuminance(image: Rgba): number {
  let sum = 0;
  const pixels = image.width * image.height;
  for (let i = 0; i < pixels; i++) {
    const o = i * 4;
    sum += luminance(image.data[o] ?? 0, image.data[o + 1] ?? 0, image.data[o + 2] ?? 0);
  }
  return pixels === 0 ? 1 : sum / pixels;
}

export interface Prepared {
  image: Rgba;
  scale: number;
}

// Tesseract does best on dark text over a light background at around 300 dpi.
export function prepareForOcr(source: Rgba): Prepared {
  const scale = source.width < 1500 ? 2 : 1;
  const invert = meanLuminance(source) < 0.4;
  const width = source.width * scale;
  const height = source.height * scale;
  const data = new Uint8ClampedArray(width * height * 4);

  const gray = (x: number, y: number) => {
    const o = (y * source.width + x) * 4;
    const value =
      luminance(source.data[o] ?? 0, source.data[o + 1] ?? 0, source.data[o + 2] ?? 0) * 255;
    return invert ? 255 - value : value;
  };

  for (let y = 0; y < height; y++) {
    const sy = Math.min(source.height - 1, y / scale);
    const y0 = Math.floor(sy);
    const y1 = Math.min(source.height - 1, y0 + 1);
    const fy = sy - y0;
    for (let x = 0; x < width; x++) {
      const sx = Math.min(source.width - 1, x / scale);
      const x0 = Math.floor(sx);
      const x1 = Math.min(source.width - 1, x0 + 1);
      const fx = sx - x0;
      const top = gray(x0, y0) * (1 - fx) + gray(x1, y0) * fx;
      const bottom = gray(x0, y1) * (1 - fx) + gray(x1, y1) * fx;
      const value = top * (1 - fy) + bottom * fy;
      const o = (y * width + x) * 4;
      data[o] = value;
      data[o + 1] = value;
      data[o + 2] = value;
      data[o + 3] = 255;
    }
  }
  return { image: { data, width, height }, scale };
}

const scaleBox = (box: Box, factor: number): Box => ({
  x: box.x * factor,
  y: box.y * factor,
  w: box.w * factor,
  h: box.h * factor,
});

export function toOriginalCoordinates(page: OcrPage, scale: number): OcrPage {
  if (scale === 1) return page;
  const factor = 1 / scale;
  return {
    width: page.width * factor,
    height: page.height * factor,
    lines: page.lines.map((line) => ({
      box: scaleBox(line.box, factor),
      words: line.words.map((w) => ({ text: w.text, box: scaleBox(w.box, factor) })),
    })),
  };
}
