import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detect, type OcrPage } from "../src/core/detect";
import type { OcrEngine } from "../src/ocr/types";
import { hit, load, nodeEngine, shots, type Expected } from "./helpers/recall";

const names = existsSync(shots)
  ? readdirSync(shots)
      .filter((f) => f.endsWith(".png"))
      .map((f) => f.replace(".png", ""))
  : [];

// Pages read by another engine (the native macOS one writes them with `cargo test dump_pages -- --ignored`).
const pagesDir = process.env.OCR_PAGES_DIR;

const results = new Map<string, { found: number; total: number }[]>();
const perFile: string[] = [];

describe.skipIf(names.length === 0)("OCR recall on generated screens", () => {
  let engine: OcrEngine;

  beforeAll(() => {
    if (!pagesDir) engine = nodeEngine();
  }, 60_000);

  afterAll(async () => {
    await engine?.terminate();
    const rows = [...results.entries()].map(([category, runs]) => {
      const found = runs.reduce((a, r) => a + r.found, 0);
      const total = runs.reduce((a, r) => a + r.total, 0);
      return `${category.padEnd(12)} ${found}/${total}`;
    });
    process.stdout.write(
      `\nRecall by category (${pagesDir ? "native pages" : `psm ${process.env.PSM ?? "11"}`})\n${rows.join("\n")}\n${perFile.join("\n")}`,
    );
  });

  it.each(names)("%s", { timeout: 120_000 }, async (name) => {
    const { expected } = JSON.parse(readFileSync(join(shots, `${name}.json`), "utf8")) as {
      expected: Expected[];
    };
    const page = pagesDir
      ? (JSON.parse(readFileSync(join(pagesDir, `${name}.json`), "utf8")) as OcrPage)
      : await engine.recognize(load(name));
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
