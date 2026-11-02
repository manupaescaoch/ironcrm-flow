import { observeManualCandidate } from './contactControl.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { resolveGrupoUnidade, sendTelegramMessage } from './telegram.ts';
import { tecladoFuTecnico, notificacaoFuTecnico, recifeTecnicoDia } from './fuTecnicoRules.ts';

/** Technical follow-ups only; never calls WhatsApp, legacy FU or task notification functions. */
export async function sendTechnicalFu(admin: SupabaseClient, dryRun = false, now = new Date()) {
  const today = recifeTecnicoDia(now);
  const results: { task: string; status: string }[] = [];
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await admin.from('tasks').select('id,unidade_id,prazo,responsavel,fu_tecnico_etapa,fu_tecnico_lead_id,fu_tecnico_matricula_id')
      .in('fu_tecnico_status', ['pendente', 'em_andamento']).is('fu_tecnico_confirmado_em', null).lte('prazo', today).order('id').range(offset, offset + 199);
    if (error) throw error;
    for (const task of data ?? []) {
      const { data: lead, error: leadError } = await admin.from('leads').select('nome,telefone,unidade_id,ativo,is_matriculado,status_funil').eq('id', task.fu_tecnico_lead_id).single();
      if (leadError) throw leadError;
      if (!lead?.ativo || !lead.is_matriculado || lead.status_funil === 'perdido' || lead.unidade_id !== task.unidade_id) continue;
      const { data: enrollment, error: enrollmentError } = await admin.from('interacoes').select('fechou_matricula,cancelado,treinador_responsavel').eq('id', task.fu_tecnico_matricula_id).single();
      if (enrollmentError) throw enrollmentError;
      if (!enrollment?.fechou_matricula || enrollment.cancelado) continue;
      if (!dryRun) {
        try { await observeManualCandidate(admin, { lead_id: task.fu_tecnico_lead_id, unidade_id: task.unidade_id, ciclo_id: task.fu_tecnico_matricula_id, chave: 'candidato:fu_tecnico:' + task.id, fluxo: 'fu_tecnico', objetivo: 'tecnico', setor: 'coordenador', canal: 'whatsapp', prioridade: 2, nao_urgente: true, prazo_original: task.prazo ? task.prazo + 'T08:00:00-03:00' : null }); }
        catch { console.warn('[contato] observação de candidato indisponível; notificação interna preservada'); }
      }
      const grupo = await resolveGrupoUnidade(admin, task.unidade_id, ['coordenadores']);
      if (!grupo) {
        if (!dryRun) {
          const { error: pendingError } = await admin.from('tasks').update({ fu_tecnico_envio_status: 'sem_grupo', fu_tecnico_envio_erro: 'Grupo COORDENADOR não conectado nesta unidade' }).eq('id', task.id);
          if (pendingError) throw pendingError;
        }
        results.push({ task: task.id, status: 'sem_grupo' }); continue;
      }
      if (dryRun) { results.push({ task: task.id, status: 'preview' }); continue; }
      const { data: claimed, error: claimError } = await admin.rpc('fu_tecnico_claim', { p_task: task.id, p_dia: today });
      if (claimError) throw claimError;
      if (!claimed) { results.push({ task: task.id, status: 'ja_processado' }); continue; }
      const { data: unit, error: unitError } = await admin.from('unidades').select('nome').eq('id', task.unidade_id).single();
      if (unitError) throw unitError;
      // A single linked coordinator can be named; ambiguous assignments remain editable.
      const { data: staff, error: staffError } = await admin.from('cronograma_funcionarios').select('nome,user_id').eq('unidade_id', task.unidade_id).eq('ativo', true).not('user_id', 'is', null);
      if (staffError) throw staffError;
      const ids = (staff ?? []).map(s => s.user_id);
      const { data: roles, error: rolesError } = ids.length ? await admin.from('user_roles').select('user_id').eq('role', 'coordenador').in('user_id', ids) : { data: [], error: null };
      if (rolesError) throw rolesError;
      const coordinators = (staff ?? []).filter(s => (roles ?? []).some(r => r.user_id === s.user_id));
      const coordinator = task.responsavel !== '[COORDENADOR]' ? task.responsavel : coordinators.length === 1 ? coordinators[0].nome : null;
      const payload = notificacaoFuTecnico(task.fu_tecnico_etapa, lead.nome, unit.nome, lead.telefone, coordinator, enrollment.treinador_responsavel);
      const sent = await sendTelegramMessage({ chat_id: grupo.telegram_chat_id, text: payload.text, reply_markup: tecladoFuTecnico(task.id, payload.link), recipient_type: 'grupo', recipient_id: grupo.id, message_type: 'fu_tecnico' }, admin);
      // Fail closed on uncertain network outcomes; retry on the next Recife day, not repeatedly today.
      const { error: logError } = await admin.from('tasks').update({ fu_tecnico_envio_status: sent.ok ? 'enviado' : 'erro', fu_tecnico_envio_erro: sent.error ?? null,
        ...(sent.ok ? { fu_tecnico_telegram_chat_id: grupo.telegram_chat_id, fu_tecnico_telegram_message_id: sent.message_id } : {}),
      }).eq('id', task.id);
      if (logError) throw logError;
      results.push({ task: task.id, status: sent.ok ? 'enviado' : 'erro' });
    }
    if ((data?.length ?? 0) < 200) break;
  }
  return { success: results.every(r => !['erro', 'sem_grupo'].includes(r.status)), results };
}