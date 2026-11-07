const digitsOf = (value: string) => value.replace(/\D/g, "");

function mod11Digit(sum: number): number {
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

function weighted(digits: number[], weights: number[]): number {
  return digits.reduce((acc, d, i) => acc + d * (weights[i] ?? 0), 0);
}

export function isValidCpf(value: string): boolean {
  const d = digitsOf(value);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const nums = [...d].map(Number);
  const first = mod11Digit(weighted(nums.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]));
  const second = mod11Digit(weighted(nums.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]));
  return first === nums[9] && second === nums[10];
}

const CNPJ_W1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_W2 = [6, ...CNPJ_W1];

// Letters count as their ASCII code minus 48, which is how the alphanumeric CNPJ is defined.
export function isValidCnpj(value: string): boolean {
  const chars = value.replace(/[.\-/\s]/g, "").toUpperCase();
  if (!/^[0-9A-Z]{12}\d{2}$/.test(chars) || /^(\d)\1+$/.test(chars)) return false;
  const nums = [...chars].map((c) => c.charCodeAt(0) - 48);
  const first = mod11Digit(weighted(nums.slice(0, 12), CNPJ_W1));
  const second = mod11Digit(weighted(nums.slice(0, 13), CNPJ_W2));
  return first === nums[12] && second === nums[13];
}

export function isValidPis(value: string): boolean {
  const d = digitsOf(value);
  if (d.length !== 11) return false;
  const nums = [...d].map(Number);
  const dv = 11 - (weighted(nums.slice(0, 10), [3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) % 11);
  return (dv >= 10 ? 0 : dv) === nums[10];
}

export function isValidCns(value: string): boolean {
  const d = digitsOf(value);
  if (d.length !== 15) return false;
  const sum = [...d].reduce((acc, c, i) => acc + Number(c) * (15 - i), 0);
  return sum % 11 === 0;
}

export function passesLuhn(value: string): boolean {
  const d = digitsOf(value);
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  [...d].reverse().forEach((c, i) => {
    let n = Number(c);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  });
  return sum % 10 === 0;
}

const DDD = new Set(
  [
    ...range(11, 19),
    21,
    22,
    24,
    27,
    28,
    ...range(31, 35),
    37,
    38,
    ...range(41, 49),
    51,
    ...range(53, 55),
    ...range(61, 69),
    71,
    73,
    74,
    75,
    77,
    79,
    ...range(81, 89),
    ...range(91, 99),
  ].map(String),
);

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

export const isValidDdd = (ddd: string) => DDD.has(ddd);

// Shannon entropy in bits per character.
export function entropy(value: string): number {
  const counts = new Map<string, number>();
  for (const c of value) counts.set(c, (counts.get(c) ?? 0) + 1);
  let bits = 0;
  for (const n of counts.values()) {
    const p = n / value.length;
    bits -= p * Math.log2(p);
  }
  return bits;
}
