import { tauri } from "./tauri";
import type { Platform } from "./types";
import { web } from "./web";

export { SaveRefusedError } from "./types";
export type { LoadedImage, Platform } from "./types";

export const isTauri = "__TAURI_INTERNALS__" in window;
export const platform: Platform = isTauri ? tauri : web;
