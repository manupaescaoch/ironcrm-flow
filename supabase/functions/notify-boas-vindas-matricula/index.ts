// Existing welcome cron now requests manual Commercial contact only.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { authorizeCronOnly } from '../_shared/cronAuth.ts';
import { adminClient } from '../_shared/telegram.ts';
import { sendEnrollmentWelcomeFu } from '../_shared/fuMatriculadosDigest.ts';
import { boasVindasBodySchema } from './bodySchema.ts';
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', {headers:corsHeaders});
  const auth=authorizeCronOnly(req);
  const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
  if(!auth.ok) return json({error:auth.error},auth.status);
  try {
    const parsed=boasVindasBodySchema.safeParse(await req.json().catch(()=>({})));
    if(!parsed.success) return json({error:'Parâmetros inválidos'},400);
    const result=await sendEnrollmentWelcomeFu(adminClient(),parsed.data.dry_run===true,parsed.data.task_id);
    return json(result,result.success?200:502);
  } catch(error) {return json({error:error instanceof Error?error.message:'Falha no processamento'},500);}
});
