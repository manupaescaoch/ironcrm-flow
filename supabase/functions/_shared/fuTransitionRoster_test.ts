import { observeEnrollmentLegacyRoster } from './fuTransitionRoster.ts';
const assert=(v:boolean)=>{if(!v)throw new Error('Assertion failed');};
Deno.test('R01 observes only due enrollment roster and never sends or creates tasks',async()=>{
 const decisions:any[]=[];
 const rows=[
  {id:'cycle',lead_id:'lead',unidade_id:'unit',data_fechamento:'2026-11-01',leads:{id:'lead',unidade_id:'unit',ativo:true,is_matriculado:true}},
  {id:'old',lead_id:'lead',unidade_id:'unit',data_fechamento:'2026-10-01',leads:{id:'lead',unidade_id:'unit',ativo:true,is_matriculado:true}},
  {id:'inactive',lead_id:'inactive',unidade_id:'unit',data_fechamento:'2026-11-01',leads:{ativo:false,is_matriculado:true}},
 ];
 const chain=(data:any)=>{const q:any={then:(fn:any)=>Promise.resolve({data}).then(fn)};for(const n of ['select','eq','gte','order','range'])q[n]=()=>q;return q;};
 const admin={from:(table:string)=>{assert(['interacoes','follow_ups'].includes(table));return chain(table==='interacoes'?rows:[]);},rpc:(name:string,args:any)=>{assert(name==='fu_transicao_avaliar');decisions.push(args);return {data:{modo:'OBSERVACAO',suprimir:false}};}};
 const result=await observeEnrollmentLegacyRoster(admin,new Date('2026-11-02T12:00:00Z'));
 assert(result.observed===1&&decisions.length===1&&decisions[0].p_candidato.etapa==='D+1'&&decisions[0].p_candidato.ciclo_id==='cycle');
});
Deno.test('R01 already completed or future pending records stay excluded',async()=>{
 let decisions=0;
 const chain=(data:any)=>{const q:any={then:(fn:any)=>Promise.resolve({data}).then(fn)};for(const n of ['select','eq','gte','order','range'])q[n]=()=>q;return q;};
 const admin={from:(table:string)=>chain(table==='interacoes'?[{id:'cycle',lead_id:'lead',unidade_id:'unit',data_fechamento:'2026-11-01',leads:{unidade_id:'unit',ativo:true,is_matriculado:true}}]:[{status:'concluido'}]),rpc:()=>{decisions++;return {data:{modo:'OBSERVACAO',suprimir:false}};}};
 await observeEnrollmentLegacyRoster(admin,new Date('2026-11-02T12:00:00Z'));
 assert(decisions===0);
});