import { describe, expect, it } from "vitest";
import {
  alignRects,
  paintStyled,
  smudgeRect,
  surroundings,
  verifySmooth,
  verifyTwoColours,
  type Mark,
  type Rgba,
} from "../src/core/redact";

function page(width: number, height: number, rgb: [number, number, number]): Rgba {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([...rgb, 255], i * 4);
  return { data, width, height };
}

// Dark "text": thin vertical strokes on a light page, like a line of letters.
function withText(): Rgba {
  const image = page(200, 60, [250, 250, 248]);
  for (let x = 40; x < 140; x += 6) {
    for (let y = 22; y < 38; y++) {
      for (let dx = 0; dx < 2; dx++) image.data.set([20, 20, 20, 255], (y * 200 + x + dx) * 4);
    }
  }
  return image;
}

const area = { x: 36, y: 20, w: 108, h: 20 };

describe("surroundings", () => {
  it("takes the colour of the page around a region, not of what is inside", () => {
    expect(surroundings(withText(), area)).toEqual([250, 250, 248]);
  });
});

describe("smudge", () => {
  it("leaves nothing sharp inside the region", () => {
    const image = withText();
    const before = verifySmooth(image, [area]);
    expect(before.ok).toBe(false);
    smudgeRect(image, area, [0, 0, 0]);
    expect(verifySmooth(image, [area]).ok).toBe(true);
  });

  it("changes only the region and a soft margin around it", () => {
    const image = withText();
    const original = new Uint8ClampedArray(image.data);
    smudgeRect(image, area, [0, 0, 0]);
    const at = (x: number, y: number) => (y * 200 + x) * 4;
    // far away: untouched
    expect(image.data[at(5, 5)]).toBe(original[at(5, 5)]);
    expect(image.data[at(190, 55)]).toBe(original[at(190, 55)]);
    // inside: the dark strokes are gone
    for (let x = 40; x < 140; x += 6) expect(image.data[at(x, 30)]!).toBeGreaterThan(120);
  });

  it("keeps the same tone as the page, so it does not look like a hole", () => {
    const image = withText();
    smudgeRect(image, area, [0, 0, 0]);
    const corner = image.data[(21 * 200 + 37) * 4]!;
    expect(corner).toBeGreaterThan(170);
  });

  it("only keeps a few tones, never the shape of the letters", () => {
    const image = withText();
    smudgeRect(image, area, [0, 0, 0]);
    // Every tile is one flat tone before blurring; along the row the result changes slowly.
    let largestStep = 0;
    for (let x = 37; x < 142; x++) {
      const a = image.data[(30 * 200 + x) * 4]!;
      const b = image.data[(30 * 200 + x + 1) * 4]!;
      largestStep = Math.max(largestStep, Math.abs(a - b));
    }
    expect(largestStep).toBeLessThan(25);
  });

  it("works on a light-on-dark page too", () => {
    const image = page(200, 60, [18, 22, 30]);
    for (let x = 40; x < 140; x += 6) {
      for (let y = 22; y < 38; y++) image.data.set([240, 240, 240, 255], (y * 200 + x) * 4);
    }
    smudgeRect(image, area, [255, 255, 255]);
    expect(verifySmooth(image, [area]).ok).toBe(true);
  });

  it("copes with a region at the image border", () => {
    const image = withText();
    expect(() => smudgeRect(image, { x: -5, y: -5, w: 30, h: 15 }, [0, 0, 0])).not.toThrow();
    expect(() => smudgeRect(image, { x: 190, y: 50, w: 40, h: 30 }, [0, 0, 0])).not.toThrow();
    expect(() => smudgeRect(image, { x: 500, y: 0, w: 4, h: 4 }, [0, 0, 0])).not.toThrow();
  });
});

describe("smudge tint", () => {
  it("stays visible on a dark page even when the bar colour is black", () => {
    const image = page(200, 60, [22, 40, 30]);
    for (let x = 40; x < 140; x += 6) {
      for (let y = 22; y < 38; y++) image.data.set([240, 240, 240, 255], (y * 200 + x) * 4);
    }
    smudgeRect(image, area, [0, 0, 0]);
    // lighter than the page, so it reads as a patch and not as a hole
    expect(image.data[(30 * 200 + 90) * 4]!).toBeGreaterThan(40);
  });

  it("stays visible on a light page even when the bar colour is white", () => {
    const image = withText();
    smudgeRect(image, area, [255, 255, 255]);
    expect(image.data[(30 * 200 + 90) * 4]!).toBeLessThan(245);
    expect(verifySmooth(image, [area]).ok).toBe(true);
  });
});

describe("paintStyled", () => {
  const marks: Mark[] = [{ rect: area, label: "CPF" }];

  it("paints solid bars for the solid and label styles", () => {
    for (const style of ["solid", "label"] as const) {
      const image = withText();
      paintStyled(image, marks, style, "black");
      expect(image.data[(30 * 200 + 60) * 4]).toBe(0);
    }
  });

  it("smudges instead of painting for the smudge style", () => {
    const image = withText();
    paintStyled(image, marks, "smudge", "black");
    expect(image.data[(30 * 200 + 60) * 4]).toBeGreaterThan(100);
  });
});

describe("verifyTwoColours", () => {
  it("accepts a bar with lettering and rejects a third colour", () => {
    const image = page(60, 20, [0, 0, 0]);
    image.data.set([255, 255, 255, 255], (10 * 60 + 20) * 4);
    image.data.set([128, 128, 128, 255], (10 * 60 + 21) * 4);
    const rect = { x: 0, y: 0, w: 60, h: 20 };
    expect(verifyTwoColours(image, [rect], [0, 0, 0], [255, 255, 255], 0).ok).toBe(true);
    image.data.set([255, 0, 0, 255], (5 * 60 + 5) * 4);
    expect(verifyTwoColours(image, [rect], [0, 0, 0], [255, 255, 255], 0).ok).toBe(false);
  });
});

describe("alignRects stays available for JPEG", () => {
  it("still grows to blocks", () => {
    expect(alignRects([{ x: 1, y: 1, w: 2, h: 2 }], 64, 64)).toEqual([
      { x: 0, y: 0, w: 16, h: 16 },
    ]);
  });
});
