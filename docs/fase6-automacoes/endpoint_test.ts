import { assertEquals, assert } from 'jsr:@std/assert@1';
import { notificationRecord, requireUnit, ScopeError } from './package/_shared/automationAppScope.ts';
const automatic = ['confirmacao-experimental-automatica','healthcheck-follow-ups','notify-feedback-experimental','notify-nps-resposta','notify-resumo-semanal-crm','notify-resumo-semanal-pergunta','notify-rotinas-diarias','presenca-experimental-telegram','retry-anamneses-pendentes','send-cronograma-messages','send-formulario-lembretes'];
const admin = ['notify-task-deadlines','send-confirmacao-recepcao','send-fu-digest-comercial','notify-resumo-gestao-operacional','daily-crm-backup'];
const apps = ['ops-notify-task','send-task-whatsapp','notify-anamnese-experimental','notify-formulario-encerramento'];
const A='11111111-1111-1111-1111-111111111111', B='22222222-2222-2222-2222-222222222222';
const b64=(v:unknown)=>btoa(JSON.stringify(v)).replaceAll('=','').replaceAll('+','-').replaceAll('/','_');
const token=(role:string)=>`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:role,role:'authenticated',exp:4102444800,iss:'http://mock.local/auth/v1'})}.fictitioussignature`;
const keys=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_ANON_KEY','CRON_JOB_SECRET','BACKUP_CRON_SECRET'];
const env=['http://mock.local','fict-service','fict-anon','fict-job-000000000000000','fict-backup-111111111111'];
let handler:((r:Request)=>Promise<Response>)|undefined;
let authorizedDataCalls=0;
let scopeUnit=A;
let role='user';
async function fetchMock(input:any,init:any) {
 const url=new URL(input instanceof Request?input.url:String(input));
 assertEquals(url.hostname,'mock.local','Unexpected real network');
 const path=url.pathname;
 if(path.endsWith('/auth/v1/admin/users')) return Response.json({users:[{id:A,user_metadata:{name:'FICTICIO'}}]});
 if(path.includes('/auth/v1/')) return Response.json({id:role,role:'authenticated',email:'fict@example.invalid',app_metadata:{},user_metadata:{}});
 if(path.endsWith('/has_role')) {
  const body=JSON.parse(String(init?.body ?? '{}')); return Response.json(body._role===role);
 }
 authorizedDataCalls++;
 if(path.endsWith('/user_roles')) return Response.json([{role}]);
 if(path.endsWith('/user_unidades')) return Response.json(url.searchParams.get('unidade_id')===`eq.${B}`?[]:[{unidade_id:A}]);
 if(path.endsWith('/anamneses_experimental')) return Response.json(url.searchParams.get('id') ? {id:A,lead_id:A,unidade_id:scopeUnit}:[]);
 if(path.endsWith('/tasks')) return Response.json(url.searchParams.get('id') ? {id:A,unidade_id:scopeUnit,titulo:'FICTICIO',responsavel:'FICTICIO'}:[]);
 if(path.endsWith('/unidades')) return Response.json([{id:scopeUnit,nome:'MADALENA'}]);
 if(path.endsWith('/leads')) return Response.json({nome:'FICTICIO',unidade_id:scopeUnit});
 if(path.endsWith('/telegram_groups')) return Response.json([]);
 if(path.endsWith('/admin/users') || path.endsWith('/auth/v1/admin/users')) return Response.json({users:[{id:A,user_metadata:{name:'FICTICIO'}}]});
 return Response.json([]);
}
for(const name of [...automatic,...admin,...apps]) {
 Deno.test(`${name}: real endpoint authorization and no external transport`,async()=>{
  const originalFetch=globalThis.fetch, originalServe=Deno.serve;
  const previous=keys.map(k=>Deno.env.get(k));
  keys.forEach((k,i)=>Deno.env.set(k,env[i]));
  globalThis.fetch=fetchMock;
  (Deno as any).serve=(fn:any)=>{handler=fn;};
  try {
   handler=undefined; await import(`./package/${name}/index.ts`);
   const run=handler; assert(run,'Actual handler registered');
   const invoke=(headers:Record<string,string>,body:object={})=>run(new Request('http://mock.local/endpoint',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)}));
   authorizedDataCalls=0;
   const none=await invoke({}); assertEquals(none.status,name==='notify-resumo-semanal-crm'?200:401);
   assertEquals(authorizedDataCalls,0,'Denied request performed operational queries');
   role='user'; authorizedDataCalls=0;
   const common=await invoke({Authorization:`Bearer ${token('user')}`});
   if(automatic.includes(name)||admin.includes(name)) {
    assertEquals(common.status,name==='notify-resumo-semanal-crm'?200:admin.includes(name)?403:401);
    assertEquals(authorizedDataCalls,0,'Common user executed privileged routine');
   }
   if(automatic.includes(name)||admin.includes(name)) {
    for(const secret of [env[3],env[4]]) {
     const allowed=await invoke({'x-cron-secret':secret}); assert(![401,403].includes(allowed.status),'Valid scheduler blocked');
    }
   }
   if(admin.includes(name)) {
    role='admin'; const allowed=await invoke({Authorization:`Bearer ${token('admin')}`}); assert(![401,403].includes(allowed.status),'Admin blocked');
   }
   if(name==='ops-notify-task'||name==='notify-anamnese-experimental'||name==='send-task-whatsapp') {
    role='user'; scopeUnit=B; authorizedDataCalls=0;
    const body=name==='notify-anamnese-experimental'?{anamnese_id:A}:{task_id:A,task_title:'FICTICIO',responsavel_name:'FICTICIO'};
    assertEquals((await invoke({Authorization:`Bearer ${token('user')}`},body)).status,403);
    scopeUnit=A;
    const allowed=await invoke({Authorization:`Bearer ${token('user')}`},body);
    if(name==='send-task-whatsapp') assertEquals(allowed.status,500,'Fixture intentionally lacks provider credentials after successful scope check');
    else assertEquals(allowed.status,200,'Legitimate unit failed');
   }
   if(name==='notify-formulario-encerramento') {
    role='user';scopeUnit=A;
    const bad={tipo_formulario:'estagiario_lider',unidade:'MADALENA',unidade_id:B,mode:'test'};
    assertEquals((await invoke({Authorization:`Bearer ${token('user')}`},bad)).status,403);
    const internalKey='fict-internal-notify-0000000';
    const prior=Deno.env.get('INTERNAL_NOTIFY_SECRET');Deno.env.set('INTERNAL_NOTIFY_SECRET',internalKey);
    try {
     const good={tipo_formulario:'estagiario_lider',unidade:'MADALENA',unidade_id:A,resposta_id:A,row:{unidade:'MADALENA',nome:'FICTICIO'}};
     const result=await invoke({'x-internal-call':internalKey,'x-cron-secret':env[4]},good);
     assert(![401,403].includes(result.status),'Public form bridge rejected');
     assertEquals((await invoke({'x-internal-call':internalKey},{...good,unidade_id:B})).status,403);
    } finally {if(prior===undefined)Deno.env.delete('INTERNAL_NOTIFY_SECRET');else Deno.env.set('INTERNAL_NOTIFY_SECRET',prior);}
   }
   const preflight=await run(new Request('http://mock.local/endpoint',{method:'OPTIONS'}));assertEquals(preflight.status,200);
  }finally{
   globalThis.fetch=originalFetch;(Deno as any).serve=originalServe;
   keys.forEach((k,i)=>{const v=previous[i];if(v===undefined)Deno.env.delete(k);else Deno.env.set(k,v);});scopeUnit=A;
  }
 });
}
Deno.test('routine legacy consumer binds exact persisted unit and assignee; cross unit is denied',async()=>{
 const client:any={rpc:async()=>({data:false}),from:(table:string)=>{
  const q:any={select:()=>q,eq:()=>q,then:(resolve:any)=>resolve({data:table==='unidades'?[{id:A,nome:'EVO MADALENA'}]:table==='user_unidades'?[{unidade_id:A}]:table==='rotinas'?[{id:A,unidade_id:A,nome:'ROTINA',responsavel_principal:'FICTICIO'}]:[]})};return q;
 }};
 const auth={ok:true,method:'jwt' as const,userId:A};
 const row=await notificationRecord(client,auth,{unidade_nome:'EVO MADALENA',task_title:'ROTINA',responsavel_name:'FICTICIO'},true);assertEquals(row.id,A);
 let denied=false;try{await notificationRecord(client,auth,{unidade_nome:'OUTRA',task_title:'ROTINA',responsavel_name:'FICTICIO'},true);}catch(e){denied=e instanceof ScopeError&&e.status===403;}assert(denied);
});
