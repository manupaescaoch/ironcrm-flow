// Montagem da mensagem de WhatsApp para o módulo Contas a Pagar.
// Regras: nome da unidade dinâmico em negrito, descrição em caixa alta,
// data dd/mm/aaaa, valor no padrão brasileiro, e o dado de pagamento
// (Pix / linha digitável) copiado byte a byte, sem nenhuma alteração.

export interface ContaParaMensagem {
  descricao: string;
  data_vencimento: string; // yyyy-mm-dd
  valor: number | string;
  forma_pagamento: string;
  codigo_pix?: string | null;
  chave_pix?: string | null;
  linha_digitavel?: string | null;
  codigo_barras?: string | null;
  link_pagamento?: string | null;
  banco?: string | null;
  agencia?: string | null;
  conta_bancaria?: string | null;
  favorecido?: string | null;
  fornecedor?: string | null;
}

export function formatarDataBR(iso: string): string {
  const [ano, mes, dia] = String(iso).slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

export function formatarValorBR(valor: number | string): string {
  const n = typeof valor === 'number' ? valor : Number(valor);
  const fixed = (Number.isFinite(n) ? n : 0).toFixed(2);
  const [int, dec] = fixed.split('.');
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${intFmt},${dec}`;
}

/** Retorna o rótulo e o dado de pagamento. Nunca altera o conteúdo do dado. */
export function resolverDadoPagamento(conta: ContaParaMensagem): { label: string; dado: string } | null {
  const forma = (conta.forma_pagamento || '').toLowerCase();

  if (forma === 'pix') {
    const dado = conta.codigo_pix || conta.chave_pix;
    if (dado) return { label: 'Pix', dado };
  }

  if (forma === 'boleto') {
    const dado = conta.linha_digitavel || conta.codigo_barras;
    if (dado) return { label: 'Boleto', dado };
  }


  if (forma === 'transferencia') {
    const linhas: string[] = [];
    if (conta.banco) linhas.push(`Banco: ${conta.banco}`);
    if (conta.agencia) linhas.push(`Agência: ${conta.agencia}`);
    if (conta.conta_bancaria) linhas.push(`Conta: ${conta.conta_bancaria}`);
    const favorecido = conta.favorecido || conta.fornecedor;
    if (favorecido) linhas.push(`Favorecido: ${favorecido}`);
    if (linhas.length) return { label: 'Transferência', dado: linhas.join('\n') };
  }

  // Fallback: qualquer dado de pagamento preenchido, independente da forma.
  if (conta.codigo_pix || conta.chave_pix) {
    return { label: 'Pix', dado: (conta.codigo_pix || conta.chave_pix)! };
  }
  if (conta.linha_digitavel || conta.codigo_barras) {
    return { label: 'Boleto', dado: (conta.linha_digitavel || conta.codigo_barras)! };
  }
  if (conta.link_pagamento) {
    return { label: 'Link de pagamento', dado: conta.link_pagamento };
  }

  return null;
}

export function montarMensagemConta(conta: ContaParaMensagem, unidadeNome: string): string {
  const pagamento = resolverDadoPagamento(conta);

  const blocoPagamento = pagamento
    ? `${pagamento.label}:\n\n${pagamento.dado}`
    : 'Forma de pagamento: Outro\nDados para pagamento não informados.';

  return [
    `\u{1F534} *${(unidadeNome || '').toUpperCase()}* \u{1F534}`,
    '',
    '*\u26A0\uFE0F VENCE HOJE \u2014 PAGAMENTO URGENTE \u26A0\uFE0F*',
    '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501',
    '',
    `Descrição: ${(conta.descricao || '').toUpperCase()}`,
    `Vencimento: ${formatarDataBR(conta.data_vencimento)}`,
    `Valor: ${formatarValorBR(conta.valor)}`,
    '',
    blocoPagamento,
  ].join('\n');
}

