import type { Box, OcrLine, OcrPage, OcrWord } from "../core/detect";
import type { Rgba } from "../core/redact";
import type { OcrEngine } from "./types";

export interface NativeConfig {
  // Turns pixels into PNG bytes; the system reader decodes the file itself.
  encode: (image: Rgba) => Promise<Uint8Array>;
  // Runs the system reader (Vision on macOS, Windows.Media.Ocr on Windows) on a PNG.
  read: (png: Uint8Array) => Promise<OcrPage>;
}

const finite = (box: Box) => [box.x, box.y, box.w, box.h].every(Number.isFinite);

// The system readers are trusted for text, not for geometry: boxes that are not numbers or have no
// area would break the redaction later, so they are dropped here.
export function cleanPage(page: OcrPage): OcrPage {
  const lines: OcrLine[] = [];
  for (const line of page.lines) {
    const words: OcrWord[] = line.words.filter(
      (w) => w.text.trim() !== "" && finite(w.box) && w.box.w > 0 && w.box.h > 0,
    );
    if (words.length > 0 && finite(line.box)) lines.push({ words, box: line.box });
  }
  return { width: page.width, height: page.height, lines };
}

export function createNativeEngine({ encode, read }: NativeConfig): OcrEngine {
  return {
    async recognize(image, onProgress) {
      // There is no fine progress from the system readers; show that work has started.
      onProgress?.(0.5);
      const page = cleanPage(await read(await encode(image)));
      onProgress?.(1);
      return page;
    },
    terminate: () => Promise.resolve(),
  };
}
