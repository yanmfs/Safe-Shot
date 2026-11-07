import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";
import type { Box, Detection } from "../core/detect";
import type { Rgba } from "../core/redact";

// zxing-wasm loads its binary from a CDN unless told otherwise. The app ships its own copy.
export function loadBundledWasm(url = "ocr/zxing_reader.wasm"): Promise<unknown> {
  return prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? url : prefix + path),
    },
    fireImmediately: true,
  });
}

const FORMATS = [
  "QRCode",
  "MicroQRCode",
  "Aztec",
  "DataMatrix",
  "PDF417",
  "Code128",
  "Code39",
  "EANUPC",
  "ITF",
] as const;

// A little margin so the bar also covers the code's edge modules.
const PAD = 0.04;

// Finds QR codes and barcodes and returns where they are. Their content is never read out of here.
export async function findCodes(image: Rgba): Promise<Box[]> {
  const input = {
    data: image.data,
    width: image.width,
    height: image.height,
    colorSpace: "srgb",
  } as ImageData;
  const found = await readBarcodes(input, {
    formats: [...FORMATS],
    tryHarder: true,
    maxNumberOfSymbols: 12,
  });
  return found.map(({ position: p }) => {
    const xs = [p.topLeft.x, p.topRight.x, p.bottomRight.x, p.bottomLeft.x];
    const ys = [p.topLeft.y, p.topRight.y, p.bottomRight.y, p.bottomLeft.y];
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    const right = Math.max(...xs);
    const bottom = Math.max(...ys);
    const px = Math.max(3, (right - left) * PAD);
    const py = Math.max(3, (bottom - top) * PAD);
    const x = Math.max(0, left - px);
    const y = Math.max(0, top - py);
    return {
      x,
      y,
      w: Math.min(image.width, right + px) - x,
      h: Math.min(image.height, bottom + py) - y,
    };
  });
}

export function codeDetections(boxes: Box[], label: string): Detection[] {
  return boxes.map((box, i) => ({
    id: `qr:${i}`,
    category: "qr" as const,
    confidence: "high" as const,
    text: "",
    boxes: [box],
    preview: label,
  }));
}
