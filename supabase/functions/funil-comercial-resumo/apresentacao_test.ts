import { safeLossReason,safeLossGroups,countRecordedClosings,coverage,indicatorDefinitions,unitCriterion } from './apresentacao.ts';
import {handleResumo} from './index.ts';
const assert=(condition:boolean)=>{if(!condition)throw new Error('Assertion failed');};
Deno.test('FC-1 Outro free note never reaches presentation',()=>assert(safeLossReason('Outro: Cliente informou uma situação pessoal')==='Outro'));
Deno.test('FC-1 safe historical label is preserved literally',()=>assert(safeLossReason('Não atende / Telefone inválido')==='Não atende / Telefone inválido'));
Deno.test('FC-1 historical case remains compatible',()=>assert(safeLossReason('problemas financeiros')==='problemas financeiros'));
Deno.test('FC-1 annotated known category reveals only its category',()=>assert(safeLossReason('Problemas de saúde: situação pessoal')==='Problemas de saúde'));
Deno.test('FC-1 arbitrary personal text is fail-closed',()=>{
 for(const value of ['PESSOA TESTE','teste@example.invalid','81999999999','Outro - nota privada','Preço alto\nPessoa teste','<script>nota</script>'])assert(safeLossReason(value)==='Outro');
});
Deno.test('FC-1 missing loss category has existing fallback',()=>assert(safeLossReason(null)==='NÃO INFORMADO'&&safeLossReason('')==='NÃO INFORMADO'));
Deno.test('FC-1 multiple Outro notes consolidate amounts',()=>{
 const result=safeLossGroups([{motivo_perda:'Outro: nota 1'},{motivo_perda:'Outro: nota 2'},{motivo_perda:'Outro'}]);
 assert(result.length===1&&result[0].motivo==='Outro'&&result[0].qtd===3);
});
Deno.test('FC-1 safe grouping never mutates original notes',()=>{
 const rows=[{motivo_perda:'Outro: conteúdo privado'}];safeLossGroups(rows);assert(rows[0].motivo_perda==='Outro: conteúdo privado');
});
Deno.test('FC-1 safe historical distinct labels retain quantities',()=>{
 const result=safeLossGroups([{motivo_perda:'Optou por outra academia'},{motivo_perda:'Problemas financeiros'},{motivo_perda:'Problemas financeiros'}]);
 assert(result.length===2&&result.find(r=>r.motivo==='Problemas financeiros')?.qtd===2);
});
Deno.test('FC-1 closing count deduplicates by lead not interaction',()=>assert(countRecordedClosings([{lead_id:'a'},{lead_id:'a'},{lead_id:'b'},{lead_id:null}])===2));
Deno.test('FC-1 empty closings return zero',()=>assert(countRecordedClosings([])===0));
Deno.test('FC-1 coverage matches verified migration marker',()=>assert(coverage.inicio_registro_automatico==='2026-11-02T09:23:47.046-03:00'&&coverage.historico_completo===false&&coverage.criterio==='convertido_em_aluno_at'));
Deno.test('FC-1 metadata preserves global attribution criterion',()=>assert(unitCriterion.deduplicacao==='global_por_telefone'&&unitCriterion.atribuicao==='unidade_do_registro_vencedor'&&Object.keys(indicatorDefinitions).length===9));
function fixture() {
 const queries:{table:string;select:string;filters:unknown[][];offset?:number}[]=[];
 const admin={from(table:string){
  const state={table,select:'',filters:[] as unknown[][],offset:undefined as number|undefined};queries.push(state);
  const q:any={select(s:string){state.select=s;return q;},eq(k:string,v:unknown){state.filters.push([k,'eq',v]);return q;},gte(k:string,v:unknown){state.filters.push([k,'gte',v]);return q;},lt(k:string,v:unknown){state.filters.push([k,'lt',v]);return q;},order(){return q;},range(a:number){state.offset=a;return q;},maybeSingle(){return Promise.resolve({data:{valor:'fixture-token'},error:null});},then(fn:any){
   let data:any[]=[];
   if(table==='interacoes'&&state.select==='id,lead_id')data=state.offset===0?Array.from({length:1000},()=>({id:'interaction',lead_id:'same-lead'})):[{id:'last',lead_id:'other-lead'}];
   if(state.select==='id,motivo_perda')data=[{id:'private-id',motivo_perda:'Outro: PESSOA TESTE teste@example.invalid 81999999999'},{id:'another-private-id',motivo_perda:'Outro: outra nota'}];
   return Promise.resolve({data,count:0,error:null}).then(fn);
  }};return q;
 }};return {admin,queries};
}
const req=(inicio='2026-10-01',fim='2026-11-01')=>new Request('http://local',{method:'POST',headers:{'x-funil-token':'fixture-token'},body:JSON.stringify({inicio,fim})});
Deno.test('FC-1 full handler adds fields without dropping legacy contract or leaking notes',async()=>{
 const {admin}=fixture();const response=await handleResumo(req(),admin);const result=await response.json();
 assert(response.status===200);
 for(const field of ['periodo','leads_cadastrados','experimentais','por_status','pendentes_atualizacao','matriculas_por_data_conversao','por_unidade','por_origem','perdas_por_motivo','cobertura_matriculas','definicoes_indicadores','criterio_unidades','fechamentos_registrados_no_periodo'])assert(field in result);
 for(const value of ['PESSOA TESTE','teste@example.invalid','81999999999','private-id','fixture-token'])assert(!JSON.stringify(result).includes(value));
 assert(result.perdas_por_motivo[0].qtd===2&&result.fechamentos_registrados_no_periodo===2&&result.matriculas_por_data_conversao===0);
});
Deno.test('FC-1 closing query requires explicit flag and actual date, with paginated dedup',async()=>{
 const {admin,queries}=fixture();const result=await (await handleResumo(req(),admin)).json();
 const closings=queries.filter(q=>q.table==='interacoes'&&q.select==='id,lead_id');assert(closings.length===2&&result.fechamentos_registrados_no_periodo===2);
 for(const q of closings){assert(q.filters.some(f=>f[0]==='fechou_matricula'&&f[2]===true));assert(q.filters.some(f=>f[0]==='data_fechamento'&&f[1]==='gte'&&f[2]==='2026-10-01'));assert(q.filters.some(f=>f[0]==='data_fechamento'&&f[1]==='lt'&&f[2]==='2026-11-01'));assert(!q.filters.some(f=>f[0]==='created_at'));}
});
Deno.test('FC-1 unverified external period usage does not introduce 366-day breaking cap',async()=>assert((await handleResumo(req('2024-01-01','2026-01-01'),fixture().admin)).status===200));