import { createClient } from 'npm:@supabase/supabase-js@2';
import { authorizeCronOnly, type AuthResult } from './cronAuth.ts';

export class ScopeError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const normalize = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();

export async function authorizeApp(req: Request, roles: string[], allowCron: boolean): Promise<AuthResult> {
  if (allowCron) {
    const cron = authorizeCronOnly(req);
    if (cron.ok) return cron;
  }
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return {ok:false,status:401,error:'Unauthorized'};
  try {
    const client = createClient(Deno.env.get('SUPABASE_URL') ?? '',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data,error } = await client.auth.getClaims(header.slice(7));
    if (error || !data?.claims?.sub || data.claims.role !== 'authenticated') return {ok:false,status:401,error:'Unauthorized'};
    for (const role of roles) {
      const result = await client.rpc('has_role',{_user_id:data.claims.sub,_role:role});
      if (!result.error && result.data === true) return {ok:true,method:'jwt',userId:data.claims.sub};
    }
    return {ok:false,status:403,error:'Forbidden'};
  } catch { return {ok:false,status:401,error:'Unauthorized'}; }
}

export async function requireUnit(client: any, auth: AuthResult, unit: unknown): Promise<void> {
  if (!uuid(unit)) throw new ScopeError(403,'Unidade não autorizada');
  if (auth.method === 'cron') return;
  if (!auth.userId) throw new ScopeError(401,'Unauthorized');
  const admin = await client.rpc('has_role',{_user_id:auth.userId,_role:'admin'});
  if (admin.error) throw new ScopeError(403,'Não foi possível validar permissões');
  if (admin.data === true) return;
  const result = await client.from('user_unidades').select('unidade_id').eq('user_id',auth.userId).eq('unidade_id',unit);
  if (result.error || !result.data?.length) throw new ScopeError(403,'Unidade não autorizada');
}

/** Bind ID-less legacy routine callers to one exact persisted routine, never a fuzzy unit/name. */
export async function notificationRecord(client: any, auth: AuthResult, body: any, routine: boolean): Promise<any> {
  if (uuid(body.task_id)) {
    const result = await client.from('tasks').select('*').eq('id',body.task_id).maybeSingle();
    if (result.error || !result.data) throw new ScopeError(404,'Recurso indisponível');
    await requireUnit(client,auth,result.data.unidade_id);
    return result.data;
  }
  if (!routine) throw new ScopeError(400,'task_id inválido');
  const units = await client.from('unidades').select('id,nome');
  const matching = (units.data ?? []).filter((u:any)=>normalize(u.nome)===normalize(body.unidade_nome));
  if (units.error || matching.length !== 1) throw new ScopeError(403,'Unidade não autorizada');
  const unit = matching[0].id;
  await requireUnit(client,auth,unit);
  const rows = await client.from('rotinas').select('*').eq('unidade_id',unit).eq('nome',body.task_title ?? body.taskTitle).eq('ativo',true);
  if (rows.error || rows.data?.length !== 1) throw new ScopeError(409,'Rotina não identificada de forma única');
  const row = rows.data[0];
  const activities = await client.from('rotina_atividades').select('responsavel').eq('rotina_id',row.id);
  if (activities.error) throw new ScopeError(403,'Responsável não autorizado');
  const target = normalize(body.responsavel_name ?? body.responsavel);
  if (![row.responsavel_principal,...(activities.data ?? []).map((a:any)=>a.responsavel)].some(v=>normalize(v)===target)) throw new ScopeError(403,'Responsável não autorizado');
  return {...row,titulo:row.nome,responsavel:body.responsavel_name ?? body.responsavel,prazo:null,hora_prazo:null};
}

export async function requireRecipientUnit(client: any, unit: string, user: string): Promise<void> {
  const result = await client.from('user_unidades').select('unidade_id').eq('user_id',user).eq('unidade_id',unit);
  if (result.error || !result.data?.length) throw new ScopeError(403,'Responsável sem vínculo com a unidade');
}