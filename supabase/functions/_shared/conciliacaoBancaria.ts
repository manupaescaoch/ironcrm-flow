// Conciliação entre contas pagas (Contas a Pagar) e débitos bancários enviados pelo EVO OS.
// Nunca cria despesa nem movimento bancário: só vincula uma transação existente a uma conta existente.
import { telegramApi } from './telegram.ts';
import { resolverGrupoContasPagar } from './contasPagarEnvio.ts';
import { formatarDataBR, formatarValorBR } from './contasPagarMensagem.ts';
import { decidir, JANELA_DIAS, TransMatch } from './conciliacaoRegras.ts';

export const PREFIXO_CONCILIACAO = 'cpc';

function addDias(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}

async function carregarConta(admin: any, id: string) {
  const { data } = await admin.from('contas_pagar').select('*, unidades(nome)').eq('id', id).maybeSingle();
  return data;
}

async function vincular(admin: any, conta: any, t: any, porNome: string, extra: Record<string, unknown> = {}) {
  // Reserva atômica: a transação só pode pertencer a uma conta.
  const { data: ok } = await admin.from('transacoes_bancarias_evo_os')
    .update({ conta_pagar_id: conta.id, conciliado_em: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', t.id).is('conta_pagar_id', null).select('id').maybeSingle();
  if (!ok) return false;
  await admin.from('contas_pagar').update({
    conciliacao_status: 'conciliado', conciliado_em: new Date().toISOString(), conciliado_por_nome: porNome,
    valor_debitado: Number(t.valor), transacao_bancaria_id: t.id, conciliacao_sugestoes: null, ...extra,
  }).eq('id', conta.id);
  await admin.from('contas_pagar_historico').insert({
    conta_id: conta.id, acao: 'edicao', campo: 'conciliacao',
    valor_anterior: conta.conciliacao_status, valor_novo: `conciliado com débito de ${formatarValorBR(t.valor)} em ${formatarDataBR(t.data)} (${t.descricao ?? 'EVO OS'})`,
    user_nome: porNome,
  });
  return true;
}

export type ResultadoConciliacao =
  | { status: 'conciliado'; transacao: any }
  | { status: 'divergencia'; transacao: any; diferenca: number }
  | { status: 'ambiguo'; sugestoes: any[] }
  | { status: 'aguardando' }
  | { status: 'ignorado' };

/** Tenta conciliar uma conta paga. Concilia sozinho quando a correspondência é única e exata. */
export async function conciliarConta(admin: any, contaId: string, opts: { notificar?: boolean } = {}): Promise<ResultadoConciliacao> {
  const conta = await carregarConta(admin, contaId);
  if (!conta || conta.deleted_at || conta.status !== 'paga' || conta.conciliacao_status === 'conciliado') return { status: 'ignorado' };
  const ref = String(conta.data_pagamento ?? conta.data_vencimento).slice(0, 10);
  const { data: trans } = await admin.from('transacoes_bancarias_evo_os').select('*')
    .eq('unidade_id', conta.unidade_id).eq('tipo', 'debito').is('conta_pagar_id', null)
    .gte('data', addDias(ref, -JANELA_DIAS)).lte('data', addDias(ref, JANELA_DIAS)).limit(500);
  const d = decidir(conta, (trans ?? []) as TransMatch[]);

  if (d.tipo === 'auto') {
    if (await vincular(admin, conta, d.transacao, 'AUTOMÁTICO', { valor_pago: Number(d.transacao.valor) })) {
      return { status: 'conciliado', transacao: d.transacao };
    }
    return { status: 'aguardando' };
  }
  if (d.tipo === 'nenhum') {
    if (conta.conciliacao_status !== 'aguardando_transacao') {
      await admin.from('contas_pagar').update({ conciliacao_status: 'aguardando_transacao', conciliacao_sugestoes: null }).eq('id', conta.id);
    }
    return { status: 'aguardando' };
  }

  const ids = d.tipo === 'divergencia' ? [d.transacao.id] : d.sugestoes.map((s) => s.id);
  const mudou = JSON.stringify(conta.conciliacao_sugestoes ?? []) !== JSON.stringify(ids);
  await admin.from('contas_pagar').update({ conciliacao_status: 'divergencia', conciliacao_sugestoes: ids }).eq('id', conta.id);
  const resultado: ResultadoConciliacao = d.tipo === 'divergencia'
    ? { status: 'divergencia', transacao: d.transacao, diferenca: d.diferenca }
    : { status: 'ambiguo', sugestoes: d.sugestoes };
  // Evita notificação repetida: só avisa quando as sugestões mudam.
  if (opts.notificar !== false && (mudou || !conta.conciliacao_notificado_em)) {
    await notificarDivergencia(admin, conta, resultado);
  }
  return resultado;
}

function cabecalho(conta: any) {
  return [
    `Unidade: ${conta.unidades?.nome ?? ''}`,
    `Fornecedor: ${String(conta.fornecedor || conta.descricao || '').toUpperCase()}`,
    `Valor previsto: ${formatarValorBR(conta.valor)}`,
  ];
}

export function textoDivergencia(conta: any, r: ResultadoConciliacao): { text: string; reply_markup: unknown } {
  if (r.status === 'divergencia') {
    return {
      text: ['⚠️ CONCILIAÇÃO BANCÁRIA — DIVERGÊNCIA', '', ...cabecalho(conta),
        `Valor debitado: ${formatarValorBR(r.transacao.valor)} em ${formatarDataBR(r.transacao.data)}`,
        `Descrição bancária: ${r.transacao.descricao ?? '-'}`,
        `Diferença: ${formatarValorBR(Math.abs(r.diferenca))} ${r.diferenca > 0 ? 'a mais' : 'a menos'}`, '',
        'Como classificar a diferença?'].join('\n'),
      reply_markup: { inline_keyboard: [
        [{ text: r.diferenca > 0 ? 'Juros ou multa' : 'Desconto ou abatimento', callback_data: `${r.diferenca > 0 ? 'cpcj' : 'cpcd'}:${conta.id}` },
          { text: 'Pagamento parcial', callback_data: `cpcp:${conta.id}` }],
        [{ text: 'Transação incorreta', callback_data: `cpcx:${conta.id}` }],
      ] },
    };
  }
  if (r.status === 'ambiguo') {
    const linhas = r.sugestoes.map((s, i) => `${i + 1}. ${formatarDataBR(s.data)} — ${formatarValorBR(s.valor)} — ${s.descricao ?? '-'}`);
    return {
      text: ['🔎 CONCILIAÇÃO BANCÁRIA — MAIS DE UM DÉBITO', '', ...cabecalho(conta), '', ...linhas, '', 'Qual débito corresponde a esta conta?'].join('\n'),
      reply_markup: { inline_keyboard: [
        r.sugestoes.map((_, i) => ({ text: `Débito ${i + 1}`, callback_data: `cpcs:${conta.id}:${i}` })),
        [{ text: 'Nenhum destes', callback_data: `cpcx:${conta.id}` }],
      ] },
    };
  }
  return { text: '', reply_markup: undefined };
}

async function notificarDivergencia(admin: any, conta: any, r: ResultadoConciliacao) {
  const grupo = await resolverGrupoContasPagar(admin, conta.unidade_id);
  if (!grupo) return;
  const { text, reply_markup } = textoDivergencia(conta, r);
  const env = await telegramApi('sendMessage', { chat_id: grupo.telegram_chat_id, text, reply_markup });
  if (env.ok) await admin.from('contas_pagar').update({ conciliacao_notificado_em: new Date().toISOString() }).eq('id', conta.id);
}

export function textoConciliado(conta: any, t: any, porNome: string, extra?: string) {
  const dif = Number(t.valor) - Number(conta.valor);
  return ['✅ CONCILIAÇÃO BANCÁRIA', '', ...cabecalho(conta),
    `Valor debitado: ${formatarValorBR(t.valor)} em ${formatarDataBR(t.data)}`,
    `Diferença: ${formatarValorBR(Math.abs(dif))}${extra ? ` (${extra})` : ''}`,
    'Status da conta: Pago', `Conciliação: Conciliado (${porNome})`].join('\n');
}

/** Botões de classificação/escolha da conciliação (callback_data cpc?:<contaId>[:i]). */
export async function receberBotaoConciliacao(admin: any, cq: any, user: { userId: string; nome: string }): Promise<void> {
  const [acao, contaId, idx] = String(cq.data).split(':');
  const conta = await carregarConta(admin, contaId);
  const responder = (text: string, alert = false) => telegramApi('answerCallbackQuery', { callback_query_id: cq.id, text, show_alert: alert });
  const editar = (text: string, reply_markup: unknown = { inline_keyboard: [] }) =>
    telegramApi('editMessageText', { chat_id: cq.message.chat.id, message_id: cq.message.message_id, text, reply_markup });

  if (!conta || conta.deleted_at) { await responder('Lançamento não encontrado.', true); return; }
  if (conta.conciliacao_status === 'conciliado') { await responder('Esta conta já está conciliada.', true); await editar(String(cq.message.text ?? '') + '\n\n✅ Já conciliada.'); return; }
  const sug: string[] = conta.conciliacao_sugestoes ?? [];

  if (acao === 'cpcx') {
    await admin.from('contas_pagar').update({ conciliacao_status: 'aguardando_transacao', conciliacao_sugestoes: null }).eq('id', contaId);
    await admin.from('contas_pagar_historico').insert({ conta_id: contaId, acao: 'edicao', campo: 'conciliacao', valor_novo: 'transação sugerida recusada; aguardando débito', user_id: user.userId, user_nome: user.nome });
    await responder('Ok, aguardando o débito correto.');
    await editar([...cabecalho(conta), '', 'Conciliação bancária: Pendente', `Sugestão recusada por ${user.nome}. Aguardando identificação no extrato.`].join('\n'));
    return;
  }

  const transId = acao === 'cpcs' ? sug[Number(idx)] : sug[0];
  if (!transId) { await responder('Sugestão expirada. Aguarde a próxima conciliação.', true); return; }
  const { data: t } = await admin.from('transacoes_bancarias_evo_os').select('*').eq('id', transId).maybeSingle();
  if (!t || t.conta_pagar_id) { await responder('Este débito já foi usado em outra conta.', true); return; }
  if (t.unidade_id !== conta.unidade_id) { await responder('Débito de outra unidade não pode ser usado.', true); return; }

  const debito = Number(t.valor), previsto = Number(conta.valor), dif = Math.round((debito - previsto) * 100) / 100;

  if (acao === 'cpcs') {
    if (Math.abs(dif) < 0.005) {
      if (!(await vincular(admin, conta, t, user.nome, { valor_pago: debito }))) { await responder('Débito já utilizado.', true); return; }
      await responder('Conciliado ✅');
      await editar(textoConciliado(conta, t, user.nome));
      return;
    }
    await admin.from('contas_pagar').update({ conciliacao_sugestoes: [t.id] }).eq('id', contaId);
    const { text, reply_markup } = textoDivergencia(conta, { status: 'divergencia', transacao: t, diferenca: dif });
    await responder('Classifique a diferença');
    await editar(text, reply_markup);
    return;
  }

  // Nunca altera o valor original da obrigação: registra o pago e a diferença à parte.
  let extra: Record<string, unknown>, rotulo: string;
  if (acao === 'cpcj') { extra = { valor_pago: debito, juros: Math.max(0, dif), diferenca_classificacao: 'juros_multa' }; rotulo = 'juros/multa'; }
  else if (acao === 'cpcd') { extra = { valor_pago: debito, desconto: Math.abs(Math.min(0, dif)), diferenca_classificacao: 'desconto' }; rotulo = 'desconto/abatimento'; }
  else if (acao === 'cpcp') {
    if (debito >= previsto) { await responder('O débito não é menor que o previsto; não é parcial.', true); return; }
    extra = { valor_pago: debito, status: 'pendente', diferenca_classificacao: 'parcial' }; rotulo = `parcial — restam ${formatarValorBR(previsto - debito)}`;
  } else { await responder('Ação desconhecida.'); return; }

  if (!(await vincular(admin, conta, t, user.nome, extra))) { await responder('Débito já utilizado.', true); return; }
  await admin.from('contas_pagar_historico').insert({ conta_id: contaId, acao: 'edicao', campo: 'diferenca_classificacao', valor_novo: `${rotulo} (${formatarValorBR(Math.abs(dif))})`, user_id: user.userId, user_nome: user.nome });
  await responder('Conciliado ✅');
  await editar(textoConciliado(conta, t, user.nome, rotulo).replace('Status da conta: Pago', acao === 'cpcp' ? 'Status da conta: Parcialmente pago' : 'Status da conta: Pago'));
}

/** Reprocessa contas pagas ainda não conciliadas das unidades afetadas. */
export async function reconciliarPendentes(admin: any, unidadeIds: string[], desde: string) {
  if (!unidadeIds.length) return { verificadas: 0, conciliadas: 0, divergencias: 0 };
  const { data } = await admin.from('contas_pagar').select('id').eq('status', 'paga').is('deleted_at', null)
    .in('unidade_id', unidadeIds).in('conciliacao_status', ['nao_conciliado', 'aguardando_transacao', 'divergencia'])
    .gte('data_pagamento', addDias(desde, -JANELA_DIAS)).limit(500);
  let conciliadas = 0, divergencias = 0;
  for (const c of data ?? []) {
    const r = await conciliarConta(admin, c.id);
    if (r.status === 'conciliado') conciliadas++;
    else if (r.status === 'divergencia' || r.status === 'ambiguo') divergencias++;
  }
  return { verificadas: (data ?? []).length, conciliadas, divergencias };
}
