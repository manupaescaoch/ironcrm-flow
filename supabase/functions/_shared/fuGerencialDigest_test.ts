import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendManagerExperienceFu } from './fuGerencialDigest.ts';
Deno.test('Individual manager reminders are unit-scoped sequential daily and never contact a student', async()=>{
 const original=globalThis.fetch, token=Deno.env.get('TELEGRAM_BOT_TOKEN');Deno.env.set('TELEGRAM_BOT_TOKEN','test-only');
 const sent:any[]=[],claims=new Set<string>(),writes:any[]=[];
 globalThis.fetch=async(input,init)=>{
  const url=new URL(input instanceof Request?input.url:String(input));const method=init?.method??'GET',body=init?.body?JSON.parse(String(init.body)):null;const table=url.pathname.split('/').pop();let data:any=[];
  if(url.hostname==='api.telegram.org'){if(table!=='sendMessage')throw new Error('Unexpected Telegram operation');sent.push(body);return Response.json({ok:true,result:{message_id:sent.length}});}
  if(table==='tasks'){
   if(method==='PATCH'){writes.push(body);return Response.json([]);}
   data=[{id:'a',unidade_id:'A',responsavel:'[GERENTE]'},{id:'b',unidade_id:'B',responsavel:'[GERENTE]'}];
  }
  if(table==='fu_gerencial_contexto')data={elegivel:true,aluno:body.p_task==='a'?'ALUNO A':'ALUNO B',unidade:body.p_task==='a'?'A':'B',telefone:'81999990000',avisos:[]};
  if(table==='fu_gerencial_claim'){data=!claims.has(body.p_task);claims.add(body.p_task);}
  if(table==='telegram_groups'){
   data=[{id:'g',group_type:'gerencia',telegram_chat_id:url.searchParams.get('unidade_id')==='eq.A'?-1:-2}];
  }
  if(table==='cronograma_funcionarios')data=[];
  return Response.json(data);
 };
 try{
  const admin=createClient('http://mock.local','test',{auth:{persistSession:false}});
  const now=new Date('2026-12-02T11:00:00Z');
  await sendManagerExperienceFu(admin,false,now);
  if(sent.length!==2||sent[0].chat_id!==-1||sent[1].chat_id!==-2)throw new Error('Missing individual unit messages');
  if(sent[0].text.includes('ALUNO B')||sent[1].text.includes('ALUNO A'))throw new Error('Unit leak');
  if(writes.some(w=>w.status||w.fu_gerencial_status||w.fu_gerencial_confirmado_em))throw new Error('Reminder completed contact');
  await sendManagerExperienceFu(admin,false,now);if(sent.length!==2)throw new Error('Duplicate daily reminder');
  await sendManagerExperienceFu(admin,false,new Date('2026-12-05T11:00:00Z'));if(sent.length!==2)throw new Error('Weekend send');
 }finally{globalThis.fetch=original;if(token)Deno.env.set('TELEGRAM_BOT_TOKEN',token);else Deno.env.delete('TELEGRAM_BOT_TOKEN');}
});