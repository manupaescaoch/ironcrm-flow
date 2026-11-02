import { evaluateTransition } from './fuTransition.ts';
import { addFuBusinessDays, diffFuBusinessDays, effectiveFuDay, fuDay } from './fuBusinessDays.ts';

/** Observe R01 without changing its calculated frontend roster or creating any task. */
export async function observeEnrollmentLegacyRoster(admin: any, now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Recife',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const cutoff = fuDay(new Date(now.getTime() - 80 * 86400000));
  let observed = 0;
  const latest = new Set<string>();
  for (let offset = 0; ; offset += 500) {
    const {data,error} = await admin.from('interacoes')
      .select('id,lead_id,unidade_id,data_fechamento,leads!inner(id,unidade_id,ativo,is_matriculado)')
      .eq('fechou_matricula',true).gte('data_fechamento',cutoff)
      .order('data_fechamento',{ascending:false}).order('id').range(offset,offset+499);
    if (error) throw error;
    for (const row of data ?? []) {
      const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads;
      if (!lead?.ativo || !lead.is_matriculado || row.unidade_id !== lead.unidade_id || latest.has(row.lead_id)) continue;
      latest.add(row.lead_id);
      const days = diffFuBusinessDays(row.data_fechamento,today);
      const stage = days < 1 || days > 45 ? null : days <= 1 ? 'D+1' : days <= 15 ? 'D+7' : 'D+30';
      if (!stage) continue;
      // Existing completed/future D+ records remain the frontend's source, not rewritten here.
      const {data:follows,error:fuError} = await admin.from('follow_ups').select('status,data_prevista')
        .eq('lead_id',row.lead_id).eq('unidade_id',row.unidade_id).eq('tipo',stage);
      if (fuError) throw fuError;
      if ((follows ?? []).some((f:any) => f.status==='concluido' || (f.status==='pendente' && f.data_prevista && effectiveFuDay(f.data_prevista)>today))) continue;
      const saved = (follows ?? []).find((f:any) => f.status==='pendente');
      const due = saved?.data_prevista ? effectiveFuDay(saved.data_prevista) : fuDay(addFuBusinessDays(row.data_fechamento,Number(stage.slice(2))));
      if (due>today) continue;
      await evaluateTransition(admin,{familia:'R01',etapa:stage,lead_id:row.lead_id,unidade_id:row.unidade_id,ciclo_id:row.id});
      observed++;
    }
    if ((data?.length ?? 0)<500) break;
  }
  return {observed};
}