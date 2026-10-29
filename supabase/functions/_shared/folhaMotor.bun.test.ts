import { describe, it, expect } from "bun:test";
import { calcularFolha, desconto, faixaExperimental, comissao, REGRAS_PADRAO as R, type Colaborador } from "./folhaMotor";

const est: Colaborador = { id: "e", nome: "ESTAGIARIO TESTE", tipo: "ESTAGIARIO", base: 600, passagem: 80, turno: "manha" };
const clt: Colaborador = { id: "c", nome: "CLT TESTE", tipo: "CLT", funcao: "PERSONAL", base: 2000, passagem: 0, valor_fds: 120, valor_feriado: 90 };

describe("descontos de saúde", () => {
  it("Blue 50, Ultra 80, Dental 12 por pessoa inteira", () => {
    expect(desconto({ blue: true })).toBe(50);
    expect(desconto({ ultra: true })).toBe(80);
    expect(desconto({ dental: true, quantity: 2.8 })).toBe(24);
    expect(desconto({ dental: false, quantity: 3 })).toBe(0);
  });
});

describe("faixas de experimentais", () => {
  it("1-4=20, 5-7=25, 8-10=30, 11+=40", () => {
    expect(faixaExperimental(0, R.faixas)).toBe(0);
    expect(faixaExperimental(4, R.faixas)).toBe(20);
    expect(faixaExperimental(5, R.faixas)).toBe(25);
    expect(faixaExperimental(10, R.faixas)).toBe(30);
    expect(faixaExperimental(11, R.faixas)).toBe(40);
  });
  it("modo mês usa o total de alunos do mês para todas as aulas", () => {
    // 3+3 = 6 alunos → faixa 25 → 6×25
    expect(calcularFolha(clt, { x: [3, 3] }, R).valores.x).toBe(150);
  });
  it("modo aula usa a faixa de cada aula", () => {
    expect(calcularFolha(clt, { x: [3, 3] }, { ...R, xmode: "aula" }).valores.x).toBe(120);
  });
});

describe("estagiário histórico", () => {
  it("diárias d=30, df=50, dn=20 por quantidade", () => {
    const r = calcularFolha(est, { d: 2, df: 1, dn: 3 }, R, null, "evo-ajustes-identificados-v2");
    expect(r.valores).toMatchObject({ d: 60, df: 50, dn: 60 });
  });
  it("fins de semana limitados a 2 × 100", () => {
    expect(calcularFolha(est, { f: 5 }, R, null, "evo-ajustes-identificados-v2").valores.f).toBe(200);
  });
  it("bolsa + passagem entram por padrão e podem ser excluídas no mês", () => {
    expect(calcularFolha(est, {}, R).total).toBe(680);
    expect(calcularFolha(est, { opt: { bolsa: false } }, R).total).toBe(80);
    expect(calcularFolha(est, { opt: { passagem: false } }, R).total).toBe(600);
  });
  it("líder recebe 300 ou valor próprio", () => {
    expect(calcularFolha({ ...est, lider: true }, {}, R).lider).toBe(300);
    expect(calcularFolha({ ...est, lider: true, lider_valor: 150 }, {}, R).lider).toBe(150);
  });
  it("segundo turno dobra bolsa e passagem e soma os campos do 2º turno", () => {
    const r = calcularFolha({ ...est, turno2: "tarde" }, { d: 1, s2: { d: 2 } }, R);
    expect(r.base).toBe(1200); expect(r.passagem).toBe(160); expect(r.valores.d).toBe(90);
  });
});

describe("CLT", () => {
  it("fim de semana e feriado usam os valores do cadastro", () => {
    const r = calcularFolha(clt, { f: 3, h: 1 }, R, null, "evo-ajustes-identificados-v2");
    expect(r.valores.f).toBe(360); expect(r.valores.h).toBe(90);
  });
  it("professor CLT recebe 200 por fim de semana", () => {
    expect(calcularFolha({ ...clt, funcao: "Professor" }, { f: 2 }, R, null, "evo-ajustes-identificados-v2").valores.f).toBe(400);
  });
  it("salário líquido do mês substitui a base do cadastro", () => {
    expect(calcularFolha(clt, { salary: { net: 1800 } }, R).base).toBe(1800);
  });
  it("não recebe diárias de estagiário", () => {
    expect(calcularFolha(clt, { d: 5, df: 2, dn: 2 }, R).extras).toBe(0);
  });
  it("contracheque importado substitui o cálculo sem desconto", () => {
    const r = calcularFolha(clt, { health: { blue: true } }, R, 1750.5);
    expect(r.total).toBe(1750.5); expect(r.desconto).toBe(0);
  });
  it("desconto de saúde sai do total", () => {
    expect(calcularFolha(clt, { health: { blue: true, ultra: true, dental: true, quantity: 2 } }, R).total).toBe(2000 - 154);
  });
});

describe("comissão da recepção", () => {
  const rec: Colaborador = { ...clt, funcao: "Recepção" };
  it("3% cadastro e 2% fechamento sobre o valor do plano", () => {
    const c = comissao({ comm: { completo: { mensal: { c: 2, f: 1 } } } }, R);
    expect(c.cadastro).toBe(45); expect(c.fechamento).toBe(15); expect(c.total).toBe(60);
  });
  it("só recepção CLT recebe", () => {
    const l = { comm: { executivo: { anual: { c: 1 } } } };
    expect(calcularFolha(rec, l, R, null, "evo-ajustes-identificados-v2").comissao).toBe(15);
    expect(calcularFolha(clt, l, R, null, "evo-ajustes-identificados-v2").comissao).toBe(0);
  });
});

describe("salário líquido zero", () => {
  it("líquido do mês 0 zera a base (não volta ao cadastro)", () => {
    expect(calcularFolha(clt, { salary: { net: 0 } }, R).base).toBe(0);
  });
  it("contracheque importado 0 vale como total 0", () => {
    expect(calcularFolha(clt, {}, R, 0).total).toBe(0);
  });
});
