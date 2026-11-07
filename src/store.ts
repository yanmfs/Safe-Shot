import { useCallback } from "react";
import { create } from "zustand";
import { resolveLang, translate, type Key, type Lang } from "./i18n";
import { platform } from "./platform";
import { defaultSettings, parseSettings, type Settings } from "./settings";

interface AppState {
  settings: Settings;
  ready: boolean;
  settingsOpen: boolean;
  aboutOpen: boolean;
  whyOpen: boolean;
  shortcutError: string | null;
  setShortcutError: (shortcut: string | null) => void;
  hydrate: () => Promise<void>;
  update: (patch: Partial<Settings>) => void;
  setDialog: (dialog: "settingsOpen" | "aboutOpen" | "whyOpen", open: boolean) => void;
}

export const useApp = create<AppState>((set, get) => ({
  settings: defaultSettings,
  ready: false,
  settingsOpen: false,
  aboutOpen: false,
  whyOpen: false,
  shortcutError: null,
  setShortcutError: (shortcutError) => set({ shortcutError }),

  hydrate: async () => {
    const saved = parseSettings(await platform.loadSettings().catch(() => null), platform.os);
    set({ settings: saved, ready: true });
  },

  update: (patch) => {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    void platform.saveSettings(settings);
  },

  setDialog: (dialog, open) => set({ [dialog]: open }),
}));

export const selectLang = (s: { settings: Settings }): Lang =>
  resolveLang(s.settings.language, platform.systemLocale);

type Vars = Record<string, string | number>;

export function useT() {
  const lang = useApp(selectLang);
  return useCallback((key: Key, vars?: Vars) => translate(lang, key, vars), [lang]);
}

export const tNow = (key: Key, vars?: Vars) => translate(selectLang(useApp.getState()), key, vars);
