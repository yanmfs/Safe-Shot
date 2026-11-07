import {
  entropy,
  isValidCnpj,
  isValidCns,
  isValidCpf,
  isValidDdd,
  isValidPis,
  passesLuhn,
} from "../validate";
import { fold, type LineCtx } from "./text";
import type { Category, Confidence, Match } from "./types";

type Detector = (ctx: LineCtx, all: LineCtx[]) => Match[];

function scan(
  re: RegExp,
  source: string,
  build: (m: RegExpExecArray) => Match | Match[] | null,
): Match[] {
  const out: Match[] = [];
  for (const m of source.matchAll(re)) {
    const built = build(m as RegExpExecArray);
    if (built) out.push(...(Array.isArray(built) ? built : [built]));
  }
  return out;
}

const make = (category: Category, confidence: Confidence, start: number, end: number): Match => ({
  category,
  confidence,
  start,
  end,
});

const digitsOnly = (s: string) => s.replace(/\D/g, "");
const previous = (ctx: LineCtx, all: LineCtx[]) => all[ctx.index - 1];
const hasLetters = (s: string) => /\p{L}/u.test(s);

export const cpf: Detector = ({ norm }) =>
  scan(/(?<!\d)(?:\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11})(?!\d)/g, norm, (m) => {
    const valid = isValidCpf(m[0]);
    const punctuated = m[0].length > 11;
    if (!valid && !punctuated) return null;
    return make("cpf", valid ? "high" : "medium", m.index, m.index + m[0].length);
  });

export const cnpj: Detector = ({ text, norm }) => {
  const pattern =
    /(?<![\p{L}\p{N}])[A-Z0-9]{2}\.?[A-Z0-9]{3}\.?[A-Z0-9]{3}\/?[A-Z0-9]{4}-?\d{2}(?![\p{L}\p{N}])/gu;
  const build = (m: RegExpExecArray) => {
    if (!/\d/.test(m[0])) return null;
    const valid = isValidCnpj(m[0]);
    const punctuated = /\./.test(m[0]) && m[0].includes("/") && m[0].includes("-");
    if (!valid && !punctuated) return null;
    return make("cnpj", valid ? "high" : "medium", m.index, m.index + m[0].length);
  };
  // Letters in an alphanumeric CNPJ must not be rewritten as digits, so check both views.
  return [...scan(pattern, text, build), ...scan(pattern, norm, build)];
};

const DOC_KEYWORDS =
  /\b(?:rg|identidade|registro geral|cnh|habilitacao|titulo de eleitor|passaporte|matricula|nis|pis|pasep|nit|cns|cartao sus)\b/;
const PIS_FAMILY = /\b(?:pis|pasep|nit|nis)\b/;
const CNS_FAMILY = /\b(?:cns|cartao sus)\b/;

export const document: Detector = (ctx, all) => {
  const context = `${fold(ctx.text)} ${fold(previous(ctx, all)?.text ?? "")}`;
  if (!DOC_KEYWORDS.test(context)) return [];
  return scan(/(?<![\w.])\d(?:[.\- ]?\d){6,}[Xx]?(?!\w)/g, ctx.norm, (m) => {
    const before = ctx.norm.slice(Math.max(0, m.index - 3), m.index);
    const after = ctx.norm.slice(m.index + m[0].length, m.index + m[0].length + 3);
    if (/R\$\s?$/.test(before) || /^,\d/.test(after)) return null;
    const digits = digitsOnly(m[0]);
    let confidence: Confidence = "high";
    if (PIS_FAMILY.test(context) && digits.length === 11 && !isValidPis(digits))
      confidence = "medium";
    if (CNS_FAMILY.test(context) && digits.length === 15 && !isValidCns(digits))
      confidence = "medium";
    return make("document", confidence, m.index, m.index + m[0].length);
  });
};

const SECRET_KEYWORD =
  /\b(?:senha|password|pin|codigo de verificacao|codigo de seguranca|token|otp)\b\s*(?::|=|-|\bis\b|\be\b)?\s*([^\s,;]{4,})/dg;

export const secret: Detector = ({ text }) =>
  scan(SECRET_KEYWORD, fold(text), (m) => {
    const range = m.indices?.[1];
    if (!range) return null;
    const token = text.slice(range[0], range[1]);
    const looksLikeSecret =
      /\d/.test(token) ||
      (token.length >= 6 &&
        (/[^\p{L}\p{N}]/u.test(token) || (/\p{Ll}/u.test(token) && /\p{Lu}/u.test(token))));
    return looksLikeSecret ? make("secret", "high", range[0], range[1]) : null;
  });

