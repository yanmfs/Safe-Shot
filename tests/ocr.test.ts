import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detect, type Category, type Detection } from "../src/core/detect";
import type { Rgba } from "../src/core/redact";
import { createTesseractEngine } from "../src/ocr/tesseract";
import type { OcrEngine } from "../src/ocr/types";
import { copyOcrAssets } from "../scripts/copy-ocr-assets.mjs";

const shots = join(__dirname, "fixtures", "shots");
const names = existsSync(shots)
  ? readdirSync(shots)
      .filter((f) => f.endsWith(".png"))
      .map((f) => f.replace(".png", ""))
  : [];

interface Expected {
  category: Category;
  text: string;
}

const key = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

function similarity(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...Array<number>(b.length).fill(0),
  ]);
  for (let j = 1; j <= b.length; j++) rows[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i]![j] = Math.min(
        rows[i - 1]![j]! + 1,
        rows[i]![j - 1]! + 1,
        rows[i - 1]![j - 1]! + cost,
      );
    }
  }
  return 1 - rows[a.length]![b.length]! / Math.max(a.length, b.length, 1);
}

// Tesseract sometimes swaps 0/O in long tokens; a near match still means the right text was boxed.
const hit = (d: Detection, e: Expected) =>
  d.category === e.category &&
  (key(d.text).includes(key(e.text)) ||
    key(e.text).includes(key(d.text)) ||
    similarity(key(d.text), key(e.text)) >= 0.9);

function load(name: string): Rgba {
  const png = PNG.sync.read(readFileSync(join(shots, `${name}.png`)));
  return { data: new Uint8ClampedArray(png.data), width: png.width, height: png.height };
}

const results = new Map<string, { found: number; total: number }[]>();
const perFile: string[] = [];

describe.skipIf(names.length === 0)("OCR recall on generated screens", () => {
  let engine: OcrEngine;

  beforeAll(() => {
    const target = copyOcrAssets();
    engine = createTesseractEngine({
      paths: { langPath: join(target, "lang") } as never,
      encode: (image) => {
        const png = new PNG({ width: image.width, height: image.height });
        png.data = Buffer.from(image.data);
        return PNG.sync.write(png);
      },
      pageSegMode: (process.env.PSM as "3" | "11" | undefined) ?? "11",
    });
  }, 60_000);

  afterAll(async () => {
    await engine.terminate();
    const rows = [...results.entries()].map(([category, runs]) => {
      const found = runs.reduce((a, r) => a + r.found, 0);
      const total = runs.reduce((a, r) => a + r.total, 0);
      return `${category.padEnd(12)} ${found}/${total}`;
    });
    // eslint-disable-next-line no-console
    console.log(
      `\nRecall by category (psm ${process.env.PSM ?? "11"})\n${rows.join("\n")}\n${perFile.join("\n")}`,
    );
  });

  it.each(names)("%s", { timeout: 120_000 }, async (name) => {
    const { expected } = JSON.parse(readFileSync(join(shots, `${name}.json`), "utf8")) as {
      expected: Expected[];
    };
    const page = await engine.recognize(load(name));
    const found = detect(page);
    const missed: string[] = [];
    for (const e of expected) {
      const ok = found.some((d) => hit(d, e));
      const list = results.get(e.category) ?? [];
      list.push({ found: ok ? 1 : 0, total: 1 });
      results.set(e.category, list);
      if (!ok) missed.push(`${e.category}:${e.text}`);
    }
    perFile.push(
      `${name}: ${expected.length - missed.length}/${expected.length}${missed.length ? "  missed " + missed.join(", ") : ""}`,
    );
    expect(page.lines.length).toBeGreaterThan(0);
  });

  it("meets the recall targets", () => {
    const rate = (categories: string[], theme?: string) => {
      const entries = [...results.entries()].filter(([c]) => categories.includes(c));
      const runs = entries.flatMap(([, r]) => r);
      return { found: runs.reduce((a, r) => a + r.found, 0), total: runs.length, theme };
    };
    const all = rate([...results.keys()]);
    expect(all.found / all.total).toBeGreaterThanOrEqual(0.95);
    for (const category of ["cpf", "email", "phone"]) {
      const { found, total } = rate([category]);
      expect(found, category).toBe(total);
    }
  });
});
