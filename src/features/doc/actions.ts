import { activeRects, useDoc } from "./store";
import { exportName, exportRedacted, VerificationError } from "./export";
import { platform, SaveRefusedError } from "../../platform";
import { tNow, useApp } from "../../store";
import { showToast } from "../../toast";

async function render(): Promise<{ png: Uint8Array; name: string; path?: string } | null> {
  const { doc, detections, edit } = useDoc.getState();
  if (!doc) return null;
  try {
    const png = await exportRedacted(
      doc.bitmap,
      activeRects(detections, edit),
      useApp.getState().settings.barColor,
    );
    return { png, name: exportName(doc.name), path: doc.path };
  } catch (error) {
    showToast(
      tNow(error instanceof VerificationError ? "toast.verifyFailed" : "toast.exportFailed"),
      "error",
    );
    return null;
  }
}

export async function copyResult(): Promise<void> {
  const out = await render();
  if (!out) return;
  try {
    await platform.copyImage(out.png);
    showToast(tNow("toast.copied"));
  } catch {
    showToast(tNow("toast.exportFailed"), "error");
  }
}

export async function saveResult(): Promise<void> {
  const out = await render();
  if (!out) return;
  try {
    if (await platform.saveImage(out.png, out.name, out.path)) showToast(tNow("toast.saved"));
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
