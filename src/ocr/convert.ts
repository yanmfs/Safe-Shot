import type { OcrLine, OcrPage } from "../core/detect";

interface TessBbox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface TessBlock {
  paragraphs: {
    lines: { text: string; bbox: TessBbox; words: { text: string; bbox: TessBbox }[] }[];
  }[];
}

const toBox = ({ x0, y0, x1, y1 }: TessBbox) => ({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });

export function pageFromBlocks(blocks: TessBlock[] | null, width: number, height: number): OcrPage {
  const lines: OcrLine[] = [];
  for (const block of blocks ?? []) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        const words = line.words
          .filter((w) => w.text.trim() !== "")
          .map((w) => ({ text: w.text.trim(), box: toBox(w.bbox) }));
        if (words.length > 0) lines.push({ words, box: toBox(line.bbox) });
      }
    }
  }
  return { width, height, lines };
}
