import { detectOs, type Os } from "../core/os";
import type { LoadedImage, Platform } from "./types";

const KEY = "safeshot:settings";
const IMAGE_TYPES = /^image\/(png|jpeg|webp|bmp|gif)$/;

function osFromQuery(): Os | null {
  const value = new URLSearchParams(window.location.search).get("os");
  return value === "windows" || value === "macos" ? value : null;
}

async function fromFile(file: File): Promise<LoadedImage> {
  return { bytes: new Uint8Array(await file.arrayBuffer()), name: file.name || "image.png" };
}

// Used by the browser demo, the screenshots and the UI tests.
export const web: Platform = {
  os: osFromQuery() ?? detectOs(navigator.userAgent),
  systemLocale: navigator.language,
  hasGlobalShortcut: false,
  registerShortcut: () => Promise.reject(new Error("no global shortcut in the browser")),
  unregisterShortcut: () => Promise.resolve(),
  bringToFront: () => Promise.resolve(),
  setMenuLabels: () => Promise.resolve(),
  onMenuAction: () => Promise.resolve(() => undefined),
  pickImages: () =>
    new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.accept = "image/png,image/jpeg,image/webp,image/bmp,image/gif";
      input.onchange = () => resolve(Promise.all([...(input.files ?? [])].map(fromFile)));
      input.oncancel = () => resolve([]);
      input.click();
    }),
  readClipboardImage: async () => {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = item.types.find((t) => IMAGE_TYPES.test(t));
      if (!type) continue;
      const blob = await item.getType(type);
      return { bytes: new Uint8Array(await blob.arrayBuffer()), name: "clipboard.png" };
    }
    return null;
  },
  copyImage: (png) =>
    navigator.clipboard.write([
      new ClipboardItem({ "image/png": new Blob([png as BlobPart], { type: "image/png" }) }),
    ]),
  saveImage: (bytes, suggestedName) => {
    const type = /\.jpe?g$/i.test(suggestedName) ? "image/jpeg" : "image/png";
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = suggestedName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return Promise.resolve(true);
  },
  onFileDrop: ({ hover, images, failed }) => {
    const over = (e: DragEvent) => {
      e.preventDefault();
      hover(true);
    };
    const leave = () => hover(false);
    const drop = (e: DragEvent) => {
      e.preventDefault();
      hover(false);
      const files = [...(e.dataTransfer?.files ?? [])].filter((f) => IMAGE_TYPES.test(f.type));
      if (files.length === 0) return failed();
      Promise.all(files.map(fromFile)).then(images, failed);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return Promise.resolve(() => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    });
  },
  loadSettings: () => {
    try {
      return Promise.resolve(JSON.parse(localStorage.getItem(KEY) ?? "null"));
    } catch {
      return Promise.resolve(null);
    }
  },
  saveSettings: (settings) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      // Private mode or full storage: settings just won't survive a reload.
    }
    return Promise.resolve();
  },
  openUrl: (url) => {
    window.open(url, "_blank", "noopener");
    return Promise.resolve();
  },
};
