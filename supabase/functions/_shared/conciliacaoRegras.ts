// Regras puras de correspondência entre uma conta paga e débitos bancários do EVO OS.

export interface ContaMatch {
  id: string; unidade_id: string; valor: number | string; valor_pago?: number | string | null;
  data_pagamento?: string | null; data_vencimento: string;
  fornecedor?: string | null; descricao?: string | null; fornecedor_documento?: string | null;
  linha_digitavel?: string | null; codigo_barras?: string | null; chave_pix?: string | null; codigo_pix?: string | null;
}
export interface TransMatch {
  id: string; unidade_id: string | null; data: string; valor: number | string; tipo: string;
  descricao?: string | null; beneficiario?: string | null; documento?: string | null;
  pix_id?: string | null; autenticacao?: string | null; conta_pagar_id?: string | null;
}

export type Decisao =
  | { tipo: 'auto'; transacao: TransMatch }
  | { tipo: 'divergencia'; transacao: TransMatch; diferenca: number }
  | { tipo: 'ambiguo'; sugestoes: TransMatch[] }
  | { tipo: 'nenhum' };

export const JANELA_DIAS = 5;
const digitos = (s?: string | null) => (s ?? '').replace(/\D/g, '');
const norm = (s?: string | null) => (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const dias = (a: string, b: string) => Math.abs((Date.parse(a) - Date.parse(b)) / 86_400_000);
const centavos = (v: number | string) => Math.round(Number(v) * 100);

/** Fornecedor/identificador batem? (documento, Pix, código do boleto ou nome do fornecedor) */
export function identifica(c: ContaMatch, t: TransMatch): boolean {
  const doc = digitos(c.fornecedor_documento);
  if (doc.length >= 11 && digitos(t.documento) === doc) return true;
  const texto = norm(`${t.descricao ?? ''} ${t.beneficiario ?? ''} ${t.autenticacao ?? ''} ${t.pix_id ?? ''}`);
  const textoDig = digitos(texto);
  for (const cod of [c.linha_digitavel, c.codigo_barras]) {
    const d = digitos(cod);
    if (d.length >= 20 && textoDig.includes(d.slice(0, 20))) return true;
  }
  const pix = norm(c.chave_pix || '');
  if (pix.length >= 6 && texto.includes(pix)) return true;
  const palavras = norm(c.fornecedor || c.descricao).split(/[^A-Z0-9]+/).filter((w) => w.length >= 4 && !['LTDA', 'EIRELI', 'SERVICOS', 'COMERCIO'].includes(w));
  return palavras.length > 0 && palavras.some((w) => texto.includes(w));
}

export function decidir(c: ContaMatch, transacoes: TransMatch[]): Decisao {
  const ref = String(c.data_pagamento ?? c.data_vencimento).slice(0, 10);
  const alvo = centavos(c.valor_pago ?? c.valor);
  const base = transacoes.filter((t) =>
    t.tipo === 'debito' && !t.conta_pagar_id && t.unidade_id === c.unidade_id && dias(t.data, ref) <= JANELA_DIAS);
  if (!base.length) return { tipo: 'nenhum' };

  const exatos = base.filter((t) => centavos(t.valor) === alvo);
  if (exatos.length === 1) return { tipo: 'auto', transacao: exatos[0] };
  if (exatos.length > 1) {
    const ident = exatos.filter((t) => identifica(c, t));
    if (ident.length === 1) return { tipo: 'auto', transacao: ident[0] };
    const mesmoDia = exatos.filter((t) => t.data === ref);
    if (ident.length === 0 && mesmoDia.length === 1) return { tipo: 'auto', transacao: mesmoDia[0] };
    return { tipo: 'ambiguo', sugestoes: (ident.length ? ident : exatos).slice(0, 3) };
  }

  // Valor diferente: só sugere quando o fornecedor/identificador bate e a diferença é plausível.
  const tolerancia = Math.max(alvo * 0.2, 5000); // 20% ou R$ 50
  const proximos = base.filter((t) => Math.abs(centavos(t.valor) - alvo) <= tolerancia && identifica(c, t));
  if (proximos.length === 1) {
    return { tipo: 'divergencia', transacao: proximos[0], diferenca: (centavos(proximos[0].valor) - alvo) / 100 };
  }
  if (proximos.length > 1) return { tipo: 'ambiguo', sugestoes: proximos.slice(0, 3) };
  return { tipo: 'nenhum' };
}
