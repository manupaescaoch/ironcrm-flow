// Botões ✅ Compareceu / ❌ Não compareceu da confirmação de experimental no Telegram.
// Valida o grupo COMERCIAL da unidade, o estado atual do agendamento e registra
// quem respondeu. Cliques repetidos ou de mensagens antigas não alteram o registro.

import { telegramApi } from './telegram.ts';
import {
  PREFIXOS_PRESENCA,
  PREFIXO_COMPARECEU,
  agoraTextoBR,
  mensagemInvalidada,
  mensagemRespondida,
  validarSituacao,
  type DadosMensagem,
} from './experimentalPresenca.ts';

const alerta = (cq: any, text: string, show_alert = false) =>
  telegramApi('answerCallbackQuery', { callback_query_id: cq.id, text, show_alert });

async function editar(cq: any, text: string) {
  const r = await telegramApi('editMessageText', {
    chat_id: cq.message.chat.id,
    message_id: cq.message.message_id,
    text,
    reply_markup: { inline_keyboard: [] },
  });
  if (!r.ok) console.warn('[expPresenca] editMessageText:', r.description);
}

function nomeDe(from: any): string {
  const nome = [from?.first_name, from?.last_name].filter(Boolean).join(' ').trim();
  return (nome || from?.username || 'EQUIPE').toUpperCase();
}

/** Dispara o FU de reagendamento (mesma função usada pelo painel), via segredo de automação. */
async function dispararFuReagendamento(admin: any, leadId: string, interacaoId: string, responsavel: string) {
  try {
    const { data: cfg } = await admin.from('app_config').select('valor').eq('chave', 'cron_secret').maybeSingle();
    if (!cfg?.valor) {
      console.error('[expPresenca] cron_secret indisponível para FU reagendamento');
      return;
    }
    const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-reagendamento-experimental`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': cfg.valor },
      body: JSON.stringify({ lead_id: leadId, interacao_id: interacaoId, responsavel_nome: responsavel }),
    });
    if (!r.ok) console.error('[expPresenca] FU reagendamento falhou:', r.status, await r.text().catch(() => ''));
  } catch (e) {
    console.error('[expPresenca] erro ao disparar FU reagendamento', e);
  }
}

export async function receberBotaoPresenca(admin: any, cq: any): Promise<boolean> {
  const data: string = cq?.data ?? '';
  if (!PREFIXOS_PRESENCA.some((p) => data.startsWith(p))) return false;

  const compareceu = data.startsWith(PREFIXO_COMPARECEU);
  const interacaoId = data.slice(5);

  // Mensagem enviada para este agendamento (a mais recente com botões)
  const { data: msg } = await admin
    .from('experimental_presenca_telegram')
    .select('*')
    .eq('interacao_id', interacaoId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!msg) {
    await alerta(cq, 'Agendamento não encontrado.', true);
    return true;
  }

  // Só aceita clique vindo do grupo COMERCIAL da unidade do agendamento
  const { data: grupo } = await admin
    .from('telegram_groups')
    .select('id')
    .eq('unidade_id', msg.unidade_id)
    .eq('group_type', 'comercial')
    .eq('status', 'conectado')
    .eq('telegram_chat_id', Number(cq.message?.chat?.id))
    .maybeSingle();
  if (!grupo) {
    await alerta(cq, 'Ação permitida apenas no grupo COMERCIAL da unidade.', true);
    return true;
  }

  // Mensagem antiga (remarcada): nunca sobrescreve o registro atual
  if (msg.telegram_message_id && Number(msg.telegram_message_id) !== Number(cq.message?.message_id)) {
    await alerta(cq, 'Esta mensagem é de um agendamento anterior e já foi substituída.', true);
    return true;
  }

  const { data: it } = await admin
    .from('interacoes')
    .select('id, lead_id, unidade_id, data_experimental, hora_experimental, compareceu, cancelado')
    .eq('id', interacaoId)
    .maybeSingle();
  if (!it) {
    await alerta(cq, 'Agendamento não encontrado.', true);
    return true;
  }

  const { data: lead } = await admin.from('leads').select('nome, telefone').eq('id', it.lead_id).maybeSingle();
  const { data: unidade } = await admin.from('unidades').select('nome').eq('id', it.unidade_id).maybeSingle();
  const dados: DadosMensagem = {
    unidade: unidade?.nome ?? '',
    leadNome: lead?.nome ?? 'LEAD',
    leadTelefone: lead?.telefone ?? '',
    slot: { data: String(msg.data_aula).slice(0, 10), hora: msg.hora_aula },
  };

  const situacao = validarSituacao(it, dados.slot);

  if (situacao === 'cancelado' || situacao === 'remarcado') {
    await editar(cq, mensagemInvalidada(dados, situacao));
    await admin.from('experimental_presenca_telegram')
      .update({ status: 'cancelado', erro_msg: `agendamento_${situacao}`, updated_at: new Date().toISOString() })
      .eq('id', msg.id);
    await alerta(cq, situacao === 'cancelado' ? 'Este agendamento foi cancelado.' : 'Este agendamento foi remarcado.');
    return true;
  }

  if (situacao === 'ja_respondido' || msg.status === 'respondido') {
    await alerta(cq, 'Este agendamento já foi atualizado. Nenhuma alteração foi feita.', true);
    return true;
  }

  // Registra a resposta de forma atômica: só o primeiro clique vence.
  const agora = new Date().toISOString();
  const { data: claimed } = await admin
    .from('experimental_presenca_telegram')
    .update({
      status: 'respondido',
      resultado: compareceu ? 'compareceu' : 'nao_compareceu',
      origem_resposta: 'telegram',
      respondido_por: nomeDe(cq.from),
      respondido_em: agora,
      updated_at: agora,
    })
    .eq('id', msg.id)
    .eq('status', 'enviado')
    .select('id');

  if (!claimed || claimed.length === 0) {
    await alerta(cq, 'Este agendamento já foi atualizado. Nenhuma alteração foi feita.', true);
    return true;
  }

  // Atualiza o agendamento (gatilhos do banco cuidam de compareceu_em e dos follow-ups)
  const { error: upErr } = await admin
    .from('interacoes')
    .update({ compareceu })
    .eq('id', interacaoId)
    .is('compareceu', null);
  if (upErr) {
    console.error('[expPresenca] falha ao atualizar interacao', upErr.message);
    await alerta(cq, 'Não consegui registrar agora. Tente novamente.', true);
    return true;
  }

  if (compareceu) {
    // Mesmo efeito do painel: lead vai para follow_up (sem fechar matrícula)
    await admin.from('leads').update({ status_funil: 'follow_up' }).eq('id', it.lead_id).eq('is_matriculado', false);
  }

  await editar(cq, mensagemRespondida(dados, compareceu, nomeDe(cq.from)));
  await alerta(cq, compareceu ? 'Comparecimento confirmado.' : 'Não comparecimento registrado.');

  if (!compareceu) {
    await dispararFuReagendamento(admin, it.lead_id, interacaoId, nomeDe(cq.from));
  }

  console.log('[expPresenca] resposta registrada', { interacaoId, compareceu, por: nomeDe(cq.from), em: agoraTextoBR() });
  return true;
}
