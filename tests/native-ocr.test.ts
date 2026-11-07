import { describe, expect, it } from "vitest";
import type { OcrPage } from "../src/core/detect";
import { cleanPage, createNativeEngine } from "../src/ocr/native";

const image = { data: new Uint8ClampedArray(4), width: 1, height: 1 };
const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });

describe("native engine", () => {
  it("passes the PNG to the system reader and returns its page", async () => {
    const seen: Uint8Array[] = [];
    const page: OcrPage = {
      width: 100,
      height: 40,
      lines: [{ words: [{ text: "CPF", box: box(1, 2, 30, 10) }], box: box(1, 2, 30, 10) }],
    };
    const progress: number[] = [];
    const engine = createNativeEngine({
      encode: () => Promise.resolve(new Uint8Array([1, 2, 3])),
      read: (png) => {
        seen.push(png);
        return Promise.resolve(page);
      },
    });
    expect(await engine.recognize(image, (p) => progress.push(p))).toEqual(page);
    expect(seen[0]).toEqual(new Uint8Array([1, 2, 3]));
    expect(progress).toEqual([0.5, 1]);
  });

  it("lets a failing reader reject so the caller can fall back", async () => {
    const engine = createNativeEngine({
      encode: () => Promise.resolve(new Uint8Array()),
      read: () => Promise.reject(new Error("no reader")),
    });
    await expect(engine.recognize(image)).rejects.toThrow("no reader");
  });
});

describe("cleanPage", () => {
  it("drops words without text or with unusable boxes, and lines left empty", () => {
    const page: OcrPage = {
      width: 10,
      height: 10,
      lines: [
        {
          words: [
            { text: "ok", box: box(0, 0, 5, 5) },
            { text: " ", box: box(5, 0, 1, 5) },
            { text: "nan", box: box(Number.NaN, 0, 5, 5) },
            { text: "flat", box: box(0, 0, 0, 5) },
          ],
          box: box(0, 0, 10, 5),
        },
        { words: [{ text: "gone", box: box(0, 0, 0, 0) }], box: box(0, 6, 10, 4) },
      ],
    };
    const cleaned = cleanPage(page);
    expect(cleaned.lines).toHaveLength(1);
    expect(cleaned.lines[0]?.words.map((w) => w.text)).toEqual(["ok"]);
  });
});
