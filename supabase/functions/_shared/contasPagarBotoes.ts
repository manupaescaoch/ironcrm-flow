// Botões PAGO / REAGENDAR nas cobranças de Contas a Pagar no Telegram.
// Ações reais no banco: baixa (pagamento declarado) e reagendamento interno.
import { telegramApi } from './telegram.ts';
import { formatarDataBR, formatarValorBR } from './contasPagarMensagem.ts';

export const PREFIXOS = ['cpp:', 'cpr:', 'cprd:', 'cprc:', 'cprx:'];

export function tecladoCobranca(contaId: string) {
  return {
    inline_keyboard: [[
      { text: '✅ PAGO', callback_data: `cpp:${contaId}` },
      { text: '📅 REAGENDAR', callback_data: `cpr:${contaId}` },
    ]],
  };
}

function hojeBRT(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

/** Próximos N dias úteis (seg–sex) a partir de amanhã, em yyyy-mm-dd. */
export function proximosDiasUteis(baseIso: string, n: number): string[] {
  const [a, m, d] = baseIso.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  const out: string[] = [];
  while (out.length < n) {
    dt.setUTCDate(dt.getUTCDate() + 1);
    const wd = dt.getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(dt.toISOString().slice(0, 10));
  }
  return out;
}

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
function rotuloDia(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  return `${DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

async function grupoIds(admin: any): Promise<number[]> {
  const { data } = await admin.from('telegram_groups').select('telegram_chat_id')
    .eq('group_type', 'contas_pagar').eq('status', 'conectado').not('telegram_chat_id', 'is', null);
  return (data ?? []).map((g: any) => Number(g.telegram_chat_id));
}

/** Usuário autorizado = Telegram vinculado a um usuário do CRM com permissão de gerir contas. */
export async function autorizar(admin: any, from: any): Promise<{ userId: string; nome: string } | null> {
  if (!from?.id) return null;
  const { data: tu } = await admin.from('telegram_users').select('user_id, status')
    .eq('telegram_user_id', from.id).maybeSingle();
  if (!tu?.user_id || (tu.status && tu.status !== 'conectado')) return null;
  const { data: pode } = await admin.rpc('can_manage_contas_pagar', { _user_id: tu.user_id });
  if (!pode) return null;
  let nome = [from.first_name, from.last_name].filter(Boolean).join(' ');
  try {
    const { data } = await admin.auth.admin.getUserById(tu.user_id);
    nome = String(data?.user?.user_metadata?.full_name || data?.user?.user_metadata?.name || nome || data?.user?.email || 'USUÁRIO');
  } catch { /* mantém nome do Telegram */ }
  return { userId: tu.user_id, nome: nome.toUpperCase() };
}

async function carregar(admin: any, id: string) {
  const { data } = await admin.from('contas_pagar').select('*, unidades(nome)').eq('id', id).maybeSingle();
  return data;
}

const alerta = (cq: any, text: string, show_alert = false) =>
  telegramApi('answerCallbackQuery', { callback_query_id: cq.id, text, show_alert });

async function editar(cq: any, text: string, reply_markup: unknown = { inline_keyboard: [] }) {
  const r = await telegramApi('editMessageText', {
    chat_id: cq.message.chat.id, message_id: cq.message.message_id, text, reply_markup,
  });
  if (!r.ok) console.warn('[contasPagarBotoes] editMessageText', r.description);
}

function textoPago(c: any, nome: string, quando: string) {
  return [
    '✅ PAGAMENTO CONFIRMADO', '',
    `Unidade: ${c.unidades?.nome ?? ''}`,
    `Descrição: ${String(c.descricao ?? '').toUpperCase()}`,
    `Valor: ${formatarValorBR(c.valor)}`,
    'Status: PAGO',
    `Confirmado por: ${nome}`,
    `Data: ${quando}`,
  ].join('\n');
}

function textoReagendado(c: any, nova: string, nome: string) {
  return [
    '📅 PAGAMENTO REAGENDADO', '',
    `Unidade: ${c.unidades?.nome ?? ''}`,
    `Descrição: ${String(c.descricao ?? '').toUpperCase()}`,
    `Valor: ${formatarValorBR(c.valor)}`,
    `Vencimento original: ${formatarDataBR(c.data_vencimento)}`,
    `Pagamento previsto: ${formatarDataBR(nova)}`,
    'Status: REAGENDADO',
    `Reagendado por: ${nome}`,
  ].join('\n');
}

function agoraBR(): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date());
}

export async function receberBotaoCobranca(admin: any, cq: any): Promise<boolean> {
  const data: string = cq?.data ?? '';
  if (!PREFIXOS.some((p) => data.startsWith(p))) return false;
  const [acao, contaId, dataArg] = data.split(':');

  if (!(await grupoIds(admin)).includes(Number(cq.message?.chat?.id))) {
    await alerta(cq, 'Ação não permitida neste chat.');
    return true;
  }
  const user = await autorizar(admin, cq.from);
  if (!user) {
    await alerta(cq, 'Você não tem permissão. Vincule seu Telegram ao CRM com acesso ao financeiro.', true);
    return true;
  }

  const conta = await carregar(admin, contaId);
  if (!conta || conta.deleted_at) {
    await alerta(cq, 'Lançamento não encontrado.', true);
    await editar(cq, String(cq.message?.text ?? '') + '\n\n⚠️ Lançamento não encontrado no sistema.');
    return true;
  }
  if (conta.status === 'paga') {
    await alerta(cq, 'Esta conta já está paga.', true);
    await editar(cq, textoPago(conta, conta.baixado_por_nome ?? '-', conta.baixado_em
      ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(conta.baixado_em))
      : formatarDataBR(conta.data_pagamento ?? hojeBRT())));
    return true;
  }
  if (conta.status === 'cancelada') {
    await alerta(cq, 'Esta conta foi cancelada.', true);
    await editar(cq, String(cq.message?.text ?? '') + '\n\n❌ Conta cancelada no sistema.');
    return true;
  }

  try {
    if (acao === 'cpp') {
      const hoje = hojeBRT();
      const { data: ok, error } = await admin.from('contas_pagar').update({
        status: 'paga',
        valor_pago: conta.valor,
        data_pagamento: hoje,
        forma_pagamento_baixa: conta.forma_pagamento,
        baixado_por: user.userId,
        baixado_por_nome: user.nome,
        baixado_em: new Date().toISOString(),
        baixa_origem: 'telegram_declarado',
        baixa_observacoes: 'Pagamento declarado via Telegram (sem comprovante) — sujeito a conciliação bancária.',
      }).eq('id', contaId).eq('status', 'pendente').select('id').maybeSingle();
      if (error) throw error;
      if (!ok) { await alerta(cq, 'Esta conta já foi baixada.', true); return true; }
      await admin.from('contas_pagar_historico').insert({
        conta_id: contaId, acao: 'baixa', campo: 'status', valor_anterior: 'pendente', valor_novo: 'paga (declarado via Telegram)',
        user_id: user.userId, user_nome: user.nome,
      });
      await alerta(cq, 'Baixa registrada ✅');
      await editar(cq, textoPago(conta, user.nome, agoraBR()));
      return true;
    }

    if (acao === 'cpr') {
      const base = hojeBRT();
      const dias = proximosDiasUteis(base, 6);
      const linhas = [];
      for (let i = 0; i < dias.length; i += 3) {
        linhas.push(dias.slice(i, i + 3).map((d) => ({ text: rotuloDia(d), callback_data: `cprd:${contaId}:${d.replace(/-/g, '')}` })));
      }
      linhas.push([{ text: '↩️ Voltar', callback_data: `cprx:${contaId}` }]);
      await alerta(cq, 'Escolha a nova data de pagamento');
      await telegramApi('editMessageReplyMarkup', { chat_id: cq.message.chat.id, message_id: cq.message.message_id, reply_markup: { inline_keyboard: linhas } });
      return true;
    }

    if (acao === 'cprx') {
      await alerta(cq, 'Cancelado');
      await telegramApi('editMessageReplyMarkup', { chat_id: cq.message.chat.id, message_id: cq.message.message_id, reply_markup: tecladoCobranca(contaId) });
      return true;
    }

    const iso = /^\d{8}$/.test(dataArg ?? '') ? `${dataArg.slice(0, 4)}-${dataArg.slice(4, 6)}-${dataArg.slice(6, 8)}` : '';
    if (!iso || iso <= hojeBRT()) { await alerta(cq, 'Data inválida.', true); return true; }

    if (acao === 'cprd') {
      await alerta(cq, `Confirmar ${formatarDataBR(iso)}?`);
      await telegramApi('editMessageReplyMarkup', {
        chat_id: cq.message.chat.id, message_id: cq.message.message_id,
        reply_markup: { inline_keyboard: [[
          { text: `✅ Confirmar ${formatarDataBR(iso)}`, callback_data: `cprc:${contaId}:${dataArg}` },
          { text: '↩️ Voltar', callback_data: `cpr:${contaId}` },
        ]] },
      });
      return true;
    }

    if (acao === 'cprc') {
      const anterior = conta.data_pagamento_prevista ?? conta.data_vencimento;
      const { data: ok, error } = await admin.from('contas_pagar').update({
        data_pagamento_prevista: iso, reagendado_por_nome: user.nome, reagendado_em: new Date().toISOString(),
      }).eq('id', contaId).eq('status', 'pendente').select('id').maybeSingle();
      if (error) throw error;
      if (!ok) { await alerta(cq, 'Não foi possível reagendar: conta não está pendente.', true); return true; }
      // Libera um novo lembrete na data programada (o envio confere a data efetiva).
      await admin.from('contas_pagar_envios').update({
        status: 'aguardando_envio', tentativas: 0, proxima_tentativa_em: null, erro_msg: null,
      }).eq('conta_id', contaId).eq('tipo_envio', 'VENCIMENTO');
      await admin.from('contas_pagar_historico').insert({
        conta_id: contaId, acao: 'edicao', campo: 'data_pagamento_prevista',
        valor_anterior: formatarDataBR(anterior), valor_novo: `${formatarDataBR(iso)} (reagendado via Telegram; vencimento original ${formatarDataBR(conta.data_vencimento)})`,
        user_id: user.userId, user_nome: user.nome,
      });
      await alerta(cq, 'Reagendado 📅');
      await editar(cq, textoReagendado(conta, iso, user.nome));
      return true;
    }
  } catch (e) {
    console.error('[contasPagarBotoes]', e);
    await alerta(cq, 'Erro ao registrar. Tente novamente ou use o CRM.', true);
    return true;
  }
  await alerta(cq, 'Ação desconhecida.');
  return true;
}
