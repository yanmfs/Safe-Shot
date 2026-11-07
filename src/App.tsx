import { ClipboardPaste, FilePlus2, FolderOpen, Info, Settings } from "lucide-react";
import { useEffect } from "react";
import { Button } from "./components/Button";
import { Logo } from "./components/Logo";
import { Toaster } from "./components/Toaster";
import { Tooltip, TooltipProvider } from "./components/Tooltip";
import { Copy, Download, SkipForward } from "lucide-react";
import { modKeyLabel } from "./core/os";
import { place } from "./core/queue";
import {
  copyResult,
  openFromDialog,
  pasteFromClipboard,
  runShortcut,
  saveResult,
} from "./features/doc/actions";
import { useDoc } from "./features/doc/store";
import { AboutDialog } from "./features/settings/AboutDialog";
import { SettingsDialog } from "./features/settings/SettingsDialog";
import { WhyDialog } from "./features/settings/WhyDialog";
import { Sidebar } from "./features/sidebar/Sidebar";
import { Toolbar } from "./features/toolbar/Toolbar";
import { useIntake } from "./features/useIntake";
import { useShortcuts } from "./features/useShortcuts";
import { EmptyState } from "./features/viewer/EmptyState";
import { Viewer } from "./features/viewer/Viewer";
import { firstOf } from "./features/actionGuard";
import { platform, type MenuLabels } from "./platform";
import { selectLang, tNow, useApp, useT } from "./store";

let started: Promise<void> | undefined;

function menuLabels(): MenuLabels {
  return {
    app: "SafeShot",
    file: tNow("menu.file"),
    open: tNow("menu.open"),
    save: tNow("menu.save"),
    edit: tNow("menu.edit"),
    undo: tNow("menu.undo"),
    redo: tNow("menu.redo"),
    cut: tNow("menu.cut"),
    copy: tNow("menu.copy"),
    paste: tNow("menu.paste"),
    selectAll: tNow("menu.selectAll"),
    window: tNow("menu.window"),
  };
}

// The macOS menu bar carries Open, Save, Undo and Redo back to the page, and follows the language.
async function setUpMenu() {
  await platform.setMenuLabels(menuLabels()).catch(() => undefined);
  let lang = selectLang(useApp.getState());
  useApp.subscribe((state) => {
    const next = selectLang(state);
    if (next === lang) return;
    lang = next;
    void platform.setMenuLabels(menuLabels()).catch(() => undefined);
  });
  await platform
    .onMenuAction((action) => {
      if (!firstOf(action)) return;
      const doc = useDoc.getState();
      if (action === "open") void openFromDialog();
      else if (action === "save") void (doc.doc && saveResult());
      else if (action === "undo") doc.undo();
      else doc.redo();
    })
    .catch(() => undefined);
}

// Runs once per window, even when React mounts the tree twice in development.
async function start() {
  await useApp.getState().hydrate();
  await setUpMenu();
  if (!platform.hasGlobalShortcut) return;
  const { shortcut } = useApp.getState().settings;
  await platform
    .registerShortcut(shortcut, () => void runShortcut())
    .catch(() => {
      useApp.getState().setShortcutError(shortcut);
    });
}

