import { activeRects, useDoc } from "./store";
import { exportName, exportRedacted, exportRedactedJpeg, VerificationError } from "./export";
import type { ExportFormat } from "../../settings";
import { platform, SaveRefusedError } from "../../platform";
import { tNow, useApp } from "../../store";
import { showToast } from "../../toast";

// The clipboard always gets a PNG; the saved file follows the format in the settings.
async function render(
  format: ExportFormat,
): Promise<{ bytes: Uint8Array; name: string; path?: string } | null> {
  const { doc, detections, edit } = useDoc.getState();
  if (!doc) return null;
  try {
    const rects = activeRects(detections, edit);
    const { barColor } = useApp.getState().settings;
    const bytes =
      format === "jpeg"
        ? await exportRedactedJpeg(doc.bitmap, rects, barColor)
        : await exportRedacted(doc.bitmap, rects, barColor);
    return { bytes, name: exportName(doc.name, format), path: doc.path };
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
  const image = await platform.pickImage().catch(() => null);
  if (image) await useDoc.getState().open(image);
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
