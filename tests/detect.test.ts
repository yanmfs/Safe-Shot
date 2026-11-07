import { describe, expect, it } from "vitest";
import { detect, type Category, type Detection } from "../src/core/detect";
import { isValidCpf } from "../src/core/validate";
import { makeCard, makeCnpj, makeCns, makeCpf, makePis } from "./helpers/generate";
import { pageFromLines } from "./helpers/ocr";

const run = (lines: string[]) => detect(pageFromLines(lines));
const of = (lines: string[], category: Category) =>
  run(lines).filter((d) => d.category === category);

const cpf1 = makeCpf(1);
const cpf2 = makeCpf(2);

type Cases = Record<string, { positive: string[][]; negative: string[][] }>;

const cases: Cases = {
  cpf: {
    positive: [
      [`CPF: ${cpf1}`],
      [`meu cpf é ${cpf2} obrigado`],
      [makeCpf(3, false)],
      [`titular ${cpf1} e ${cpf2}`],
      ["CPF 529.982.247-25"],
    ],
    negative: [
      ["Total R$ 1.234.567,89"],
      ["Pedido 12345678901"],
      ["Ligue (62) 99999-8888"],
      ["Data 10/03/2026 às 14:30"],
      ["Protocolo 2024.0001.234"],
    ],
  },
  cnpj: {
    positive: [
      [`CNPJ: ${makeCnpj(1)}`],
      ["empresa 12.ABC.345/01DE-35"],
      [makeCnpj(2, false)],
      ["12ABC34501DE35"],
      ["CNPJ 11.222.333/0001-81"],
    ],
    negative: [
      ["ABCDEFGHIJKLMN"],
      ["12345678901234"],
      ["Rua 12.345.678"],
      ["PROTOCOLOABCDEF"],
      ["1234.5678/9012"],
    ],
  },
  document: {
    positive: [
      ["RG: 12.345.678-9"],
      ["RG 1234567 SSP/GO"],
      ["CNH 12345678901"],
      ["Título de eleitor 1234 5678 9012"],
      [`PIS: ${makePis(1)}`],
      ["Registro Geral", "1234567"],
    ],
    negative: [
      ["Valor R$ 1.234.567,89"],
      ["Matrícula"],
      ["RG 123"],
      ["Total 12345678"],
      ["Matrícula valor R$ 1.234.567,89 pago"],
    ],
  },
  secret: {
    positive: [
      ["Senha: abc12345"],
      ["senha = Xk9#mZ"],
      ["Código de verificação: 483920"],
      ["PIN 4821"],
      ["token: a1b2c3d4e5"],
      ["OTP is 123456"],
    ],
    negative: [
      ["Senha incorreta"],
      ["Esqueci minha senha"],
      ["digite o código"],
      ["PIN"],
      ["senha: abc"],
    ],
  },
  phone: {
    positive: [
      ["(62) 99999-8888"],
      ["62 99999-8888"],
      ["+55 62 99999-8888"],
      ["(11) 3333-4444"],
      ["62999998888"],
      ["+1 415 555 2671"],
    ],
    negative: [
      ["(10) 99999-8888"],
      ["12345678"],
      ["Total R$ 1.234,56"],
      ["10/03/2026"],
      ["CEP 74000-000"],
      ["(62) 12345-8888"],
    ],
  },
  email: {
    positive: [
      ["contato@exemplo.com.br"],
      ["joao.silva+tag@mail.exemplo.com"],
      ["Email: ana_maria@example.org"],
      ["escreva para a@b.co hoje"],
      ["<maria@exemplo.com>"],
    ],
    negative: [["arroba @usuario"], ["texto@"], ["@"], ["email: "], ["www.exemplo.com.br"]],
  },
  cep: {
    positive: [
      ["CEP 74000-000"],
      ["74000-000"],
      ["CEP: 74000000"],
      ["Setor Oeste 74110-130"],
      ["cep 01310100"],
    ],
    negative: [["74000"], ["123456789"], ["Total 74000000 itens"], ["CEP"], ["1234-5678"]],
  },
  address: {
    positive: [
      ["Rua 5, Qd. 12, Lt. 3, Setor Oeste"],
      ["Av. Brasil, 1500"],
      ["Avenida Paulista 1578"],
      ["Apto 302 Bloco B"],
      ["Alameda Santos, 45"],
      ["Rodovia BR-153 km 12"],
    ],
    negative: [
      ["O setor de serviços cresceu"],
      ["A rua estava vazia"],
      ["avenida"],
      ["Trabalho no Brasil"],
      ["bloco de notas"],
    ],
  },
  pix: {
    positive: [
      ["chave 123e4567-e89b-42d3-a456-426614174000"],
      ["00020126580014br.gov.bcb.pix0136123e4567e89b12d3a456426614174000"],
      [
        "00020126580014br.gov.bcb.pix0136123e4567e89b12d3a4564266141740005204000053039865802BR",
        "5913FULANO DE TAL6008BRASILIA62070503***6304ABCD",
      ],
      ["Pix: 123e4567-e89b-42d3-a456-426614174000"],
      ["br.gov.bcb.pix2584abcdefghijklmnop"],
    ],
    negative: [
      ["123e4567-e89b-12d3-a456-426614174000"],
      ["pix"],
      ["000201"],
      ["5d41402abc4b2a76b9719d911017c592"],
      ["br.gov.bcb"],
    ],
  },
  card: {
    positive: [
      ["4111 1111 1111 1111"],
      [makeCard(1)],
      ["5500-0000-0000-0004"],
      ["cartão final 1234"],
      ["Cartão: 4012888888881881"],
    ],
    negative: [
      ["4111 1111 1111 1112"],
      ["1234 5678 9012 3456"],
      ["Ligue (62) 99999-8888"],
      ["123456789012"],
      ["final 1234"],
    ],
  },
  bank: {
    positive: [
      ["Agência 1234 Conta 56789-0"],
      ["Ag: 0001"],
      ["C/C 12345-6"],
      ["Conta corrente: 123456-7"],
      ["Poupança 98765-4"],
    ],
    negative: [
      ["Conta de luz vencida"],
      ["agência de viagens"],
      ["conta"],
      ["Conta 1"],
      ["Agradecemos a visita"],
    ],
  },
  plate: {
    positive: [["ABC-1234"], ["ABC1D23"], ["placa BRA2E19"], ["Placa: QWE-5678"], ["RIO2A18"]],
    negative: [["CPF-1234"], ["AB-1234"], ["abc-1234"], ["ABC12345"], ["TEL-1234"]],
  },
  birthdate: {
    positive: [
      ["Data de nascimento: 12/03/1990"],
      ["Nasc.: 01/02/85"],
      ["DN 5.6.1988"],
      ["Nascimento 12 de março de 1990"],
      ["nascido em 03-04-1991"],
    ],
    negative: [
      ["Pedido em 12/03/2024"],
      ["Nascimento"],
      ["Vencimento 10/03/2026"],
      ["Nasc"],
      ["Validade 12/2030"],
    ],
  },
  name: {
    positive: [
      ["Nome: Maria da Silva"],
      ["Nome completo: João Pedro Souza"],
      ["Titular: ANA LIMA"],
      ["Paciente: José Alves"],
      ["Aluno: Pedro"],
    ],
    negative: [["Nome:"], ["O nome do arquivo"], ["Nome do produto"], ["Aluno"], ["nomeado ontem"]],
  },
  ip: {
    positive: [
      ["192.168.0.1"],
      ["IP 10.0.0.255"],
      ["2001:db8::1"],
      ["fe80::1ff:fe23:4567:890a"],
      ["8.8.8.8"],
    ],
    negative: [["256.1.1.1"], ["12:30:45"], ["1.2.3"], ["versão 1.2.3.4.5"], ["10:30"]],
  },
  credential: {
    positive: [
      [`ghp_${"aB3dE5gH7jK9mN1pQ3sT5vX7zA9cE1gI3kM5"}`],
      ["AKIAIOSFODNN7EXAMPLE"],
      ["sk-proj-abcdefghijklmnop1234"],
      [
        "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
      ],
      ["xoxb-1234567890-abcdefghij"],
      ["aB3_xZ9-qW7+mK2/pL5=tR8vC4yN6uH1jD0Ab3Cd"],
    ],
    negative: [
      ["Anticonstitucionalissimamente"],
      ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
      ["uma frase comum sem segredo nenhum aqui"],
      ["https://exemplo.com.br/um/caminho/muito/longo/de/arquivos"],
      ["sk-curto"],
    ],
  },
  "url-secret": {
    positive: [
      ["https://api.exemplo.com/x?token=abc123"],
      ["https://x.com/a?key=AAA&b=2"],
      ["https://x.com/cb?code=xyz"],
      ["https://x.com/f?sig=abcdef"],
      ["x.com/y?access_token=zzz"],
    ],
    negative: [
      ["https://exemplo.com/docs?page=2"],
      ["https://exemplo.com/?keyword=abc"],
      ["token"],
      ["https://exemplo.com"],
      ["code=1"],
    ],
  },
};

