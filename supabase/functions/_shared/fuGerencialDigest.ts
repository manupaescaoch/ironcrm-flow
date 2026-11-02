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
    const { data, error } = await admin.from('tasks').select('id,unidade_id,responsavel,fu_gerencial_lead_id,fu_gerencial_matricula_id')
      .in('fu_gerencial_status', ['pendente','em_andamento']).is('fu_gerencial_confirmado_em',null).lte('prazo',day).order('id').range(offset,offset+199);
    if (error) throw error;
    for (const task of data ?? []) {
      const { data: context, error: contextError } = await admin.rpc('fu_gerencial_contexto', { p_task: task.id, p_agora: now.toISOString() });
      if (contextError) throw contextError;
      if (!context?.elegivel) { results.push({ task: task.id, status: 'inelegivel' }); continue; }
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
      const payload = notificacaoFuGerencial(context.aluno,context.unidade,context.telefone,manager,context.avisos ?? []);
      const sent = await sendTelegramMessage({chat_id:group.telegram_chat_id,text:payload.text,reply_markup:tecladoFuGerencial(task.id,payload.link),recipient_type:'grupo',recipient_id:group.id,message_type:'fu_gerencial_m30'},admin);
      const { error: saveError } = await admin.from('tasks').update({ fu_gerencial_contexto: context, fu_gerencial_envio_status:sent.ok?'enviado':'erro',fu_gerencial_envio_erro:sent.error ?? null,
        ...(sent.ok ? {fu_gerencial_telegram_chat_id:group.telegram_chat_id,fu_gerencial_telegram_message_id:sent.message_id}:{}), }).eq('id',task.id);
      if (saveError) throw saveError;
      results.push({task:task.id,status:sent.ok?'enviado':'erro'});
    }
    if ((data?.length ?? 0)<200) break;
  }
  return {success:results.every(r=>!['erro','sem_grupo'].includes(r.status)),results};
}