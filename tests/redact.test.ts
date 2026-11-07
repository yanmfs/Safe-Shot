import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { meanLuminance, prepareForOcr, toOriginalCoordinates } from "../src/core/ocr-prep";
import { endsAtIend, paintBars, toPixelRect, verifyBars, type Rgba } from "../src/core/redact";

function solid(width: number, height: number, rgb: [number, number, number]): Rgba {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([...rgb, 255], i * 4);
  return { data, width, height };
}

describe("toPixelRect", () => {
  it("rounds outwards and clamps to the image", () => {
    expect(toPixelRect({ x: 10.4, y: 5.6, w: 20.2, h: 10.1 }, 100, 100)).toEqual({
      x: 10,
      y: 5,
      w: 21,
      h: 11,
    });
    expect(toPixelRect({ x: -5, y: -5, w: 20, h: 20 }, 100, 100)).toEqual({
      x: 0,
      y: 0,
      w: 15,
      h: 15,
    });
  });

  it("drops rectangles that fall outside", () => {
    expect(toPixelRect({ x: 200, y: 0, w: 10, h: 10 }, 100, 100)).toBeNull();
  });
});

describe("paintBars and verifyBars", () => {
  it("fills every pixel of the bar and nothing else", () => {
    const image = solid(40, 40, [200, 100, 50]);
    const rect = { x: 10.5, y: 10.5, w: 10, h: 5 };
    paintBars(image, [rect], "black");
    expect(verifyBars(image, [rect], "black")).toEqual({ ok: true, badPixels: 0 });
    expect([...image.data.subarray(0, 4)]).toEqual([200, 100, 50, 255]);
  });

  it("detects a pixel that was not covered", () => {
    const image = solid(40, 40, [200, 100, 50]);
    const rect = { x: 5, y: 5, w: 10, h: 10 };
    paintBars(image, [rect], "gray");
    image.data.set([200, 100, 50, 255], (7 * 40 + 7) * 4);
    expect(verifyBars(image, [rect], "gray")).toEqual({ ok: false, badPixels: 1 });
  });

  it("accepts small drift when a tolerance is given", () => {
    const image = solid(20, 20, [10, 10, 10]);
    expect(verifyBars(image, [{ x: 0, y: 0, w: 20, h: 20 }], "black", 24).ok).toBe(true);
    expect(verifyBars(image, [{ x: 0, y: 0, w: 20, h: 20 }], "black", 0).ok).toBe(false);
  });

  it("supports the three bar colours", () => {
    for (const color of ["black", "white", "gray"] as const) {
      const image = solid(10, 10, [90, 90, 90]);
      const rect = { x: 0, y: 0, w: 10, h: 10 };
      paintBars(image, [rect], color);
      expect(verifyBars(image, [rect], color).ok).toBe(true);
    }
  });
});

describe("endsAtIend", () => {
  const png = () => {
    const p = new PNG({ width: 4, height: 4 });
    p.data.fill(255);
    return new Uint8Array(PNG.sync.write(p));
  };

  it("accepts a clean PNG", () => {
    expect(endsAtIend(png())).toBe(true);
  });

  it("rejects trailing bytes after IEND", () => {
    const clean = png();
    const dirty = new Uint8Array(clean.length + 5);
    dirty.set(clean);
    expect(endsAtIend(dirty)).toBe(false);
  });

  it("rejects truncated files and other formats", () => {
    expect(endsAtIend(png().subarray(0, 30))).toBe(false);
    expect(
      endsAtIend(
        new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      ),
    ).toBe(false);
  });
});

describe("prepareForOcr", () => {
  it("upscales small images and keeps wide ones", () => {
    expect(prepareForOcr(solid(100, 50, [255, 255, 255])).scale).toBe(2);
    expect(prepareForOcr(solid(100, 50, [255, 255, 255])).image.width).toBe(200);
    expect(
      prepareForOcr({ data: new Uint8ClampedArray(1600 * 2 * 4), width: 1600, height: 2 }).scale,
    ).toBe(1);
  });

  it("inverts dark screenshots", () => {
    const dark = solid(10, 10, [10, 10, 10]);
    expect(meanLuminance(dark)).toBeLessThan(0.4);
    expect(prepareForOcr(dark).image.data[0]).toBeGreaterThan(200);
    const light = solid(10, 10, [240, 240, 240]);
    expect(prepareForOcr(light).image.data[0]).toBeGreaterThan(200);
  });

  it("maps boxes back to the original size", () => {
    const page = {
      width: 200,
      height: 100,
      lines: [
        {
          box: { x: 20, y: 10, w: 100, h: 20 },
          words: [{ text: "a", box: { x: 20, y: 10, w: 40, h: 20 } }],
        },
      ],
    };
    const back = toOriginalCoordinates(page, 2);
    expect(back.width).toBe(100);
    expect(back.lines[0]?.words[0]?.box).toEqual({ x: 10, y: 5, w: 20, h: 10 });
  });
});
