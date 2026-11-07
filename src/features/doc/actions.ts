import { detect, type Box } from "../../core/detect";
import type { Mark, Rgba } from "../../core/redact";
import { getOcrEngine } from "../../ocr/engine";
import { platform, SaveRefusedError } from "../../platform";
import type { ExportFormat } from "../../settings";
import { tNow, useApp } from "../../store";
import { showToast } from "../../toast";
import { exportName, exportRedacted, exportRedactedJpeg, VerificationError } from "./export";
import { activeMarks, useDoc } from "./store";

const area = (b: Box) => b.w * b.h;

function overlap(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

// Reads the smudged picture again, the way anyone could, and says which marks still show data.
async function leakingMarks(image: Rgba, marks: Mark[]): Promise<number[]> {
  const page = await getOcrEngine().recognize(image);
  const found = detect(page, { terms: useApp.getState().settings.terms }).flatMap((d) => d.boxes);
  return marks.flatMap((m, i) =>
    found.some((b) => overlap(b, m.rect) > 0.3 * area(b)) ? [i] : [],
  );
}

// The clipboard always gets a PNG; the saved file follows the format in the settings.
async function render(
  format: ExportFormat,
): Promise<{ bytes: Uint8Array; name: string; path?: string } | null> {
  const { doc, detections, edit } = useDoc.getState();
  if (!doc) return null;
  try {
    const { barColor, redactStyle } = useApp.getState().settings;
    const marks = activeMarks(detections, edit, (c) => tNow(`cat.${c}`).toUpperCase());
    const options = { style: redactStyle, color: barColor, recheck: leakingMarks };
    if (redactStyle === "smudge") showToast(tNow("toast.checking"));
    const out =
      format === "jpeg"
        ? await exportRedactedJpeg(doc.bitmap, marks, options)
        : await exportRedacted(doc.bitmap, marks, options);
    if (out.hardened > 0) showToast(tNow("toast.hardened", { count: out.hardened }));
    return { bytes: out.bytes, name: exportName(doc.name, format), path: doc.path };
  } catch (error) {
    showToast(
      tNow(error instanceof VerificationError ? "toast.verifyFailed" : "toast.exportFailed"),
      "error",
    );
    return null;
  }
}

export async function copyResult(): Promise<void> {
  const out = await render("png");
  if (!out) return;
  try {
    await platform.copyImage(out.bytes);
    showToast(tNow("toast.copied"));
  } catch {
    showToast(tNow("toast.exportFailed"), "error");
  }
}

export async function saveResult(): Promise<void> {
  const out = await render(useApp.getState().settings.format);
  if (!out) return;
  try {
    if (await platform.saveImage(out.bytes, out.name, out.path)) showToast(tNow("toast.saved"));
  } catch (error) {
    showToast(
      tNow(error instanceof SaveRefusedError ? "toast.saveRefused" : "toast.exportFailed"),
      "error",
    );
  }
}

export async function openFromDialog(): Promise<void> {
  const images = await platform.pickImages().catch(() => []);
  await useDoc.getState().openMany(images);
}

export async function pasteFromClipboard(): Promise<void> {
  const image = await platform.readClipboardImage().catch(() => null);
  if (!image) return showToast(tNow("paste.empty"), "error");
  await useDoc.getState().open(image);
}

// Runs from the global shortcut, so the window may be hidden or behind the app with the screenshot.
export async function runShortcut(): Promise<void> {
  await platform.bringToFront().catch(() => undefined);
  await pasteFromClipboard();
}

export async function changeShortcut(accelerator: string): Promise<boolean> {
  const { settings, update, setShortcutError } = useApp.getState();
  const previous = settings.shortcut;
  await platform.unregisterShortcut(previous).catch(() => undefined);
  try {
    await platform.registerShortcut(accelerator, () => void runShortcut());
    setShortcutError(null);
    update({ shortcut: accelerator });
    return true;
  } catch {
    setShortcutError(accelerator);
    await platform.registerShortcut(previous, () => void runShortcut()).catch(() => undefined);
    return false;
  }
}
