import { describe, expect, it } from "vitest";
import {
  entropy,
  isValidCnpj,
  isValidCns,
  isValidCpf,
  isValidDdd,
  isValidPis,
  passesLuhn,
} from "../src/core/validate";
import { makeCard, makeCnpj, makeCns, makeCpf, makePis } from "./helpers/generate";

describe("isValidCpf", () => {
  it("accepts the documented test value, with and without punctuation", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
  });

  it("rejects a wrong check digit", () => {
    expect(isValidCpf("529.982.247-26")).toBe(false);
  });

  it("rejects repeated digits that pass the checksum", () => {
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });

  it("rejects wrong lengths", () => {
    expect(isValidCpf("529.982.247-2")).toBe(false);
    expect(isValidCpf("")).toBe(false);
  });

  it("accepts generated values", () => {
    for (let seed = 1; seed <= 20; seed++) expect(isValidCpf(makeCpf(seed))).toBe(true);
  });
});

describe("isValidCnpj", () => {
  it("accepts the numeric and alphanumeric test values", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("12.ABC.345/01DE-35")).toBe(true);
    expect(isValidCnpj("12ABC34501DE35")).toBe(true);
  });

  it("rejects a wrong check digit", () => {
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
    expect(isValidCnpj("12.ABC.345/01DE-36")).toBe(false);
  });

  it("rejects non-numeric check digits", () => {
    expect(isValidCnpj("12.ABC.345/01DE-3A")).toBe(false);
  });

  it("accepts generated values", () => {
    for (let seed = 1; seed <= 20; seed++) expect(isValidCnpj(makeCnpj(seed))).toBe(true);
  });
});

describe("isValidPis and isValidCns", () => {
  it("accept generated values", () => {
    for (let seed = 1; seed <= 10; seed++) {
      expect(isValidPis(makePis(seed))).toBe(true);
      expect(isValidCns(makeCns(seed))).toBe(true);
    }
  });

  it("reject altered values", () => {
    const pis = makePis(3);
    const wrong = pis.slice(0, 10) + ((Number(pis[10]) + 1) % 10);
    expect(isValidPis(wrong)).toBe(false);
    expect(isValidCns("123456789012345")).toBe(false);
  });
});

describe("passesLuhn", () => {
  it("accepts the documented test card and generated ones", () => {
    expect(passesLuhn("4111 1111 1111 1111")).toBe(true);
    for (let seed = 1; seed <= 10; seed++) expect(passesLuhn(makeCard(seed))).toBe(true);
  });

  it("rejects altered numbers and short sequences", () => {
    expect(passesLuhn("4111 1111 1111 1112")).toBe(false);
    expect(passesLuhn("1234")).toBe(false);
  });
});

describe("isValidDdd", () => {
  it("knows valid and invalid area codes", () => {
    for (const ddd of ["11", "62", "21", "99", "38"]) expect(isValidDdd(ddd)).toBe(true);
    for (const ddd of ["10", "20", "23", "36", "52", "72", "00"])
      expect(isValidDdd(ddd)).toBe(false);
  });
});

describe("entropy", () => {
  it("is higher for random-looking strings", () => {
    expect(entropy("aaaaaaaa")).toBe(0);
    expect(entropy("aB3$xZ9!qW7#")).toBeGreaterThan(3.5);
  });
});
