import { Maximize, MousePointer2, Redo2, Square, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "../../components/Button";
import { Tooltip } from "../../components/Tooltip";
import { modKeyLabel } from "../../core/os";
import type { BarColor } from "../../core/redact";
import { platform } from "../../platform";
import { useApp, useT } from "../../store";
import { useDoc } from "../doc/store";
import { useView } from "../viewer/view";

const BAR_COLORS: BarColor[] = ["black", "white", "gray"];
const SWATCH: Record<BarColor, string> = { black: "#000", white: "#fff", gray: "#808080" };

export function Toolbar() {
  const t = useT();
  const mod = modKeyLabel(platform.os);
  const tool = useDoc((s) => s.tool);
  const canUndo = useDoc((s) => s.past.length > 0);
  const canRedo = useDoc((s) => s.future.length > 0);
  const doc = useDoc((s) => s.doc);
  const zoom = useView((s) => s.zoom);
  const barColor = useApp((s) => s.settings.barColor);
  const update = useApp((s) => s.update);
  const setDialog = useApp((s) => s.setDialog);
  const { setTool, undo, redo } = useDoc.getState();
  const view = useView.getState();

  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-3">
      <div className="flex items-center gap-1">
        <Tooltip label={t("tool.select")} hint="V">
          <Button
            variant={tool === "select" ? "subtle" : "ghost"}
            icon
            aria-pressed={tool === "select"}
            aria-label={t("tool.select")}
            onClick={() => setTool("select")}
          >
            <MousePointer2 className="size-4" aria-hidden />
          </Button>
        </Tooltip>
        <Tooltip label={t("tool.rect")} hint="R">
          <Button
            variant={tool === "rect" ? "subtle" : "ghost"}
            icon
            aria-pressed={tool === "rect"}
            aria-label={t("tool.rect")}
            onClick={() => setTool("rect")}
          >
            <Square className="size-4" aria-hidden />
          </Button>
        </Tooltip>
        <span aria-hidden className="mx-1 h-5 w-px bg-border" />
        <Tooltip label={t("tool.undo")} hint={`${mod}+Z`}>
          <Button
            variant="ghost"
            icon
            disabled={!canUndo}
            aria-label={t("tool.undo")}
            onClick={undo}
          >
            <Undo2 className="size-4" aria-hidden />
          </Button>
        </Tooltip>
        <Tooltip label={t("tool.redo")} hint={`${mod}+Shift+Z`}>
          <Button
            variant="ghost"
            icon
            disabled={!canRedo}
            aria-label={t("tool.redo")}
            onClick={redo}
          >
            <Redo2 className="size-4" aria-hidden />
          </Button>
        </Tooltip>
      </div>

      <div className="flex items-center gap-1">
        <Tooltip label={t("tool.zoomOut")}>
          <Button
            variant="ghost"
            icon
            aria-label={t("tool.zoomOut")}
            onClick={() => view.zoomTo(zoom / 1.25)}
          >
            <ZoomOut className="size-4" aria-hidden />
          </Button>
        </Tooltip>
        <Tooltip label={t("tool.actual")} hint={`${mod}+1`}>
          <button
            type="button"
            className="h-8 min-w-14 rounded-control px-2 text-sm tabular-nums text-muted hover:bg-surface-2"
            onClick={() => view.zoomTo(1)}
          >
            {Math.round(zoom * 100)}%
          </button>
        </Tooltip>
        <Tooltip label={t("tool.zoomIn")}>
          <Button
            variant="ghost"
            icon
            aria-label={t("tool.zoomIn")}
            onClick={() => view.zoomTo(zoom * 1.25)}
          >
            <ZoomIn className="size-4" aria-hidden />
          </Button>
        </Tooltip>
        <Tooltip label={t("tool.fit")} hint={`${mod}+0`}>
          <Button
            variant="ghost"
            icon
            aria-label={t("tool.fit")}
            onClick={() => doc && view.fit(doc.width, doc.height)}
          >
            <Maximize className="size-4" aria-hidden />
          </Button>
        </Tooltip>
      </div>

      <div className="flex items-center gap-3">
        <div role="group" aria-label={t("bar.label")} className="flex items-center gap-1">
          {BAR_COLORS.map((color) => (
            <Tooltip key={color} label={t(`bar.${color}`)}>
              <button
                type="button"
                aria-pressed={barColor === color}
                aria-label={t(`bar.${color}`)}
                onClick={() => update({ barColor: color })}
                className={`flex size-8 items-center justify-center rounded-control ${barColor === color ? "bg-surface-2" : "hover:bg-surface-2"}`}
              >
                <span
                  className="size-4 rounded-sm border border-border"
                  style={{ background: SWATCH[color] }}
                />
              </button>
            </Tooltip>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setDialog("whyOpen", true)}
          className="hidden text-xs text-accent-text underline-offset-2 hover:underline min-[1100px]:inline"
        >
          {t("bar.why")}
        </button>
      </div>
    </div>
  );
}
