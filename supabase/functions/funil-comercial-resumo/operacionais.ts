import {validDay,recifeDay} from './regras.ts';
export interface ExperimentalEvent {
 id:string;lead_id:string|null;unidade_id:string|null;agendou_experimental:boolean;
 data_experimental:string|null;hora_experimental:string|null;compareceu:boolean|null;
 cancelado:boolean;reagendou:boolean;
 leads?:{data_aula_experimental:string|null}|null;
}
export interface AttendanceEvidence {
 id:string;interacao_id:string;lead_id:string;unidade_id:string;
 data_aula:string;hora_aula:string;status:string;resultado:string|null;respondido_em:string|null;
}
const timeOf=(value:string|null)=>value&&/^\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(value)&&Number(value.slice(0,2))<24&&Number(value.slice(3,5))<60?value.slice(0,5):null;
const empty=()=>({agendamentos_registrados:0,comparecimentos_registrados:0,faltas_registradas:0,cancelamentos_registrados:0,reagendamentos_registrados:0,pendentes_confirmacao:0,pendentes_sem_horario_verificavel:0,revisao_necessaria:0,comparecimentos_conclusivos:0,faltas_conclusivas:0,cancelamentos_conclusivos:0,futuros_sem_resultado:0,marcacoes_falta_sem_evidencia:0,ciclos_analisados:0});
type Counts=ReturnType<typeof empty>;
type State='comparecimentos_conclusivos'|'faltas_conclusivas'|'cancelamentos_conclusivos'|'futuros_sem_resultado'|'pendentes_confirmacao'|'pendentes_sem_horario_verificavel'|'revisao_necessaria';
export function aggregateOperational(events:ExperimentalEvent[],evidence:AttendanceEvidence[],units:Map<string,string>,inicio:string,fim:string,now=new Date()) {
 // Row id identifies the origin; repeat pages cannot inflate record counts.
 const selected=[...new Map(events.filter(e=>e.agendou_experimental===true&&validDay(e.data_experimental)&&e.data_experimental>=inicio&&e.data_experimental<fim).map(e=>[e.id,e])).values()];
 const controls=new Map<string,AttendanceEvidence[]>();
 for(const item of evidence){const list=controls.get(item.interacao_id)??[];list.push(item);controls.set(item.interacao_id,list);}
 const byUnit=new Map<string,Counts>();
 const counts=empty();const reasons=new Map<string,number>();
 const addReason=(key:string)=>reasons.set(key,(reasons.get(key)??0)+1);
 const slotKey=(e:ExperimentalEvent)=>JSON.stringify([e.lead_id,e.unidade_id,e.data_experimental,timeOf(e.hora_experimental)??'sem_hora']);
 const cycles=new Map<string,ExperimentalEvent[]>();
 const confirmedNegative=(e:ExperimentalEvent)=>matching(e).some(c=>c.resultado==='nao_compareceu');
 function matching(e:ExperimentalEvent) {
  return (controls.get(e.id)??[]).filter(c=>c.status==='respondido'&&c.respondido_em&&c.lead_id===e.lead_id&&c.unidade_id===e.unidade_id&&c.data_aula===e.data_experimental&&timeOf(c.hora_aula)===timeOf(e.hora_experimental)&&timeOf(c.hora_aula)!==null);
 }
 for(const e of selected) {
  const key=e.unidade_id&&units.has(e.unidade_id)?e.unidade_id:'unidade_nao_identificada';
  const local=byUnit.get(key)??empty();byUnit.set(key,local);
  for(const target of [counts,local]) {
   target.agendamentos_registrados++;
   if(e.compareceu===true)target.comparecimentos_registrados++;
   if(confirmedNegative(e))target.faltas_registradas++;
   if(e.compareceu===false&&!confirmedNegative(e))target.marcacoes_falta_sem_evidencia++;
   if(e.cancelado===true)target.cancelamentos_registrados++;
   if(e.reagendou===true)target.reagendamentos_registrados++;
  }
  const groupKey=e.lead_id?slotKey(e):JSON.stringify(['sem_lead',e.id]);
  const list=cycles.get(groupKey)??[];list.push(e);cycles.set(groupKey,list);
 }
 for(const group of cycles.values()) {
  const first=group[0];if(!first)continue;
  const key=first.unidade_id&&units.has(first.unidade_id)?first.unidade_id:'unidade_nao_identificada';
  const local=byUnit.get(key);if(!local)continue;
  let state:State;let reason:string|null=null;
  const time=timeOf(first.hora_experimental);
  const responses=group.flatMap(matching);
  const yes=group.some(e=>e.compareceu===true)||responses.some(c=>c.resultado==='compareceu');
  const no=responses.some(c=>c.resultado==='nao_compareceu');
  const divergent=group.some(e=>e.leads?.data_aula_experimental&&recifeDay(e.leads.data_aula_experimental)!==e.data_experimental);
  if(group.length>1){state='revisao_necessaria';reason='multiplos_registros_mesmo_ciclo';}
  else if(!first.lead_id){state='revisao_necessaria';reason='identidade_do_ciclo_ausente';}
  else if(divergent){state='revisao_necessaria';reason='data_atual_do_lead_divergente';}
  else if(yes&&no){state='revisao_necessaria';reason='resultados_contraditorios';}
  else if(responses.some(c=>c.resultado==='compareceu')&&first.compareceu===false){state='revisao_necessaria';reason='resultado_atual_diverge_da_evidencia';}
  else if(first.cancelado&&(yes||no)){state='revisao_necessaria';reason='cancelamento_com_resultado_sem_sequencia';}
  else if(first.reagendou){state='revisao_necessaria';reason='reagendamento_sem_ciclo_anterior_comprovado';}
  else if(first.cancelado)state='cancelamentos_conclusivos';
  else if(yes)state='comparecimentos_conclusivos';
  else if(no)state='faltas_conclusivas';
  else if(first.compareceu===false){state='revisao_necessaria';reason='falta_pode_ser_valor_padrao';}
  else if(!time)state=first.data_experimental&&first.data_experimental<=recifeDay(now.toISOString())?'pendentes_sem_horario_verificavel':'futuros_sem_resultado';
  else state=Date.parse(`${first.data_experimental}T${time}:00-03:00`)<now.getTime()?'pendentes_confirmacao':'futuros_sem_resultado';
  counts[state]++;local[state]++;counts.ciclos_analisados++;local.ciclos_analisados++;
  if(reason)addReason(reason);
 }
 const rate=(c:Counts)=>({base_taxa_comparecimento:c.comparecimentos_conclusivos+c.faltas_conclusivas,taxa_comparecimento:c.revisao_necessaria>0||c.comparecimentos_conclusivos+c.faltas_conclusivas===0?null:100*c.comparecimentos_conclusivos/(c.comparecimentos_conclusivos+c.faltas_conclusivas)});
 return {...counts,...rate(counts),por_unidade:[...byUnit].map(([key,c])=>({unidade:key==='unidade_nao_identificada'?key:units.get(key),...c,...rate(c)})).sort((a,b)=>(a.unidade??'').localeCompare(b.unidade??'')),metadados:{
  fonte:'interacoes',evidencia_complementar:'experimental_presenca_telegram',fuso_horario:'America/Recife',criterio_temporal:'data_experimental da interação; início inclusivo e fim exclusivo',historico_imutavel:false,
  criterio_agendamentos:'agendou_experimental=true e data_experimental no período; registros distintos por id, sem deduplicação por telefone',
  criterio_ciclo:'lead + unidade do evento + data + hora verificável; múltiplos registros no mesmo ciclo vão para revisão, sem escolher mais recente',
  criterio_falta:'Somente resposta nao_compareceu com status respondido, respondido_em e vínculo exato de interação, lead, unidade, data e hora no controle de presença. compareceu=false isolado pode ser padrão histórico e não comprova falta.',
  criterio_pendencias:'compareceu=null, ciclo sem conflito/cancelamento/reagendamento, com horário transcorrido em Recife. Sem hora: separado somente em data de hoje ou anterior; nenhuma hora presumida.',
  criterio_unidade:'unidade_id da interação, sem fallback para a unidade atual do lead; unidade inválida/ausente fica em unidade_nao_identificada',
  criterio_taxa:'Presenças conclusivas / (presenças conclusivas + faltas conclusivas) × 100. Indisponível se há revisão ou base zero; a base informa ciclos com resultado seguro, não todos os eventos.',
  motivos_revisao:[...reasons].sort(([a],[b])=>a.localeCompare(b)).map(([motivo,qtd])=>({motivo,qtd})),
  observacao:'Eventos registrados editáveis, não uma trilha imutável de horários originais. Flags podem se sobrepor. Registros false sem evidência são mostrados separadamente, não como faltas confirmadas. Reagendamentos não permitem reconstruir o ciclo anterior com segurança. Indicadores diferem da fotografia atual dos leads.',
 }};
}