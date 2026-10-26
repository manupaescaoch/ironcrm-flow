// Regras puras (sem rede) do recebimento de documentos pelo grupo de Contas a Pagar.

export const soDigitos = (v: unknown): string => String(v ?? '').replace(/\D/g, '');

export interface UnidadeCnpj {
  id: string;
  nome: string;
  cnpj: string | null;
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

/** Palavra-chave do nome da unidade (EVO MADALENA → MADALENA). */
function chaveNome(nome: string): string {
  return semAcento(nome).replace(/^EVO\s+/, '').replace(/\s+DO\s+CAPIBARIBE$/, '').trim();
}

/**
 * Identifica a unidade pagadora. Ordem: CNPJ do pagador → nome do pagador.
 * Nunca usa o CNPJ do fornecedor. Retorna null quando não há correspondência segura.
 */
export function identificarUnidade(
  dados: { pagador_cnpj?: string | null; pagador_nome?: string | null; cpf_cnpj?: string | null },
  unidades: UnidadeCnpj[],
): { unidade_id: string; metodo: 'cnpj' | 'nome' } | null {
  const pagador = soDigitos(dados.pagador_cnpj);
  const fornecedor = soDigitos(dados.cpf_cnpj);
  if (pagador.length === 14 && pagador !== fornecedor) {
    const u = unidades.find((x) => soDigitos(x.cnpj) === pagador);
    if (u) return { unidade_id: u.id, metodo: 'cnpj' };
  }
  const nome = semAcento(dados.pagador_nome ?? '');
  if (nome) {
    const achadas = unidades.filter((u) => {
      const k = chaveNome(u.nome);
      return k.length >= 4 && nome.includes(k);
    });
    if (achadas.length === 1) return { unidade_id: achadas[0].id, metodo: 'nome' };
  }
  return null;
}

export interface ContaExistente {
  id: string;
  valor: number;
  data_vencimento: string;
  linha_digitavel: string | null;
  codigo_barras: string | null;
  chave_nfe: string | null;
  numero_fatura: string | null;
  fornecedor_documento: string | null;
  status: string;
}

export type Correspondencia =
  | { tipo: 'duplicado'; conta: ContaExistente }
  | { tipo: 'vinculo'; conta: ContaExistente; divergente: boolean };

/**
 * Procura conta correspondente na mesma unidade.
 * - Mesmo documento (linha digitável, código de barras ou chave NF-e iguais) → duplicado.
 * - Nota ↔ boleto do mesmo fornecedor e valor (ou mesmo número de nota) → vínculo.
 */
export function acharCorrespondencia(dados: any, contas: ContaExistente[]): Correspondencia | null {
  const linha = soDigitos(dados.linha_digitavel);
  const barras = soDigitos(dados.codigo_barras);
  const chave = soDigitos(dados.chave_nfe);
  const forn = soDigitos(dados.cpf_cnpj);
  const numero = String(dados.numero_documento ?? '').trim();
  const valor = typeof dados.valor === 'number' ? dados.valor : null;
  const venc = dados.data_vencimento ?? null;

  for (const c of contas) {
    if (linha && soDigitos(c.linha_digitavel) === linha) return { tipo: 'duplicado', conta: c };
    if (barras.length >= 44 && soDigitos(c.codigo_barras) === barras) return { tipo: 'duplicado', conta: c };
    if (chave.length === 44 && soDigitos(c.chave_nfe) === chave) return { tipo: 'duplicado', conta: c };
  }

  if (!forn) return null;
  const mesmoForn = contas.filter((c) => soDigitos(c.fornecedor_documento) === forn);
  for (const c of mesmoForn) {
    if (numero && c.numero_fatura && c.numero_fatura.trim() === numero) {
      const divergente = valor != null && Math.abs(Number(c.valor) - valor) > 0.01;
      return { tipo: 'vinculo', conta: c, divergente };
    }
  }
  if (valor == null) return null;
  for (const c of mesmoForn) {
    if (Math.abs(Number(c.valor) - valor) > 0.01) continue;
    // Documento complementar: um lado é nota (sem linha) e o outro é boleto
    const contaSemBoleto = !c.linha_digitavel && !c.codigo_barras;
    const contaSemNota = !c.chave_nfe && !c.numero_fatura;
    const docEhBoleto = !!(linha || barras);
    if ((docEhBoleto && contaSemBoleto) || (!docEhBoleto && contaSemNota) || (venc && c.data_vencimento === venc)) {
      return { tipo: 'vinculo', conta: c, divergente: false };
    }
  }
  return null;
}

const brl = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (d: string | null | undefined) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '—');

const TIPO_LABEL: Record<string, string> = {
  nota_fiscal: 'Nota fiscal',
  cupom_fiscal: 'Cupom fiscal',
  boleto: 'Boleto bancário',
  outro: 'Documento de cobrança',
};

export function msgProcessado(d: any, unidadeNome: string, extra = ''): string {
  const tipo = (TIPO_LABEL[d.tipo_documento] ?? 'Documento de cobrança').toLowerCase();
  return [
    `📥 Recebi ${tipo.startsWith('nota') ? 'a' : 'o'} ${tipo} e já lancei no Contas a Pagar:`,
    '',
    `🏢 ${unidadeNome}`,
    `👤 ${d.fornecedor ?? 'Fornecedor não identificado'}`,
    `💰 ${brl(d.valor)} — vence ${dataBr(d.data_vencimento)}`,
    '',
    'Ficou aguardando conferência. Dá uma olhada e toque em CONFIRMAR se estiver tudo certo, ou EDITAR para ajustar.' +
      (extra ? `\n\n${extra}` : ''),
  ].join('\n');
}

export function msgConfirmarUnidade(d: any): string {
  const comprovante = d?.comprovante_pagamento === true;
  return [
    comprovante ? '🧾 Recebi o comprovante de pagamento.' : '📥 Recebi o documento.',
    '',
    `👤 ${d?.fornecedor ?? 'Fornecedor não identificado'}`,
    `💰 ${brl(d?.valor)}` + (comprovante ? ` — pago em ${dataBr(d?.data_emissao)}` : ` — vence ${dataBr(d?.data_vencimento)}`),
    '',
    'Não consegui saber de qual unidade é. Qual delas?',
  ].join('\n');
}

export function msgDuplicado(vinculou: boolean): string {
  return vinculou
    ? '📎 Essa conta já estava no Contas a Pagar, então só anexei o arquivo nela. Nada novo foi lançado.'
    : '👍 Esse arquivo já está no Contas a Pagar. Não lancei de novo.';
}

export function msgAguardandoVencimento(d: any, unidadeNome: string): string {
  return [
    '🧾 Recebi a nota fiscal:',
    '',
    `🏢 ${unidadeNome}`,
    `👤 ${d.fornecedor ?? 'Fornecedor não identificado'}`,
    `💰 ${brl(d.valor)}`,
    '',
    'Ela não tem vencimento. Manda o boleto dela aqui que eu completo o lançamento.',
  ].join('\n');
}
