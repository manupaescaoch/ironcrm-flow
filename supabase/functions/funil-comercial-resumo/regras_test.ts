import {aggregateExperimentals,countGroups,validDay,recifeDay,recifeStart,type SummaryLead} from './regras.ts';
import {handleResumo} from './index.ts';
const assert=(value:boolean)=>{if(!value)throw new Error('Assertion failed');};
const row=(id:string,phone:string|null,status:string,unit='a',date='2026-11-01T03:00:00Z'):SummaryLead=>({id,telefone_normalizado:phone,status_funil:status,unidade_id:unit,data_aula_experimental:date});
const units=new Map([['a','A'],['b','B']]);
Deno.test('conversion wins over performed, lost and scheduled for same phone',()=>{
 const r=aggregateExperimentals([row('1','phone','aula_agendada'),row('2','phone','perdido'),row('3','phone','aula_realizada'),row('4','phone','convertido')],units,'2026-11-02');
 assert(r.experimentais===1&&r.por_status.convertido===1&&r.por_status.aula_realizada===0&&r.pendentes_atualizacao===0);
});
Deno.test('performed outranks lost and lost outranks other statuses',()=>{
 const r=aggregateExperimentals([row('1','p1','perdido'),row('2','p1','aula_realizada'),row('3','p2','novo'),row('4','p2','perdido')],units,'2026-11-02');
 assert(r.experimentais===2&&r.por_status.aula_realizada===1&&r.por_status.perdido===1);
});
Deno.test('dedup across units counts winning record only',()=>{
 const r=aggregateExperimentals([row('1','p','perdido','a'),row('2','p','convertido','b')],units,'2026-11-02');
 assert(r.por_unidade.length===1&&r.por_unidade[0].unidade==='B'&&r.por_unidade[0].convertido===1);
});
Deno.test('unknown phones are excluded, never merged into one invented telephone',()=>{
 const r=aggregateExperimentals([row('1',null,'perdido'),row('2','','convertido')],units,'2026-11-02');assert(r.experimentais===0);
});
Deno.test('only scheduled before today counts as pending update',()=>{
 const r=aggregateExperimentals([row('1','a','aula_agendada'),row('2','b','aula_agendada','a','2026-11-02T03:00:00Z'),row('3','c','novo')],units,'2026-11-02');assert(r.pendentes_atualizacao===1&&r.por_status.aula_agendada===3);
});
Deno.test('Recife midnight boundaries and valid calendar days',()=>{
 assert(recifeStart('2026-11-02')==='2026-11-02T00:00:00-03:00'&&recifeDay('2026-11-02T02:59:59Z')==='2026-11-01');
 assert(validDay('2024-02-29')&&!validDay('2026-02-29')&&!validDay('2026-11-31'));
});
Deno.test('origin and loss counts use rows not telephone dedup',()=>{
 assert(JSON.stringify(countGroups([{origem:'WHATSAPP'},{origem:'WHATSAPP'},{origem:null}],'origem','NÃO INFORMADO'))===JSON.stringify([['NÃO INFORMADO',1],['WHATSAPP',2]]));
 assert(countGroups([{motivo_perda:'Preço'},{motivo_perda:'Preço'}],'motivo_perda','NÃO INFORMADO')[0][1]===2);
});
function fakeAdmin(fail=false) {
 const queries:any[]=[];
 const admin={from:(table:string)=>{
  const state:any={table,filters:[],select:''};queries.push(state);
  const q:any={select:(s:string,o:any)=>{state.select=s;state.options=o;return q;},eq:(k:string,v:any)=>{state.filters.push([k,v]);return q;},gte:(k:string,v:any)=>{state.filters.push([k,'gte',v]);return q;},lt:(k:string,v:any)=>{state.filters.push([k,'lt',v]);return q;},order:()=>q,range:()=>q,maybeSingle:()=>Promise.resolve({data:{valor:'test-token'},error:fail?{}:null}),then:(fn:any)=>{
   let data:any=[];let count:any=null;
   if(table==='unidades')data=[{id:'a',nome:'A'}];
   if(state.select.includes('telefone_normalizado'))data=[row('1','phone','convertido')];
   if(state.select==='id,origem')data=[{id:'1',origem:'WHATSAPP'}];
   if(state.select==='id,motivo_perda')data=[{id:'1',motivo_perda:'Preço alto'}];
   if(state.options?.head)count=2;
   return Promise.resolve({data,count,error:fail?{}:null}).then(fn);
  }};return q;
 }};return {admin,queries};
}
const request=(body:any,token='test-token')=>new Request('http://local',{method:'POST',headers:token?{'x-funil-token':token}:{},body:JSON.stringify(body)});
Deno.test('missing or wrong token is 401',async()=>{
 const {admin}=fakeAdmin();assert((await handleResumo(request({},''),admin)).status===401&&(await handleResumo(request({},'wrong'),admin)).status===401);
});
Deno.test('invalid period and exclusive end order rejected',async()=>{
 for(const body of [{inicio:'2026-02-30',fim:'2026-03-01'},{inicio:'2026-11-02',fim:'2026-11-02'},{inicio:'2026-11-03',fim:'2026-11-02'}])assert((await handleResumo(request(body),fakeAdmin().admin)).status===400);
});
Deno.test('all requested output fields aggregate separately without personal data',async()=>{
 const {admin,queries}=fakeAdmin();const res=await handleResumo(request({inicio:'2026-11-01',fim:'2026-11-03'}),admin,new Date('2026-11-02T12:00:00Z'));const data=await res.json();
 assert(res.status===200&&data.leads_cadastrados===1&&data.experimentais===1&&data.matriculas_por_data_conversao===2&&data.por_origem[0].leads_cadastrados===1&&data.perdas_por_motivo[0].qtd===1&&data.por_unidade[0].unidade==='A');
 assert(!JSON.stringify(data).includes('phone')&&!('nome' in data)&&!('telefone_normalizado' in data));
 for(const q of queries.filter(q=>q.table==='leads')) assert(q.filters.some((f:any)=>f[1]==='gte'&&f[2]==='2026-11-01T00:00:00-03:00')&&q.filters.some((f:any)=>f[1]==='lt'&&f[2]==='2026-11-03T00:00:00-03:00'));
});
Deno.test('database failures are generic 500 with CORS',async()=>{
 const res=await handleResumo(request({inicio:'2026-11-01',fim:'2026-11-03'}),fakeAdmin(true).admin);assert(res.status===500&&res.headers.get('Access-Control-Allow-Origin')==='*'&&(await res.json()).error==='Não foi possível obter o resumo');
});
Deno.test('preflight does not require token',async()=>{const r=await handleResumo(new Request('http://local',{method:'OPTIONS'}),{});assert(r.status===200&&r.headers.get('Access-Control-Allow-Headers')?.includes('x-funil-token')===true);});