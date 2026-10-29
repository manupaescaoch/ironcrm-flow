// Cálculo puro da Ajuda de Custo mensal. Na implantação aprovada, este código passa para
// supabase/functions/_shared/folhaMotor.ts para ser o MESMO no servidor e na interface.

/* ---------------- Ajuda de Custo mensal (fonte única: folha_ajuda_lancamentos) ---------------- */
export interface AjusteAjuda { id: string; descricao: string; tipo: "adicional" | "desconto"; valor: number; origem?: string }
export interface AjudaMensal {
  passagem_dia?: number; dias_uteis?: number; dias_adicionais?: number;
  /** Substitui (não soma) passagem_dia × dias_adicionais. Exige motivo. */
  passagem_adicional_manual?: { valor: number; motivo: string } | null;
  alimentacao_dia?: number; dias_alimentacao?: number;
  ajustes?: AjusteAjuda[]; datas?: [string, string];
}
const naoNeg = (v: unknown, nome: string, inteiro = false) => {
  if (v === undefined || v === null) return 0;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || (inteiro && !Number.isInteger(v))) throw new Error(`${nome} inválido`);
  return v;
};
/** Total = passagem/dia × dias úteis + (passagem manual OU passagem/dia × dias adicionais) + alimentação/dia × dias + ajustes. Em centavos. */
export function calcularAjudaMensal(a: AjudaMensal | null | undefined) {
  const d = a || {};
  const pd = naoNeg(d.passagem_dia, "Passagem diária"), du = naoNeg(d.dias_uteis, "Dias úteis", true), da = naoNeg(d.dias_adicionais, "Dias adicionais", true);
  const ad = naoNeg(d.alimentacao_dia, "Alimentação diária"), dal = naoNeg(d.dias_alimentacao, "Dias de alimentação", true);
  const c = (v: number) => Math.round(v * 100);
  const passagemUteis = c(pd) * du;
  let passagemAdicional = c(pd) * da, manual = false;
  if (d.passagem_adicional_manual) {
    const m = d.passagem_adicional_manual;
    if (!m.motivo?.trim()) throw new Error("Passagem adicional manual exige motivo");
    passagemAdicional = c(naoNeg(m.valor, "Passagem adicional manual")); manual = true;
  }
  const alimentacao = c(ad) * dal;
  const ajustes = d.ajustes || [];
  if (new Set(ajustes.map((x) => x.id)).size !== ajustes.length) throw new Error("Ajustes da ajuda duplicados");
  let aj = 0;
  for (const x of ajustes) {
    if (!x.id || !x.descricao?.trim() || !["adicional", "desconto"].includes(x.tipo)) throw new Error("Ajuste da ajuda exige descrição e tipo");
    aj += (x.tipo === "adicional" ? 1 : -1) * c(naoNeg(x.valor, "Valor do ajuste"));
  }
  const total = passagemUteis + passagemAdicional + alimentacao + aj;
  if (total < 0) throw new Error("Total da ajuda de custo não pode ser negativo");
  const primeira = Math.round(total / 2);
  return {
    passagemUteis: passagemUteis / 100, passagemAdicional: passagemAdicional / 100, passagemManual: manual,
    alimentacao: alimentacao / 100, ajustes: aj / 100, total: total / 100,
    parcelas: [primeira / 100, (total - primeira) / 100] as [number, number],
  };
}
