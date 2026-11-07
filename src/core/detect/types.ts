export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface OcrWord {
  text: string;
  box: Box;
}

export interface OcrLine {
  words: OcrWord[];
  box: Box;
}

export interface OcrPage {
  width: number;
  height: number;
  lines: OcrLine[];
}

export const CATEGORIES = [
  "cpf",
  "cnpj",
  "document",
  "secret",
  "phone",
  "email",
  "cep",
  "address",
  "pix",
  "card",
  "bank",
  "plate",
  "birthdate",
  "name",
  "ip",
  "credential",
  "url-secret",
  "term",
  "qr",
] as const;

export type Category = (typeof CATEGORIES)[number];
export type Confidence = "high" | "medium";

export interface Detection {
  id: string;
  category: Category;
  confidence: Confidence;
  // Kept in memory only, never logged or persisted.
  text: string;
  boxes: Box[];
  preview: string;
}

export interface Match {
  category: Category;
  confidence: Confidence;
  start: number;
  end: number;
}
