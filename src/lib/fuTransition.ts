import { supabase } from '@/integrations/supabase/client';
export interface RosterCandidate {lead_id:string;etapa:string;ciclo_id:string;}
/** Only returns server-approved exclusions. Browser never writes transition settings. */
export async function transitionExclusions(unit: string, family: 'R01'|'G02', candidates: RosterCandidate[]) {
  const exclusions = new Set<string>();
  for(let start=0;start<candidates.length;start+=100) {
    const {data,error} = await supabase.rpc('fu_transicao_filtrar',{p_unidade:unit,p_familia:family,p_candidatos:candidates.slice(start,start+100)});
    if(error) throw error;
    if(Array.isArray(data)) for(const row of data) {
      if(row && typeof row==='object' && !Array.isArray(row) && typeof row.lead_id==='string' && typeof row.etapa==='string') exclusions.add(`${row.lead_id}|${row.etapa}`);
    }
  }
  return exclusions;
}