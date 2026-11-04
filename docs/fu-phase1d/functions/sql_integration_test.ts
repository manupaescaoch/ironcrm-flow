// Requires an explicitly disposable local socket; no hosted credentials or real traffic.
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { createHandler } from './handler.ts';
const socket = Deno.env.get('FU_TEST_SOCKET');
if (socket !== '/tmp/fu-phase1c/socket') throw new Error('Explicit disposable socket required');
const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12,'0')}`;
async function sql(query: string) {
 const result=await new Deno.Command('psql',{args:['-h',socket,'-p','55439','-U','lovable','-d','postgres','-X','-At','-v','ON_ERROR_STOP=1','-c',query]}).output();
 if(!result.success)throw new Error(new TextDecoder().decode(result.stderr));return new TextDecoder().decode(result.stdout).trim();
}
Deno.test('Authenticated handler calls real isolated transaction and reload reads same confirmation',async()=>{
 const t=uuid(2000),actor=uuid(101),lead=uuid(2),unit=uuid(1),en=uuid(3);
 await sql(`INSERT INTO tasks(id,unidade_id,status,fu_tecnico_lead_id,fu_tecnico_matricula_id,fu_tecnico_etapa,fu_tecnico_status) VALUES('${t}','${unit}','a_fazer','${lead}','${en}','M+7','pendente');`);
 const handler=createHandler('internal',{actor:async token=>token==='fictitious-verified-session'?actor:null,rpc:async(_n,a)=>{
  try{return {data:JSON.parse(await sql(`SELECT fu_crm_confirmar_envio('${a.p_task}','${a.p_actor}','${a.p_lead}','${a.p_matricula}','${a.p_unidade}','${a.p_etapa}');`)),error:null};}catch{return {data:null,error:{code:'22023'}};}
 }});
 const request=()=>new Request('http://localhost/',{method:'POST',headers:{authorization:'Bearer fictitious-verified-session'},body:JSON.stringify({task_id:t,lead_id:lead,matricula_id:en,unidade_id:unit,etapa:'M+7'})});
 let r=await handler(request());assertEquals(r.status,200);const first=await r.json();assertEquals(first.duplicado,false);
 r=await handler(request());assertEquals(r.status,200);const repeated=await r.json();assertEquals(repeated.duplicado,true);assertEquals(first.confirmado_em,repeated.confirmado_em);
 assertEquals(await sql(`SELECT status FROM tasks WHERE id='${t}';`),'a_fazer');assertEquals(await sql(`SELECT count(*) FROM task_history WHERE task_id='${t}';`),'1');
});
