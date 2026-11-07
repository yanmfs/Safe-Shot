import { detectors } from "./detectors";
import { boxesFor, buildLine, overlaps, type LineCtx } from "./text";
import type { Category, Detection, Match, OcrPage } from "./types";

export type { Box, Category, Confidence, Detection, OcrLine, OcrPage, OcrWord } from "./types";
export { CATEGORIES } from "./types";

// When two detectors claim the same text, the earlier category in this list wins.
const PRIORITY: Category[] = [
  "cpf",
  "cnpj",
  "card",
  "pix",
  "credential",
  "url-secret",
  "phone",
  "document",
  "bank",
  "secret",
  "birthdate",
  "email",
  "cep",
  "ip",
  "plate",
  "term",
  "qr",
  "name",
  "address",
];

// Whole-line categories overlap everything by design and must not hide the specific match.
const NON_EXCLUSIVE = new Set<Category>(["address", "name"]);

function resolve(lines: { ctx: LineCtx; match: Match }[]): { ctx: LineCtx; match: Match }[] {
  const ranked = [...lines].sort((a, b) => {
    if (a.match.confidence !== b.match.confidence) return a.match.confidence === "high" ? -1 : 1;
    const byPriority = PRIORITY.indexOf(a.match.category) - PRIORITY.indexOf(b.match.category);
    if (byPriority !== 0) return byPriority;
    return b.match.end - b.match.start - (a.match.end - a.match.start);
  });
  const kept: typeof lines = [];
  for (const candidate of ranked) {
    const exclusive = !NON_EXCLUSIVE.has(candidate.match.category);
    const clash = kept.some(
      (k) =>
        k.ctx.index === candidate.ctx.index &&
        exclusive &&
        !NON_EXCLUSIVE.has(k.match.category) &&
        overlaps(k.match, candidate.match),
    );
    if (!clash) kept.push(candidate);
  }
  return kept;
}

const MASK = "•";

// Keeps just enough of the value to recognise it in the list, never the whole thing.
export function maskPreview(text: string): string {
  const chars = [...text];
  const alnum = chars.filter((c) => /[\p{L}\p{N}]/u.test(c)).length;
  if (alnum <= 3) return chars.map((c) => (/[\p{L}\p{N}]/u.test(c) ? MASK : c)).join("");
  const head = alnum >= 9 ? 3 : 1;
  const tail = alnum >= 9 ? 2 : 0;
  let seen = 0;
  return chars
    .map((c) => {
      if (!/[\p{L}\p{N}]/u.test(c)) return c;
      seen++;
      return seen <= head || seen > alnum - tail ? c : MASK;
    })
    .join("");
}

function maskEmail(text: string): string {
  const at = text.indexOf("@");
  return at <= 0 ? maskPreview(text) : `${text[0]}${MASK.repeat(3)}${text.slice(at)}`;
}

function preview(category: Category, text: string): string {
  if (category === "email") return maskEmail(text);
  if (category === "address") return `${text.split(/\s+/)[0] ?? ""} ${MASK.repeat(3)}`;
  return maskPreview(text);
}

export function detect(page: OcrPage): Detection[] {
  const all = page.lines.filter((l) => l.words.length > 0).map(buildLine);

  const matches = all.flatMap((ctx) =>
    detectors.flatMap((run) => run(ctx, all).map((match) => ({ ctx, match }))),
  );

  return resolve(matches)
    .sort((a, b) => a.ctx.index - b.ctx.index || a.match.start - b.match.start)
    .map(({ ctx, match }) => {
      const text = ctx.text.slice(match.start, match.end);
      return {
        id: `${match.category}:${ctx.index}:${match.start}`,
        category: match.category,
        confidence: match.confidence,
        text,
        boxes: boxesFor(ctx, match.start, match.end),
        preview: preview(match.category, text),
      };
    })
    .filter((d) => d.boxes.length > 0);
}
