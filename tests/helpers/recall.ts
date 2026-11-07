import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import type { Category, Detection } from "../../src/core/detect";
import type { Rgba } from "../../src/core/redact";
import { createTesseractEngine } from "../../src/ocr/tesseract";
import type { OcrEngine } from "../../src/ocr/types";
import { copyOcrAssets } from "../../scripts/copy-ocr-assets.mjs";

export const shots = join(__dirname, "..", "fixtures", "shots");

export interface Expected {
  category: Category;
  text: string;
}

export const key = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

export function similarity(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...Array<number>(b.length).fill(0),
  ]);
  for (let j = 1; j <= b.length; j++) rows[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i]![j] = Math.min(
        rows[i - 1]![j]! + 1,
        rows[i]![j - 1]! + 1,
        rows[i - 1]![j - 1]! + cost,
      );
    }
  }
  return 1 - rows[a.length]![b.length]! / Math.max(a.length, b.length, 1);
}

// Tesseract sometimes swaps 0/O in long tokens; a near match still means the right text was boxed.
export const hit = (d: Detection, e: Expected) =>
  d.category === e.category &&
  (key(d.text).includes(key(e.text)) ||
    key(e.text).includes(key(d.text)) ||
    similarity(key(d.text), key(e.text)) >= 0.9);

export function load(name: string): Rgba {
  const png = PNG.sync.read(readFileSync(join(shots, `${name}.png`)));
  return { data: new Uint8ClampedArray(png.data), width: png.width, height: png.height };
}

export function nodeEngine(): OcrEngine {
  const target = copyOcrAssets();
  return createTesseractEngine({
    paths: { langPath: join(target, "lang") },
    encode: (image) => {
      const png = new PNG({ width: image.width, height: image.height });
      png.data = Buffer.from(image.data);
      return PNG.sync.write(png);
    },
  });
}

export type { Detection };
