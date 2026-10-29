import { describe, expect, test, beforeEach } from "bun:test";
// sessionStorage simples para o teste
const mem = new Map<string, string>();
(globalThis as any).sessionStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k), key: () => null, get length() { return mem.size; } };
const { pendencias, lerRascunho, gravarRascunho, nomeMes } = await import("@/components/folha/ConferenciaMensal");

const clt = { id: "a", nome: "ANA", tipo: "CLT", base: 2000, passagem: 0, pix: "ana@x.com" } as any;
beforeEach(() => mem.clear());

describe("conferência mensal", () => {
  test("mês aberto sem lançamento fica pendente de preparação", () => {
    expect(pendencias(clt, undefined, null, null, true)).toContain("Mês não preparado");
  });
  test("mês fechado não acusa falta de preparação", () => {
    expect(pendencias(clt, { dados: {} }, null, null, false)).not.toContain("Mês não preparado");
  });
  test("salário ausente é sinalizado, não inventado", () => {
    expect(pendencias({ ...clt, base: 0 }, { dados: {} }, null, null, true)).toContain("Salário líquido não informado");
  });
  test("PIX ausente é sinalizado", () => {
    expect(pendencias({ ...clt, pix: null }, { dados: {} }, null, null, true)).toContain("PIX ausente");
  });
  test("rascunho fica separado por unidade e mês", () => {
    gravarRascunho("u1", "2026-10", "a", { comissao_manual: 50 });
    expect(lerRascunho("u1", "2026-10", "a")?.comissao_manual).toBe(50);
    expect(lerRascunho("u1", "2026-11", "a")).toBeNull();
    expect(lerRascunho("u2", "2026-10", "a")).toBeNull();
    gravarRascunho("u1", "2026-10", "a", null);
    expect(lerRascunho("u1", "2026-10", "a")).toBeNull();
  });
  test("nome do mês", () => expect(nomeMes("2026-10")).toBe("outubro/2026"));
});
