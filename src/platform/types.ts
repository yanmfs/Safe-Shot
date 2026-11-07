import type { Os } from "../core/os";
import type { Settings } from "../settings";

export type Unlisten = () => void;

export interface LoadedImage {
  bytes: Uint8Array;
  name: string;
  // Only known when the file came from disk, so saving can refuse to overwrite it.
  path?: string;
}

export interface DropHandlers {
  hover: (over: boolean) => void;
  images: (images: LoadedImage[]) => void;
  failed: () => void;
}

export interface Platform {
  os: Os;
  systemLocale: string;
  pickImage(): Promise<LoadedImage | null>;
  readClipboardImage(): Promise<LoadedImage | null>;
  copyImage(png: Uint8Array): Promise<void>;
  // Resolves false when the person cancels the dialog.
  saveImage(png: Uint8Array, suggestedName: string, originalPath?: string): Promise<boolean>;
  onFileDrop(handlers: DropHandlers): Promise<Unlisten>;
  loadSettings(): Promise<unknown>;
  saveSettings(settings: Settings): Promise<void>;
  openUrl(url: string): Promise<void>;
}

export class SaveRefusedError extends Error {}
