import { defaultShortcut, type Os } from "./core/os";
import type { BarColor } from "./core/redact";
import type { LangSetting } from "./i18n";

export type ThemeSetting = "system" | "light" | "dark";

export interface Settings {
  language: LangSetting;
  theme: ThemeSetting;
  barColor: BarColor;
  terms: string[];
  // Accelerator that opens the clipboard image; "" until the first run picks the OS default.
  shortcut: string;
  // The format of the exported file: PNG is lossless, JPEG is smaller for photos.
  format: ExportFormat;
}

export type ExportFormat = "png" | "jpeg";

export const defaultSettings: Settings = {
  language: "auto",
  theme: "system",
  barColor: "black",
  terms: [],
  shortcut: "",
  format: "png",
};

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

// Stored settings can be missing fields (older versions) or hand-edited; fall back per field.
export function parseSettings(raw: unknown, os: Os = "windows"): Settings {
  const r = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    language: pick(r.language, ["auto", "pt-BR", "en"], defaultSettings.language),
    theme: pick(r.theme, ["system", "light", "dark"], defaultSettings.theme),
    barColor: pick(r.barColor, ["black", "white", "gray"], defaultSettings.barColor),
    terms: Array.isArray(r.terms)
      ? r.terms.filter((t): t is string => typeof t === "string").slice(0, 200)
      : [],
    shortcut:
      typeof r.shortcut === "string" && r.shortcut !== "" ? r.shortcut : defaultShortcut(os),
    format: pick(r.format, ["png", "jpeg"], defaultSettings.format),
  };
}
