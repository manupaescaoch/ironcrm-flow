import { receberBotaoFuGerencial } from './fuGerencialBotoes.ts';
import { tecladoFuGerencial } from './fuGerencialRules.ts';
const assert = (ok: boolean) => { if (!ok) throw new Error('Assertion failed'); };
const id='00000000-0000-0000-0000-000000000001';
Deno.test('Open button never calls confirmation and callback carries task identity',()=>{
 const k=tecladoFuGerencial(id,'https://wa.me/5581999990000?text=Oi');
 assert('url' in k.inline_keyboard[0][0]); assert(k.inline_keyboard[0][1].callback_data===`fgc:${id}`);
});
Deno.test('Invalid phone omits opening button',()=>assert(tecladoFuGerencial(id,null).inline_keyboard[0].length===1));
Deno.test('Confirmed callback edits original, removes buttons and sends no new message',async()=>{
 const calls:{method:string;body:any}[]=[];let count=0;
 const admin={rpc:(name:string,args:any)=>{assert(name==='fu_gerencial_confirmar_envio');assert(args.p_task===id&&args.p_message===100);count++;return {data:{ok:true,duplicado:count>1,unidade:'TESTE',aluno:'ALUNO',responsavel:'MANU',confirmado_em:'2026-11-02T11:00:00Z'}};}};
 const api=async(method:string,body:any)=>{calls.push({method,body});return {ok:true};};
 const cq={id:'query',data:`fgc:${id}`,from:{id:123},message:{chat:{id:-123},message_id:100}};
 await receberBotaoFuGerencial(admin,cq,api);await receberBotaoFuGerencial(admin,cq,api);
 assert(calls.every(c=>c.method!=='sendMessage'));assert(calls.filter(c=>c.method==='editMessageText').every(c=>c.body.message_id===100&&c.body.reply_markup.inline_keyboard.length===0));
});
Deno.test('Unauthorized callback cannot edit Telegram',async()=>{
 const calls:string[]=[];
 await receberBotaoFuGerencial({rpc:()=>({data:{ok:false,erro:'Sem permissão'}})},{id:'q',data:`fgc:${id}`,from:{id:123},message:{chat:{id:-123},message_id:100}},async(m:string)=>{calls.push(m);return {ok:true};});
 assert(calls.length===1&&calls[0]==='answerCallbackQuery');
});
Deno.test('Other followup callbacks remain untouched',async()=>assert(await receberBotaoFuGerencial({}, {data:`ftc:${id}`})===false));