import { describe, expect, test } from "bun:test";
import { calcularAjudaMensal } from "./motor";

describe("ajuda de custo mensal", () => {
  test("R$ 720 com passagem adicional manual de 90", () => {
    const r = calcularAjudaMensal({ passagem_dia: 18, dias_uteis: 19, dias_adicionais: 5, passagem_adicional_manual: { valor: 90, motivo: "FDS recepção" }, alimentacao_dia: 12, dias_alimentacao: 24 });
    expect(r.total).toBe(720);
    expect(r.passagemAdicional).toBe(90); // substitui 18×5, não soma
  });
  test("R$ 570 sem adicional", () => expect(calcularAjudaMensal({ passagem_dia: 18, dias_uteis: 19, alimentacao_dia: 12, dias_alimentacao: 19 }).total).toBe(570));
  test("R$ 399 com passagem de 9", () => expect(calcularAjudaMensal({ passagem_dia: 9, dias_uteis: 19, alimentacao_dia: 12, dias_alimentacao: 19 }).total).toBe(399));
  test("ajuste anterior de R$ 30 soma separado", () => {
    const r = calcularAjudaMensal({ passagem_dia: 18, dias_uteis: 19, alimentacao_dia: 12, dias_alimentacao: 19, ajustes: [{ id: "a", descricao: "DIFERENÇA OUTUBRO", tipo: "adicional", valor: 30, origem: "2026-10" }] });
    expect(r.ajustes).toBe(30); expect(r.total).toBe(600);
  });
  test("R$ 750,01 → 375,01 + 375,00", () => {
    const r = calcularAjudaMensal({ passagem_dia: 0, ajustes: [{ id: "x", descricao: "T", tipo: "adicional", valor: 750.01 }] });
    expect(r.parcelas).toEqual([375.01, 375]);
  });
  test("passagem manual sem motivo é recusada", () => {
    expect(() => calcularAjudaMensal({ passagem_adicional_manual: { valor: 90, motivo: " " } })).toThrow("motivo");
  });
  test("dias fracionados são recusados", () => expect(() => calcularAjudaMensal({ passagem_dia: 18, dias_uteis: 1.5 })).toThrow());
  test("total negativo é recusado", () => expect(() => calcularAjudaMensal({ ajustes: [{ id: "d", descricao: "D", tipo: "desconto", valor: 1 }] })).toThrow("negativo"));
});
