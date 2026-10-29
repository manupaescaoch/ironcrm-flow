import { expect, it as test } from "bun:test";
import { normalizarPix, linhaClara } from "../../../supabase/functions/_shared/folhaClara";
test("e-mail PIX mantém minúsculas digitadas", () => { expect(normalizarPix("teste.pix@homologacao.invalid", "email")).toBe("teste.pix@homologacao.invalid"); });
test("chave aleatória preserva caixa original", () => { const k = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"; expect(normalizarPix(k, "aleatoria")).toBe(k); });
test("tipo errado é recusado", () => { expect(normalizarPix("teste@homologacao.invalid", "cpf")).toBeNull(); expect(normalizarPix("123", "telefone")).toBeNull(); });
test("XLSX Clara usa a chave exatamente como gravada", () => {
  const l = linhaClara({ pagamento_id: "p", colaborador_id: "c", nome: "TESTE", pix: "Teste.Pix@homologacao.invalid", cpf: null, valor: 10, status: "pendente" }, { pagamento_id: "p", tipo: "email" }, "d");
  expect(l.pix).toBe("Teste.Pix@homologacao.invalid");
});
