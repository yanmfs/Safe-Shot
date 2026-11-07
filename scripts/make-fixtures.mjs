// Renders fictional screens to PNG for the OCR recall test. All data is generated.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { makeCard, makeCnpj, makeCpf } from "../tests/helpers/generate.ts";

const out = "tests/fixtures/shots";
mkdirSync(out, { recursive: true });

const cpf = makeCpf(11);
const cpf2 = makeCpf(12);
const cnpj = makeCnpj(13);
const card = makeCard(14);
const pixKey = "3f2b8c1e-9d47-4a6b-8e15-7c0d2a9b6f34";
const ghToken = "ghp_a8Kd92LmQ4xV7nB1zT6yW3pR5sE0uHjC2oFi";

const palettes = {
  light: {
    bg: "#f2f3f5",
    card: "#ffffff",
    text: "#1c1e21",
    muted: "#65676b",
    bubble: "#e4e6eb",
    mine: "#d9f2e6",
    border: "#d0d3d8",
  },
  dark: {
    bg: "#18191a",
    card: "#242526",
    text: "#e4e6eb",
    muted: "#b0b3b8",
    bubble: "#3a3b3c",
    mine: "#1f4a3a",
    border: "#3e4042",
  },
};

const base = (p, body) =>
  `<html><body style="margin:0;background:${p.bg};color:${p.text};font:16px -apple-system,'Segoe UI',system-ui,sans-serif">${body}</body></html>`;

const screens = {
  chat: (p) => ({
    html: base(
      p,
      `<div style="padding:24px;width:900px">
      <div style="font-weight:600;font-size:20px;margin-bottom:16px">Carla Souza</div>
      <div style="background:${p.bubble};padding:12px 16px;border-radius:14px;width:520px;margin-bottom:10px">Oi, consegue me mandar os dados pra cadastro?</div>
      <div style="background:${p.mine};padding:12px 16px;border-radius:14px;width:560px;margin:0 0 10px auto">Claro! Meu CPF é ${cpf}</div>
      <div style="background:${p.mine};padding:12px 16px;border-radius:14px;width:560px;margin:0 0 10px auto">Pode pagar no pix: ${pixKey}</div>
      <div style="background:${p.bubble};padding:12px 16px;border-radius:14px;width:520px;margin-bottom:10px">Perfeito, qualquer coisa me liga no (62) 99999-8888</div>
      <div style="background:${p.mine};padding:12px 16px;border-radius:14px;width:560px;margin:0 0 10px auto">Combinado, fale comigo também por carla.souza@exemplo.com.br</div></div>`,
    ),
    expected: [
      { category: "cpf", text: cpf },
      { category: "pix", text: pixKey },
      { category: "phone", text: "(62) 99999-8888" },
      { category: "email", text: "carla.souza@exemplo.com.br" },
    ],
  }),
  form: (p) => ({
    html: base(
      p,
      `<div style="padding:28px;width:900px"><div style="background:${p.card};border:1px solid ${p.border};border-radius:12px;padding:24px;line-height:2.1">
      <div style="font-size:22px;font-weight:600;margin-bottom:8px">Ficha de cadastro</div>
      <div>Nome: Maria Oliveira Santos</div>
      <div>CPF: ${cpf2}</div>
      <div>RG: 12.345.678-9</div>
      <div>Data de nascimento: 14/03/1991</div>
      <div>CEP: 74110-130</div>
      <div>Rua 5, Qd. 12, Lt. 3, Setor Oeste</div>
      <div>Telefone: (62) 3333-4444</div>
      <div>E-mail: maria.santos@exemplo.com</div></div></div>`,
    ),
    expected: [
      { category: "name", text: "Maria Oliveira Santos" },
      { category: "cpf", text: cpf2 },
      { category: "document", text: "12.345.678-9" },
      { category: "birthdate", text: "14/03/1991" },
      { category: "cep", text: "74110-130" },
      { category: "address", text: "Rua 5, Qd. 12, Lt. 3, Setor Oeste" },
      { category: "phone", text: "(62) 3333-4444" },
      { category: "email", text: "maria.santos@exemplo.com" },
    ],
  }),
  bank: (p) => ({
    html: base(
      p,
      `<div style="padding:28px;width:760px"><div style="background:${p.card};border:1px solid ${p.border};border-radius:12px;padding:24px;line-height:2.2">
      <div style="font-size:22px;font-weight:600">Minha conta</div>
      <div style="color:${p.muted}">Agência 1234 &nbsp;&nbsp; Conta corrente 56789-0</div>
      <div>Titular: Joao Pereira Lima</div>
      <div>Cartão ${card}</div>
      <div>CNPJ ${cnpj}</div>
      <div>Saldo disponível R$ 3.482,17</div></div></div>`,
    ),
    expected: [
      { category: "bank", text: "1234" },
      { category: "bank", text: "56789-0" },
      { category: "name", text: "Joao Pereira Lima" },
      { category: "card", text: card },
      { category: "cnpj", text: cnpj },
    ],
  }),
  terminal: () => ({
    html: `<html><body style="margin:0;background:#0d1117;color:#c9d1d9;font:15px ui-monospace,Menlo,monospace"><div style="padding:24px;width:1000px;line-height:1.9">
      <div>$ git config user.email "dev.exemplo@exemplo.com"</div>
      <div>$ export GITHUB_TOKEN=${ghToken}</div>
      <div>$ ping 192.168.10.45</div>
      <div>Welcome to Ubuntu 22.04 LTS</div></div></body></html>`,
    expected: [
      { category: "email", text: "dev.exemplo@exemplo.com" },
      { category: "credential", text: ghToken },
      { category: "ip", text: "192.168.10.45" },
    ],
  }),
  email: (p) => ({
    html: base(
      p,
      `<div style="padding:28px;width:900px"><div style="background:${p.card};border:1px solid ${p.border};border-radius:12px;padding:24px;line-height:1.9">
      <div style="font-weight:600;font-size:20px">Re: proposta comercial</div>
      <div style="color:${p.muted}">Para: financeiro@empresa-exemplo.com.br</div>
      <p>Olá, segue em anexo a proposta. Qualquer dúvida, é só ligar.</p>
      <div>Atenciosamente,</div><div>Paulo Mendes</div>
      <div>Tel: (11) 98888-7777</div></div></div>`,
    ),
    expected: [
      { category: "email", text: "financeiro@empresa-exemplo.com.br" },
      { category: "phone", text: "(11) 98888-7777" },
    ],
  }),
};

const browser = await chromium.launch({ channel: "chromium" });
for (const [name, build] of Object.entries(screens)) {
  const themes = name === "terminal" ? ["dark"] : ["light", "dark"];
  for (const theme of themes) {
    const { html, expected } = build(palettes[theme]);
    const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
    await page.setContent(html);
    const file = `${name}-${theme}`;
    await page.screenshot({ path: `${out}/${file}.png`, fullPage: true });
    writeFileSync(`${out}/${file}.json`, JSON.stringify({ expected }, null, 2) + "\n");
    await page.close();
  }
}
await browser.close();
