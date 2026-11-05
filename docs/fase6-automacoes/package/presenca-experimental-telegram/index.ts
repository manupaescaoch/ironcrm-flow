// Confirmação de comparecimento à experimental pelo Telegram.
// acao "enviar" (cron a cada 5 min): envia a pergunta ao grupo COMERCIAL da unidade
// 30 min após o início da aula, com botões Compareceu / Não compareceu.
// acao "sincronizar" (gatilho do banco): reflete no Telegram alterações feitas
// manualmente no painel (comparecimento, cancelamento, remarcação).

import { authorizeCronOnly, CRON_CORS_HEADERS } from '../_shared/cronAuth.ts';
import { adminClient, resolveGrupoUnidade, sendTelegramGroupText, telegramApi } from '../_shared/telegram.ts';
import {
  dentroDaJanelaEnvio,
  mensagemInvalidada,
  mensagemPresenca,
  mensagemRespondida,
  tecladoPresenca,
  validarSituacao,
  type DadosMensagem,
  type SlotAula,
} from '../_shared/experimentalPresenca.ts';

const cors = CRON_CORS_HEADERS;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

function slotDaInteracao(i: any): SlotAula | null {
  const data = String(i.data_experimental ?? '').slice(0, 10);
  const hora = String(i.hora_experimental ?? '').slice(0, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{2}:\d{2}$/.test(hora)) return null;
  return { data, hora };
}

async function editarMensagem(chatId: number, messageId: number, text: string) {
  const r = await telegramApi('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    reply_markup: { inline_keyboard: [] },
  });
  if (!r.ok) console.warn('[presenca-exp] editMessageText:', r.description);
  return r.ok;
}

