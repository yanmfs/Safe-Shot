import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { writeBarcode } from "zxing-wasm/writer";
import { codeDetections, findCodes } from "../src/ocr/qr";
import type { Rgba } from "../src/core/redact";

// Puts a generated code on a white screen-sized canvas, as in a real screenshot.
async function screenWith(content: string, at: { x: number; y: number }): Promise<Rgba> {
  const written = await writeBarcode(content, { format: "QRCode", scale: 4 });
  const code = PNG.sync.read(Buffer.from(await written.image!.arrayBuffer()));
  const width = 640;
  const height = 360;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 0; y < code.height; y++) {
    for (let x = 0; x < code.width; x++) {
      const from = (y * code.width + x) * 4;
      const to = ((y + at.y) * width + x + at.x) * 4;
      for (let c = 0; c < 4; c++) data[to + c] = code.data[from + c]!;
    }
  }
  return { data, width, height };
}

describe("findCodes", () => {
  it("locates a QR code and covers all of it", async () => {
    const image = await screenWith("https://exemplo.invalid/pix?x=1", { x: 300, y: 80 });
    const boxes = await findCodes(image);
    expect(boxes).toHaveLength(1);
    const box = boxes[0]!;
    // The generated code spans 100 px from its quiet zone at (316, 96) to (416, 196).
    expect(box.x).toBeLessThanOrEqual(316);
    expect(box.y).toBeLessThanOrEqual(96);
    expect(box.x + box.w).toBeGreaterThanOrEqual(416);
    expect(box.y + box.h).toBeGreaterThanOrEqual(196);
    expect(box.x + box.w).toBeLessThan(440);
  });

  it("finds nothing on a plain screen", async () => {
    const data = new Uint8ClampedArray(320 * 200 * 4).fill(255);
    expect(await findCodes({ data, width: 320, height: 200 })).toEqual([]);
  });

  it("turns boxes into high-confidence detections without keeping the content", () => {
    const [d] = codeDetections([{ x: 1, y: 2, w: 3, h: 4 }], "QR code");
    expect(d).toMatchObject({ category: "qr", confidence: "high", text: "", preview: "QR code" });
  });
});
