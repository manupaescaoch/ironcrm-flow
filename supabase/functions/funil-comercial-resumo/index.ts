import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders as sdkCorsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { aggregateExperimentals,countGroups,recifeDay,recifeStart,validDay,type SummaryLead } from './regras.ts';
import { safeLossGroups,countRecordedClosings,coverage,indicatorDefinitions,unitCriterion } from './apresentacao.ts';
import {aggregateOperational} from './operacionais.ts';

const headers={...sdkCorsHeaders,'Access-Control-Allow-Headers':`${sdkCorsHeaders['Access-Control-Allow-Headers']}, x-funil-token`,'Access-Control-Allow-Methods':'POST, OPTIONS'};
const response=(body:unknown,status=200)=>Response.json(body,{status,headers});
export async function handleResumo(req:Request,admin:any,now=new Date()) {
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 try {
  const supplied=req.headers.get('x-funil-token');
  if(!supplied)return response({error:'Não autorizado'},401);
  const {data:config,error:tokenError}=await admin.from('app_config').select('valor').eq('chave','funil_resumo_token').maybeSingle();
  if(tokenError)throw tokenError;
  if(!config?.valor||supplied!==config.valor)return response({error:'Não autorizado'},401);
  if(req.method!=='POST')return response({error:'Método não permitido'},405);
  let body:any;
  try {body=await req.json();}catch{return response({error:'Período inválido'},400);}
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['inicio','fim'].includes(k))||!validDay(body.inicio)||!validDay(body.fim)||body.inicio>=body.fim)return response({error:'Período inválido'},400);
  const {inicio,fim}=body;
  const start=recifeStart(inicio),end=recifeStart(fim);
  async function load(build:()=>any) {
   const rows:any[]=[];
   for(let offset=0;;offset+=1000){const {data,error}=await build().order('id').range(offset,offset+999);if(error)throw error;rows.push(...(data??[]));if((data?.length??0)<1000)break;}
   return rows;
  }
  const [experimental,registered,losses,conversions,unitResult,closings,operationalEvents,attendanceEvidence]=await Promise.all([
   load(()=>admin.from('leads').select('id,telefone_normalizado,status_funil,data_aula_experimental,unidade_id').gte('data_aula_experimental',start).lt('data_aula_experimental',end)),
   load(()=>admin.from('leads').select('id,origem').gte('created_at',start).lt('created_at',end)),
   load(()=>admin.from('leads').select('id,motivo_perda').gte('data_perda',start).lt('data_perda',end)),
   admin.from('leads').select('id',{count:'exact',head:true}).gte('convertido_em_aluno_at',start).lt('convertido_em_aluno_at',end),
   admin.from('unidades').select('id,nome'),
   load(()=>admin.from('interacoes').select('id,lead_id').eq('fechou_matricula',true).gte('data_fechamento',inicio).lt('data_fechamento',fim)),
   load(()=>admin.from('interacoes').select('id,lead_id,unidade_id,agendou_experimental,data_experimental,hora_experimental,compareceu,cancelado,reagendou,leads(data_aula_experimental)').eq('agendou_experimental',true).gte('data_experimental',inicio).lt('data_experimental',fim)),
   load(()=>admin.from('experimental_presenca_telegram').select('id,interacao_id,lead_id,unidade_id,data_aula,hora_aula,status,resultado,respondido_em').gte('data_aula',inicio).lt('data_aula',fim)),
  ]);
  if(conversions.error||unitResult.error)throw new Error('Consulta falhou');
  const units=new Map<string,string>((unitResult.data??[]).map((u:any)=>[u.id,u.nome]));
  return response({periodo:{inicio,fim},leads_cadastrados:registered.length,...aggregateExperimentals(experimental as SummaryLead[],units,recifeDay(now.toISOString())),matriculas_por_data_conversao:conversions.count??0,por_origem:countGroups(registered,'origem','NÃO INFORMADO').map(([origem,leads_cadastrados])=>({origem,leads_cadastrados})),perdas_por_motivo:safeLossGroups(losses),fechamentos_registrados_no_periodo:countRecordedClosings(closings),cobertura_matriculas:coverage,definicoes_indicadores:indicatorDefinitions,criterio_unidades:unitCriterion,experimentais_operacionais:aggregateOperational(operationalEvents,attendanceEvidence,units,inicio,fim,now)});
 }catch{return response({error:'Não foi possível obter o resumo'},500);}
}
if(import.meta.main) {
 const url=Deno.env.get('SUPABASE_URL');const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 Deno.serve((req:Request)=>url&&key?handleResumo(req,createClient(url,key,{auth:{persistSession:false}})):response({error:'Não foi possível obter o resumo'},500));
}