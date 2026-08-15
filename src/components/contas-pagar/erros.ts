/**
 * Traduz erros de salvamento/edição de contas a pagar em mensagens claras,
 * explicando o motivo e o que deve ser corrigido.
 */

const LABELS: Record<string, string> = {
  descricao: 'Descrição',
  valor: 'Valor',
  data_vencimento: 'Vencimento',
  recorrencia_qtd: 'Parcelas da recorrência',
  codigo_pix: 'Código Pix',
  linha_digitavel: 'Linha digitável',
  codigo_barras: 'Código de barras',
  chave_pix: 'Chave Pix',
  link_pagamento: 'Link de pagamento',
  numero_fatura: 'Número da fatura',
};

export function rotuloCampo(campo: string): string {
  return LABELS[campo] ?? campo;
}

/** Monta a lista "Campo: motivo" dos campos inválidos. */
export function descreverPendencias(errors: Record<string, string>): string {
  return Object.entries(errors)
    .map(([campo, motivo]) => `${rotuloCampo(campo)}: ${motivo.toLowerCase()}`)
    .join(' • ');
}

interface ErroDetalhado {
  titulo: string;
  descricao: string;
}

/** Explica o erro técnico do backend em linguagem do usuário, dizendo como corrigir. */
export function descreverErroConta(error: unknown, acao: 'salvar' | 'atualizar' = 'salvar'): ErroDetalhado {
  const raw = error as { message?: string; code?: string; details?: string; hint?: string } | null;
  const message = `${raw?.message ?? ''} ${raw?.details ?? ''}`.trim();
  const code = raw?.code ?? '';
  const base = acao === 'atualizar' ? 'Não foi possível atualizar a conta' : 'Não foi possível salvar a conta';

  const de = (descricao: string): ErroDetalhado => ({ titulo: base, descricao });

  if (!message && !code) {
    return de('Erro inesperado. Tente novamente e, se persistir, recarregue a página.');
  }

  if (code === '42501' || /row-level security|permission denied/i.test(message)) {
    return de(
      'Motivo: seu usuário não tem permissão nesta unidade. Corrija selecionando a unidade correta no topo do sistema ou peça acesso ao administrador.',
    );
  }
  if (code === '23505' || code === '23505' || /duplicate key|already exists/i.test(message)) {
    return de(
      'Motivo: já existe uma conta idêntica (mesma descrição, valor e vencimento). Corrija alterando um desses dados ou dê baixa na conta existente.',
    );
  }
  if (code === '23502' || /null value|not-null constraint/i.test(message)) {
    const campo = message.match(/column "([^"]+)"/)?.[1];
    return de(
      `Motivo: o campo obrigatório ${campo ? rotuloCampo(campo) : 'obrigatório'} está vazio. Preencha-o e salve novamente.`,
    );
  }
  if (code === '22P02' || /invalid input syntax/i.test(message)) {
    return de(
      'Motivo: um valor foi digitado em formato inválido (verifique valor em R$ e a data de vencimento). Corrija o formato e salve novamente.',
    );
  }
  if (code === '22003' || /numeric field overflow|out of range/i.test(message)) {
    return de('Motivo: o valor informado é maior do que o permitido. Corrija o valor da conta.');
  }
  if (code === '23503' || /foreign key/i.test(message)) {
    return de(
      'Motivo: a unidade ou o usuário vinculado não foi encontrado. Corrija recarregando a página e selecionando a unidade novamente.',
    );
  }
  if (code === '23514' || /check constraint/i.test(message)) {
    return de(
      'Motivo: algum campo está fora dos valores aceitos (status, prioridade ou forma de pagamento). Revise as opções selecionadas.',
    );
  }
  if (/Failed to fetch|NetworkError|network|timeout/i.test(message)) {
    return de('Motivo: falha de conexão com o servidor. Verifique sua internet e tente salvar novamente.');
  }
  if (/JWT|token|not authenticated|Usuário não autenticado/i.test(message)) {
    return de('Motivo: sua sessão expirou. Faça login novamente e repita o cadastro.');
  }
  if (/Nenhuma unidade selecionada/i.test(message)) {
    return de('Motivo: nenhuma unidade está selecionada. Escolha a unidade no topo do sistema antes de salvar.');
  }

  const limpa = message.replace(/\s+/g, ' ').slice(0, 200);
  return de(`Motivo: ${limpa}${code ? ` (código ${code})` : ''}.`);
}
