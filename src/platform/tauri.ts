import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { readImage, writeImage } from "@tauri-apps/plugin-clipboard-manager";
import { open, save } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { load, type Store } from "@tauri-apps/plugin-store";
import { detectOs } from "../core/os";
import { SaveRefusedError, type LoadedImage, type Platform } from "./types";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "bmp", "gif", "heic", "heif"];

let store: Promise<Store> | undefined;
const settingsStore = () => (store ??= load("settings.json", { autoSave: false, defaults: {} }));

const basename = (path: string) => path.split(/[\\/]/).pop() ?? path;
const dirname = (path: string) =>
  path.slice(0, Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);

async function readFromDisk(path: string): Promise<LoadedImage> {
  const buffer = await invoke<ArrayBuffer>("read_image_file", { path });
  return { bytes: new Uint8Array(buffer), name: basename(path), path };
}

async function rgbaToPng(rgba: Uint8Array, width: number, height: number): Promise<Uint8Array> {
  const canvas = new OffscreenCanvas(width, height);
  canvas
    .getContext("2d")
    ?.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
  const blob = await canvas.convertToBlob({ type: "image/png" });
  return new Uint8Array(await blob.arrayBuffer());
}

export const tauri: Platform = {
  os: detectOs(navigator.userAgent),
  systemLocale: navigator.language,
  pickImage: async () => {
    const path = await open({
      multiple: false,
      filters: [{ name: "Images", extensions: IMAGE_EXTENSIONS }],
    });
    return typeof path === "string" ? readFromDisk(path) : null;
  },
  readClipboardImage: async () => {
    try {
      const image = await readImage();
      const { width, height } = await image.size();
      return { bytes: await rgbaToPng(await image.rgba(), width, height), name: "clipboard.png" };
    } catch {
      return null;
    }
  },
  copyImage: (png) => writeImage(png),
  saveImage: async (png, suggestedName, originalPath) => {
    const target = await save({
      defaultPath: originalPath ? dirname(originalPath) + suggestedName : suggestedName,
      filters: [{ name: "PNG", extensions: ["png"] }],
    });
    if (!target) return false;
    const headers: Record<string, string> = { "x-target": encodeURIComponent(target) };
    if (originalPath) headers["x-original"] = encodeURIComponent(originalPath);
    try {
      await invoke("save_image_file", png, { headers });
    } catch (error) {
      if (String(error).includes("overwrite")) throw new SaveRefusedError();
      throw error;
    }
    return true;
  },
  onFileDrop: ({ hover, images, failed }) =>
    getCurrentWebview().onDragDropEvent((event) => {
      const { type } = event.payload;
      hover(type === "enter" || type === "over");
      if (type !== "drop") return;
      const paths = event.payload.paths.filter((p) =>
        IMAGE_EXTENSIONS.includes(p.split(".").pop()?.toLowerCase() ?? ""),
      );
      if (paths.length === 0) return failed();
      Promise.all(paths.map(readFromDisk)).then(images, failed);
    }),
  loadSettings: async () => (await settingsStore()).get("settings"),
  saveSettings: async (settings) => {
    const s = await settingsStore();
    await s.set("settings", settings);
    await s.save();
  },
  openUrl: (url) => openUrl(url),
};
