import { create } from "zustand";

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;
const clamp = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

interface ViewState {
  zoom: number;
  x: number;
  y: number;
  fitting: boolean;
  width: number;
  height: number;
  setContainer: (width: number, height: number) => void;
  fit: (imageW: number, imageH: number) => void;
  zoomTo: (zoom: number, anchor?: { x: number; y: number }) => void;
  panTo: (x: number, y: number) => void;
}

export const useView = create<ViewState>((set, get) => ({
  zoom: 1,
  x: 0,
  y: 0,
  fitting: true,
  width: 0,
  height: 0,

  setContainer: (width, height) => set({ width, height }),

  fit: (imageW, imageH) => {
    const { width, height } = get();
    if (width === 0 || height === 0) return;
    const zoom = clamp(Math.min(1, (width - 32) / imageW, (height - 32) / imageH));
    set({ zoom, x: (width - imageW * zoom) / 2, y: (height - imageH * zoom) / 2, fitting: true });
  },

  // Keeps the point under the cursor (or the centre) fixed while the scale changes.
  zoomTo: (target, anchor) => {
    const { zoom, x, y, width, height } = get();
    const next = clamp(target);
    const ax = anchor?.x ?? width / 2;
    const ay = anchor?.y ?? height / 2;
    const ratio = next / zoom;
    set({ zoom: next, x: ax - (ax - x) * ratio, y: ay - (ay - y) * ratio, fitting: false });
  },

  panTo: (x, y) => set({ x, y, fitting: false }),
}));
