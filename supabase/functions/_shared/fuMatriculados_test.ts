import { receberBotaoFuMatriculados } from './fuMatriculadosBotoes.ts';
import { notificacaoFuMatriculados, tecladoFuMatriculados } from './fuMatriculadosRules.ts';
import { sendEnrollmentWelcomeFu } from './fuMatriculadosDigest.ts';
const assert=(v:boolean)=>{if(!v) throw new Error('Assertion failed');};
const id='00000000-0000-0000-0000-000000000001';
Deno.test('Opening uses registered phone and encoded personalized message without a callback',()=>{
 const p=notificacaoFuMatriculados('MANU PAES','EVO SETÚBAL','81996392285');
 const k=tecladoFuMatriculados(id,p.link); const b=k.inline_keyboard[0][0];
 assert('url' in b && typeof b.url === 'string' && new URL(b.url).pathname==='/5581996392285');
 assert('url' in b && typeof b.url === 'string' && new URL(b.url).searchParams.get('text')===p.mensagem);
 assert(!('callback_data' in b));
});
Deno.test('Confirmation edits original message, removes buttons and never sends a second notification',async()=>{
 const calls:{method:string;body:any}[]=[];
 const admin={rpc:(name:string,args:any)=>{assert(name==='fu_matriculados_confirmar_envio'&&args.p_task===id&&args.p_chat===-123);return {data:{ok:true,unidade:'TESTE',aluno:'ALUNO',responsavel:'COMERCIAL',confirmado_em:'2026-11-02T11:00:00Z'}};}};
 await receberBotaoFuMatriculados(admin,{id:'q',data:`fmc:${id}`,from:{id:1},message:{chat:{id:-123},message_id:10}},async(method,body)=>{calls.push({method,body});return {ok:true};});
 assert(calls.length===2&&calls[0].method==='editMessageText'&&calls[0].body.message_id===10&&calls[0].body.reply_markup.inline_keyboard.length===0);
});
Deno.test('Unauthorized user cannot edit original',async()=>{
 const calls:string[]=[];await receberBotaoFuMatriculados({rpc:()=>({data:{ok:false,erro:'Não autorizado'}})},{id:'q',data:`fmc:${id}`,from:{id:1},message:{chat:{id:-1},message_id:2}},async(m)=>{calls.push(m);return {ok:true};});assert(calls.length===1&&calls[0]==='answerCallbackQuery');
});
Deno.test('Other FU callbacks are untouched',async()=>assert(await receberBotaoFuMatriculados({}, {data:`fgc:${id}`})===false));
Deno.test('Invalid phone has no opening link',()=>assert(tecladoFuMatriculados(id,notificacaoFuMatriculados('ALUNO','TESTE','123').link).inline_keyboard[0].length===1));
function fakeAdmin(tasks:any[]) {
 let claimed=false;
 const chain=(value:any)=>{const q:any={then:(f:any)=>Promise.resolve(value).then(f)}; for(const n of ['select','not','is','neq','lte','order','range','eq','update'])q[n]=()=>q;q.maybeSingle=()=>Promise.resolve(value);q.single=()=>Promise.resolve(value);return q;};
 return {from:(table:string)=>chain({data:table==='tasks'?tasks:table==='leads'?{nome:'ALUNO',telefone:'81996392285',ativo:true,is_matriculado:true}: {nome:'TESTE'},error:null}),rpc:(name:string)=>{if(name==='contato_observar') return {data:{id:'observation',permitido:true,modo:'observacao'},error:null};const v=!claimed;claimed=true;return {data:v,error:null};}};
}
Deno.test('Individual messages only to Commercial in current unit; daily claim stops duplicate runs',async()=>{
 const calls:any[]=[];const admin=fakeAdmin([{id,unidade_id:'unit',fu_matriculados_lead_id:'lead'}]);
 const deps={resolve:async(_a:any,unit:any,types:any)=>{assert(unit==='unit'&&JSON.stringify(types)==='["comercial"]');return {id:'group',group_type:'comercial' as const,telegram_chat_id:-12,telegram_title:'TESTE'};},send:async(p:any)=>{calls.push(p);return {ok:true,message_id:9};}};
 await sendEnrollmentWelcomeFu(admin,false,undefined,new Date('2026-11-02T11:00:00Z'),deps);await sendEnrollmentWelcomeFu(admin,false,undefined,new Date('2026-11-02T11:00:00Z'),deps);
 assert(calls.length===1&&calls[0].chat_id===-12);
});
Deno.test('Task already notified is never re-notified',async()=>{
 let sends=0;const r=await sendEnrollmentWelcomeFu(fakeAdmin([{id,unidade_id:'unit',fu_matriculados_lead_id:'lead',fu_matriculados_chat_id:-12}]),false,undefined,new Date('2026-11-02T11:00:00Z'),{resolve:async()=>({id:'g',group_type:'comercial' as const,telegram_chat_id:-12,telegram_title:'T'}),send:async()=>{sends++;return {ok:true};}});
 assert(sends===0&&r.results[0].status==='ja_notificado');
});
Deno.test('Missing Commercial group never falls back or sends',async()=>{
 let sends=0;const r=await sendEnrollmentWelcomeFu(fakeAdmin([{id,unidade_id:'unit'}]),false,undefined,new Date('2026-11-02T11:00:00Z'),{resolve:async()=>null,send:async()=>{sends++;return {ok:true};}});assert(sends===0&&r.results[0].status==='sem_grupo');
});Deno.test('Recepção M+3 and M+32 use approved texts and identify the stage',()=>{
 const m3=notificacaoFuMatriculados('ANA SILVA','EVO SETÚBAL','81996392285','M+3');
 const m32=notificacaoFuMatriculados('ANA SILVA','EVO SETÚBAL','81996392285','M+32');
 assert(m3.mensagem.includes('primeiros dias na EVO')&&m3.text.includes('FU | RECEPÇÃO | M+3'));
 assert(m32.mensagem.includes('primeiro mês com a gente')&&m32.text.includes('FU | RECEPÇÃO | M+32'));
 assert(notificacaoFuMatriculados('ANA','EVO SETÚBAL',null).text.includes('FU | MATRICULADOS'));
});
