import { useEffect, useMemo, useRef, useState } from "react";
import type { Box } from "../../core/detect";
import { BAR_RGB } from "../../core/redact";
import { useApp, useT } from "../../store";
import { bitmapToRgba } from "../doc/image";
import { renderMarks } from "../doc/render";
import { CATEGORY_COLOR } from "../categories";
import { activeMarks, useDoc } from "../doc/store";
import { useView } from "./view";

const rectProps = (b: Box) => ({ x: b.x, y: b.y, width: b.w, height: b.h });

const barFill = (color: keyof typeof BAR_RGB) => `rgb(${BAR_RGB[color].join(",")})`;

export function Viewer() {
  const t = useT();
  const doc = useDoc((s) => s.doc);
  const page = useDoc((s) => s.page);
  const detections = useDoc((s) => s.detections);
  const edit = useDoc((s) => s.edit);
  const tool = useDoc((s) => s.tool);
  const selected = useDoc((s) => s.selectedMark);
  const { toggleWordAt, addManual, selectMark } = useDoc.getState();
  const barColor = useApp((s) => s.settings.barColor);
  const redactStyle = useApp((s) => s.settings.redactStyle);
  const { zoom, x, y, fitting } = useView();

  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const [space, setSpace] = useState(false);
  const [alt, setAlt] = useState(false);
  const [draft, setDraft] = useState<Box | null>(null);
  const drag = useRef<{
    kind: "pan" | "draw";
    px: number;
    py: number;
    vx: number;
    vy: number;
  } | null>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const measure = () => {
      useView.getState().setContainer(el.clientWidth, el.clientHeight);
      const { doc: d } = useDoc.getState();
      if (d && useView.getState().fitting) useView.getState().fit(d.width, d.height);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [doc]);

  useEffect(() => {
    if (!doc) return;
    useView.getState().fit(doc.width, doc.height);
    const ctx = canvas.current?.getContext("2d");
    ctx?.drawImage(doc.bitmap, 0, 0);
  }, [doc]);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const view = useView.getState();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        view.zoomTo(view.zoom * Math.exp(-e.deltaY * 0.01), {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      } else {
        view.panTo(view.x - e.deltaX, view.y - e.deltaY);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [doc]);

  useEffect(() => {
    const editable = (e: KeyboardEvent) =>
      e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    const down = (e: KeyboardEvent) => {
      if (e.key === " " && !editable(e)) {
        e.preventDefault();
        setSpace(true);
      }
      if (e.key === "Alt") setAlt(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === " ") setSpace(false);
      if (e.key === "Alt") setAlt(false);
    };
    const blur = () => {
      setSpace(false);
      setAlt(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  // The labelled and smudged styles are drawn by the same code that exports, so the preview is exact.
  const base = useMemo(() => (doc ? bitmapToRgba(doc.bitmap) : null), [doc]);
  useEffect(() => {
    const target = preview.current;
    const ctx = target?.getContext("2d");
    if (!target || !ctx || !base) return;
    const marks = activeMarks(detections, edit, (c) => t(`cat.${c}`).toUpperCase());
    if (redactStyle === "solid" || marks.length === 0) {
      ctx.clearRect(0, 0, target.width, target.height);
      return;
    }
    const frame = requestAnimationFrame(() => {
      const copy = {
        data: new Uint8ClampedArray(base.data),
        width: base.width,
        height: base.height,
      };
      renderMarks(copy, marks, redactStyle, barColor);
      ctx.putImageData(new ImageData(copy.data, copy.width, copy.height), 0, 0);
    });
    return () => cancelAnimationFrame(frame);
  }, [base, detections, edit, redactStyle, barColor, t]);

  const words = useMemo(
    () =>
      (page?.lines ?? []).flatMap((line) => {
        const pad = Math.max(2, line.box.h * 0.12);
        return line.words.map((w, i) => ({
          key: `${line.box.y}:${i}:${w.box.x}`,
          box: {
            x: w.box.x - pad,
            y: line.box.y - pad,
            w: w.box.w + pad * 2,
            h: line.box.h + pad * 2,
          },
        }));
      }),
    [page],
  );

  if (!doc) return null;

  const toImage = (clientX: number, clientY: number) => {
    const rect = container.current?.getBoundingClientRect();
    return {
      x: (clientX - (rect?.left ?? 0) - x) / zoom,
      y: (clientY - (rect?.top ?? 0) - y) / zoom,
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || (e.button === 0 && space)) {
      drag.current = { kind: "pan", px: e.clientX, py: e.clientY, vx: x, vy: y };
    } else if (e.button === 0 && tool === "rect") {
      const p = toImage(e.clientX, e.clientY);
      drag.current = { kind: "draw", px: p.x, py: p.y, vx: 0, vy: 0 };
      setDraft({ x: p.x, y: p.y, w: 0, h: 0 });
    } else {
      return;
    }
    container.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === "pan") {
      useView.getState().panTo(d.vx + e.clientX - d.px, d.vy + e.clientY - d.py);
    } else {
      const p = toImage(e.clientX, e.clientY);
      setDraft({
        x: Math.min(d.px, p.x),
        y: Math.min(d.py, p.y),
        w: Math.abs(p.x - d.px),
        h: Math.abs(p.y - d.py),
      });
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.kind === "draw" && draft && draft.w >= 4 && draft.h >= 4) addManual(draft);
    setDraft(null);
  };

  const off = new Set(edit.off);
  const fill = redactStyle === "solid" ? barFill(barColor) : "none";
  const cursor = space ? "grab" : tool === "rect" ? "crosshair" : "default";

  return (
    <div
      ref={container}
      role="region"
      aria-label={doc.name}
      className="relative min-h-0 flex-1 overflow-hidden bg-surface-2"
      style={{ cursor, touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className={fitting ? "" : "will-change-transform"}
        style={{
          position: "absolute",
          width: doc.width,
          height: doc.height,
          transform: `translate(${x}px, ${y}px) scale(${zoom})`,
          transformOrigin: "0 0",
          boxShadow: "0 2px 18px rgb(0 0 0 / 0.25)",
        }}
      >
        <canvas
          ref={canvas}
          width={doc.width}
          height={doc.height}
          style={{ width: doc.width, height: doc.height, display: "block" }}
        />
        <canvas
          ref={preview}
          width={doc.width}
          height={doc.height}
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            width: doc.width,
            height: doc.height,
            pointerEvents: "none",
            opacity: alt ? 0 : 1,
          }}
        />
        <svg
          viewBox={`0 0 ${doc.width} ${doc.height}`}
          width={doc.width}
          height={doc.height}
          style={{ position: "absolute", inset: 0 }}
        >
          {tool === "select" &&
            !space &&
            words.map((w) => (
              <rect
                key={w.key}
                {...rectProps(w.box)}
                className="word-target"
                fill="transparent"
                onClick={() =>
                  toggleWordAt({ x: w.box.x + w.box.w / 2, y: w.box.y + w.box.h / 2 }, w.box)
                }
              />
            ))}

          {detections.map((d) =>
            d.boxes.map((b, i) => {
              const hidden = !off.has(d.id);
              return (
                <rect
                  key={`${d.id}:${i}`}
                  {...rectProps(b)}
                  rx={2}
                  pointerEvents="none"
                  fill={hidden && !alt ? fill : "none"}
                  stroke={CATEGORY_COLOR[d.category]}
                  strokeWidth={2}
                  strokeDasharray={d.confidence === "medium" || !hidden ? "6 4" : undefined}
                  strokeOpacity={hidden ? 1 : 0.55}
                  vectorEffect="non-scaling-stroke"
                />
              );
            }),
          )}

          {[...edit.words, ...edit.manual].map((m) => (
            <rect
              key={m.id}
              {...rectProps(m.box)}
              rx={2}
              fill={alt ? "none" : fill}
              stroke={selected === m.id ? "#f5b700" : "#6e56cf"}
              strokeWidth={selected === m.id ? 3 : 2}
              vectorEffect="non-scaling-stroke"
              onClick={(e) => {
                e.stopPropagation();
                selectMark(m.id);
              }}
            />
          ))}

          {draft && (
            <rect
              {...rectProps(draft)}
              fill="rgb(245 183 0 / 0.25)"
              stroke="#f5b700"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      </div>
      <span className="sr-only">{t("tool.showOriginal")}</span>
    </div>
  );
}