describe.each(Object.entries(cases))("%s detector", (category, { positive, negative }) => {
  it("has enough cases", () => {
    expect(positive.length).toBeGreaterThanOrEqual(5);
    expect(negative.length).toBeGreaterThanOrEqual(5);
  });

  it.each(positive.map((lines) => [lines.join(" / "), lines] as const))("finds %s", (_, lines) => {
    expect(of(lines, category as Category).length).toBeGreaterThan(0);
  });

  it.each(negative.map((lines) => [lines.join(" / "), lines] as const))(
    "ignores %s",
    (_, lines) => {
      expect(of(lines, category as Category)).toEqual([]);
    },
  );
});

describe("confidence", () => {
  const first = (lines: string[], category: Category): Detection => {
    const found = of(lines, category)[0];
    if (!found) throw new Error(`no ${category} detection`);
    return found;
  };

  it("marks a valid CPF as high and a punctuated one with a wrong check digit as medium", () => {
    expect(first([`CPF ${cpf1}`], "cpf").confidence).toBe("high");
    expect(isValidCpf("529.982.247-26")).toBe(false);
    expect(first(["CPF 529.982.247-26"], "cpf").confidence).toBe("medium");
  });

  it("marks phones with a valid area code as high and without as medium", () => {
    expect(first(["(62) 99999-8888"], "phone").confidence).toBe("high");
    expect(first(["99999-8888"], "phone").confidence).toBe("medium");
  });

  it("marks a card ending hint as medium", () => {
    expect(first(["cartão final 1234"], "card").confidence).toBe("medium");
  });

  it("downgrades PIS and CNS that fail validation", () => {
    expect(first([`PIS ${makePis(4)}`], "document").confidence).toBe("high");
    expect(first(["PIS 12345678901"], "document").confidence).toBe("medium");
    expect(first([`CNS ${makeCns(4)}`], "document").confidence).toBe("high");
  });
});

