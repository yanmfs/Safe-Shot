import { useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { acceleratorFromEvent, formatShortcut } from "../../core/os";
import { platform } from "../../platform";
import { useApp, useT } from "../../store";
import { changeShortcut } from "../doc/actions";

export function ShortcutRecorder() {
  const t = useT();
  const shortcut = useApp((s) => s.settings.shortcut);
  const failed = useApp((s) => s.shortcutError);
  const [recording, setRecording] = useState(false);
  const [needsModifier, setNeedsModifier] = useState(false);

  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") return setRecording(false);
      const accelerator = acceleratorFromEvent(e, platform.os);
      if (!accelerator) {
        setNeedsModifier(!/^(Control|Shift|Alt|Meta)/.test(e.code));
        return;
      }
      setNeedsModifier(false);
      setRecording(false);
      void changeShortcut(accelerator);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recording]);

  if (!platform.hasGlobalShortcut) {
    return <p className="text-sm text-muted">{t("settings.shortcutUnavailable")}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <kbd
          aria-live="polite"
          className="inline-flex h-9 min-w-32 items-center justify-center rounded-control border border-border bg-surface-2 px-3 font-sans text-sm"
        >
          {recording ? t("settings.shortcutRecording") : formatShortcut(shortcut, platform.os)}
        </kbd>
        <Button
          onClick={() => {
            setNeedsModifier(false);
            setRecording((r) => !r);
          }}
        >
          {recording ? t("settings.shortcutCancel") : t("settings.shortcutChange")}
        </Button>
      </div>
      <p className="text-xs text-muted">{t("settings.shortcutHelp")}</p>
      {needsModifier && (
        <p role="alert" className="text-xs text-danger">
          {t("settings.shortcutNeedsModifier")}
        </p>
      )}
      {failed && !recording && (
        <p role="alert" className="text-xs text-danger">
          {t("settings.shortcutFailed", { shortcut: formatShortcut(failed, platform.os) })}
        </p>
      )}
    </div>
  );
}
