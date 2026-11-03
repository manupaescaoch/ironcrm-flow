import { observeManualCandidate } from './contactControl.ts';
import { resolveGrupoUnidade, sendTelegramMessage } from './telegram.ts';
import { notificacaoFuMatriculados, tecladoFuMatriculados, recifeTecnicoDia } from './fuMatriculadosRules.ts';
export async function sendEnrollmentWelcomeFu(admin: any, dryRun = false, taskId?: string, now = new Date(), deps = { resolve: resolveGrupoUnidade, send: sendTelegramMessage }) {
  const day = recifeTecnicoDia(now);
  const results: {task: string; status: string}[] = [];
  if ([0,6].includes(new Date(`${day}T12:00:00Z`).getUTCDay())) return {success:true,results,skipped:'fim_de_semana'};
  for (let offset=0; ; offset+=200) {
    let query = admin.from('tasks').select('id,unidade_id,prazo,fu_matriculados_lead_id,fu_matriculados_matricula_id,fu_matriculados_etapa,fu_matriculados_chat_id').not('fu_matriculados_matricula_id','is',null).is('fu_matriculados_confirmado_em',null).neq('status','concluida').lte('prazo',day).order('id').range(offset,offset+199);
    if (taskId) query=query.eq('id',taskId);
    const {data,error}=await query; if(error) throw error;
    for (const task of data ?? []) {
      const {data:lead,error:le}=await admin.from('leads').select('nome,telefone,ativo,is_matriculado,pausado_fu,origem').eq('id',task.fu_matriculados_lead_id).eq('unidade_id',task.unidade_id).maybeSingle();
      if(le) throw le;
      if(!lead?.ativo || !lead.is_matriculado || lead.pausado_fu) continue;
      if(task.fu_matriculados_chat_id) { results.push({task:task.id,status:'ja_notificado'}); continue; }
      if (!dryRun) {
        try { const decision = await observeManualCandidate(admin, { lead_id: task.fu_matriculados_lead_id, unidade_id: task.unidade_id, ciclo_id: task.fu_matriculados_matricula_id, chave: 'candidato:fu_matriculados:' + task.id, fluxo: 'fu_matriculados', objetivo: (task.fu_matriculados_etapa ?? 'BV') === 'BV' ? 'boas_vindas' : 'recepcao_' + task.fu_matriculados_etapa, setor: 'comercial', canal: 'whatsapp', prioridade: 4, nao_urgente: true, prazo_original: task.prazo ? task.prazo + 'T08:00:00-03:00' : null, excecao: 'transicao_matricula' }); if (decision?.modo === 'ativo' && !decision.permitido) { results.push({ task: task.id, status: 'adiado' }); continue; } }
        catch { console.warn('[contato] observação de candidato indisponível; notificação interna preservada'); }
      }
      const group=await deps.resolve(admin,task.unidade_id,['comercial']);
      if(!group) {
        if(!dryRun) { const {error:e}=await admin.from('tasks').update({fu_matriculados_envio_erro:'Grupo COMERCIAL não conectado nesta unidade'}).eq('id',task.id); if(e) throw e; }
        results.push({task:task.id,status:'sem_grupo'}); continue;
      }
      if(dryRun) {results.push({task:task.id,status:'preview'});continue;}
      const {data:claimed,error:ce}=await admin.rpc('fu_matriculados_claim',{p_task:task.id,p_dia:day}); if(ce) throw ce;
      if(!claimed) continue;
      const {data:unit,error:ue}=await admin.from('unidades').select('nome').eq('id',task.unidade_id).single(); if(ue) throw ue;
      const payload=notificacaoFuMatriculados(lead.nome,unit.nome,lead.telefone,task.fu_matriculados_etapa ?? 'BV');
      const sent=await deps.send({chat_id:group.telegram_chat_id,text:payload.text,reply_markup:tecladoFuMatriculados(task.id,payload.link),recipient_type:'grupo',recipient_id:group.id,message_type:'fu_matriculados'},admin);
      const {error:se}=await admin.from('tasks').update({fu_matriculados_envio_erro:sent.error ?? null,...(sent.ok ? {fu_matriculados_chat_id:group.telegram_chat_id,fu_matriculados_message_id:sent.message_id} : {})}).eq('id',task.id); if(se) throw se;
      results.push({task:task.id,status:sent.ok?'enviado':'erro'});
    }
    if((data?.length ?? 0)<200) break;
  }
  return {success:results.every(r=>!['erro','sem_grupo'].includes(r.status)),results};
}