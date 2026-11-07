import type { Rgba } from "../core/redact";
import { createTesseractEngine } from "./tesseract";
import type { OcrEngine } from "./types";

let engine: OcrEngine | undefined;

function encode(image: Rgba): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  canvas
    .getContext("2d")
    ?.putImageData(
      new ImageData(new Uint8ClampedArray(image.data), image.width, image.height),
      0,
      0,
    );
  return canvas;
}

// One worker for the whole session: loading the language data is the slow part.
export function getOcrEngine(): OcrEngine {
  engine ??= createTesseractEngine({
    paths: { workerPath: "ocr/worker.min.js", corePath: "ocr/core", langPath: "ocr/lang" },
    encode,
  });
  return engine;
}
