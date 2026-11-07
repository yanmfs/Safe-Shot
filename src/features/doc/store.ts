import { create } from "zustand";
import { detect, type Box, type Category, type Detection, type OcrPage } from "../../core/detect";
import { advance, startQueue, type Queue } from "../../core/queue";
import type { Mark as RedactMark } from "../../core/redact";
import { getOcrEngine } from "../../ocr/engine";
import { codeDetections, findCodes, loadBundledWasm } from "../../ocr/qr";
import type { LoadedImage } from "../../platform";
import { tNow, useApp } from "../../store";
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
  codes: Box[];
  detections: Detection[];
  edit: Edit;
  past: Edit[];
  future: Edit[];
  tool: Tool;
  selectedMark: string | null;
  queue: Queue<LoadedImage> | null;
  open: (image: LoadedImage, keepQueue?: boolean) => Promise<void>;
  openMany: (images: LoadedImage[]) => Promise<void>;
  nextInQueue: () => Promise<void>;
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

let wasmReady: Promise<unknown> | undefined;

async function readCodes(image: ReturnType<typeof bitmapToRgba>): Promise<Box[]> {
  try {
    await (wasmReady ??= loadBundledWasm());
    return await findCodes(image);
  } catch {
    return [];
  }
}

const merge = (page: OcrPage, codes: Box[]): Detection[] => [
  ...detect(page, { terms: useApp.getState().settings.terms }),
  ...codeDetections(codes, tNow("cat.qr")),
];

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
    codes: [],
    detections: [],
    edit: emptyEdit,
    past: [],
    future: [],
    tool: "select",
    selectedMark: null,
    queue: null,

    openMany: async (images) => {
      const started = startQueue(images);
      if (!started) return;
      await get().open(started.first, true);
      set({ queue: started.queue.total > 1 ? started.queue : null });
    },

    nextInQueue: async () => {
      const { queue } = get();
      const step = queue ? advance(queue) : null;
      if (!step) return;
      set({ queue: step.queue });
      await get().open(step.next, true);
    },

    open: async (image, keepQueue = false) => {
      if (!keepQueue) set({ queue: null });
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
        codes: [],
        detections: [],
        edit: emptyEdit,
        past: [],
        future: [],
        selectedMark: null,
        status: "reading",
      });
      const rgba = bitmapToRgba(bitmap);
      // A code is found from pixels, so it still works when the text reading fails.
      const codes = await readCodes(rgba);
      set({ codes, detections: codeDetections(codes, tNow("cat.qr")) });
      try {
        const page = await getOcrEngine().recognize(rgba, (progress) => set({ progress }));
        set({ page, detections: merge(page, codes), status: "ready" });
      } catch {
        set({ status: "ready", ocrFailed: true });
      }
    },

    reset: () => {
      get().doc?.bitmap.close();
      set({
        queue: null,
        status: "empty",
        doc: null,
        page: null,
        codes: [],
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
      if (page) set({ detections: merge(page, get().codes) });
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

// What gets hidden, with the name of the data for labelled bars. Hand-drawn areas have no name.
export function activeMarks(
  detections: Detection[],
  edit: Edit,
  nameOf: (category: Category) => string,
): RedactMark[] {
  const off = new Set(edit.off);
  return [
    ...detections
      .filter((d) => !off.has(d.id))
      .flatMap((d) => d.boxes.map((rect) => ({ rect, label: nameOf(d.category) }))),
    ...edit.words.map((w) => ({ rect: w.box })),
    ...edit.manual.map((m) => ({ rect: m.box })),
  ];
}
