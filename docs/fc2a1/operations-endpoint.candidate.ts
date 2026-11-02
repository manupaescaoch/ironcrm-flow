// NOT DEPLOYED. Candidate lives outside function entrypoints until explicit production approval.
import { createClient } from 'npm:@supabase/supabase-js@2';
import {handleExperimentalOperation} from '../../supabase/functions/_shared/experimentalOperations.ts';
const url=Deno.env.get('SUPABASE_URL');const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if(import.meta.main&&url&&key){
 const admin=createClient(url,key,{auth:{persistSession:false}});
 Deno.serve(req=>handleExperimentalOperation(req,{
  authenticate:async token=>{const {data,error}=await admin.auth.getUser(token);return error?null:data.user;},
  allowed:async(actor,unit)=>{
   const [roles,links]=await Promise.all([admin.from('user_roles').select('role').eq('user_id',actor),admin.from('user_unidades').select('unidade_id').eq('user_id',actor).eq('unidade_id',unit)]);
   if(roles.error||links.error)throw new Error('Permission lookup failed');
   return roles.data?.some(r=>r.role==='admin')===true||(links.data?.length??0)>0;
  },
  execute:async(actor,command)=>{const {data,error}=await admin.rpc('experimental_operar',{p_usuario:actor,p_comando:command});if(error)throw error;return data;},
 }));
}