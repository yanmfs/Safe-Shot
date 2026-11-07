import { fold, type LineCtx } from "./text";
import type { Match } from "./types";

function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0] ?? 0;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = prev[j] ?? 0;
      prev[j] = Math.min(
        above + 1,
        (prev[j - 1] ?? 0) + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return prev[b.length] ?? 2;
}

const strip = (s: string) => s.replace(/[^\p{L}\p{N}]/gu, "");

// Compares without accents or case. Single words of 5+ letters tolerate one OCR mistake.
export function termMatches(ctx: LineCtx, terms: string[]): Match[] {
  const out: Match[] = [];
  const text = fold(ctx.text);
  for (const raw of terms) {
    const term = fold(raw.trim());
    if (term.length < 2) continue;
    if (/\s/.test(term)) {
      for (
        let from = text.indexOf(term);
        from >= 0;
        from = text.indexOf(term, from + term.length)
      ) {
        out.push({ category: "term", confidence: "high", start: from, end: from + term.length });
      }
      continue;
    }
    const wanted = strip(term);
    for (const span of ctx.spans) {
      const word = strip(fold(span.word.text));
      const hit =
        word === wanted || (wanted.length >= 5 && word.length >= 4 && distance(word, wanted) <= 1);
      if (hit) out.push({ category: "term", confidence: "high", start: span.start, end: span.end });
    }
  }
  return out;
}
