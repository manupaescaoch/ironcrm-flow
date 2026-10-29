import { it, expect } from "bun:test";
import { calcularFolha, calcularAjudaCusto, REGRAS_PADRAO as R, type Colaborador } from "./folhaMotor";
const c: Colaborador = { id: "TESTE", nome: "TESTE CLT", tipo: "CLT", base: 1000, passagem: 0 };
it("comissão manual 150 entra uma vez sem percentuais ou planos", () => {
  const r = calcularFolha(c, { comissao_manual: 150, comm: { completo: { mensal: { c: 20, f: 20 } } } }, R);
  expect(r.comissao).toBe(150); expect(r.total).toBe(1150);
});
it("comissão manual zero é preservada", () => expect(calcularFolha(c, { comissao_manual: 0 }, R).comissao).toBe(0));
it("comissão manual negativa é recusada", () => expect(() => calcularFolha(c, { comissao_manual: -1 }, R)).toThrow());
it("líquido importado 1234.56 não recebe comissão 150 novamente", () => expect(calcularFolha(c, { comissao_manual: 150 }, R, 1234.56).total).toBe(1234.56));
it("ajuda 720 fica fora do líquido 1234.56 e comissão", () => {
  const r = calcularFolha(c, { comissao_manual: 150, ajuda_custo: { passagem: 432, alimentacao: 288, ajustes: [] } }, R, 1234.56);
  expect(r.ajudaCusto?.total).toBe(720); expect(r.total).toBe(1234.56); expect(r.comissao).toBe(150);
});
it("ajuste de mês anterior 30 fica separado da ajuda recorrente 720", () => {
  const r = calcularAjudaCusto(c, { passagem: 432, alimentacao: 288, ajustes: [{ id: "TESTE-ANTERIOR", descricao: "MÊS ANTERIOR", tipo: "adicional", valor: 30 }] });
  expect(r.passagem).toBe(432); expect(r.alimentacao).toBe(288); expect(r.ajustes).toBe(30); expect(r.total).toBe(750);
});
it("Setúbal novembro/2026 conserva 5310 mensal e 2655 na referência 15 dias", () => {
  const total = [720,720,720,720,570,570,570,720].reduce((s,v) => s+calcularAjudaCusto(c, { passagem: v===720?432:342, alimentacao: v===720?288:228, ajustes: [] }).total,0);
  expect(total).toBe(5310); expect(total/2).toBe(2655);
});
it("Boa Viagem novembro/2026 conserva 3708 mensal e 1854 na referência 15 dias", () => {
  const itens = [720,720,720,750,399,399];
  const total = itens.reduce((s,v) => s+calcularAjudaCusto(c, { passagem: v===399?171:432, alimentacao: v===399?228:288, ajustes: v===750?[{id:"ANT",descricao:"MÊS ANTERIOR",tipo:"adicional",valor:30}]:[] }).total,0);
  expect(total).toBe(3708); expect(total/2).toBe(1854);
});
it("ajuda não gera pagamento nem altera salário sem contracheque", () => expect(calcularFolha(c, { ajuda_custo: { passagem:432,alimentacao:288,ajustes:[] } }, R).total).toBe(1000));
it("ajuda discriminada não muda regras de estagiários", () => expect(() => calcularFolha({...c,tipo:"ESTAGIARIO"},{ajuda_custo:{passagem:432,alimentacao:288,ajustes:[]}},R)).toThrow());
it("versão histórica mantém comissão antiga 60 e total 1060", () => {
  const r = calcularFolha({...c,funcao:"RECEPÇÃO"},{comm:{completo:{mensal:{c:2,f:1}}}},R,null,"evo-ajustes-identificados-v2");
  expect(r.comissao).toBe(60); expect(r.total).toBe(1060);
});