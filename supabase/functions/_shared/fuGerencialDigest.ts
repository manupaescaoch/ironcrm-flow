import { observeManualCandidate } from './contactControl.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { resolveGrupoUnidade, sendTelegramMessage } from './telegram.ts';
import { isManagerFuWeekday } from './fuGerenteRules.ts';
import { notificacaoFuGerencial, tecladoFuGerencial, recifeTecnicoDia } from './fuGerencialRules.ts';
/** Uses existing manager cron. Never sends messages to a student. */
export async function sendManagerExperienceFu(admin: SupabaseClient, dryRun = false, now = new Date()) {
  const results: { task: string; status: string }[] = [];
  if (!isManagerFuWeekday(now)) return { success: true, results, skipped: 'fim_de_semana' };
  const day = recifeTecnicoDia(now);
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await admin.from('tasks').select('id,unidade_id,prazo,responsavel,fu_gerencial_lead_id,fu_gerencial_matricula_id,fu_gerencial_etapa')
      .in('fu_gerencial_status', ['pendente','em_andamento']).is('fu_gerencial_confirmado_em',null).lte('prazo',day).order('id').range(offset,offset+199);
    if (error) throw error;
    for (const task of data ?? []) {
      try {
      if (!dryRun) {
        try { const decision = await observeManualCandidate(admin, { lead_id: task.fu_gerencial_lead_id, unidade_id: task.unidade_id, ciclo_id: task.fu_gerencial_matricula_id, chave: 'candidato:fu_gerencial:' + task.id, fluxo: 'fu_gerencial', objetivo: 'experiencia', setor: 'gerente', canal: 'whatsapp', prioridade: 3, nao_urgente: true, prazo_original: task.prazo ? task.prazo + 'T08:00:00-03:00' : null }); if (decision?.modo === 'ativo' && !decision.permitido) { results.push({ task: task.id, status: 'adiado' }); continue; } }
        catch { console.warn('[contato] observação de candidato indisponível; notificação interna preservada'); }
      }
      const { data: context, error: contextError } = await admin.rpc('fu_gerencial_contexto', { p_task: task.id, p_agora: now.toISOString() });
      if (contextError) throw contextError;
      if (!context?.elegivel) { results.push({ task: task.id, status: 'inelegivel' }); continue; }
      if (context.objetivo_realizado) {
        if (!dryRun) {
          const { error: saveError } = await admin.from('tasks').update({fu_gerencial_contexto:context,fu_gerencial_envio_erro:'Objetivo já realizado: conferir histórico e dispensar acompanhamento.'}).eq('id',task.id);
          if (saveError) throw saveError;
        }
        results.push({task:task.id,status:'objetivo_realizado'}); continue;
      }
      if (context.adiar_ate && context.adiar_ate.slice(0,10) > day) {
        if (!dryRun) {
          const { error: saveError } = await admin.from('tasks').update({ prazo: context.adiar_ate.slice(0,10), fu_gerencial_contexto: context, fu_gerencial_envio_erro: context.motivo }).eq('id',task.id);
          if (saveError) throw saveError;
        }
        results.push({task:task.id,status:'adiado'}); continue;
      }
      const group = await resolveGrupoUnidade(admin,task.unidade_id,['gerencia']);
      if (!group) {
        if (!dryRun) {
          const { error: saveError } = await admin.from('tasks').update({fu_gerencial_envio_status:'sem_grupo',fu_gerencial_envio_erro:'Grupo GERENTE não conectado nesta unidade'}).eq('id',task.id);
          if (saveError) throw saveError;
        }
        results.push({task:task.id,status:'sem_grupo'}); continue;
      }
      if (dryRun) { results.push({task:task.id,status:'preview'}); continue; }
      const { data: claimed, error: claimError } = await admin.rpc('fu_gerencial_claim',{p_task:task.id,p_dia:day});
      if (claimError) throw claimError;
      if (!claimed) { results.push({task:task.id,status:'ja_processado'}); continue; }
      const { data: staff, error: staffError } = await admin.from('cronograma_funcionarios').select('nome,user_id').eq('unidade_id',task.unidade_id).eq('ativo',true).not('user_id','is',null);
      if (staffError) throw staffError;
      const ids = (staff ?? []).map(s => s.user_id);
      const { data: roles, error: roleError } = ids.length ? await admin.from('user_roles').select('user_id').eq('role','gerente').in('user_id',ids) : {data:[],error:null};
      if (roleError) throw roleError;
      const managers = (staff ?? []).filter(s => (roles ?? []).some(r => r.user_id === s.user_id));
      const manager = task.responsavel !== '[GERENTE]' ? task.responsavel : managers.length === 1 ? managers[0].nome : null;
      const payload = notificacaoFuGerencial(context.aluno,context.unidade,context.telefone,manager,context.avisos ?? [],task.fu_gerencial_etapa ?? 'M+30');
      const sent = await sendTelegramMessage({chat_id:group.telegram_chat_id,text:payload.text,reply_markup:tecladoFuGerencial(task.id,payload.link),recipient_type:'grupo',recipient_id:group.id,message_type:'fu_gerencial_m30'},admin);
      const { error: saveError } = await admin.from('tasks').update({ fu_gerencial_contexto: context, fu_gerencial_envio_status:sent.ok?'enviado':'erro',fu_gerencial_envio_erro:sent.error ?? null,
        ...(sent.ok ? {fu_gerencial_telegram_chat_id:group.telegram_chat_id,fu_gerencial_telegram_message_id:sent.message_id}:{}), }).eq('id',task.id);
      if (saveError) throw saveError;
      results.push({task:task.id,status:sent.ok?'enviado':'erro'});
      } catch (error) {
        // Do not release an existing claim: an ambiguous send remains protected.
        // One failing enrollment must not stop other tasks or endpoint routines.
        console.error('FU gerencial: falha isolada no acompanhamento', error instanceof Error ? error.message : 'erro desconhecido');
        results.push({ task: task.id, status: 'erro' });
      }
    }
    if ((data?.length ?? 0)<200) break;
  }
  return {success:results.every(r=>!['erro','sem_grupo'].includes(r.status)),results};
}