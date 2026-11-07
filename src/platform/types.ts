import type { OcrPage } from "../core/detect";
import type { Os } from "../core/os";
import type { Settings } from "../settings";

export type Unlisten = () => void;

export interface LoadedImage {
  bytes: Uint8Array;
  name: string;
  // Only known when the file came from disk, so saving can refuse to overwrite it.
  path?: string;
}

export type MenuAction = "open" | "save" | "undo" | "redo";

export interface MenuLabels {
  app: string;
  file: string;
  open: string;
  save: string;
  edit: string;
  undo: string;
  redo: string;
  cut: string;
  copy: string;
  paste: string;
  selectAll: string;
  window: string;
}

export interface DropHandlers {
  hover: (over: boolean) => void;
  images: (images: LoadedImage[]) => void;
  failed: () => void;
}

export interface Platform {
  os: Os;
  systemLocale: string;
  hasGlobalShortcut: boolean;
  registerShortcut(accelerator: string, onPressed: () => void): Promise<void>;
  unregisterShortcut(accelerator: string): Promise<void>;
  // Shows and focuses the window, for when the shortcut fires while it is hidden or behind others.
  bringToFront(): Promise<void>;
  // Missing in the browser demo; the installed app has the reader of the system.
  nativeOcr?: (png: Uint8Array) => Promise<OcrPage>;
  // The macOS menu bar; the page gets its actions back through `onMenuAction`.
  setMenuLabels(labels: MenuLabels): Promise<void>;
  onMenuAction(handler: (action: MenuAction) => void): Promise<Unlisten>;
  pickImages(): Promise<LoadedImage[]>;
  readClipboardImage(): Promise<LoadedImage | null>;
  copyImage(png: Uint8Array): Promise<void>;
  // Resolves false when the person cancels the dialog.
  // The extension of `suggestedName` (png or jpg) says which format `bytes` hold.
  saveImage(bytes: Uint8Array, suggestedName: string, originalPath?: string): Promise<boolean>;
  onFileDrop(handlers: DropHandlers): Promise<Unlisten>;
  loadSettings(): Promise<unknown>;
  saveSettings(settings: Settings): Promise<void>;
  openUrl(url: string): Promise<void>;
}

export class SaveRefusedError extends Error {}
