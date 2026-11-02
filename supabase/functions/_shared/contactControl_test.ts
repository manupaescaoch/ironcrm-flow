import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { controlledSend, observeManualCandidate, type ContactIntent } from './contactControl.ts';
const intent: ContactIntent = { lead_id:'lead',unidade_id:'unit',chave:'event',fluxo:'comercial_d',objetivo:'conversao',setor:'comercial',canal:'whatsapp',prioridade:4,nao_urgente:true };
Deno.test('Central: deferred never invokes provider or completes follow-up',async()=>{
 let sent=0,finished=0;
 const admin={rpc:(name:string)=>{if(name==='contato_resultado') finished++;return Promise.resolve({data:{id:'id',permitido:false,modo:'ativo',motivo:'intervalo_72h'},error:null});}};
 const result=await controlledSend(admin,intent,async()=>{sent++;return {ok:true,skipped:false,status:200,body:{}};});
 assertEquals(result.deferred,true);assertEquals(sent,0);assertEquals(finished,0);
});
Deno.test('Central: observation records conflict but preserves allowed send',async()=>{
 let sent=0;const states:string[]=[];
 const admin={rpc:(name:string,args:any)=>{if(name==='contato_resultado') states.push(args.p_estado);return Promise.resolve({data:{id:'id',permitido:true,modo:'observacao',motivo:'intervalo_72h'},error:null});}};
 await controlledSend(admin,intent,async()=>{sent++;return{ok:true,skipped:false,status:200,body:{}};});
 assertEquals(sent,1);assertEquals(states,['enviado']);
});
Deno.test('Central: reservation error prevents provider call',async()=>{
 let sent=0;await assertRejects(()=>controlledSend({rpc:()=>Promise.resolve({error:'database error'})},intent,async()=>{sent++;return{ok:true,skipped:false,status:200,body:{}};}));assertEquals(sent,0);
});
Deno.test('Central: timeout is uncertain never confirmed',async()=>{
 const states:string[]=[];const admin={rpc:(name:string,args:any)=>{if(name==='contato_resultado')states.push(args.p_estado);return Promise.resolve({data:{id:'id',permitido:true,modo:'ativo'},error:null});}};
 await assertRejects(()=>controlledSend(admin,intent,async()=>{throw new Error('timeout');}));assertEquals(states,['incerto']);
});
Deno.test('Central: reused provider key is not successful contact evidence',async()=>{
 const states:string[]=[];const admin={rpc:(name:string,args:any)=>{if(name==='contato_resultado')states.push(args.p_estado);return Promise.resolve({data:{id:'id',permitido:true,modo:'observacao'},error:null});}};
 await controlledSend(admin,intent,async()=>({ok:false,skipped:true,status:0,body:{}}));assertEquals(states,['incerto']);
});
Deno.test('Central: Telegram reminder only observes, never reserves or confirms',async()=>{
 const calls:string[]=[];await observeManualCandidate({rpc:(name:string)=>{calls.push(name);return Promise.resolve({error:null});}},intent);assertEquals(calls,['contato_observar']);
});
Deno.test('Central: repeated/concurrent calls share a reservation',async()=>{
 let reserved=false,sent=0;const admin={rpc:(name:string)=>{if(name==='contato_reservar'){const permitted=!reserved;reserved=true;return Promise.resolve({data:{id:'id',permitido:permitted,modo:'ativo'},error:null});}return Promise.resolve({error:null});}};
 const send=async()=>{sent++;return{ok:true,skipped:false,status:200,body:{}};};
 await Promise.all([controlledSend(admin,intent,send),controlledSend(admin,intent,send)]);assertEquals(sent,1);
});