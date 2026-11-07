import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detect } from "../src/core/detect";
import { paintStyled, verifySmooth, type Mark } from "../src/core/redact";
import type { OcrEngine } from "../src/ocr/types";
import { hit, load, nodeEngine, shots, type Expected } from "./helpers/recall";

const names = ["bank-light", "chat-light", "email-light", "form-light", "bank-dark", "chat-dark"];

// The point of a smudge is that nobody can read the data back, not even a program. This reads the
// result with the same OCR that found the data in the first place.
describe("a smudged screen cannot be read back", () => {
  let engine: OcrEngine;
  beforeAll(() => {
    engine = nodeEngine();
  }, 60_000);
  afterAll(async () => {
    await engine.terminate();
  });

  it.each(names)("%s", { timeout: 120_000 }, async (name) => {
    const { expected } = JSON.parse(readFileSync(join(shots, `${name}.json`), "utf8")) as {
      expected: Expected[];
    };
    const image = load(name);
    const found = detect(await engine.recognize(image));
    expect(found.length).toBeGreaterThan(0);

    const marks: Mark[] = found.flatMap((d) => d.boxes.map((rect) => ({ rect })));
    paintStyled(image, marks, "smudge", name.endsWith("dark") ? "white" : "black");
    expect(
      verifySmooth(
        image,
        marks.map((m) => m.rect),
      ).ok,
    ).toBe(true);

    const again = detect(await engine.recognize(image));
    const leaked = expected.filter((e) => again.some((d) => hit(d, e)));
    expect(leaked, `still readable: ${leaked.map((e) => e.text).join(", ")}`).toEqual([]);
  });
});
