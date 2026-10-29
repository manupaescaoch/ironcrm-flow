import { it as test, expect } from "bun:test";
import * as XLSX from "xlsx";
import { normalizarPix, linhaClara, totalClara, type FonteClara } from "../../../supabase/functions/_shared/folhaClara";
import { gerarLoteClara, CABECALHOS_CLARA } from "./clara";
const fonte: FonteClara = { pagamento_id: "p1", colaborador_id: "c1", nome: "CLARA TESTE", pix: "01234567890", cpf: "01234567890", valor: 1234.56, status: "pendente" };
test("CPF com zero inicial exige tipo explícito e mantém zero e máscara", () => { expect(normalizarPix(fonte.pix)).toBeNull(); expect(normalizarPix(fonte.pix, "cpf")).toBe("012.345.678-90"); expect(normalizarPix("00000000000", "cpf")).toBeNull(); });
test("telefone usa apenas dígitos conforme modelo e nunca vira CPF", () => { expect(normalizarPix("(81)91234-5678", "telefone")).toBe("81912345678"); expect(normalizarPix("81912345678", "cpf")).toBeNull(); });
test("email e chave aleatória preservam texto", () => { expect(normalizarPix("teste@homologacao.invalid", "email")).toBe("teste@homologacao.invalid"); expect(normalizarPix("8082b8fe-728f-4a2c-8a44-cb12431c6aca", "aleatoria")).toBe("8082b8fe-728f-4a2c-8a44-cb12431c6aca"); });
test("v5 seleciona dois destinatários fictícios distintos sem alterar fontes, total 1484,56", () => {
 const fontes: FonteClara[] = [
  { ...fonte, pagamento_id: "v5-email", pix: "v5.destino@homologacao.invalid", valor: 1234.56 },
  { ...fonte, pagamento_id: "v5-aleatoria", pix: "8082b8fe-728f-4a2c-8a44-cb12431c6aca", valor: 250 },
 ];
 const antes = structuredClone(fontes);
 const linhas = fontes.map((f, i) => linhaClara(f, { pagamento_id: f.pagamento_id, tipo: i ? "aleatoria" : "email" }, "EVO Club | Madalena | Folha 11/2030"));
 const wb = XLSX.read(gerarLoteClara(linhas), { type: "array", cellNF: true });
 const ws = wb.Sheets.Sheet1;
 expect(ws["!ref"]).toBe("A1:D3");
 expect(ws.A2.v).toBe("v5.destino@homologacao.invalid");
 expect(ws.A3.v).toBe("8082b8fe-728f-4a2c-8a44-cb12431c6aca");
 expect(ws.C2.v + ws.C3.v).toBe(1484.56);
 expect(fontes).toEqual(antes);
});
test("PIX válido deixa CPF alternativo vazio mesmo com cadastro confirmado", () => { expect(linhaClara(fonte, { pagamento_id: "p1", tipo: "cpf", fornecedor_cadastrado: true }, "teste").cpf).toBe(""); });
test("sem PIX bloqueia sem confirmação explícita de cadastro Clara", () => { expect(() => linhaClara({ ...fonte, pix: null }, { pagamento_id: "p1" }, "teste")).toThrow(); expect(linhaClara({ ...fonte, pix: null }, { pagamento_id: "p1", fornecedor_cadastrado: true }, "teste").cpf).toBe("01234567890"); });
test("CPF inválido não serve de alternativa mesmo com confirmação", () => { expect(() => linhaClara({ ...fonte, pix: null, cpf: "00000000000" }, { pagamento_id: "p1", fornecedor_cadastrado: true }, "teste")).toThrow(); });
test("valor zero excluído", () => { expect(() => linhaClara({ ...fonte, valor: 0 }, { pagamento_id: "p1", tipo: "cpf" }, "teste")).toThrow(); });
test("confirmado excluído", () => { expect(() => linhaClara({ ...fonte, status: "pago" }, { pagamento_id: "p1", tipo: "cpf" }, "teste")).toThrow(); });
test("descrição limitada a 140 caracteres", () => { expect(linhaClara(fonte, { pagamento_id: "p1", tipo: "cpf" }, "A".repeat(140)).descricao.length).toBe(140); expect(() => linhaClara(fonte, { pagamento_id: "p1", tipo: "cpf" }, "A".repeat(141))).toThrow(); });
test("soma por centavos conserva obrigações separadas", () => { expect(totalClara([{ valor: 1234.56 }, { valor: 1810 }])).toBe(3044.56); });
test("XLSX reaberto conserva quatro colunas, texto com zero e valor numérico sem fórmula", () => {
 const data = gerarLoteClara([linhaClara(fonte, { pagamento_id: "p1", tipo: "cpf" }, "EVO Club | Madalena | Folha 10/2026")]);
 const wb = XLSX.read(data, { type: "array", cellNF: true }); const ws = wb.Sheets.Sheet1;
 expect(wb.SheetNames).toEqual(["Sheet1"]); expect(ws["!ref"]).toBe("A1:D2");
 expect(XLSX.utils.sheet_to_json(ws, { header: 1 })[0]).toEqual(CABECALHOS_CLARA);
 expect(ws.A2.t).toBe("s"); expect(ws.A2.v).toBe("012.345.678-90"); expect(ws.B2.v).toBe(""); expect(ws.C2.t).toBe("n"); expect(ws.C2.v).toBe(1234.56); expect(ws.C2.z).toBe("0.00"); expect(ws.C2.f).toBeUndefined();
});