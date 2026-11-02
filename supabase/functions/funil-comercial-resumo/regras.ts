export interface SummaryLead {
 id:string; telefone_normalizado:string|null; status_funil:string|null;
 data_aula_experimental:string|null; unidade_id:string|null;
}
export const rank = (status:string|null) => status==='convertido'?4:status==='aula_realizada'?3:status==='perdido'?2:1;
export function validDay(day:unknown): day is string {
 if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
 const [y,m,d]=day.split('-').map(Number);
 const date=new Date(Date.UTC(y,m-1,d));
 return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d;
}
export const recifeStart = (day:string) => `${day}T00:00:00-03:00`;
export const recifeDay = (time:string) => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Recife',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time));
export function aggregateExperimentals(rows:SummaryLead[],units:Map<string,string>,today:string) {
 const phones=new Map<string,SummaryLead>();
 for(const row of rows) {
  // Missing normalized phone cannot identify a distinct telephone; exclude instead of merging unknown people.
  const phone=row.telefone_normalizado?.trim();
  if(!phone)continue;
  const old=phones.get(phone);
  if(!old||rank(row.status_funil)>rank(old.status_funil)) phones.set(phone,row);
 }
 const por_status={aula_agendada:0,aula_realizada:0,convertido:0,perdido:0};
 const byUnit=new Map<string,{unidade:string;experimentais:number;aula_realizada:number;convertido:number;perdido:number}>();
 let pendentes_atualizacao=0;
 for(const row of phones.values()) {
  const status=row.status_funil==='convertido'||row.status_funil==='aula_realizada'||row.status_funil==='perdido'?row.status_funil:'aula_agendada';
  por_status[status]++;
  if(row.status_funil==='aula_agendada'&&row.data_aula_experimental&&recifeDay(row.data_aula_experimental)<today)pendentes_atualizacao++;
  const key=row.unidade_id??'sem_unidade';
  const item=byUnit.get(key)??{unidade:units.get(key)??'NÃO INFORMADA',experimentais:0,aula_realizada:0,convertido:0,perdido:0};
  item.experimentais++;
  if(status!=='aula_agendada')item[status]++;
  byUnit.set(key,item);
 }
 return {experimentais:phones.size,por_status,pendentes_atualizacao,por_unidade:[...byUnit.values()].sort((a,b)=>a.unidade.localeCompare(b.unidade))};
}
export function countGroups(rows:Record<string,unknown>[],field:string,fallback:string) {
 const counts=new Map<string,number>();
 for(const row of rows){const key=typeof row[field]==='string'&&String(row[field]).trim()?String(row[field]):fallback;counts.set(key,(counts.get(key)??0)+1);}
 return [...counts].sort(([a],[b])=>a.localeCompare(b));
}