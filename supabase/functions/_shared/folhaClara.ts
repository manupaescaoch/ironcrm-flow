export const CABECALHOS_CLARA = [
  "Chave Pix ou Código Pix copia e cola (Opcional se CPF/CNPJ do Fornecedor informado)",
  "CPF/CNPJ do Fornecedor cadastrado", "Valor", "Descrição (Opcional)",
];
export type TipoPix = "cpf" | "cnpj" | "telefone" | "email" | "aleatoria";
export type EscolhaClara = { pagamento_id: string; tipo?: TipoPix; fornecedor_cadastrado?: boolean };
export type FonteClara = { pagamento_id: string; colaborador_id: string; nome: string; pix: string | null; cpf: string | null; valor: number; status: string };
export function documentoValido(texto: string, tamanho: 11 | 14): boolean {
  const s = texto.replace(/\D/g, "");
  if (s.length !== tamanho || /^(\d)\1+$/.test(s)) return false;
  const digito = (base: string, pesos: number[]) => { const resto = [...base].reduce((n, v, i) => n + Number(v) * pesos[i], 0) % 11; return resto < 2 ? 0 : 11 - resto; };
  const p = tamanho === 11 ? [10,9,8,7,6,5,4,3,2] : [5,4,3,2,9,8,7,6,5,4,3,2];
  const base = s.slice(0, -2), d1 = digito(base, p);
  const d2 = digito(base + d1, tamanho === 11 ? [11,10,9,8,7,6,5,4,3,2] : [6,...p]);
  return s.endsWith(`${d1}${d2}`);
}
export function normalizarPix(chave: string | null, tipo?: TipoPix): string | null {
  const s = String(chave || "").trim(), n = s.replace(/\D/g, "");
  if (!s || !tipo) return null;
  if (tipo === "cpf" && /^[\d.\-]+$/.test(s) && documentoValido(s, 11)) return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (tipo === "cnpj" && /^[\d.\/-]+$/.test(s) && documentoValido(s, 14)) return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (tipo === "telefone" && /^[\d()\s-]+$/.test(s) && /^\d{2}9\d{8}$/.test(n)) return n;
  if (tipo === "email" && s.length <= 77 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return s;
  if (tipo === "aleatoria" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return s;
  return null;
}
export function linhaClara(fonte: FonteClara, escolha: EscolhaClara, descricao: string) {
  if (fonte.status !== "pendente" || !Number.isFinite(Number(fonte.valor)) || Number(fonte.valor) <= 0) throw new Error("Somente pagamentos pendentes com valor positivo");
  if (descricao.length > 140) throw new Error("Descrição ultrapassa 140 caracteres");
  const pix = normalizarPix(fonte.pix, escolha.tipo);
  const cpf = !pix && escolha.fornecedor_cadastrado === true && (documentoValido(fonte.cpf || "", 11) || documentoValido(fonte.cpf || "", 14)) ? String(fonte.cpf).replace(/\D/g, "") : "";
  if (!pix && !cpf) throw new Error(`${fonte.nome}: confirme o tipo de uma chave PIX válida ou o cadastro do fornecedor na Clara`);
  return { pagamento_id: fonte.pagamento_id, nome: fonte.nome, pix: pix || "", cpf, valor: Math.round(Number(fonte.valor) * 100) / 100, descricao };
}
export function totalClara(linhas: { valor: number }[]) { return linhas.reduce((s, l) => s + Math.round(l.valor * 100), 0) / 100; }