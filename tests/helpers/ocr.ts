import type { OcrLine, OcrPage } from "../../src/core/detect";

const CHAR_W = 10;
const LINE_H = 20;

// Lays text out in a monospace grid so box maths is easy to check by hand.
export function pageFromLines(lines: string[]): OcrPage {
  const ocrLines: OcrLine[] = lines.map((text, row) => {
    const y = row * (LINE_H + 10);
    const words = [...text.matchAll(/\S+/g)].map((m) => ({
      text: m[0],
      box: { x: m.index * CHAR_W, y, w: m[0].length * CHAR_W, h: LINE_H },
    }));
    return { words, box: { x: 0, y, w: text.length * CHAR_W, h: LINE_H } };
  });
  return { width: 2000, height: lines.length * (LINE_H + 10), lines: ocrLines };
}
