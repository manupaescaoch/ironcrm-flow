import { describe, expect, it } from "bun:test";
import { lerPagina, lerPlanilha, mesReferencia, sugerirColaborador, validarImportacao } from "./contracheque";
import { calcularFolha, mesclarRegras } from "./motor";

const pagina = `IRON LIFTING CLUB LTDA
Folha Mensal 01/10/2026 a 31/10/2026
000123 TESTE RECEPCAO SILVA Função: RECEPCIONISTA CBO 4221
Total de Vencimentos 2.100,00 Total de Descontos 290,00
Valor Líquido 1.810,00`;

describe("leitura de contracheque", () => {
  it("lê nome, função, bruto, líquido e mês", () => {
    const r = lerPagina(pagina, 1);
    expect(r.nome).toBe("TESTE RECEPCAO SILVA");
    expect(r.funcao).toBe("RECEPCIONISTA");
    expect(r.bruto).toBe(2100);
    expect(r.liquido).toBe(1810);
    expect(r.ref).toBe("2026-10");
  });
  it("referência mm/aaaa", () => expect(mesReferencia("Referência: 09/2026")).toBe("2026-09"));
  it("planilha com competências misturadas é recusada", () => {
    expect(lerPlanilha([{ NOME: "A", LÍQUIDO: 1, COMPETÊNCIA: "2026-09" }, { NOME: "B", LÍQUIDO: 2, COMPETÊNCIA: "2026-10" }]).erro).toBeTruthy();
  });
  it("planilha lê competência como data de Excel", () => {
    expect(lerPlanilha([{ NOME: "A", LIQUIDO: "1.234,56", COMPETENCIA: new Date(2027, 1, 1) }])).toMatchObject({ ref: "2027-02", itens: [{ liquido: 1234.56 }] });
  });
  it("planilha aceita líquido zero", () => {
    expect(lerPlanilha([{ NOME: "A", "VALOR LÍQUIDO": 0 }]).itens[0].liquido).toBe(0);
  });
});

describe("validação antes de gravar", () => {
  const item = (id: string, l: number | null) => ({ colaborador_id: id, liquido: l, bruto: 0 });
  it("competência incorreta é recusada", () => expect(validarImportacao([item("a", 10)], "2026-10", "2026-09", false)).toContain("2026-09"));
  it("sem referência exige confirmação manual", () => {
    expect(validarImportacao([item("a", 10)], "2026-10", null, false)).toBeTruthy();
    expect(validarImportacao([item("a", 10)], "2026-10", null, true)).toBeNull();
  });
  it("mesmo colaborador duas vezes é recusado", () => expect(validarImportacao([item("a", 10), item("a", 5)], "2026-10", "2026-10", false)).toBeTruthy());
  it("item sem associação é recusado", () => expect(validarImportacao([item("", 10)], "2026-10", "2026-10", false)).toBeTruthy());
  it("líquido zero é aceito", () => expect(validarImportacao([item("a", 0)], "2026-10", "2026-10", false)).toBeNull());
  it("associação só por nome exato de CLT único", () => {
    const cs = [{ id: "1", nome: "TESTE RECEPÇÃO SILVA", tipo: "CLT" }, { id: "2", nome: "TESTE ESTAGIARIO", tipo: "ESTAGIARIO" }];
    expect(sugerirColaborador("teste recepcao silva", cs)).toBe("1");
    expect(sugerirColaborador("TESTE ESTAGIARIO", cs)).toBeNull();
    expect(sugerirColaborador("TESTE RECEPCAO", cs)).toBeNull();
  });
  it("líquido importado zero vale zero (não volta ao cadastro)", () => {
    const c = { id: "1", nome: "X", tipo: "CLT" as const, base: 1810, passagem: 0 };
    expect(calcularFolha(c, {}, mesclarRegras(null), 0).total).toBe(0);
  });
});
