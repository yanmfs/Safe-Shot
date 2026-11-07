import type { Category } from "../core/detect";

// One hue per family so the legend stays readable; the list also shows the name, never just colour.
export const CATEGORY_COLOR: Record<Category, string> = {
  cpf: "#e5484d",
  cnpj: "#e5484d",
  document: "#e5484d",
  secret: "#ab4aba",
  credential: "#ab4aba",
  "url-secret": "#ab4aba",
  phone: "#3e63dd",
  email: "#3e63dd",
  cep: "#12a594",
  address: "#12a594",
  pix: "#d6409f",
  card: "#d6409f",
  bank: "#d6409f",
  plate: "#f76b15",
  birthdate: "#f76b15",
  name: "#8d6e63",
  ip: "#2a7e9e",
  term: "#6e56cf",
  qr: "#6e56cf",
};
