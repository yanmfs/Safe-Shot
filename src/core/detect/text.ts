import type { Box, OcrLine, OcrWord } from "./types";

export interface WordSpan {
  start: number;
  end: number;
  word: OcrWord;
}

export interface LineCtx {
  index: number;
  line: OcrLine;
  text: string;
  // Same length as `text`, with digit look-alikes fixed inside numeric tokens.
  norm: string;
  spans: WordSpan[];
}

const LOOKALIKE: Record<string, string> = {
  O: "0",
  o: "0",
  D: "0",
  I: "1",
  l: "1",
  "|": "1",
  i: "1",
  S: "5",
  B: "8",
};

// OCR reads "0" as "O" and "1" as "l" often; a token that is mostly digits is a number.
export function fixDigitLookalikes(text: string): string {
  return text.replace(/\S+/g, (token) => {
    const alnum = token.replace(/[^\p{L}\p{N}|]/gu, "");
    const digits = (alnum.match(/\d/g) ?? []).length;
    if (digits < 3 || digits / alnum.length < 0.6) return token;
    return [...token].map((c) => LOOKALIKE[c] ?? c).join("");
  });
}

export function buildLine(line: OcrLine, index: number): LineCtx {
  const spans: WordSpan[] = [];
  let text = "";
  for (const word of line.words) {
    if (text !== "") text += " ";
    spans.push({ start: text.length, end: text.length + word.text.length, word });
    text += word.text;
  }
  return { index, line, text, norm: fixDigitLookalikes(text), spans };
}

// Boxes use the line height so redaction bars look uniform, and are padded a little.
export function boxesFor(ctx: LineCtx, start: number, end: number): Box[] {
  const hit = ctx.spans.filter((s) => s.end > start && s.start < end);
  const first = hit[0];
  const last = hit[hit.length - 1];
  if (!first || !last) return [];

  const slice = (s: WordSpan, from: number, to: number) => {
    const len = Math.max(1, s.end - s.start);
    const left = s.word.box.x + (s.word.box.w * (Math.max(from, s.start) - s.start)) / len;
    const right = s.word.box.x + (s.word.box.w * (Math.min(to, s.end) - s.start)) / len;
    return [left, right] as const;
  };
  const [left] = slice(first, start, end);
  const [, right] = slice(last, start, end);
  const { y, h } = ctx.line.box;
  const pad = Math.max(2, h * 0.12);
  return [{ x: left - pad, y: y - pad, w: right - left + pad * 2, h: h + pad * 2 }];
}

export const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) =>
  a.start < b.end && b.start < a.end;

// Per-character so the result has the same length as the input and indexes carry over.
export const fold = (s: string) =>
  Array.from(s, (c) => {
    const base = c.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    return base.length === c.length ? base : c;
  }).join("");
