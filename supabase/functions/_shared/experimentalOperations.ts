import { z } from 'npm:zod@3.23.8';
const uuid=z.string().uuid();
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(`${v}T12:00:00Z`);return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;});
const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const base={unidade_id:uuid,chave:z.string().min(1).max(190)};
export const operationSchema=z.discriminatedUnion('operacao',[
 z.object({...base,operacao:z.literal('criar'),lead_id:uuid,data:day,hora:time,descricao:z.string().max(4000).optional()}).strict(),
 z.object({...base,operacao:z.literal('editar'),ciclo_id:uuid,versao:z.number().int().nonnegative(),descricao:z.string().max(4000).optional(),treinador:z.string().min(1).max(200).optional()}).strict().refine(v=>v.descricao!==undefined||v.treinador!==undefined),
 z.object({...base,operacao:z.literal('confirmar'),ciclo_id:uuid,versao:z.number().int().nonnegative(),resultado:z.enum(['compareceu','nao_compareceu']),motivo:z.string().min(1).max(1000).optional(),treinador:z.string().min(1).max(200).optional()}).strict(),
 z.object({...base,operacao:z.literal('cancelar'),ciclo_id:uuid,versao:z.number().int().nonnegative(),motivo:z.string().min(1).max(1000)}).strict(),
 z.object({...base,operacao:z.literal('inativar'),ciclo_id:uuid,versao:z.number().int().nonnegative(),motivo:z.string().min(1).max(1000)}).strict(),
 z.object({...base,operacao:z.literal('reagendar'),ciclo_id:uuid,versao:z.number().int().nonnegative(),motivo:z.string().min(1).max(1000),data:day,hora:time}).strict(),
]);
export type CycleCommand=z.infer<typeof operationSchema>;
export interface OperationsDeps {
 authenticate:(jwt:string)=>Promise<{id:string}|null>;
 allowed:(actor:string,unit:string)=>Promise<boolean>;
 execute:(actor:string,command:CycleCommand)=>Promise<unknown>;
}
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, content-type, apikey, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const response=(body:unknown,status=200)=>Response.json(body,{status,headers});
/** Prepared endpoint: JWT identity is always derived server-side; no service/cron body bypass. */
export async function handleExperimentalOperation(req:Request,deps:OperationsDeps):Promise<Response> {
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return response({error:'Método não permitido'},405);
 const match=req.headers.get('authorization')?.match(/^Bearer (.+)$/i);
 if(!match)return response({error:'Não autorizado'},401);
 try {
  const actor=await deps.authenticate(match[1]);if(!actor)return response({error:'Não autorizado'},401);
  let body:unknown;try{body=await req.json();}catch{return response({error:'Solicitação inválida'},400);}
  const parsed=operationSchema.safeParse(body);if(!parsed.success)return response({error:'Solicitação inválida'},400);
  if(!await deps.allowed(actor.id,parsed.data.unidade_id))return response({error:'Sem acesso à unidade'},403);
  return response(await deps.execute(actor.id,parsed.data));
 }catch{return response({error:'Operação não concluída; consulte o estado antes de repetir'},409);}
}