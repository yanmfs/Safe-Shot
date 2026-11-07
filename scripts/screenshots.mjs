// Usage: node scripts/screenshots.mjs [baseUrl]  (serve the built app first, e.g. `vite preview`)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:4173";
const out = "docs/shots";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: "chromium" });
for (const os of ["macos", "windows"]) {
  for (const scheme of ["light", "dark"]) {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 800 },
      colorScheme: scheme,
      deviceScaleFactor: 2,
      locale: "pt-BR",
    });
    await page.goto(`${base}/?os=${os}`);
    await page.getByRole("button", { name: "Abrir imagem" }).waitFor();
    await page.screenshot({ path: `${out}/${os}-${scheme}-empty.png` });

    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByRole("button", { name: "Abrir imagem" }).click(),
    ]);
    await chooser.setFiles(`tests/fixtures/shots/form-${scheme}.png`);
    await page.getByText("Dados encontrados").first().waitFor();
    await page.getByRole("heading", { name: /^CPF/ }).waitFor({ timeout: 60000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}/${os}-${scheme}-main.png` });
    await page.close();
  }
}
await browser.close();
