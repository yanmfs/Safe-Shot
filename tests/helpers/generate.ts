// Fictional but checksum-valid documents. Nothing here belongs to a real person.
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const digits = (next: () => number, n: number) =>
  Array.from({ length: n }, () => Math.floor(next() * 10));

const dv11 = (nums: number[], weights: number[]) => {
  const rest = nums.reduce((a, d, i) => a + d * weights[i]!, 0) % 11;
  return rest < 2 ? 0 : 11 - rest;
};

export function makeCpf(seed: number, punctuated = true): string {
  const next = rng(seed);
  let base = digits(next, 9);
  while (new Set(base).size === 1) base = digits(next, 9);
  const d1 = dv11(base, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv11([...base, d1], [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const all = [...base, d1, d2].join("");
  return punctuated
    ? `${all.slice(0, 3)}.${all.slice(3, 6)}.${all.slice(6, 9)}-${all.slice(9)}`
    : all;
}

const W1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const W2 = [6, ...W1];

export function makeCnpj(seed: number, punctuated = true): string {
  const next = rng(seed);
  const base = [...digits(next, 8), 0, 0, 0, 1];
  const d1 = dv11(base, W1);
  const d2 = dv11([...base, d1], W2);
  const all = [...base, d1, d2].join("");
  return punctuated
    ? `${all.slice(0, 2)}.${all.slice(2, 5)}.${all.slice(5, 8)}/${all.slice(8, 12)}-${all.slice(12)}`
    : all;
}

export function makePis(seed: number): string {
  const nums = digits(rng(seed), 10);
  const dv = 11 - (nums.reduce((a, d, i) => a + d * [3, 2, 9, 8, 7, 6, 5, 4, 3, 2][i]!, 0) % 11);
  return [...nums, dv >= 10 ? 0 : dv].join("");
}

export function makeCns(seed: number): string {
  const next = rng(seed);
  for (;;) {
    const nums = digits(next, 14);
    const partial = nums.reduce((a, d, i) => a + d * (15 - i), 0);
    for (let last = 0; last < 10; last++) {
      if ((partial + last) % 11 === 0) return [...nums, last].join("");
    }
  }
}

export function makeCard(seed: number, spaced = true): string {
  const nums = [4, ...digits(rng(seed), 14)];
  let sum = 0;
  [...nums].reverse().forEach((n, i) => {
    let v = n;
    if (i % 2 === 0) {
      v *= 2;
      if (v > 9) v -= 9;
    }
    sum += v;
  });
  const all = [...nums, (10 - (sum % 10)) % 10].join("");
  return spaced ? all.replace(/(\d{4})(?=\d)/g, "$1 ") : all;
}