export const phone: Detector = ({ norm }) => {
  const national = scan(
    /(?<![\d])(?:\+?55[\s-]?)?(?:\(?(\d{2})\)?[\s-]?)?(9?\d{4})([-\s.]?)(\d{4})(?![\d])/g,
    norm,
    (m) => {
      const [, ddd, head, separator, tail] = m;
      const number = `${head}${tail}`;
      if (number.length === 9 ? number[0] !== "9" : !/^[2-5]/.test(number)) return null;
      if (ddd !== undefined) {
        if (!isValidDdd(ddd)) return null;
        return make("phone", "high", m.index, m.index + m[0].length);
      }
      if (separator === "") return null;
      return make("phone", "medium", m.index, m.index + m[0].length);
    },
  );
  const international = scan(
    /(?<![\d+])\+(?!55\b)\d{1,3}[\s-]?(?:[\d()-]\s?){8,14}\d(?!\d)/g,
    norm,
    (m) => make("phone", "high", m.index, m.index + m[0].length),
  );
  return [...national, ...international];
};

export const email: Detector = ({ text }) =>
  scan(/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu, text, (m) =>
    make("email", "high", m.index, m.index + m[0].length),
  );

export const cep: Detector = ({ text, norm }) => [
  ...scan(/(?<!\d)\d{5}-\d{3}(?!\d)/g, norm, (m) =>
    make("cep", "high", m.index, m.index + m[0].length),
  ),
  ...(/\bcep\b/.test(fold(text))
    ? scan(/(?<![\d-])\d{8}(?![\d-])/g, norm, (m) => make("cep", "high", m.index, m.index + 8))
    : []),
];

const STREET_WORDS =
  /(?<![\p{L}\p{N}])(?:rua|r\.|av\.?|avenida|travessa|tv\.|alameda|rodovia|estrada|pra[cç]a|quadra|qd\.?|lote|lt\.?|setor|bairro|apto\.?|apartamento|bloco|condom[ií]nio|n[º°])\s+(\S)/giu;

export const address: Detector = ({ text }) => {
  const found = scan(STREET_WORDS, text, (m) =>
    /^[\p{Lu}\d]/u.test(m[1] ?? "") ? make("address", "medium", 0, text.length) : null,
  );
  return found.slice(0, 1);
};

const UUID_V4 =
  /(?<![0-9a-f-])[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?![0-9a-f-])/gi;
const PIX_MARKER = /br\.gov\.bcb\.pix|^000201/i;

function isPixToken(token: string) {
  return token.length >= 20 && PIX_MARKER.test(token);
}

const isLongWord = (line: LineCtx) => !line.text.includes(" ") && line.text.length >= 25;

function continuesPixPayload(ctx: LineCtx, all: LineCtx[]): boolean {
  if (!isLongWord(ctx)) return false;
  for (let i = ctx.index - 1; i >= 0; i--) {
    const line = all[i];
    if (!line) return false;
    if (line.text.split(" ").some(isPixToken)) return true;
    if (!isLongWord(line)) return false;
  }
  return false;
}

export const pix: Detector = (ctx, all) => {
  const key = scan(UUID_V4, ctx.text, (m) => make("pix", "high", m.index, m.index + m[0].length));
  const payload = scan(/\S{20,}/g, ctx.text, (m) =>
    isPixToken(m[0]) ? make("pix", "high", m.index, m.index + m[0].length) : null,
  );
  const continuation = continuesPixPayload(ctx, all)
    ? [make("pix", "high", 0, ctx.text.length)]
    : [];
  return [...key, ...payload, ...continuation];
};

export const card: Detector = ({ text, norm }) => {
  const full = scan(/(?<!\d)\d(?:[ -]?\d){12,18}(?!\d)/g, norm, (m) =>
    passesLuhn(m[0]) ? make("card", "high", m.index, m.index + m[0].length) : null,
  );
  const folded = fold(text);
  const last4 = /cart/.test(folded)
    ? scan(/\bfinal\s*(\d{4})\b/dg, folded, (m) => {
        const range = m.indices?.[1];
        return range ? make("card", "medium", range[0], range[1]) : null;
      })
    : [];
  return [...full, ...last4];
};

const BANK_KEYWORD =
  /(?<![a-z])(?:agencia|ag|conta corrente|conta poupanca|conta|c\/c|poupanca)\b\.?\s*(?:n[o°º]\.?)?\s*[:.-]?\s*(\d[\d.]*(?:\s?-\s?[\dx])?)/dg;

