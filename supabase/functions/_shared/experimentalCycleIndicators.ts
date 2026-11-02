/** Prepared additive view. No caller or production query until migration/activation approval. */
export interface IndicatorCycle {id:string;unidade_id:string;interacao_id:string;data_aula:string;hora_aula:string;situacao:'ativo'|'substituido'|'cancelado';resultado:'pendente'|'compareceu'|'nao_compareceu'}
export function cycleIndicators(cycles:IndicatorCycle[],inicio:string,fim:string,now=new Date()) {
 const rows=[...new Map(cycles.filter(c=>c.data_aula>=inicio&&c.data_aula<fim).map(c=>[c.id,c])).values()];
 const count=(items:IndicatorCycle[])=>({ciclos:items.length,comparecimentos:items.filter(c=>c.resultado==='compareceu').length,faltas:items.filter(c=>c.resultado==='nao_compareceu').length,cancelamentos:items.filter(c=>c.situacao==='cancelado').length,reagendados:items.filter(c=>c.situacao==='substituido').length,pendentes:items.filter(c=>c.situacao==='ativo'&&c.resultado==='pendente'&&Date.parse(`${c.data_aula}T${c.hora_aula.slice(0,5)}:00-03:00`)<now.getTime()).length});
 const units=[...new Set(rows.map(c=>c.unidade_id))];
 return {...count(rows),por_unidade:units.map(unidade_id=>({unidade_id,...count(rows.filter(c=>c.unidade_id===unidade_id))})),historico_inconclusivo_incluido:false};
}
/** The existing 13 commercial fields and historical operational object are retained verbatim. */
export function appendCycleIndicators<T extends Record<string,unknown>>(summary:T,cycles:IndicatorCycle[],inicio:string,fim:string,now?:Date) {
 return {...summary,experimentais_ciclos_rastreaveis:cycleIndicators(cycles,inicio,fim,now)};
}