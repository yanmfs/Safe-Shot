import { Dialog } from "../../components/Dialog";
import { Select } from "../../components/Select";
import type { LangSetting } from "../../i18n";
import type { ExportFormat, ThemeSetting } from "../../settings";
import { useApp, useT } from "../../store";
import { useDoc } from "../doc/store";
import { ShortcutRecorder } from "./ShortcutRecorder";

export function SettingsDialog() {
  const t = useT();
  const open = useApp((s) => s.settingsOpen);
  const setDialog = useApp((s) => s.setDialog);
  const settings = useApp((s) => s.settings);
  const update = useApp((s) => s.update);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => setDialog("settingsOpen", o)}
      title={t("settings.title")}
    >
      <div className="mb-4 flex flex-col gap-1.5">
        <label htmlFor="terms" className="text-sm">
          {t("settings.terms")}
        </label>
        <textarea
          id="terms"
          rows={4}
          defaultValue={settings.terms.join("\n")}
          onBlur={(e) => {
            update({
              terms: e.target.value
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean),
            });
            useDoc.getState().redetect();
          }}
          className="w-full resize-none rounded-control border border-border bg-surface px-3 py-2 text-sm"
        />
        <p className="text-xs text-muted">{t("settings.termsHelp")}</p>
      </div>
      <div className="mb-4 flex flex-col gap-1.5">
        <span className="text-sm">{t("settings.shortcut")}</span>
        <ShortcutRecorder />
      </div>
      <div className="mb-4">
        <Select
          label={t("settings.format")}
          value={settings.format}
          onChange={(format: ExportFormat) => update({ format })}
        >
          <option value="png">{t("settings.format.png")}</option>
          <option value="jpeg">{t("settings.format.jpeg")}</option>
        </Select>
        <p className="mt-1 text-xs text-muted">{t("settings.formatHelp")}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select
          label={t("settings.language")}
          value={settings.language}
          onChange={(language: LangSetting) => update({ language })}
        >
          <option value="auto">{t("settings.language.auto")}</option>
          <option value="pt-BR">{t("settings.language.pt-BR")}</option>
          <option value="en">{t("settings.language.en")}</option>
        </Select>
        <Select
          label={t("settings.theme")}
          value={settings.theme}
          onChange={(theme: ThemeSetting) => update({ theme })}
        >
          <option value="system">{t("settings.theme.system")}</option>
          <option value="light">{t("settings.theme.light")}</option>
          <option value="dark">{t("settings.theme.dark")}</option>
        </Select>
      </div>
    </Dialog>
  );
}
