import { create } from "zustand";
import { detect, type Box, type Category, type Detection, type OcrPage } from "../../core/detect";
import type { Rect } from "../../core/redact";
import { getOcrEngine } from "../../ocr/engine";
import type { LoadedImage } from "../../platform";
import { useApp } from "../../store";
import { bitmapToRgba, decodeImage } from "./image";

export interface Mark {
  id: string;
  box: Box;
}

export interface Edit {
  off: string[];
  words: Mark[];
  manual: Mark[];
}

export interface Doc {
  name: string;
  path?: string;
  width: number;
  height: number;
  bitmap: ImageBitmap;
}

export type Tool = "select" | "rect";
type Status = "empty" | "decoding" | "reading" | "ready";

const emptyEdit: Edit = { off: [], words: [], manual: [] };
const HISTORY_LIMIT = 100;

interface DocState {
  status: Status;
  progress: number;
  ocrFailed: boolean;
  openFailed: boolean;
  doc: Doc | null;
  page: OcrPage | null;
  detections: Detection[];
  edit: Edit;
  past: Edit[];
  future: Edit[];
  tool: Tool;
  selectedMark: string | null;
  open: (image: LoadedImage) => Promise<void>;
  reset: () => void;
  setTool: (tool: Tool) => void;
  redetect: () => void;
  selectMark: (id: string | null) => void;
  toggleDetection: (id: string) => void;
  toggleCategory: (category: Category, hidden: boolean) => void;
  toggleWordAt: (point: { x: number; y: number }, box: Box) => void;
  addManual: (box: Box) => void;
  removeMark: (id: string) => void;
  undo: () => void;
  redo: () => void;
}

const contains = (box: Box, p: { x: number; y: number }) =>
  p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h;

export const useDoc = create<DocState>((set, get) => {
  const commit = (edit: Edit) =>
    set((s) => ({ edit, past: [...s.past.slice(-HISTORY_LIMIT + 1), s.edit], future: [] }));

  return {
    status: "empty",
    progress: 0,
    ocrFailed: false,
    openFailed: false,
    doc: null,
    page: null,
    detections: [],
    edit: emptyEdit,
    past: [],
    future: [],
    tool: "select",
    selectedMark: null,

    open: async (image) => {
      get().doc?.bitmap.close();
      set({ status: "decoding", progress: 0, ocrFailed: false, openFailed: false });
      let bitmap: ImageBitmap;
      try {
        bitmap = await decodeImage(image.bytes);
      } catch {
        set({ status: get().doc ? "ready" : "empty", openFailed: true });
        return;
      }
      set({
        doc: {
          name: image.name,
          path: image.path,
          width: bitmap.width,
          height: bitmap.height,
          bitmap,
        },
        page: null,
        detections: [],
        edit: emptyEdit,
        past: [],
        future: [],
        selectedMark: null,
        status: "reading",
      });
      try {
        const page = await getOcrEngine().recognize(bitmapToRgba(bitmap), (progress) =>
          set({ progress }),
        );
        set({
          page,
          detections: detect(page, { terms: useApp.getState().settings.terms }),
          status: "ready",
        });
      } catch {
        set({ status: "ready", ocrFailed: true });
      }
    },

    reset: () => {
      get().doc?.bitmap.close();
      set({
        status: "empty",
        doc: null,
        page: null,
        detections: [],
        edit: emptyEdit,
        past: [],
        future: [],
        ocrFailed: false,
      });
    },

    setTool: (tool) => set({ tool, selectedMark: null }),
    redetect: () => {
      const { page } = get();
      if (page) set({ detections: detect(page, { terms: useApp.getState().settings.terms }) });
    },
    selectMark: (selectedMark) => set({ selectedMark }),

    toggleDetection: (id) => {
      const { off } = get().edit;
      commit({ ...get().edit, off: off.includes(id) ? off.filter((o) => o !== id) : [...off, id] });
    },

    toggleCategory: (category, hidden) => {
      const ids = get()
        .detections.filter((d) => d.category === category)
        .map((d) => d.id);
      const rest = get().edit.off.filter((id) => !ids.includes(id));
      commit({ ...get().edit, off: hidden ? rest : [...rest, ...ids] });
    },

    toggleWordAt: (point, box) => {
      const { edit, detections } = get();
      const mark = edit.words.find((w) => contains(w.box, point));
      if (mark) return commit({ ...edit, words: edit.words.filter((w) => w.id !== mark.id) });

      const found = detections.find((d) => d.boxes.some((b) => contains(b, point)));
      if (found) {
        const off = edit.off.includes(found.id)
          ? edit.off.filter((id) => id !== found.id)
          : [...edit.off, found.id];
        return commit({ ...edit, off });
      }
      commit({ ...edit, words: [...edit.words, { id: crypto.randomUUID(), box }] });
    },

    addManual: (box) => {
      const mark = { id: crypto.randomUUID(), box };
      commit({ ...get().edit, manual: [...get().edit.manual, mark] });
      set({ selectedMark: mark.id });
    },

    removeMark: (id) => {
      const { edit } = get();
      commit({
        ...edit,
        words: edit.words.filter((m) => m.id !== id),
        manual: edit.manual.filter((m) => m.id !== id),
      });
      set({ selectedMark: null });
    },

    undo: () => {
      const { past, edit, future } = get();
      const previous = past[past.length - 1];
      if (previous) set({ edit: previous, past: past.slice(0, -1), future: [edit, ...future] });
    },

    redo: () => {
      const { past, edit, future } = get();
      const next = future[0];
      if (next) set({ edit: next, past: [...past, edit], future: future.slice(1) });
    },
  };
});

export function activeRects(detections: Detection[], edit: Edit): Rect[] {
  const off = new Set(edit.off);
  return [
    ...detections.filter((d) => !off.has(d.id)).flatMap((d) => d.boxes),
    ...edit.words.map((w) => w.box),
    ...edit.manual.map((m) => m.box),
  ];
}
