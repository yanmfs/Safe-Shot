import type { Rgba } from "../core/redact";
import { platform } from "../platform";
import { useApp } from "../store";
import { createNativeEngine } from "./native";
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

async function encodePng(image: Rgba): Promise<Uint8Array> {
  const canvas = encode(image);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("could not encode the image");
  return new Uint8Array(await blob.arrayBuffer());
}

// One worker for the whole session: loading the language data is the slow part.
function tesseract(): OcrEngine {
  tesseractEngine ??= createTesseractEngine({
    paths: { workerPath: "ocr/worker.min.js", corePath: "ocr/core", langPath: "ocr/lang" },
    encode,
  });
  return tesseractEngine;
}

let tesseractEngine: OcrEngine | undefined;

// The reader built into the system is faster and needs no language files. If it fails for any
// reason the page is read again by Tesseract, so a broken system reader never blocks the app.
export function getOcrEngine(): OcrEngine {
  engine ??= {
    async recognize(image, onProgress) {
      const { nativeOcr } = platform;
      if (nativeOcr && useApp.getState().settings.ocrEngine === "auto") {
        try {
          return await createNativeEngine({ encode: encodePng, read: nativeOcr }).recognize(
            image,
            onProgress,
          );
        } catch {
          // Falls through to Tesseract.
        }
      }
      return tesseract().recognize(image, onProgress);
    },
    async terminate() {
      await tesseractEngine?.terminate();
    },
  };
  return engine;
}
