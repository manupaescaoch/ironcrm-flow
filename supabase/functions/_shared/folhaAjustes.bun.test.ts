import { it, expect } from "bun:test";
import { calcularFolha, linhasCompetencia, REGRAS_PADRAO } from "./folhaMotor";
const c = { id: "TESTE", nome: "PESSOA TESTE", tipo: "CLT" as const, base: 1000, passagem: 0 };
const l = { ajustes: [{ id: "A", descricao: "ADICIONAL TESTE", tipo: "adicional" as const, valor: 200 }, { id: "D", descricao: "DESCONTO TESTE", tipo: "desconto" as const, valor: 50 }] };
it("adicional 200 e desconto 50 sobre base 1000 resultam 1150", () => expect(calcularFolha(c, l, REGRAS_PADRAO).total).toBe(1150));
it("líquido importado 1234.56 não recebe ajustes novamente", () => expect(calcularFolha(c, l, REGRAS_PADRAO, 1234.56).total).toBe(1234.56));
it("não presume regra para sem contrato", () => expect(() => calcularFolha({ ...c, tipo: "SEM_CONTRATO" }, {}, REGRAS_PADRAO)).toThrow());
it("sem contrato não entra no fechamento", () => expect(linhasCompetencia([{ ...c, tipo: "SEM_CONTRATO", ativo: true }], [], REGRAS_PADRAO, true).length).toBe(0));
it("recusa ajuste sem descrição", () => expect(() => calcularFolha(c, { ajustes: [{ ...l.ajustes[0], descricao: "" }] }, REGRAS_PADRAO)).toThrow());