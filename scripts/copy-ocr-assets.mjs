// Copies the OCR worker, wasm core and traineddata into public/ocr so the app never fetches them.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "package.json"));

function packageDir(name, from = require) {
  return dirname(from.resolve(`${name}/package.json`));
}

export function copyOcrAssets(target = join(root, "public", "ocr")) {
  const tesseract = packageDir("tesseract.js");
  const core = packageDir("tesseract.js-core", createRequire(join(tesseract, "package.json")));

  mkdirSync(join(target, "core"), { recursive: true });
  mkdirSync(join(target, "lang"), { recursive: true });

  copyFileSync(join(tesseract, "dist", "worker.min.js"), join(target, "worker.min.js"));
  for (const file of readdirSync(core)) {
    if (/^tesseract-core.*-lstm\.wasm\.js$|^tesseract-core-lstm\.wasm\.js$/.test(file)) {
      copyFileSync(join(core, file), join(target, "core", file));
    }
  }
  for (const lang of ["por", "eng"]) {
    const dir = packageDir(`@tesseract.js-data/${lang}`);
    const source = join(dir, "4.0.0_best_int", `${lang}.traineddata.gz`);
    if (!existsSync(source)) throw new Error(`Missing traineddata for ${lang} in ${dir}`);
    copyFileSync(source, join(target, "lang", `${lang}.traineddata.gz`));
  }
  return target;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) copyOcrAssets();
