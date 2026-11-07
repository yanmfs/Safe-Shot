import {
  BAR_RGB,
  paintStyled,
  type BarColor,
  type Mark,
  type RedactStyle,
  type Rgba,
} from "../../core/redact";

const FONT = '600 {size}px "Hanken Grotesk", system-ui, sans-serif';

// Lettering colour on a bar: white on dark bars, black on light ones.
export function inkFor(color: BarColor): readonly [number, number, number] {
  const [r, g, b] = BAR_RGB[color];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 110 ? [255, 255, 255] : [0, 0, 0];
}

function drawLabels(image: Rgba, marks: Mark[], color: BarColor) {
  const canvas = new OffscreenCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  ctx.putImageData(
    new ImageData(new Uint8ClampedArray(image.data), image.width, image.height),
    0,
    0,
  );
  const [r, g, b] = inkFor(color);
  ctx.fillStyle = `rgb(${r} ${g} ${b})`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const { rect, label } of marks) {
    if (!label) continue;
    // Big enough to read, small enough to sit inside the bar with room around it.
    let size = Math.min(26, Math.max(9, Math.round(rect.h * 0.52)));
    ctx.font = FONT.replace("{size}", String(size));
    while (size > 8 && ctx.measureText(label).width > rect.w - 10) {
      size -= 1;
      ctx.font = FONT.replace("{size}", String(size));
    }
    if (ctx.measureText(label).width > rect.w - 6 || rect.h < size + 4) continue;
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + size * 0.04);
  }
  image.data.set(ctx.getImageData(0, 0, image.width, image.height).data);
}

// Paints the marks in the chosen style. The editor preview and the exported file both come from here,
// so what is on screen is what gets saved.
export function renderMarks(image: Rgba, marks: Mark[], style: RedactStyle, color: BarColor): void {
  paintStyled(image, marks, style, color);
  if (style === "label") drawLabels(image, marks, color);
}
