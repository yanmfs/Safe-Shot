import { createWorker, PSM, type ImageLike, type Worker } from "tesseract.js";
import { prepareForOcr, toOriginalCoordinates } from "../core/ocr-prep";
import type { Rgba } from "../core/redact";
import { pageFromBlocks } from "./convert";
import type { OcrEngine } from "./types";

export interface TesseractPaths {
  workerPath?: string;
  corePath?: string;
  langPath?: string;
}

export interface TesseractConfig {
  paths: TesseractPaths;
  // Turns prepared pixels into something the worker accepts (a canvas in the browser, a PNG in Node).
  encode: (image: Rgba) => Promise<ImageLike> | ImageLike;
  pageSegMode?: "3" | "11";
}

export function createTesseractEngine({
  paths,
  encode,
  pageSegMode = "11",
}: TesseractConfig): OcrEngine {
  let worker: Promise<Worker> | undefined;
  let report: ((fraction: number) => void) | undefined;

  const start = async () => {
    const w = await createWorker(["por", "eng"], 1, {
      ...paths,
      gzip: true,
      cacheMethod: "none",
      logger: (m) => {
        if (m.status === "recognizing text") report?.(m.progress);
      },
    });
    await w.setParameters({
      tessedit_pageseg_mode: pageSegMode === "3" ? PSM.AUTO : PSM.SPARSE_TEXT,
      preserve_interword_spaces: "1",
      user_defined_dpi: "300",
    });
    return w;
  };

  return {
    async recognize(image, onProgress) {
      worker ??= start();
      const w = await worker;
      report = onProgress;
      const { image: prepared, scale } = prepareForOcr(image);
      const { data } = await w.recognize(await encode(prepared), {}, { blocks: true });
      report = undefined;
      const page = pageFromBlocks(data.blocks, prepared.width, prepared.height);
      return toOriginalCoordinates(page, scale);
    },
    async terminate() {
      if (!worker) return;
      const w = await worker;
      worker = undefined;
      await w.terminate();
    },
  };
}