// ---------- acao "enviar" ----------
async function enviar(admin: any) {
  const agora = new Date();
  const janelaInicio = new Date(agora.getTime() - 6 * 60 * 60 * 1000); // aulas das últimas 6h
  const dataLimite = janelaInicio.toLocaleDateString('en-CA', { timeZone: 'America/Recife' });

  // Agendamentos de experimental de hoje (e fim de ontem, pelo fuso) ainda sem resposta
  const { data: interacoes, error } = await admin
    .from('interacoes')
    .select('id, lead_id, unidade_id, data_experimental, hora_experimental, compareceu, cancelado')
    .eq('agendou_experimental', true)
    .eq('cancelado', false)
    .is('compareceu', null)
    .not('data_experimental', 'is', null)
    .not('hora_experimental', 'is', null)
    .gte('data_experimental', dataLimite);

  if (error) throw error;

  const resultados: any[] = [];

  for (const it of interacoes ?? []) {
    const slot = slotDaInteracao(it);
    if (!slot || !dentroDaJanelaEnvio(slot, agora)) continue;

    // Idempotência: reserva a linha do slot antes de enviar.
    const { data: reserva, error: reservaErr } = await admin
      .from('experimental_presenca_telegram')
      .upsert({
        interacao_id: it.id,
        lead_id: it.lead_id,
        unidade_id: it.unidade_id,
        data_aula: slot.data,
        hora_aula: slot.hora,
        status: 'pendente',
      }, { onConflict: 'interacao_id,data_aula,hora_aula', ignoreDuplicates: true })
      .select('id, status')
      .maybeSingle();

    if (reservaErr) {
      console.error('[presenca-exp] reserva falhou', it.id, reservaErr.message);
      continue;
    }
    if (!reserva) continue; // já existe linha para este slot (enviada ou em andamento)

    // Revalida o estado imediatamente antes do envio (pode ter sido respondido no painel)
    const { data: atual } = await admin
      .from('interacoes')
      .select('compareceu, cancelado')
      .eq('id', it.id)
      .maybeSingle();
    if (!atual || atual.cancelado || atual.compareceu !== null) {
      await admin.from('experimental_presenca_telegram')
        .update({ status: 'cancelado', updated_at: new Date().toISOString() })
        .eq('id', reserva.id);
      resultados.push({ interacao_id: it.id, skipped: 'estado_alterado' });
      continue;
    }

    const grupo = await resolveGrupoUnidade(admin, it.unidade_id, ['comercial']);
    if (!grupo) {
      await admin.from('experimental_presenca_telegram')
        .update({ status: 'sem_grupo', erro_msg: 'Unidade sem grupo COMERCIAL vinculado', updated_at: new Date().toISOString() })
        .eq('id', reserva.id);
      resultados.push({ interacao_id: it.id, skipped: 'sem_grupo_comercial' });
      continue;
    }

    const { data: lead } = await admin
      .from('leads')
      .select('nome, telefone, ativo, is_matriculado, unidades:nome')
      .eq('id', it.lead_id)
      .maybeSingle();
    const { data: unidade } = await admin
      .from('unidades')
      .select('nome')
      .eq('id', it.unidade_id)
      .maybeSingle();

    if (!lead || lead.ativo === false) {
      await admin.from('experimental_presenca_telegram')
        .update({ status: 'cancelado', erro_msg: 'Lead inativo', updated_at: new Date().toISOString() })
        .eq('id', reserva.id);
      continue;
    }

    const dados: DadosMensagem = {
      unidade: unidade?.nome ?? '',
      leadNome: lead.nome ?? 'LEAD',
      leadTelefone: lead.telefone ?? '',
      slot,
    };

    const r = await sendTelegramGroupText(
      admin,
      grupo,
      mensagemPresenca(dados),
      'experimental_presenca',
      tecladoPresenca(it.id),
    );

    if (r.ok) {
      await admin.from('experimental_presenca_telegram')
        .update({
          status: 'enviado',
          telegram_chat_id: grupo.telegram_chat_id,
          telegram_message_id: r.message_id ?? null,
          enviado_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', reserva.id);
      resultados.push({ interacao_id: it.id, enviado: true });
    } else {
      // Falha de envio: libera a linha para nova tentativa no próximo ciclo, sem duplicar.
      await admin.from('experimental_presenca_telegram')
        .update({ status: 'pendente', erro_msg: String(r.error ?? 'erro').slice(0, 500), updated_at: new Date().toISOString() })
        .eq('id', reserva.id);
      resultados.push({ interacao_id: it.id, enviado: false, erro: r.error });
    }
  }

  return { processados: interacoes?.length ?? 0, resultados };
}

// ---------- acao "sincronizar" ----------
async function sincronizar(admin: any, interacaoId: string) {
  const { data: it } = await admin
    .from('interacoes')
    .select('id, lead_id, unidade_id, data_experimental, hora_experimental, compareceu, cancelado')
    .eq('id', interacaoId)
    .maybeSingle();
  if (!it) return { ok: true, ignored: 'interacao_inexistente' };

  // Última mensagem enviada para este agendamento, ainda sem resposta registrada
  const { data: msg } = await admin
    .from('experimental_presenca_telegram')
    .select('*')
    .eq('interacao_id', interacaoId)
    .eq('status', 'enviado')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!msg) return { ok: true, ignored: 'sem_mensagem_pendente' };

  const slotMsg: SlotAula = { data: String(msg.data_aula).slice(0, 10), hora: msg.hora_aula };
  const situacao = validarSituacao(it, slotMsg);

  if (situacao === 'ok') return { ok: true, ignored: 'sem_alteracao_relevante' };

  const { data: lead } = await admin.from('leads').select('nome, telefone').eq('id', it.lead_id).maybeSingle();
  const { data: unidade } = await admin.from('unidades').select('nome').eq('id', it.unidade_id).maybeSingle();
  const dados: DadosMensagem = {
    unidade: unidade?.nome ?? '',
    leadNome: lead?.nome ?? 'LEAD',
    leadTelefone: lead?.telefone ?? '',
    slot: slotMsg,
  };

  if (situacao === 'ja_respondido') {
    // Painel confirmou antes do clique no Telegram: reflete na mensagem e tira os botões.
    const texto = mensagemRespondida(dados, it.compareceu === true, 'PAINEL');
    if (msg.telegram_chat_id && msg.telegram_message_id) {
      await editarMensagem(Number(msg.telegram_chat_id), Number(msg.telegram_message_id), texto);
    }
    await admin.from('experimental_presenca_telegram')
      .update({
        status: 'respondido',
        resultado: it.compareceu === true ? 'compareceu' : 'nao_compareceu',
        origem_resposta: 'painel',
        respondido_por: 'PAINEL',
        respondido_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', msg.id);
    return { ok: true, sincronizado: 'respondido_painel' };
  }

  // cancelado ou remarcado: invalida os botões da mensagem antiga
  const motivo = situacao === 'cancelado' ? 'cancelado' : 'remarcado';
  if (msg.telegram_chat_id && msg.telegram_message_id) {
    await editarMensagem(Number(msg.telegram_chat_id), Number(msg.telegram_message_id), mensagemInvalidada(dados, motivo));
  }
  await admin.from('experimental_presenca_telegram')
    .update({ status: 'cancelado', erro_msg: `agendamento_${motivo}`, updated_at: new Date().toISOString() })
    .eq('id', msg.id);
  return { ok: true, sincronizado: motivo };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  const auth = await authorizeCronOnly(req);
  if (!auth.ok) return json({ error: auth.error || 'Unauthorized' }, auth.status || 401);

  try {
    const body = await req.json().catch(() => ({}));
    const admin = adminClient();

    if (body?.acao === 'sincronizar') {
      if (!body?.interacao_id) return json({ error: 'interacao_id obrigatório' }, 400);
      return json(await sincronizar(admin, String(body.interacao_id)));
    }

    return json({ ok: true, ...(await enviar(admin)) });
  } catch (e) {
    console.error('[presenca-exp] erro', e);
    return json({ error: e instanceof Error ? e.message : 'erro' }, 500);
  }
});