export const bank: Detector = ({ norm }) =>
  scan(BANK_KEYWORD, fold(norm), (m) => {
    const range = m.indices?.[1];
    if (!range || digitsOnly(m[1] ?? "").length < 2) return null;
    return make("bank", "high", range[0], range[1]);
  });

const NOT_PLATE = new Set([
  "CPF",
  "CEP",
  "CNH",
  "RGP",
  "PIS",
  "NIS",
  "CNS",
  "NIT",
  "TEL",
  "FAX",
  "PIX",
]);

export const plate: Detector = ({ text }) =>
  scan(/(?<![A-Za-z0-9])([A-Z]{3})(?:-?\d{4}|\d[A-Z]\d{2})(?![A-Za-z0-9])/g, text, (m) =>
    NOT_PLATE.has(m[1] ?? "") ? null : make("plate", "medium", m.index, m.index + m[0].length),
  );

const DATE =
  /(?<!\d)\d{1,2}[/.-]\d{1,2}[/.-](?:\d{4}|\d{2})(?!\d)|(?<!\d)\d{1,2}\s+de\s+[a-zç]+\s+de\s+\d{4}/gi;

export const birthdate: Detector = ({ text, norm }) =>
  /nascimento|nasc\b|\bdn\b|nascid[oa]/.test(fold(text))
    ? scan(DATE, norm, (m) => make("birthdate", "high", m.index, m.index + m[0].length))
    : [];

export const name: Detector = ({ text }) =>
  scan(
    /(?:nome(?:\s+completo|\s+social)?|titular|paciente|alun[oa])\s*:\s*(\S.*)$/dgiu,
    text,
    (m) => {
      const range = m.indices?.[1];
      return range && hasLetters(text.slice(range[0], range[1]))
        ? make("name", "medium", range[0], range[1])
        : null;
    },
  );

// Plain clock times (12:30:45) have the right shape, so require a hex letter or "::".
function isIpv6(candidate: string): boolean {
  const compressed = candidate.split("::");
  if (compressed.length > 2) return false;
  const groups = candidate.split(":").filter((g) => g !== "");
  if (groups.some((g) => !/^[0-9a-f]{1,4}$/i.test(g))) return false;
  if (compressed.length === 2) return groups.length <= 7;
  return (
    groups.length === 8 ||
    (/[a-f]/i.test(candidate) &&
      groups.length >= 3 &&
      candidate.split(":").length === groups.length)
  );
}

export const ip: Detector = ({ text }) => {
  const v4 = scan(
    /(?<![\d.])(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?![\d.])/g,
    text,
    (m) => make("ip", "medium", m.index, m.index + m[0].length),
  );
  const v6 = scan(/(?<![\w:])[0-9a-f:]{3,39}(?![\w:])/gi, text, (m) =>
    isIpv6(m[0]) ? make("ip", "medium", m.index, m.index + m[0].length) : null,
  );
  return [...v4, ...v6];
};

const CREDENTIAL_PREFIXES = new RegExp(
  [
    "sk-[A-Za-z0-9_-]{16,}",
    "(?:sk|pk)_live_[A-Za-z0-9]{8,}",
    "gh[po]_[A-Za-z0-9]{20,}",
    "github_pat_[A-Za-z0-9_]{20,}",
    "xox[baprs]-[A-Za-z0-9-]{10,}",
    "AKIA[0-9A-Z]{16}",
    "AIza[0-9A-Za-z_-]{35}",
    "eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+",
  ].join("|"),
  "g",
);

function classCount(token: string) {
  return [/[a-z]/, /[A-Z]/, /\d/, /[_\-+/=]/].filter((re) => re.test(token)).length;
}

export const credential: Detector = ({ text }) => {
  const known = scan(CREDENTIAL_PREFIXES, text, (m) =>
    make("credential", "high", m.index, m.index + m[0].length),
  );
  const random = scan(/\S+/g, text, (m) => {
    const token = m[0];
    if (!/^[A-Za-z0-9_\-+/=]{32,}$/.test(token) || isPixToken(token)) return null;
    if (entropy(token) <= 3.5 || classCount(token) < 3) return null;
    return make("credential", "medium", m.index, m.index + token.length);
  });
  return [...known, ...random];
};

export const urlSecret: Detector = ({ text }) =>
  scan(/\S*[?&](?:token|key|access_token|code|sig|api_key|apikey)=\S+/gi, text, (m) =>
    make("url-secret", "high", m.index, m.index + m[0].length),
  );

export const detectors: Detector[] = [
  cpf,
  cnpj,
  document,
  secret,
  phone,
  email,
  cep,
  address,
  pix,
  card,
  bank,
  plate,
  birthdate,
  name,
  ip,
  credential,
  urlSecret,
];