export default function App() {
  const t = useT();
  const lang = useApp(selectLang);
  const theme = useApp((s) => s.settings.theme);
  const ready = useApp((s) => s.ready);
  const setDialog = useApp((s) => s.setDialog);
  const status = useDoc((s) => s.status);
  const queue = useDoc((s) => s.queue);
  const progress = useDoc((s) => s.progress);
  const ocrFailed = useDoc((s) => s.ocrFailed);
  const openFailed = useDoc((s) => s.openFailed);
  const hasDoc = useDoc((s) => s.doc !== null);
  const reset = useDoc((s) => s.reset);
  const { dragging } = useIntake();
  useShortcuts();

  useEffect(() => {
    started ??= start();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.dataset.theme = theme;
    root.lang = lang;
  }, [theme, lang]);

  if (!ready) return null;
  const mod = modKeyLabel(platform.os);
  const busy = status === "reading" || status === "decoding";

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between bg-[#111316] px-4 text-[#eceff1]">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="font-semibold">SafeShot</span>
          </div>
          <div className="flex items-center gap-1 text-[#eceff1]">
            <Tooltip label={t("header.open")} hint={`${mod}+O`}>
              <Button
                variant="ghost"
                className="text-[#c9d1d9] hover:bg-white/10 hover:text-white"
                onClick={() => void openFromDialog()}
              >
                <FolderOpen className="size-4" aria-hidden />
                {t("header.open")}
              </Button>
            </Tooltip>
            <Tooltip label={t("header.paste")} hint={`${mod}+V`}>
              <Button
                variant="ghost"
                className="text-[#c9d1d9] hover:bg-white/10 hover:text-white"
                onClick={() => void pasteFromClipboard()}
              >
                <ClipboardPaste className="size-4" aria-hidden />
                {t("header.paste")}
              </Button>
            </Tooltip>
            <Button
              variant="ghost"
              icon
              aria-label={t("header.about")}
              className="text-[#c9d1d9] hover:bg-white/10 hover:text-white"
              onClick={() => setDialog("aboutOpen", true)}
            >
              <Info className="size-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              icon
              aria-label={t("header.settings")}
              className="text-[#c9d1d9] hover:bg-white/10 hover:text-white"
              onClick={() => setDialog("settingsOpen", true)}
            >
              <Settings className="size-4" aria-hidden />
            </Button>
          </div>
        </header>

        {hasDoc ? (
          <>
            <Toolbar />
            <div className="flex min-h-0 flex-1">
              <div className="relative flex min-w-0 flex-1 flex-col">
                <Viewer />
                {busy && (
                  <div
                    role="status"
                    className="anim-fade absolute left-1/2 top-4 z-20 flex w-72 -translate-x-1/2 flex-col gap-2 rounded-panel border border-border bg-surface px-4 py-3 shadow-lg"
                  >
                    <span className="text-sm">
                      {status === "decoding" || progress === 0
                        ? t("ocr.preparing")
                        : t("ocr.reading")}
                    </span>
                    <div
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(progress * 100)}
                      className="h-1.5 overflow-hidden rounded-full bg-surface-2"
                    >
                      <div
                        className="h-full bg-accent transition-[width] duration-150"
                        style={{ width: `${Math.max(4, progress * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
                {ocrFailed && (
                  <p
                    role="alert"
                    className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-control bg-surface px-3 py-2 text-sm text-danger shadow-lg"
                  >
                    {t("ocr.failed")}
                  </p>
                )}
              </div>
              <Sidebar />
            </div>
          </>
        ) : (
          <EmptyState />
        )}

        <footer className="flex h-14 shrink-0 items-center justify-between gap-3 border-t border-border bg-surface px-4">
          <p className="text-xs text-muted">
            {queue && (
              <span className="mr-2 font-medium text-text">
                {t("queue.position", { n: place(queue), total: queue.total })}
              </span>
            )}
            {t("notice.review")}
          </p>
          {hasDoc && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={reset}>
                <FilePlus2 className="size-4" aria-hidden />
                {t("action.new")}
              </Button>
              {queue && queue.pending.length > 0 && (
                <Button disabled={busy} onClick={() => void useDoc.getState().nextInQueue()}>
                  <SkipForward className="size-4" aria-hidden />
                  {t("queue.next", { count: queue.pending.length })}
                </Button>
              )}
              <Tooltip label={t("action.save")} hint={`${mod}+S`}>
                <Button disabled={busy} onClick={() => void saveResult()}>
                  <Download className="size-4" aria-hidden />
                  {t("action.save")}
                </Button>
              </Tooltip>
              <Tooltip label={t("action.copy")} hint={`${mod}+C`}>
                <Button variant="primary" disabled={busy} onClick={() => void copyResult()}>
                  <Copy className="size-4" aria-hidden />
                  {t("action.copy")}
                </Button>
              </Tooltip>
            </div>
          )}
        </footer>

        {openFailed && <span className="sr-only">{t("drop.error")}</span>}
        {dragging && (
          <div
            role="presentation"
            className="anim-fade pointer-events-none fixed inset-3 z-30 flex items-center justify-center rounded-panel border-2 border-dashed border-accent bg-bg/90 text-lg font-medium"
          >
            {t("drop.title")}
          </div>
        )}
      </div>
      <SettingsDialog />
      <AboutDialog />
      <WhyDialog />
      <Toaster />
    </TooltipProvider>
  );
}