describe("OCR digit look-alikes", () => {
  it("recovers a CPF read with O and l in place of 0 and 1", () => {
    const noisy = makeCpf(5, false).replace(/0/g, "O").replace(/1/g, "l");
    expect(of([`CPF ${noisy}`], "cpf")).toHaveLength(1);
  });

  it("does not rewrite letters inside an alphanumeric CNPJ", () => {
    expect(of(["12.ABC.345/01DE-35"], "cnpj")[0]?.confidence).toBe("high");
  });
});

describe("overlaps", () => {
  it("keeps only the most specific detection for the same text", () => {
    const found = run([`CPF ${cpf1}`]);
    expect(found.map((d) => d.category)).toEqual(["cpf"]);
  });

  it("does not report the halves of a card number as phones", () => {
    expect(run(["4111 1111 1111 1111"]).map((d) => d.category)).toEqual(["card"]);
  });

  it("keeps a labelled address line next to the phone found inside it", () => {
    const categories = run(["Rua 5, Qd. 12 - (62) 99999-8888"]).map((d) => d.category);
    expect(categories).toContain("address");
    expect(categories).toContain("phone");
  });
});

describe("boxes", () => {
  it("covers only the matched characters, padded and at line height", () => {
    const [found] = of(["CPF: 529.982.247-25"], "cpf");
    // "529.982.247-25" starts at char 5 of the line and is 14 chars long.
    expect(found?.boxes).toEqual([{ x: 50 - 2.4, y: -2.4, w: 140 + 4.8, h: 20 + 4.8 }]);
  });

  it("slices a word proportionally when the label is glued to the value", () => {
    const [found] = of(["CPF:529.982.247-25"], "cpf");
    expect(found?.boxes[0]?.x).toBeCloseTo(40 - 2.4);
    expect(found?.boxes[0]?.w).toBeCloseTo(140 + 4.8);
  });

  it("makes one box per line for a payload that wraps", () => {
    const found = of(
      [
        "00020126580014br.gov.bcb.pix0136123e4567e89b12d3a4564266141740005204000053039865802BR",
        "5913FULANO6008BRASILIA62070503***6304ABCDEFGHIJKLMNOPQRST",
      ],
      "pix",
    );
    expect(found).toHaveLength(2);
  });
});

describe("previews", () => {
  it("masks the middle of the value", () => {
    const [found] = of(["CPF 529.982.247-25"], "cpf");
    expect(found?.preview).toBe("529.•••.•••-25");
  });

  it("keeps only the domain of an e-mail", () => {
    const [found] = of(["joao.silva@exemplo.com"], "email");
    expect(found?.preview).toBe("j•••@exemplo.com");
  });
});

describe("personal terms", () => {
  const withTerms = (lines: string[], terms: string[]) =>
    detect(pageFromLines(lines), { terms }).filter((d) => d.category === "term");

  it("matches ignoring case and accents", () => {
    expect(withTerms(["Reunião com a EMPRESA Exemplo hoje"], ["empresa"])).toHaveLength(1);
    expect(withTerms(["Cliente: José"], ["jose"])).toHaveLength(1);
  });

  it("tolerates one mistake in words of five letters or more", () => {
    expect(withTerms(["projeto Fenix confidencial"], ["Fênix"])).toHaveLength(1);
    expect(withTerms(["projeto Fenox"], ["fenix"])).toHaveLength(1);
    expect(withTerms(["casa"], ["caza"])).toHaveLength(0);
  });

  it("matches phrases and ignores unrelated words", () => {
    expect(withTerms(["Obra do Parque das Flores segue"], ["parque das flores"])).toHaveLength(1);
    expect(withTerms(["nada a ver aqui"], ["empresa", "x"])).toHaveLength(0);
  });

  it("does nothing without terms", () => {
    expect(detect(pageFromLines(["empresa"]))).toEqual([]);
  });
});
